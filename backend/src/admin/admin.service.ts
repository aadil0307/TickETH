import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { UserRole, AuditAction } from '../common/enums';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** Get platform dashboard stats */
  async getDashboardStats() {
    const [usersResult, eventsResult, ticketsResult, requestsResult] = await Promise.all([
      this.supabase.admin.from('users').select('*', { count: 'exact', head: true }),
      this.supabase.admin.from('events').select('*', { count: 'exact', head: true }),
      this.supabase.admin.from('tickets').select('*', { count: 'exact', head: true }),
      this.supabase.admin
        .from('organizer_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    return {
      totalUsers: usersResult.count ?? 0,
      totalEvents: eventsResult.count ?? 0,
      totalTickets: ticketsResult.count ?? 0,
      pendingRequests: requestsResult.count ?? 0,
    };
  }

  /** Change a user's role */
  async changeUserRole(
    userId: string,
    newRole: UserRole,
    adminId: string,
    adminWallet: string,
  ) {
    const user = await this.users.updateRole(userId, newRole);

    await this.audit.log({
      actorId: adminId,
      actorWallet: adminWallet,
      action: AuditAction.ROLE_CHANGED,
      entityType: 'user',
      entityId: userId,
      details: { new_role: newRole },
    });

    this.logger.log(`User ${userId} role changed to ${newRole} by admin ${adminId}`);
    return user;
  }

  /** List all users (with pagination & optional role filter) */
  async listUsers(page = 1, limit = 20, role?: UserRole) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.admin
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role) query = query.eq('role', role);

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

  /** Delete a user (DPDP compliance) */
  async deleteUser(userId: string, adminId: string, adminWallet: string) {
    await this.audit.log({
      actorId: adminId,
      actorWallet: adminWallet,
      action: AuditAction.ADMIN_ACTION,
      entityType: 'user',
      entityId: userId,
      details: { action: 'delete_user', reason: 'DPDP deletion request' },
    });

    await this.users.delete(userId);
    return { success: true, message: 'User deleted' };
  }
}
