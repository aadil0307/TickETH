import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TicketTiersService } from '../ticket-tiers/ticket-tiers.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatus, AuditAction } from '../common/enums';
import { RecordMintDto } from './dto/record-mint.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly tiers: TicketTiersService,
    private readonly audit: AuditService,
    @Optional() @InjectQueue('mint-reconciliation') private readonly mintQueue?: Queue,
  ) {}

  /** Record a minted ticket (called after on-chain mint is confirmed) */
  async recordMint(dto: RecordMintDto) {
    // If tokenId not provided, queue reconciliation to resolve from chain
    if (!dto.tokenId && dto.txHash && dto.contractAddress) {
      await this.queueMintReconciliation(dto.contractAddress, dto.txHash);
      return { queued: true, txHash: dto.txHash };
    }

    // Validate minting time window: only allowed until event end time
    if (dto.eventId) {
      const { data: event } = await this.supabase.admin
        .from('events')
        .select('end_time')
        .eq('id', dto.eventId)
        .single();

      if (event?.end_time) {
        const endTime = new Date(event.end_time).getTime();
        if (Date.now() > endTime) {
          throw new BadRequestException(
            'Minting is no longer available. The event has ended.',
          );
        }
      }
    }

    // Upsert — atomically insert or return existing (prevents race condition)
    const { data, error } = await this.supabase.admin
      .from('tickets')
      .upsert(
        {
          token_id: dto.tokenId,
          contract_address: dto.contractAddress.toLowerCase(),
          event_id: dto.eventId,
          tier_id: dto.tierId,
          owner_wallet: dto.ownerWallet.toLowerCase(),
          original_wallet: dto.ownerWallet.toLowerCase(),
          status: TicketStatus.MINTED,
          tx_hash: dto.txHash,
          metadata_uri: dto.metadataUri,
        },
        { onConflict: 'contract_address,token_id', ignoreDuplicates: true },
      )
      .select('*')
      .single();

    if (error) {
      // If duplicate detected via constraint, fetch and return existing
      if (error.code === '23505') {
        const existing = await this.findByToken(dto.contractAddress, dto.tokenId!);
        if (existing) {
          this.logger.debug(`Token ${dto.tokenId} already recorded — skipping`);
          return existing;
        }
      }
      throw error;
    }

    // Increment minted count on tier
    await this.tiers.incrementMinted(dto.tierId);

    await this.audit.log({
      actorId: undefined,
      actorWallet: dto.ownerWallet.toLowerCase(),
      action: AuditAction.TICKET_MINTED,
      entityType: 'ticket',
      entityId: data.id,
      details: {
        token_id: dto.tokenId,
        event_id: dto.eventId,
        tx_hash: dto.txHash,
      },
    });

    this.logger.log(
      `Ticket minted: token ${dto.tokenId} on ${dto.contractAddress} for ${dto.ownerWallet}`,
    );

    return data;
  }

  /** Get tickets by owner wallet */
  async findByOwner(wallet: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('tickets')
      .select('*, events(title, start_time, venue, status), ticket_tiers(name, price)', { count: 'exact' })
      .eq('owner_wallet', wallet.toLowerCase())
      .order('minted_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const total = count ?? 0;
    return {
      data: data ?? [],
      total,
      page,
      limit,
      hasMore: from + limit < total,
    };
  }

  /** Get tickets for an event (organizer view) */
  async findByEvent(eventId: string, page = 1, limit = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('tickets')
      .select('*, ticket_tiers(name)', { count: 'exact' })
      .eq('event_id', eventId)
      .order('minted_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const total2 = count ?? 0;
    return {
      data: data ?? [],
      total: total2,
      page,
      limit,
      hasMore: from + limit < total2,
    };
  }

  /** Get a single ticket by ID */
  async findById(id: string) {
    const { data, error } = await this.supabase.admin
      .from('tickets')
      .select('*, events(title, start_time, venue, status), ticket_tiers(name, price)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Ticket not found');
    return data;
  }

  /** Find ticket by contract + tokenId (on-chain lookup) */
  async findByToken(contractAddress: string, tokenId: number) {
    const { data, error } = await this.supabase.admin
      .from('tickets')
      .select('*')
      .eq('contract_address', contractAddress.toLowerCase())
      .eq('token_id', tokenId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Update ticket owner (after on-chain transfer) */
  async recordTransfer(
    contractAddress: string,
    tokenId: number,
    newOwner: string,
  ) {
    const ticket = await this.findByToken(contractAddress, tokenId);
    if (!ticket) throw new NotFoundException('Ticket not found');

    const { data, error } = await this.supabase.admin
      .from('tickets')
      .update({
        owner_wallet: newOwner.toLowerCase(),
        status: TicketStatus.TRANSFERRED,
        transferred_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select('*')
      .single();

    if (error) throw error;

    await this.audit.log({
      actorWallet: newOwner.toLowerCase(),
      action: AuditAction.TICKET_TRANSFERRED,
      entityType: 'ticket',
      entityId: ticket.id,
      details: {
        token_id: tokenId,
        from: ticket.owner_wallet,
        to: newOwner.toLowerCase(),
      },
    });

    return data;
  }

  /** Mark ticket as checked in */
  async markCheckedIn(ticketId: string) {
    const { data, error } = await this.supabase.admin
      .from('tickets')
      .update({
        status: TicketStatus.CHECKED_IN,
        checked_in_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /** Queue a mint reconciliation job */
  async queueMintReconciliation(contractAddress: string, txHash: string) {
    if (!this.mintQueue) {
      this.logger.warn(
        `Mint reconciliation queue unavailable (Redis disabled); skipping enqueue for tx ${txHash}`,
      );
      return;
    }

    await this.mintQueue.add('reconcile', {
      contractAddress,
      txHash,
      queuedAt: Date.now(),
    });
    this.logger.log(`Queued mint reconciliation for tx ${txHash}`);
  }
}
