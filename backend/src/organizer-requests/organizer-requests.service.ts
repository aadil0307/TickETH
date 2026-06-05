import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { RequestStatus, UserRole, AuditAction } from '../common/enums';
import { SubmitRequestDto } from './dto/submit-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';

@Injectable()
export class OrganizerRequestsService {
  private readonly logger = new Logger(OrganizerRequestsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** Submit a new organizer request */
  async submit(userId: string, wallet: string, dto: SubmitRequestDto) {
    // Check for existing pending request
    const { data: existing } = await this.supabase.admin
      .from('organizer_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', RequestStatus.PENDING)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('You already have a pending organizer request');
    }

    const { data, error } = await this.supabase.admin
      .from('organizer_requests')
      .insert({
        user_id: userId,
        wallet_address: wallet,
        org_name: dto.orgName,
        bio: dto.bio,
        website: dto.website,
        social_links: dto.socialLinks ?? {},
      })
      .select('*')
      .single();

    if (error) throw error;

    await this.audit.log({
      actorId: userId,
      actorWallet: wallet,
      action: AuditAction.ORGANIZER_REQUEST_SUBMITTED,
      entityType: 'organizer_request',
      entityId: data.id,
      details: { org_name: dto.orgName },
    });

    return data;
  }

  /** Get all requests for a user */
  async findByUser(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('organizer_requests')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /** Get all pending requests (admin) */
  async findPending(page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('organizer_requests')
      .select('*, users!organizer_requests_user_id_fkey(display_name, email)', { count: 'exact' })
      .eq('status', RequestStatus.PENDING)
      .order('submitted_at', { ascending: true })
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

  /** Get all requests (admin) */
  async findAll(page = 1, limit = 20, status?: RequestStatus) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.admin
      .from('organizer_requests')
      .select('*, users!organizer_requests_user_id_fkey(display_name, email)', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
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

  /** Approve or reject a request (admin) — uses optimistic lock on status */
  async review(
    requestId: string,
    adminId: string,
    adminWallet: string,
    dto: ReviewRequestDto,
  ) {
    const newStatus = dto.approved ? RequestStatus.APPROVED : RequestStatus.REJECTED;

    // Atomically update only if still pending (prevents race condition)
    const { data, error } = await this.supabase.admin
      .from('organizer_requests')
      .update({
        status: newStatus,
        rejection_reason: dto.approved ? null : dto.rejectionReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      })
      .eq('id', requestId)
      .eq('status', RequestStatus.PENDING) // Optimistic lock
      .select('*')
      .single();

    if (error || !data) {
      throw new ConflictException('Request not found or already reviewed');
    }

    // If approved, upgrade user role
    if (dto.approved) {
      await this.users.updateRole(data.user_id, UserRole.ORGANIZER);
    }

    await this.audit.log({
      actorId: adminId,
      actorWallet: adminWallet,
      action: dto.approved
        ? AuditAction.ORGANIZER_REQUEST_APPROVED
        : AuditAction.ORGANIZER_REQUEST_REJECTED,
      entityType: 'organizer_request',
      entityId: requestId,
      details: {
        org_name: data.org_name,
        rejection_reason: dto.rejectionReason,
      },
    });

    this.logger.log(
      `Request ${requestId} ${dto.approved ? 'approved' : 'rejected'} by admin ${adminId}`,
    );

    return data;
  }
}
