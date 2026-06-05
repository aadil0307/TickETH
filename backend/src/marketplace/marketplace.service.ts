import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TicketsService } from '../tickets/tickets.service';
import { AuditService } from '../audit/audit.service';
import {
  TicketStatus,
  ListingStatus,
  AuditAction,
} from '../common/enums';
import { CreateListingDto } from './dto/create-listing.dto';
import { CompleteSaleDto } from './dto/complete-sale.dto';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly tickets: TicketsService,
    private readonly audit: AuditService,
  ) {}

  // ─── List a ticket for resale ─────────────────────────────

  async createListing(dto: CreateListingDto) {
    // Verify the ticket exists and is in a listable state
    const ticket = await this.tickets.findById(dto.ticketId);
    if (!ticket) throw new NotFoundException('Ticket not found');

    const unlistableStatuses = [TicketStatus.CHECKED_IN, TicketStatus.INVALIDATED, TicketStatus.LISTED];
    if (unlistableStatuses.includes(ticket.status as TicketStatus)) {
      throw new BadRequestException(`Ticket with status '${ticket.status}' cannot be listed`);
    }

    const { event_id: eventId, tier_id: tierId, contract_address: contractAddress, token_id: tokenId, owner_wallet: sellerWallet } = ticket;

    // Fetch tier and event in parallel
    const [tierResult, eventResult] = await Promise.all([
      this.supabase.admin
        .from('ticket_tiers')
        .select('resale_allowed, max_resales, max_price_deviation_bps, price, price_wei')
        .eq('id', tierId)
        .single(),
      this.supabase.admin
        .from('events')
        .select('start_time')
        .eq('id', eventId)
        .single(),
    ]);

    const tier = tierResult.data;
    if (!tier) throw new NotFoundException('Tier not found');
    if (!tier.resale_allowed) {
      throw new BadRequestException('Resale is not allowed for this tier');
    }
    if (tier.max_resales > 0 && ticket.transfer_count >= tier.max_resales) {
      throw new BadRequestException(`Resale limit reached (${tier.max_resales} max)`);
    }

    const event = eventResult.data;
    if (event?.start_time && new Date(event.start_time) <= new Date()) {
      throw new BadRequestException('Cannot list tickets for events that have already started');
    }

    // Resolve prices
    const askingPrice = dto.askingPrice ?? 0;
    const originalPrice = tier.price ?? 0;
    const originalPriceWei = tier.price_wei ?? '0';

    // Check price deviation cap
    if (tier.max_price_deviation_bps > 0 && originalPriceWei !== '0') {
      const asking = BigInt(dto.askingPriceWei);
      const original = BigInt(originalPriceWei);
      const deviationBps = BigInt(tier.max_price_deviation_bps);
      const minPrice = original - (original * deviationBps) / 10000n;
      const maxPrice = original + (original * deviationBps) / 10000n;

      if (asking < minPrice || asking > maxPrice) {
        throw new BadRequestException(
          `Asking price must be within ${tier.max_price_deviation_bps / 100}% of original price`,
        );
      }
    }

    // Create the listing
    const { data: listing, error } = await this.supabase.admin
      .from('marketplace_listings')
      .insert({
        ticket_id: dto.ticketId,
        event_id: eventId,
        tier_id: tierId,
        seller_wallet: sellerWallet.toLowerCase(),
        contract_address: contractAddress.toLowerCase(),
        token_id: tokenId,
        asking_price: askingPrice,
        asking_price_wei: dto.askingPriceWei,
        original_price: originalPrice,
        original_price_wei: originalPriceWei,
        status: ListingStatus.ACTIVE,
        listing_tx_hash: dto.listingTxHash,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Update ticket status to 'listed'
    await this.supabase.admin
      .from('tickets')
      .update({ status: TicketStatus.LISTED })
      .eq('id', dto.ticketId);

    await this.audit.log({
      actorWallet: sellerWallet.toLowerCase(),
      action: AuditAction.TICKET_LISTED,
      entityType: 'marketplace_listing',
      entityId: listing.id,
      details: {
        ticket_id: dto.ticketId,
        token_id: tokenId,
        asking_price_wei: dto.askingPriceWei,
        event_id: eventId,
      },
    });

    this.logger.log(
      `Ticket listed: ${tokenId} on ${contractAddress} for ${dto.askingPriceWei} wei`,
    );

    return listing;
  }

  // ─── Complete a sale ──────────────────────────────────────

  async completeSale(dto: CompleteSaleDto) {
    const listing = await this.findListingById(dto.listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not active');
    }

    // Atomically claim the listing (prevents double-sale via optimistic lock)
    const { data: updatedListing, error: listingError } = await this.supabase.admin
      .from('marketplace_listings')
      .update({
        status: ListingStatus.SOLD,
        sold_at: new Date().toISOString(),
        buyer_wallet: dto.buyerWallet.toLowerCase(),
        sale_tx_hash: dto.txHash,
        platform_fee_wei: dto.platformFeeWei ?? '0',
        seller_proceeds_wei: dto.sellerProceedsWei ?? '0',
      })
      .eq('id', dto.listingId)
      .eq('status', ListingStatus.ACTIVE) // Optimistic lock — only update if still active
      .select('*')
      .single();

    if (listingError || !updatedListing) {
      throw new BadRequestException('Listing already sold or cancelled');
    }

    const resaleNumber = (listing.tickets?.transfer_count ?? 0) + 1;

    // Update ticket and create resale history
    const [ticketResult, historyResult] = await Promise.all([
      this.supabase.admin
        .from('tickets')
        .update({
          owner_wallet: dto.buyerWallet.toLowerCase(),
          status: TicketStatus.TRANSFERRED,
          transferred_at: new Date().toISOString(),
          transfer_count: resaleNumber,
        })
        .eq('id', listing.ticket_id),
      this.supabase.admin
        .from('resale_history')
        .insert({
          listing_id: dto.listingId,
          ticket_id: listing.ticket_id,
          event_id: listing.event_id,
          token_id: listing.token_id,
          contract_address: listing.contract_address,
          seller_wallet: listing.seller_wallet,
          buyer_wallet: dto.buyerWallet.toLowerCase(),
          sale_price_wei: listing.asking_price_wei,
          original_price_wei: listing.original_price_wei,
          platform_fee_wei: dto.platformFeeWei ?? '0',
          seller_proceeds_wei: dto.sellerProceedsWei ?? '0',
          resale_number: resaleNumber,
          tx_hash: dto.txHash,
        }),
    ]);

    if (ticketResult.error) {
      this.logger.error(`Failed to update ticket after sale: ${ticketResult.error.message}`);
    }
    if (historyResult.error) {
      this.logger.error(`Failed to create resale history: ${historyResult.error.message}`);
    }

    await this.audit.log({
      actorWallet: dto.buyerWallet.toLowerCase(),
      action: AuditAction.TICKET_RESOLD,
      entityType: 'marketplace_listing',
      entityId: dto.listingId,
      details: {
        ticket_id: listing.ticket_id,
        token_id: listing.token_id,
        seller: listing.seller_wallet,
        buyer: dto.buyerWallet.toLowerCase(),
        sale_price_wei: listing.asking_price_wei,
        resale_number: resaleNumber,
        tx_hash: dto.txHash,
      },
    });

    this.logger.log(
      `Ticket sold: listing ${dto.listingId}, token ${listing.token_id} → ${dto.buyerWallet}`,
    );

    return updatedListing;
  }

  // ─── Cancel a listing ─────────────────────────────────────

  async cancelListing(listingId: string, cancellerWallet: string) {
    const listing = await this.findListingById(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not active');
    }

    // Update listing status
    const { data, error } = await this.supabase.admin
      .from('marketplace_listings')
      .update({
        status: ListingStatus.CANCELLED,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', listingId)
      .select('*')
      .single();

    if (error) throw error;

    // Revert ticket status back to minted/transferred
    await this.supabase.admin
      .from('tickets')
      .update({ status: TicketStatus.MINTED })
      .eq('id', listing.ticket_id);

    await this.audit.log({
      actorWallet: cancellerWallet.toLowerCase(),
      action: AuditAction.LISTING_CANCELLED,
      entityType: 'marketplace_listing',
      entityId: listingId,
      details: {
        ticket_id: listing.ticket_id,
        token_id: listing.token_id,
      },
    });

    this.logger.log(`Listing cancelled: ${listingId}`);
    return data;
  }

  // ─── Browse active listings ───────────────────────────────

  async findActiveListings(eventId?: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.admin
      .from('marketplace_listings')
      .select(
        '*, events(title, start_time, venue), ticket_tiers(name, max_resales, max_price_deviation_bps), tickets(transfer_count)',
        { count: 'exact' },
      )
      .eq('status', ListingStatus.ACTIVE)
      .order('listed_at', { ascending: false })
      .range(from, to);

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  }

  // ─── Browse listings by seller ────────────────────────────

  async findBySellerWallet(wallet: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('marketplace_listings')
      .select('*, events(title, start_time, venue), ticket_tiers(name)', { count: 'exact' })
      .eq('seller_wallet', wallet.toLowerCase())
      .order('listed_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  }

  // ─── Get single listing ──────────────────────────────────

  async findListingById(id: string) {
    const { data, error } = await this.supabase.admin
      .from('marketplace_listings')
      .select('*, events(title, start_time, venue), ticket_tiers(name, max_resales, max_price_deviation_bps)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Listing not found');
    return data;
  }

  // ─── Get resale history for a ticket ──────────────────────

  async getResaleHistory(ticketId: string) {
    const { data, error } = await this.supabase.admin
      .from('resale_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('resale_number', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  // ─── Marketplace stats for an event ───────────────────────

  async getEventMarketplaceStats(eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('marketplace_stats')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (error) throw error;
    return data;
  }
}
