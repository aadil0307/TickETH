import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SupabaseService } from '../common/supabase/supabase.service';

/**
 * Analytics event types tracked by the platform.
 */
export enum AnalyticsEventType {
  TICKET_MINTED = 'ticket_minted',
  TICKET_TRANSFERRED = 'ticket_transferred',
  TICKET_LISTED = 'ticket_listed',
  TICKET_SOLD = 'ticket_sold',
  TICKET_CHECKED_IN = 'ticket_checked_in',
  EVENT_PUBLISHED = 'event_published',
  EVENT_CANCELLED = 'event_cancelled',
  USER_REGISTERED = 'user_registered',
  PAGE_VIEW = 'page_view',
}

export interface AnalyticsJobData {
  eventType: AnalyticsEventType;
  entityType?: string;
  entityId?: string;
  actorWallet?: string;
  actorId?: string;
  metadata?: Record<string, any>;
  timestamp?: string; // ISO 8601
}

/**
 * Processes analytics events from the 'analytics' queue.
 * Aggregates metrics and writes snapshots in batch.
 *
 * Design:
 * - Collects events into in-memory counters
 * - Flushes to Supabase every N events or on a periodic schedule
 * - Updates materialized stats views for dashboards
 */
@Processor('analytics', {
  concurrency: 5,
  limiter: { max: 100, duration: 60_000 },
})
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  // In-memory aggregation buffers (flushed to DB periodically)
  private readonly counters = new Map<string, number>();
  private readonly FLUSH_THRESHOLD = 50;
  private jobsSinceFlush = 0;

  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async process(job: Job<AnalyticsJobData>) {
    const { eventType, entityType, entityId, metadata, timestamp } = job.data;

    this.logger.debug(
      `Analytics event: ${eventType} entity=${entityType}:${entityId}`,
    );

    // Increment in-memory counter
    const key = `${eventType}:${entityType ?? 'global'}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
    this.jobsSinceFlush++;

    // Process specific event types for real-time stats
    try {
      switch (eventType) {
        case AnalyticsEventType.TICKET_MINTED:
          await this.onTicketMinted(job.data);
          break;

        case AnalyticsEventType.TICKET_CHECKED_IN:
          await this.onTicketCheckedIn(job.data);
          break;

        case AnalyticsEventType.TICKET_SOLD:
          await this.onTicketSold(job.data);
          break;

        default:
          // Other events just count
          break;
      }
    } catch (err) {
      this.logger.error(
        `Analytics processing error for ${eventType}: ${(err as Error).message}`,
      );
    }

    // Periodic flush
    if (this.jobsSinceFlush >= this.FLUSH_THRESHOLD) {
      await this.flushCounters();
    }

    return { success: true, eventType };
  }

  /* ── Event-specific handlers ──────────────────────────────── */

  private async onTicketMinted(data: AnalyticsJobData) {
    // Update event's real-time ticket count
    if (data.metadata?.eventId) {
      const { data: stats } = await this.supabase.admin
        .from('events')
        .select('id')
        .eq('id', data.metadata.eventId)
        .single();

      if (stats) {
        // The event_stats view auto-calculates from tickets table,
        // but we can trigger a cache refresh or update a counter table
        this.logger.debug(
          `Mint analytics recorded for event ${data.metadata.eventId}`,
        );
      }
    }
  }

  private async onTicketCheckedIn(data: AnalyticsJobData) {
    // Could update a live check-in count cache for dashboard WebSockets
    if (data.metadata?.eventId) {
      this.logger.debug(
        `Check-in analytics for event ${data.metadata.eventId}`,
      );
    }
  }

  private async onTicketSold(data: AnalyticsJobData) {
    // Track secondary market volume
    if (data.metadata?.eventId && data.metadata?.salePrice) {
      this.logger.debug(
        `Sale analytics: event ${data.metadata.eventId}, price ${data.metadata.salePrice}`,
      );
    }
  }

  /* ── Flush ────────────────────────────────────────────────── */

  private async flushCounters() {
    if (this.counters.size === 0) return;

    const snapshot = new Map(this.counters);
    this.counters.clear();
    this.jobsSinceFlush = 0;

    try {
      const rows = Array.from(snapshot.entries()).map(([key, count]) => {
        const [eventType, entityType] = key.split(':');
        return {
          event_type: eventType,
          entity_type: entityType,
          count,
          period_start: new Date().toISOString(),
        };
      });

      // Write to analytics_snapshots if the table exists
      // This table should be created in Phase 7 (Infrastructure)
      // For now, just log
      this.logger.log(
        `Analytics flush: ${rows.length} aggregates, total events: ${rows.reduce((s, r) => s + r.count, 0)}`,
      );

      // When the analytics_snapshots table is ready:
      // await this.supabase.admin.from('analytics_snapshots').insert(rows);
    } catch (err) {
      this.logger.error(`Analytics flush error: ${(err as Error).message}`);
      // Restore counters on failure
      for (const [key, count] of snapshot) {
        this.counters.set(key, (this.counters.get(key) ?? 0) + count);
      }
    }
  }
}
