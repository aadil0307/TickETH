import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { AuditAction } from '../common/enums';

interface AuditLogEntry {
  actorId?: string;
  actorWallet?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private static readonly MAX_RETRIES = 3;

  constructor(private readonly supabase: SupabaseService) {}

  /** Write an immutable audit log entry with retry */
  async log(entry: AuditLogEntry): Promise<void> {
    const row = {
      actor_id: entry.actorId,
      actor_wallet: entry.actorWallet,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      details: entry.details ?? {},
      ip_address: entry.ipAddress,
    };

    for (let attempt = 1; attempt <= AuditService.MAX_RETRIES; attempt++) {
      try {
        const { error } = await this.supabase.admin
          .from('audit_logs')
          .insert(row);

        if (!error) return;

        this.logger.error(
          `Audit log attempt ${attempt}/${AuditService.MAX_RETRIES} failed: ${error.message}`,
        );
      } catch (err) {
        this.logger.error(
          `Audit log attempt ${attempt}/${AuditService.MAX_RETRIES} threw: ${(err as Error).message}`,
        );
      }

      if (attempt < AuditService.MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 100 * 2 ** (attempt - 1)));
      }
    }

    this.logger.error('Audit log write permanently failed after retries', { entry });
  }

  /** Query audit logs (admin only) */
  async findAll(
    page = 1,
    limit = 50,
    filters?: {
      action?: AuditAction;
      entityType?: string;
      entityId?: string;
      actorId?: string;
    },
  ) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.admin
      .from('audit_logs')
      .select('*, users!audit_logs_actor_id_fkey(display_name, wallet_address)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters?.action) query = query.eq('action', filters.action);
    if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
    if (filters?.actorId) query = query.eq('actor_id', filters.actorId);

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
}
