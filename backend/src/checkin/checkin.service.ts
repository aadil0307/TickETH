import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TicketsService } from '../tickets/tickets.service';
import { EventsService } from '../events/events.service';
import { AuditService } from '../audit/audit.service';
import { CheckinGateway } from './checkin.gateway';
import { CheckinResult, TicketStatus, AuditAction } from '../common/enums';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { ConfirmCheckinDto } from './dto/confirm-checkin.dto';

/**
 * QR payload structure (JSON-encoded, displayed as QR code).
 * The `hmac` field prevents tampering — only the backend can generate valid payloads.
 */
export interface QrPayload {
  ticketId: string;
  eventId: string;
  nonce: string;
  expiresAt: number;  // Unix ms
  hmac: string;       // HMAC-SHA256 of ticketId:eventId:nonce:expiresAt
}

interface PendingCheckin {
  checkinLogId: string;
  ticketId: string;
  eventId: string;
  nonce: string;
  expiresAt: number;
}

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  private redis: Redis | null = null;
  private hmacSecret!: string;

  // Fallback in-memory store (used when Redis is unavailable)
  private readonly fallbackPending = new Map<string, PendingCheckin>();
  private readonly usedNonces = new Set<string>();

  // Config
  private readonly QR_TTL_MS = 2 * 60 * 1000;        // QR valid for 2 minutes
  private readonly CONFIRM_TTL_MS = 60 * 1000;        // 60s to confirm
  private readonly NONCE_EXPIRY_SECS = 300;            // 5 min nonce anti-replay window
  private readonly PENDING_EXPIRY_SECS = 120;          // 2 min pending TTL in Redis

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly tickets: TicketsService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
    private readonly gateway: CheckinGateway,
  ) {}

  onModuleInit() {
    // HMAC secret for signing QR payloads
    this.hmacSecret = this.config.get<string>(
      'CHECKIN_HMAC_SECRET',
      this.config.get<string>('JWT_SECRET', 'ticketh-default-hmac-secret'),
    );

    // Connect to Redis for nonce management + pending check-ins
    const redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.config.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.config.get<string>('REDIS_PASSWORD');

    try {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        keyPrefix: 'ticketh:checkin:',
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.connect().then(() => {
        this.logger.log('Check-in Redis connected');
      }).catch((err) => {
        this.logger.warn(`Redis connection failed — using in-memory fallback: ${err.message}`);
        this.redis = null;
      });
    } catch {
      this.logger.warn('Redis unavailable — using in-memory fallback');
      this.redis = null;
    }
  }

  /* ── QR Payload Generation ────────────────────────────────── */

  /** Generate an HMAC-signed dynamic QR payload for a ticket */
  async generateQrPayload(ticketId: string, eventId: string): Promise<QrPayload> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + this.QR_TTL_MS;

    // Sign the payload so it can't be forged
    const hmac = this.signPayload(ticketId, eventId, nonce, expiresAt);

    // Store nonce in Redis (or memory) for replay protection
    await this.storeNonce(nonce);

    return { ticketId, eventId, nonce, expiresAt, hmac };
  }

  /* ── Step 1: Volunteer Scans QR ───────────────────────────── */

  /** Validate QR, check ticket, store pending confirmation */
  async scan(dto: ScanTicketDto, volunteerId?: string): Promise<{
    checkinLogId: string;
    result: CheckinResult;
    ticketId: string;
    message: string;
  }> {
    // 1. Verify HMAC signature (prevents forged QR codes)
    if (dto.hmac) {
      const expectedHmac = this.signPayload(
        dto.ticketId,
        dto.eventId,
        dto.nonce,
        dto.expiresAt ?? 0,
      );
      if (dto.hmac !== expectedHmac) {
        const logId = await this.createCheckinLog({
          ticketId: dto.ticketId,
          eventId: dto.eventId,
          volunteerId,
          nonce: dto.nonce,
          result: CheckinResult.FAILED_INVALID_NONCE,
          offlineSync: dto.offlineSync ?? false,
        });
        return {
          checkinLogId: logId,
          result: CheckinResult.FAILED_INVALID_NONCE,
          ticketId: dto.ticketId,
          message: 'Invalid QR code (signature mismatch).',
        };
      }
    }

    // 2. Validate nonce expiry
    if (dto.expiresAt && Date.now() > dto.expiresAt) {
      const logId = await this.createCheckinLog({
        ticketId: dto.ticketId,
        eventId: dto.eventId,
        volunteerId,
        nonce: dto.nonce,
        result: CheckinResult.FAILED_INVALID_NONCE,
        offlineSync: dto.offlineSync ?? false,
      });
      return {
        checkinLogId: logId,
        result: CheckinResult.FAILED_INVALID_NONCE,
        ticketId: dto.ticketId,
        message: 'QR code expired. Ask attendee to refresh.',
      };
    }

    // 3. Replay protection — check if nonce was already used
    if (!dto.offlineSync) {
      const alreadyUsed = await this.isNonceUsed(dto.nonce);
      if (alreadyUsed) {
        const logId = await this.createCheckinLog({
          ticketId: dto.ticketId,
          eventId: dto.eventId,
          volunteerId,
          nonce: dto.nonce,
          result: CheckinResult.FAILED_INVALID_NONCE,
          offlineSync: false,
        });
        return {
          checkinLogId: logId,
          result: CheckinResult.FAILED_INVALID_NONCE,
          ticketId: dto.ticketId,
          message: 'QR code already used (replay detected).',
        };
      }
      // Mark nonce as used
      await this.markNonceUsed(dto.nonce);
    }

    // 4. Fetch ticket
    const ticket = await this.tickets.findById(dto.ticketId);
    if (!ticket) {
      const logId = await this.createCheckinLog({
        ticketId: dto.ticketId,
        eventId: dto.eventId,
        volunteerId,
        nonce: dto.nonce,
        result: CheckinResult.FAILED_INVALID_TICKET,
        offlineSync: dto.offlineSync ?? false,
      });
      return {
        checkinLogId: logId,
        result: CheckinResult.FAILED_INVALID_TICKET,
        ticketId: dto.ticketId,
        message: 'Invalid ticket.',
      };
    }

    // 4b. Validate check-in time window (2h before start → 30min before end)
    if (!dto.offlineSync) {
      try {
        const event = await this.events.findById(dto.eventId);
        const now = Date.now();
        const startTime = event.start_time ? new Date(event.start_time).getTime() : null;
        const endTime = event.end_time ? new Date(event.end_time).getTime() : null;

        const WINDOW_BEFORE_START_MS = 2 * 60 * 60 * 1000; // 2 hours
        const WINDOW_BEFORE_END_MS = 30 * 60 * 1000;       // 30 minutes

        if (startTime && now < startTime - WINDOW_BEFORE_START_MS) {
          const logId = await this.createCheckinLog({
            ticketId: dto.ticketId,
            eventId: dto.eventId,
            volunteerId,
            nonce: dto.nonce,
            result: CheckinResult.FAILED_INVALID_TICKET,
            offlineSync: false,
          });
          return {
            checkinLogId: logId,
            result: CheckinResult.FAILED_INVALID_TICKET,
            ticketId: dto.ticketId,
            message: 'Check-in is not yet open. It opens 2 hours before the event starts.',
          };
        }

        if (endTime && now > endTime - WINDOW_BEFORE_END_MS) {
          const logId = await this.createCheckinLog({
            ticketId: dto.ticketId,
            eventId: dto.eventId,
            volunteerId,
            nonce: dto.nonce,
            result: CheckinResult.FAILED_INVALID_TICKET,
            offlineSync: false,
          });
          return {
            checkinLogId: logId,
            result: CheckinResult.FAILED_INVALID_TICKET,
            ticketId: dto.ticketId,
            message: 'Check-in has closed. It closes 30 minutes before the event ends.',
          };
        }
      } catch {
        // If event lookup fails, proceed — don't block check-in for a DB error
        this.logger.warn(`Could not validate check-in time window for event ${dto.eventId}`);
      }
    }

    // 5. Check if already checked in
    if (ticket.status === TicketStatus.CHECKED_IN) {
      const logId = await this.createCheckinLog({
        ticketId: dto.ticketId,
        eventId: dto.eventId,
        volunteerId,
        nonce: dto.nonce,
        result: CheckinResult.FAILED_ALREADY_CHECKED_IN,
        offlineSync: dto.offlineSync ?? false,
      });
      return {
        checkinLogId: logId,
        result: CheckinResult.FAILED_ALREADY_CHECKED_IN,
        ticketId: dto.ticketId,
        message: 'Ticket already checked in.',
      };
    }

    // 6. Create pending check-in log
    const logId = await this.createCheckinLog({
      ticketId: dto.ticketId,
      eventId: dto.eventId,
      volunteerId,
      nonce: dto.nonce,
      result: CheckinResult.PENDING_CONFIRMATION,
      offlineSync: dto.offlineSync ?? false,
    });

    // 7. Store pending check-in (Redis or memory)
    const pending: PendingCheckin = {
      checkinLogId: logId,
      ticketId: dto.ticketId,
      eventId: dto.eventId,
      nonce: dto.nonce,
      expiresAt: Date.now() + this.CONFIRM_TTL_MS,
    };
    await this.storePending(logId, pending);

    // 8. Notify attendee via WebSocket to show confirmation screen
    this.gateway.emitConfirmationRequest(dto.ticketId, logId);

    return {
      checkinLogId: logId,
      result: CheckinResult.PENDING_CONFIRMATION,
      ticketId: dto.ticketId,
      message: 'Waiting for attendee confirmation...',
    };
  }

  /* ── Step 2: Attendee Confirms ────────────────────────────── */

  /** Confirm check-in after volunteer scan */
  async confirm(dto: ConfirmCheckinDto): Promise<{
    result: CheckinResult;
    message: string;
  }> {
    const pendingItem = await this.getPending(dto.checkinLogId);
    if (!pendingItem) {
      throw new BadRequestException('No pending check-in found or already expired');
    }

    if (Date.now() > pendingItem.expiresAt) {
      await this.deletePending(dto.checkinLogId);
      await this.updateCheckinLog(dto.checkinLogId, CheckinResult.FAILED_CONFIRMATION_TIMEOUT);
      return {
        result: CheckinResult.FAILED_CONFIRMATION_TIMEOUT,
        message: 'Confirmation timed out. Scan again.',
      };
    }

    // Mark ticket as checked in
    await this.tickets.markCheckedIn(pendingItem.ticketId);

    // Update checkin log
    await this.updateCheckinLog(dto.checkinLogId, CheckinResult.SUCCESS);

    // Remove from pending
    await this.deletePending(dto.checkinLogId);

    await this.audit.log({
      actorWallet: dto.attendeeWallet,
      action: AuditAction.TICKET_CHECKED_IN,
      entityType: 'ticket',
      entityId: pendingItem.ticketId,
      details: {
        checkin_log_id: dto.checkinLogId,
        event_id: pendingItem.eventId,
      },
    });

    this.logger.log(`Ticket ${pendingItem.ticketId} checked in successfully`);

    // Notify volunteer's scanner via WebSocket
    this.gateway.emitCheckinResult(pendingItem.eventId, {
      checkinLogId: dto.checkinLogId,
      ticketId: pendingItem.ticketId,
      status: CheckinResult.SUCCESS,
      message: 'Attendee confirmed — entry granted!',
    });

    // Broadcast updated attendee count
    const count = await this.getLiveCount(pendingItem.eventId);
    this.gateway.emitAttendeeCount(pendingItem.eventId, count);

    return {
      result: CheckinResult.SUCCESS,
      message: 'Check-in confirmed! Entry granted.',
    };
  }

  /* ── Offline Batch Sync ───────────────────────────────────── */

  /**
   * Process a batch of offline-collected scans.
   * Called when a volunteer's device reconnects to the network.
   */
  async syncOfflineScans(scans: ScanTicketDto[], volunteerId: string): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: Array<{ ticketId: string; result: CheckinResult; message: string }>;
  }> {
    const results: Array<{ ticketId: string; result: CheckinResult; message: string }> = [];
    let succeeded = 0;
    let failed = 0;

    for (const scan of scans) {
      try {
        // For offline scans, skip replay protection (nonce may be stale)
        const scanResult = await this.scan(
          { ...scan, offlineSync: true },
          volunteerId,
        );

        if (scanResult.result === CheckinResult.PENDING_CONFIRMATION) {
          // Auto-confirm offline scans (attendee already presented at the door)
          const confirmResult = await this.confirm({
            checkinLogId: scanResult.checkinLogId,
          });

          results.push({
            ticketId: scan.ticketId,
            result: confirmResult.result,
            message: confirmResult.message,
          });

          if (confirmResult.result === CheckinResult.SUCCESS) succeeded++;
          else failed++;
        } else {
          results.push({
            ticketId: scan.ticketId,
            result: scanResult.result,
            message: scanResult.message,
          });
          failed++;
        }
      } catch (err) {
        results.push({
          ticketId: scan.ticketId,
          result: CheckinResult.FAILED_INVALID_TICKET,
          message: (err as Error).message,
        });
        failed++;
      }
    }

    return {
      processed: scans.length,
      succeeded,
      failed,
      results,
    };
  }

  /* ── Queries ──────────────────────────────────────────────── */

  /** Get check-in logs for an event */
  async getEventLogs(eventId: string, page = 1, limit = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('checkin_logs')
      .select('*, tickets(token_id, owner_wallet), users!checkin_logs_volunteer_id_fkey(display_name)', { count: 'exact' })
      .eq('event_id', eventId)
      .order('scanned_at', { ascending: false })
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

  /** Get live attendee count for an event */
  async getLiveCount(eventId: string): Promise<number> {
    const { count, error } = await this.supabase.admin
      .from('checkin_logs')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('result', CheckinResult.SUCCESS);

    if (error) throw error;
    return count ?? 0;
  }

  /** Get status of a single check-in log (used by volunteer polling) */
  async getCheckinStatus(checkinLogId: string) {
    const { data, error } = await this.supabase.admin
      .from('checkin_logs')
      .select('id, ticket_id, event_id, result, scanned_at, confirmed_at')
      .eq('id', checkinLogId)
      .single();

    if (error || !data) throw new NotFoundException('Check-in log not found');
    return data;
  }

  /* ── HMAC Signing ─────────────────────────────────────────── */

  private signPayload(
    ticketId: string,
    eventId: string,
    nonce: string,
    expiresAt: number,
  ): string {
    const message = `${ticketId}:${eventId}:${nonce}:${expiresAt}`;
    return createHmac('sha256', this.hmacSecret)
      .update(message)
      .digest('hex');
  }

  /* ── Redis-backed Nonce Management ────────────────────────── */

  /** Store a nonce so we can check for replays */
  private async storeNonce(nonce: string): Promise<void> {
    if (this.redis) {
      await this.redis.set(`nonce:${nonce}`, '1', 'EX', this.NONCE_EXPIRY_SECS);
    }
    // In-memory is not needed for generation, only for checking
  }

  /** Check if a nonce was already used (replay detection) */
  private async isNonceUsed(nonce: string): Promise<boolean> {
    if (this.redis) {
      const val = await this.redis.get(`used:${nonce}`);
      return val !== null;
    }
    return this.usedNonces.has(nonce);
  }

  /** Mark a nonce as consumed */
  private async markNonceUsed(nonce: string): Promise<void> {
    if (this.redis) {
      await this.redis.set(`used:${nonce}`, '1', 'EX', this.NONCE_EXPIRY_SECS);
    } else {
      this.usedNonces.add(nonce);
      // Cleanup old nonces in memory (prevent unbounded growth)
      if (this.usedNonces.size > 10_000) {
        const arr = Array.from(this.usedNonces);
        for (let i = 0; i < arr.length - 5_000; i++) {
          this.usedNonces.delete(arr[i]);
        }
      }
    }
  }

  /* ── Redis-backed Pending Check-ins ───────────────────────── */

  private async storePending(logId: string, pending: PendingCheckin): Promise<void> {
    if (this.redis) {
      await this.redis.set(
        `pending:${logId}`,
        JSON.stringify(pending),
        'EX',
        this.PENDING_EXPIRY_SECS,
      );
    } else {
      this.fallbackPending.set(logId, pending);
    }
  }

  private async getPending(logId: string): Promise<PendingCheckin | null> {
    if (this.redis) {
      const raw = await this.redis.get(`pending:${logId}`);
      return raw ? JSON.parse(raw) : null;
    }
    return this.fallbackPending.get(logId) ?? null;
  }

  private async deletePending(logId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`pending:${logId}`);
    } else {
      this.fallbackPending.delete(logId);
    }
  }

  /* ── Private DB Helpers ───────────────────────────────────── */

  private async createCheckinLog(params: {
    ticketId: string;
    eventId: string;
    volunteerId?: string;
    nonce: string;
    result: CheckinResult;
    offlineSync: boolean;
    deviceInfo?: Record<string, any>;
  }): Promise<string> {
    const { data, error } = await this.supabase.admin
      .from('checkin_logs')
      .insert({
        ticket_id: params.ticketId,
        event_id: params.eventId,
        volunteer_id: params.volunteerId,
        nonce: params.nonce,
        result: params.result,
        offline_sync: params.offlineSync,
        device_info: params.deviceInfo ?? {},
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private async updateCheckinLog(logId: string, result: CheckinResult) {
    const confirmed = result === CheckinResult.SUCCESS;
    await this.supabase.admin
      .from('checkin_logs')
      .update({
        result,
        confirmed_at: confirmed ? new Date().toISOString() : null,
      })
      .eq('id', logId);
  }
}
