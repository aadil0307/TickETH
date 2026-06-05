import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { SupportTicketStatus, AuditAction, UserRole } from '../common/enums';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportReplyDto } from './dto/create-support-reply.dto';
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape',
};

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
  ) {}

  /* ─── FAQ ──────────────────────────────────────────────── */

  async listFaq() {
    const { data, error } = await this.supabase.admin
      .from('faq_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /* ─── User Tickets ─────────────────────────────────────── */

  async createTicket(userId: string, userWallet: string, dto: CreateSupportTicketDto) {
    const { data, error } = await this.supabase.admin
      .from('support_tickets')
      .insert({
        user_id: userId,
        category: sanitizeHtml(dto.category, SANITIZE_OPTS),
        subject: sanitizeHtml(dto.subject, SANITIZE_OPTS),
        message: sanitizeHtml(dto.message, SANITIZE_OPTS),
        status: SupportTicketStatus.OPEN,
      })
      .select('*')
      .single();

    if (error) throw error;

    await this.audit.log({
      actorId: userId,
      actorWallet: userWallet,
      action: AuditAction.ADMIN_ACTION,
      entityType: 'support_ticket',
      entityId: data.id,
      details: { subject: dto.subject },
    });

    this.logger.log(`Support ticket created: ${data.id} by ${userId}`);
    return data;
  }

  async getMyTickets(userId: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const total = count ?? 0;
    return { data: data ?? [], total, page, limit, hasMore: from + limit < total };
  }

  async getTicketById(ticketId: string, userId: string, userRole: string) {
    const { data, error } = await this.supabase.admin
      .from('support_tickets')
      .select('*, user:users!user_id(id, wallet_address, display_name, avatar_url, role)')
      .eq('id', ticketId)
      .single();

    if (error || !data) throw new NotFoundException('Support ticket not found');

    // Non-admin users can only see their own tickets
    if (data.user_id !== userId && userRole !== UserRole.ADMIN && userRole !== UserRole.ORGANIZER) {
      throw new ForbiddenException('Not authorized to view this ticket');
    }

    // Fetch replies
    const { data: replies, error: repliesError } = await this.supabase.admin
      .from('support_replies')
      .select('*, user:users!user_id(id, wallet_address, display_name, avatar_url, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (repliesError) throw repliesError;

    return { ...data, replies: replies ?? [] };
  }

  /* ─── Replies ──────────────────────────────────────────── */

  async addReply(
    ticketId: string,
    userId: string,
    userRole: string,
    dto: CreateSupportReplyDto,
  ) {
    // Verify ticket exists and user has access
    const ticket = await this.getTicketById(ticketId, userId, userRole);
    if (!ticket) throw new NotFoundException('Support ticket not found');

    const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.ORGANIZER;

    const { data, error } = await this.supabase.admin
      .from('support_replies')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        is_admin: isAdmin,
        message: sanitizeHtml(dto.message, SANITIZE_OPTS),
      })
      .select('*')
      .single();

    if (error) throw error;

    // Auto-update ticket status to in_progress when admin replies to an open ticket
    if (isAdmin && ticket.status === SupportTicketStatus.OPEN) {
      await this.updateTicketStatus(ticketId, SupportTicketStatus.IN_PROGRESS);
    }

    return data;
  }

  /* ─── Admin ────────────────────────────────────────────── */

  async listAllTickets(page = 1, limit = 20, status?: SupportTicketStatus) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.admin
      .from('support_tickets')
      .select('*, user:users!user_id(id, wallet_address, display_name, avatar_url, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    return { data: data ?? [], total, page, limit, hasMore: from + limit < total };
  }

  async updateTicketStatus(ticketId: string, status: SupportTicketStatus) {
    const { data, error } = await this.supabase.admin
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Support ticket not found');

    return data;
  }
}
