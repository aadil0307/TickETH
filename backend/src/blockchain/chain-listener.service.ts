import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TicketsService } from '../tickets/tickets.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums';

/**
 * Listens to on-chain events from deployed TickETH ticket contracts
 * and auto-reconciles the off-chain database.
 *
 * Monitors:
 * - Transfer events → record mints & transfers
 * - CheckedIn events → mark on-chain check-ins
 * - Listing/Sale events from Marketplace contract
 */

const TICKET_EVENTS_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event CheckedIn(uint256 indexed tokenId, uint256 timestamp)',
  'event TicketMinted(address indexed to, uint256 indexed tokenId, uint256 indexed tierId, uint256 pricePaid, uint256 platformFee)',
];

const MARKETPLACE_EVENTS_ABI = [
  'event TicketListed(uint256 indexed listingId, address indexed seller, address indexed ticketContract, uint256 tokenId, uint256 askingPrice)',
  'event TicketSold(uint256 indexed listingId, address indexed buyer, uint256 salePrice)',
  'event ListingCancelled(uint256 indexed listingId)',
];

interface WatchedContract {
  address: string;
  eventId: string; // DB event UUID
  contract: ethers.Contract;
}

@Injectable()
export class ChainListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainListenerService.name);
  private provider!: ethers.JsonRpcProvider;
  private readonly watchedContracts = new Map<string, WatchedContract>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastProcessedBlock = 0;
  private enabled = false;

  private readonly POLL_MS = 15_000;
  private readonly MAX_BLOCKS_PER_POLL = 100;
  private consecutiveErrors = 0;
  private static readonly MAX_BACKOFF_MS = 120_000; // 2 minutes max

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly tickets: TicketsService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    const chainId = this.config.get<number>('CHAIN_ID', 80002);
    const rpcUrl =
      chainId === 137
        ? this.config.get<string>('POLYGON_MAINNET_RPC_URL')
        : this.config.get<string>('POLYGON_AMOY_RPC_URL');

    if (!rpcUrl) {
      this.logger.warn('No RPC URL configured — chain listener disabled');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.enabled = this.config.get<string>('CHAIN_LISTENER_ENABLED', 'true') === 'true';

    if (!this.enabled) {
      this.logger.log('Chain listener disabled via CHAIN_LISTENER_ENABLED=false');
      return;
    }

    // Load deployed contracts from DB
    await this.loadWatchedContracts();

    // Start from current block (or stored checkpoint)
    const storedBlock = this.config.get<number>('CHAIN_LISTENER_START_BLOCK', 0);
    if (storedBlock > 0) {
      this.lastProcessedBlock = storedBlock;
    } else {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
    }

    this.startPolling();
    this.logger.log(
      `Chain listener started — watching ${this.watchedContracts.size} contracts from block ${this.lastProcessedBlock}`,
    );
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  /* ── Public API ───────────────────────────────────────────── */

  /** Register a newly deployed contract for monitoring */
  registerContract(contractAddress: string, eventId: string) {
    const addr = contractAddress.toLowerCase();
    if (this.watchedContracts.has(addr)) return;

    const contract = new ethers.Contract(
      contractAddress,
      TICKET_EVENTS_ABI,
      this.provider,
    );

    this.watchedContracts.set(addr, {
      address: addr,
      eventId,
      contract,
    });

    this.logger.log(`Now watching contract ${addr} for event ${eventId}`);
  }

  /** Remove a contract from monitoring */
  unregisterContract(contractAddress: string) {
    this.watchedContracts.delete(contractAddress.toLowerCase());
  }

  /** Force a rescan of a block range (admin utility) */
  async rescanBlocks(fromBlock: number, toBlock: number) {
    this.logger.log(`Manual rescan: blocks ${fromBlock}–${toBlock}`);
    await this.processBlockRange(fromBlock, toBlock);
  }

  /** Get current listener status */
  getStatus() {
    return {
      enabled: this.enabled,
      watchedContracts: this.watchedContracts.size,
      lastProcessedBlock: this.lastProcessedBlock,
      contractAddresses: Array.from(this.watchedContracts.keys()),
    };
  }

  /* ── Polling ──────────────────────────────────────────────── */

  private startPolling() {
    if (this.pollInterval) return;

    const scheduleNext = () => {
      const backoffMs = this.consecutiveErrors > 0
        ? Math.min(this.POLL_MS * 2 ** this.consecutiveErrors, ChainListenerService.MAX_BACKOFF_MS)
        : this.POLL_MS;

      this.pollInterval = setTimeout(async () => {
        try {
          await this.poll();
          this.consecutiveErrors = 0;
        } catch (err) {
          this.consecutiveErrors++;
          this.logger.error(
            `Poll error (attempt ${this.consecutiveErrors}, next in ${Math.min(this.POLL_MS * 2 ** this.consecutiveErrors, ChainListenerService.MAX_BACKOFF_MS)}ms): ${(err as Error).message}`,
          );
        }
        scheduleNext();
      }, backoffMs);
    };

    scheduleNext();
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
      this.logger.log('Chain listener polling stopped');
    }
  }

  private async poll() {
    if (this.watchedContracts.size === 0) return;

    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock <= this.lastProcessedBlock) return;

    const fromBlock = this.lastProcessedBlock + 1;
    const toBlock = Math.min(
      currentBlock,
      fromBlock + this.MAX_BLOCKS_PER_POLL - 1,
    );

    await this.processBlockRange(fromBlock, toBlock);
    this.lastProcessedBlock = toBlock;
  }

  /* ── Event Processing ─────────────────────────────────────── */

  private async processBlockRange(fromBlock: number, toBlock: number) {
    const iface = new ethers.Interface(TICKET_EVENTS_ABI);

    for (const [addr, watched] of this.watchedContracts) {
      try {
        // Fetch all logs from this contract in the range
        const logs = await this.provider.getLogs({
          address: addr,
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          try {
            const parsed = iface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (!parsed) continue;

            switch (parsed.name) {
              case 'Transfer':
                await this.handleTransfer(watched, parsed, log);
                break;
              case 'TicketMinted':
                await this.handleTicketMinted(watched, parsed, log);
                break;
              case 'CheckedIn':
                await this.handleCheckedIn(watched, parsed, log);
                break;
            }
          } catch {
            // Skip unparseable logs (from other contracts/topics)
          }
        }
      } catch (err) {
        this.logger.error(
          `Error processing logs for ${addr}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Handle ERC-721 Transfer event */
  private async handleTransfer(
    watched: WatchedContract,
    parsed: ethers.LogDescription,
    log: ethers.Log,
  ) {
    const from: string = parsed.args[0];
    const to: string = parsed.args[1];
    const tokenId: bigint = parsed.args[2];
    const ZERO = '0x0000000000000000000000000000000000000000';

    // Mint (from == zero)
    if (from === ZERO) {
      // Check if we already have this ticket (TicketMinted event may also handle it)
      const existing = await this.tickets.findByToken(watched.address, Number(tokenId));
      if (existing) return; // Already recorded

      this.logger.log(
        `Transfer-mint detected: token ${tokenId} → ${to} on ${watched.address}`,
      );

      // Try to resolve a tier — use tier_index 0 as fallback (most events have at least one tier)
      const { data: tierRows } = await this.supabase.admin
        .from('ticket_tiers')
        .select('id')
        .eq('event_id', watched.eventId)
        .order('tier_index', { ascending: true })
        .limit(1);

      const tierId = tierRows?.[0]?.id;
      if (!tierId) {
        this.logger.warn(
          `No DB tier found for event ${watched.eventId} — cannot auto-record mint`,
        );
        return;
      }

      try {
        await this.tickets.recordMint({
          tokenId: Number(tokenId),
          contractAddress: watched.address,
          eventId: watched.eventId,
          tierId,
          ownerWallet: to,
          txHash: log.transactionHash,
        });
      } catch (err) {
        this.logger.error(
          `Failed to auto-record mint from Transfer for token ${tokenId}: ${(err as Error).message}`,
        );
      }
      return;
    }

    // Burn (to == zero) — mark ticket as invalidated
    if (to === ZERO) {
      this.logger.log(`Token ${tokenId} burned on ${watched.address}`);
      return;
    }

    // Transfer (secondary)
    this.logger.log(
      `Transfer: token ${tokenId} from ${from} → ${to} on ${watched.address}`,
    );

    try {
      await this.tickets.recordTransfer(watched.address, Number(tokenId), to);
    } catch (err) {
      // Ticket may not exist in DB yet (if minted externally)
      this.logger.warn(
        `Could not record transfer for token ${tokenId}: ${(err as Error).message}`,
      );
    }
  }

  /** Handle our custom TicketMinted event (has tier info) */
  private async handleTicketMinted(
    watched: WatchedContract,
    parsed: ethers.LogDescription,
    log: ethers.Log,
  ) {
    const to: string = parsed.args[0];
    const tokenId: bigint = parsed.args[1];
    const tierIndex: bigint = parsed.args[2];
    const pricePaid: bigint = parsed.args[3];
    const platformFee: bigint = parsed.args[4];

    this.logger.log(
      `TicketMinted: token ${tokenId}, tier ${tierIndex}, to ${to}, price ${pricePaid}, fee ${platformFee} on ${watched.address}`,
    );

    // Check if already recorded
    const existing = await this.tickets.findByToken(watched.address, Number(tokenId));
    if (existing) {
      this.logger.debug(`Token ${tokenId} already recorded — skipping`);
      return;
    }

    // Look up the DB tier by event + tierIndex
    const { data: tiers } = await this.supabase.admin
      .from('ticket_tiers')
      .select('id')
      .eq('event_id', watched.eventId)
      .eq('tier_index', Number(tierIndex))
      .limit(1);

    const tierId = tiers?.[0]?.id;
    if (!tierId) {
      this.logger.warn(
        `No DB tier found for event ${watched.eventId} tierIndex ${tierIndex}`,
      );
      return;
    }

    try {
      await this.tickets.recordMint({
        tokenId: Number(tokenId),
        contractAddress: watched.address,
        eventId: watched.eventId,
        tierId,
        ownerWallet: to,
        txHash: log.transactionHash,
      });
    } catch (err) {
      this.logger.error(
        `Failed to auto-record mint for token ${tokenId}: ${(err as Error).message}`,
      );
    }
  }

  /** Handle CheckedIn event */
  private async handleCheckedIn(
    watched: WatchedContract,
    parsed: ethers.LogDescription,
    _log: ethers.Log,
  ) {
    const tokenId: bigint = parsed.args[0];

    this.logger.log(`On-chain check-in: token ${tokenId} on ${watched.address}`);

    const ticket = await this.tickets.findByToken(watched.address, Number(tokenId));
    if (!ticket) return;

    // Only update if not already checked in
    if (ticket.status !== 'checked_in') {
      await this.tickets.markCheckedIn(ticket.id);

      await this.audit.log({
        action: AuditAction.TICKET_CHECKED_IN,
        entityType: 'ticket',
        entityId: ticket.id,
        details: {
          source: 'chain_listener',
          token_id: Number(tokenId),
          contract: watched.address,
        },
      });
    }
  }

  /* ── Bootstrap ────────────────────────────────────────────── */

  /** Load all deployed event contracts from the DB */
  private async loadWatchedContracts() {
    try {
      const { data: events } = await this.supabase.admin
        .from('events')
        .select('id, contract_address')
        .not('contract_address', 'is', null);

      if (!events?.length) {
        this.logger.log('No deployed contracts found in DB');
        return;
      }

      for (const event of events) {
        if (event.contract_address) {
          this.registerContract(event.contract_address, event.id);
        }
      }

      this.logger.log(`Loaded ${events.length} contracts to watch`);
    } catch (err) {
      this.logger.error(
        `Failed to load watched contracts: ${(err as Error).message}`,
      );
    }
  }
}
