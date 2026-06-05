import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { EventsService } from '../events/events.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';

@Injectable()
export class TicketTiersService {
  private readonly logger = new Logger(TicketTiersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly events: EventsService,
  ) {}

  /** Map a DTO to a database row */
  private mapDtoToRow(eventId: string, dto: CreateTierDto) {
    return {
      event_id: eventId,
      tier_index: dto.tierIndex,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      price_wei: dto.priceWei,
      currency: dto.currency ?? 'MATIC',
      max_supply: dto.maxSupply,
      resale_allowed: dto.resaleAllowed ?? true,
      start_time: dto.startTime,
      end_time: dto.endTime,
      max_per_wallet: dto.maxPerWallet ?? 0,
      merkle_root: dto.merkleRoot,
      max_resales: dto.maxResales ?? 0,
      max_price_deviation_bps: dto.maxPriceDeviationBps ?? 0,
      active: dto.active ?? true,
    };
  }

  /** Verify event ownership */
  private async verifyOwnership(eventId: string, organizerId: string) {
    const event = await this.events.findById(eventId);
    if (event.organizer_id !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }
    return event;
  }

  /** Create a tier for an event */
  async create(eventId: string, organizerId: string, dto: CreateTierDto) {
    await this.verifyOwnership(eventId, organizerId);

    const { data, error } = await this.supabase.admin
      .from('ticket_tiers')
      .insert(this.mapDtoToRow(eventId, dto))
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /** Batch-create tiers for an event */
  async createBatch(eventId: string, organizerId: string, tiers: CreateTierDto[]) {
    await this.verifyOwnership(eventId, organizerId);

    const rows = tiers.map((dto) => this.mapDtoToRow(eventId, dto));

    const { data, error } = await this.supabase.admin
      .from('ticket_tiers')
      .insert(rows)
      .select('*');

    if (error) throw error;
    return data;
  }

  /** Get all tiers for an event */
  async findByEvent(eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('ticket_tiers')
      .select('*')
      .eq('event_id', eventId)
      .order('tier_index', { ascending: true });

    if (error) throw error;
    return data;
  }

  /** Get tier availability view */
  async getAvailability(eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('tier_availability')
      .select('*')
      .eq('event_id', eventId);

    if (error) throw error;
    return data;
  }

  /** Update a tier */
  async update(tierId: string, organizerId: string, dto: UpdateTierDto) {
    const { data: tier } = await this.supabase.admin
      .from('ticket_tiers')
      .select('*, events!inner(organizer_id)')
      .eq('id', tierId)
      .single();

    if (!tier) throw new NotFoundException('Tier not found');
    if ((tier as any).events.organizer_id !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', price: 'price',
      priceWei: 'price_wei', maxSupply: 'max_supply', resaleAllowed: 'resale_allowed',
      startTime: 'start_time', endTime: 'end_time', maxPerWallet: 'max_per_wallet',
      merkleRoot: 'merkle_root', maxResales: 'max_resales',
      maxPriceDeviationBps: 'max_price_deviation_bps', active: 'active',
    };

    const updateData: Record<string, any> = {};
    for (const [dtoKey, dbKey] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) updateData[dbKey] = (dto as any)[dtoKey];
    }

    const { data, error } = await this.supabase.admin
      .from('ticket_tiers')
      .update(updateData)
      .eq('id', tierId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /** Increment minted count atomically */
  async incrementMinted(tierId: string, count = 1) {
    // Atomic increment using Supabase RPC — if the function doesn't exist, fall back
    try {
      const { data, error } = await this.supabase.admin.rpc('increment_tier_minted', {
        p_tier_id: tierId,
        p_count: count,
      });
      if (!error) return data;
      this.logger.warn(`RPC increment_tier_minted not available, using fallback: ${error.message}`);
    } catch {
      // RPC not available, use fallback
    }

    // Fallback: read + write (not perfectly atomic but functional)
    const { data: tier } = await this.supabase.admin
      .from('ticket_tiers')
      .select('minted')
      .eq('id', tierId)
      .single();

    if (!tier) throw new NotFoundException('Tier not found');

    const { data, error } = await this.supabase.admin
      .from('ticket_tiers')
      .update({ minted: tier.minted + count })
      .eq('id', tierId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}
