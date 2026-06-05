import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TicketTiersService } from '../ticket-tiers/ticket-tiers.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatus, AuditAction } from '../common/enums';

interface MintReconciliationData {
  contractAddress: string;
  txHash: string;
  queuedAt: number;
  eventId?: string;
}

const TICKET_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event TicketMinted(address indexed to, uint256 indexed tokenId, uint256 indexed tierId, uint256 pricePaid, uint256 platformFee)',
];

/**
 * BullMQ processor for mint reconciliation.
 * Fetches transaction receipt from chain, parses Transfer/TicketMinted events,
 * and upserts ticket records in the database.
 */
@Processor('mint-reconciliation', {
  concurrency: 3,
  limiter: { max: 10, duration: 60_000 },
})
export class MintProcessor extends WorkerHost {
  private readonly logger = new Logger(MintProcessor.name);
  private provider!: ethers.JsonRpcProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly tiers: TicketTiersService,
    private readonly audit: AuditService,
  ) {
    super();
  }

  onModuleInit() {
    const chainId = this.config.get<number>('CHAIN_ID', 80002);
    const rpcUrl =
      chainId === 137
        ? this.config.get<string>('POLYGON_MAINNET_RPC_URL')
        : this.config.get<string>('POLYGON_AMOY_RPC_URL');

    if (rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
  }

  async process(job: Job<MintReconciliationData>) {
    const { contractAddress, txHash, eventId } = job.data;
    this.logger.log(`Processing mint reconciliation: tx=${txHash} contract=${contractAddress}`);

    if (!this.provider) {
      throw new Error('No blockchain provider configured');
    }

    // 1. Fetch transaction receipt
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error(`Transaction receipt not found for ${txHash}. Will retry.`);
    }

    if (receipt.status === 0) {
      this.logger.warn(`Transaction ${txHash} failed (reverted)`);
      return { success: false, reason: 'transaction_reverted' };
    }

    // 2. Parse logs for Transfer and TicketMinted events
    const iface = new ethers.Interface(TICKET_ABI);
    const ZERO = '0x0000000000000000000000000000000000000000';
    const mints: Array<{
      tokenId: number;
      to: string;
      tierIndex?: number;
      price?: bigint;
    }> = [];

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;

      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) continue;

        if (parsed.name === 'TicketMinted') {
          mints.push({
            tokenId: Number(parsed.args[1]),
            to: parsed.args[0] as string,
            tierIndex: Number(parsed.args[2]),
            price: parsed.args[3] as bigint,
          });
        } else if (parsed.name === 'Transfer' && parsed.args[0] === ZERO) {
          const tokenId = Number(parsed.args[2]);
          if (!mints.some((m) => m.tokenId === tokenId)) {
            mints.push({
              tokenId,
              to: parsed.args[1] as string,
            });
          }
        }
      } catch {
        // Not a matching event
      }
    }

    if (mints.length === 0) {
      this.logger.warn(`No mint events found in tx ${txHash}`);
      return { success: true, mintsFound: 0 };
    }

    // 3. Upsert each minted ticket
    let recorded = 0;
    for (const mint of mints) {
      try {
        // Check if already exists
        const { data: existing } = await this.supabase.admin
          .from('tickets')
          .select('id')
          .eq('contract_address', contractAddress.toLowerCase())
          .eq('token_id', mint.tokenId)
          .maybeSingle();

        if (existing) {
          this.logger.debug(`Token ${mint.tokenId} already recorded — skipping`);
          continue;
        }

        // Resolve tier ID from DB
        let tierId: string | null = null;
        if (mint.tierIndex !== undefined && eventId) {
          const { data: tierRows } = await this.supabase.admin
            .from('ticket_tiers')
            .select('id')
            .eq('event_id', eventId)
            .eq('tier_index', mint.tierIndex)
            .limit(1);

          tierId = tierRows?.[0]?.id ?? null;
        }

        // Resolve eventId from contract if not provided
        let resolvedEventId = eventId;
        if (!resolvedEventId) {
          const { data: eventRow } = await this.supabase.admin
            .from('events')
            .select('id')
            .eq('contract_address', contractAddress.toLowerCase())
            .maybeSingle();
          resolvedEventId = eventRow?.id;
        }

        if (!resolvedEventId) {
          this.logger.warn(
            `Cannot resolve eventId for ${contractAddress} — skipping token ${mint.tokenId}`,
          );
          continue;
        }

        // Insert ticket
        const { data: ticket, error } = await this.supabase.admin
          .from('tickets')
          .insert({
            token_id: mint.tokenId,
            contract_address: contractAddress.toLowerCase(),
            event_id: resolvedEventId,
            tier_id: tierId,
            owner_wallet: mint.to.toLowerCase(),
            original_wallet: mint.to.toLowerCase(),
            status: TicketStatus.MINTED,
            tx_hash: txHash,
          })
          .select('id')
          .single();

        if (error) {
          this.logger.error(`DB insert failed for token ${mint.tokenId}: ${error.message}`);
          continue;
        }

        // Increment tier minted count
        if (tierId) {
          await this.tiers.incrementMinted(tierId);
        }

        await this.audit.log({
          actorWallet: mint.to.toLowerCase(),
          action: AuditAction.TICKET_MINTED,
          entityType: 'ticket',
          entityId: ticket.id,
          details: {
            source: 'mint_reconciliation',
            token_id: mint.tokenId,
            tier_index: mint.tierIndex,
            tx_hash: txHash,
          },
        });

        recorded++;
      } catch (err) {
        this.logger.error(
          `Error processing token ${mint.tokenId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Mint reconciliation complete: tx=${txHash}, mints=${mints.length}, recorded=${recorded}`,
    );

    return { success: true, mintsFound: mints.length, recorded };
  }
}
