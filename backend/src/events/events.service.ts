import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { EventStatus, AuditAction } from '../common/enums';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Create a new event */
  async create(organizerId: string, organizerWallet: string, dto: CreateEventDto) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .insert({
        organizer_id: organizerId,
        title: dto.title,
        description: dto.description,
        banner_url: dto.bannerUrl,
        venue: dto.venue,
        venue_address: dto.venueAddress,
        city: dto.city,
        country: dto.country ?? 'India',
        start_time: dto.startTime,
        end_time: dto.endTime,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        chain_id: dto.chainId ?? 80002,
        max_capacity: dto.maxCapacity,
        status: EventStatus.DRAFT,
      })
      .select('*')
      .single();

    if (error) throw error;

    await this.audit.log({
      actorId: organizerId,
      actorWallet: organizerWallet,
      action: AuditAction.EVENT_CREATED,
      entityType: 'event',
      entityId: data.id,
      details: { title: dto.title },
    });

    return data;
  }

  /** Get a single event by ID (includes tiers + organizer) */
  async findById(id: string) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .select('*, tiers:ticket_tiers(*), organizer:users!organizer_id(id, wallet_address, display_name, avatar_url, role)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Event not found');
    return data;
  }

  /** List public events (published, live, completed) */
  async findPublic(page = 1, limit = 20, city?: string, search?: string) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.admin
      .from('events')
      .select('*, tiers:ticket_tiers(*)', { count: 'exact' })
      .in('status', [EventStatus.PUBLISHED, EventStatus.LIVE, EventStatus.COMPLETED])
      .order('start_time', { ascending: true })
      .range(from, to);

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,venue.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
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

  /** List events by organizer */
  async findByOrganizer(organizerId: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('events')
      .select('*, tiers:ticket_tiers(*)', { count: 'exact' })
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
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

  /** Update an event */
  async update(
    eventId: string,
    organizerId: string,
    dto: UpdateEventDto,
  ) {
    // Verify ownership
    const event = await this.findById(eventId);
    if (event.organizer_id !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      bannerUrl: 'banner_url',
      venue: 'venue',
      venueAddress: 'venue_address',
      city: 'city',
      country: 'country',
      startTime: 'start_time',
      endTime: 'end_time',
      maxCapacity: 'max_capacity',
    };

    const updateData: Record<string, any> = {};
    for (const [dtoKey, dbKey] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) {
        updateData[dbKey] = (dto as any)[dtoKey];
      }
    }

    const { data, error } = await this.supabase.admin
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /** Publish an event (draft → published) */
  async publish(eventId: string, organizerId: string, organizerWallet: string) {
    const event = await this.findById(eventId);
    if (event.organizer_id !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }
    if (event.status !== EventStatus.DRAFT) {
      throw new ForbiddenException('Only draft events can be published');
    }

    const { data, error } = await this.supabase.admin
      .from('events')
      .update({ status: EventStatus.PUBLISHED })
      .eq('id', eventId)
      .select('*')
      .single();

    if (error) throw error;

    await this.audit.log({
      actorId: organizerId,
      actorWallet: organizerWallet,
      action: AuditAction.EVENT_PUBLISHED,
      entityType: 'event',
      entityId: eventId,
      details: { title: event.title },
    });

    return data;
  }

  /** Cancel an event */
  async cancel(eventId: string, organizerId: string, organizerWallet: string) {
    const event = await this.findById(eventId);
    if (event.organizer_id !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    const { data, error } = await this.supabase.admin
      .from('events')
      .update({ status: EventStatus.CANCELLED })
      .eq('id', eventId)
      .select('*')
      .single();

    if (error) throw error;

    await this.audit.log({
      actorId: organizerId,
      actorWallet: organizerWallet,
      action: AuditAction.EVENT_CANCELLED,
      entityType: 'event',
      entityId: eventId,
      details: { title: event.title },
    });

    return data;
  }

  /** Set contract address after on-chain deployment */
  async setContractAddress(
    eventId: string,
    contractAddress: string,
    factoryAddress?: string,
  ) {
    const { data, error } = await this.supabase.admin
      .from('events')
      .update({
        contract_address: contractAddress.toLowerCase(),
        factory_address: factoryAddress?.toLowerCase(),
        status: EventStatus.PUBLISHED,
      })
      .eq('id', eventId)
      .select('*')
      .single();

    if (error) throw error;

    this.logger.log(`Event ${eventId} deployed and published (contract: ${contractAddress})`);
    return data;
  }

  /** Soft-delete an event (admin or event owner) */
  async delete(
    eventId: string,
    userId: string,
    userWallet: string,
    userRole: string,
  ) {
    const event = await this.findById(eventId);

    // Only the event owner or an admin can delete
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    if (event.organizer_id !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this event');
    }

    // Prevent deleting events that have minted tickets
    const { count, error: ticketErr } = await this.supabase.admin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (ticketErr) throw ticketErr;
    if ((count ?? 0) > 0) {
      throw new ForbiddenException(
        'Cannot delete an event that has minted tickets. Cancel it instead.',
      );
    }

    // Delete related tiers first
    const { error: tierErr } = await this.supabase.admin
      .from('ticket_tiers')
      .delete()
      .eq('event_id', eventId);

    if (tierErr) {
      this.logger.error(`Failed to delete tiers for event ${eventId}`, tierErr);
      throw tierErr;
    }

    // Delete the event record
    const { error } = await this.supabase.admin
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    await this.audit.log({
      actorId: userId,
      actorWallet: userWallet,
      action: AuditAction.EVENT_DELETED,
      entityType: 'event',
      entityId: eventId,
      details: { title: event.title, deletedBy: isAdmin ? 'admin' : 'organizer' },
    });

    this.logger.log(`Event ${eventId} ("${event.title}") deleted by ${isAdmin ? 'admin' : 'organizer'} ${userId}`);
    return { success: true, message: 'Event deleted successfully' };
  }

  /** Get event stats (for organizer dashboard) */
  async getStats(eventId: string) {
    const { data, error } = await this.supabase.admin
      .from('event_stats')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (error) throw error;
    return data;
  }
}
