import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

/**
 * Notification types supported by the system.
 */
export enum NotificationType {
  /** Ticket successfully minted */
  TICKET_MINTED = 'ticket_minted',
  /** Transfer/resale completed */
  TICKET_TRANSFERRED = 'ticket_transferred',
  /** Organizer request approved / rejected */
  ORGANIZER_REQUEST_REVIEWED = 'organizer_request_reviewed',
  /** Event published */
  EVENT_PUBLISHED = 'event_published',
  /** Event cancelled */
  EVENT_CANCELLED = 'event_cancelled',
  /** Check-in confirmed */
  CHECKIN_CONFIRMED = 'checkin_confirmed',
  /** Marketplace listing sold */
  LISTING_SOLD = 'listing_sold',
  /** Marketplace listing cancelled */
  LISTING_CANCELLED = 'listing_cancelled',
  /** Event reminder (24h before) */
  EVENT_REMINDER = 'event_reminder',
}

export interface NotificationJobData {
  type: NotificationType;
  recipientWallet?: string;
  recipientUserId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels?: Array<'in_app' | 'push' | 'email'>;
}

/**
 * Processes notification jobs from the 'notifications' queue.
 * Supports in-app (Supabase insert), push (FCM placeholder), and email channels.
 *
 * In production, connect Firebase Admin SDK for push and a transactional
 * email service (SendGrid / Resend) for email.
 */
@Processor('notifications', {
  concurrency: 5,
  limiter: { max: 50, duration: 60_000 },
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<NotificationJobData>) {
    const { type, recipientWallet, recipientUserId, title, body, data, channels } = job.data;
    const targets = channels ?? ['in_app'];

    this.logger.log(
      `Processing notification [${type}] → ${recipientWallet ?? recipientUserId} via ${targets.join(',')}`,
    );

    const results: Record<string, boolean> = {};

    for (const channel of targets) {
      try {
        switch (channel) {
          case 'in_app':
            await this.sendInApp(job.data);
            results.in_app = true;
            break;

          case 'push':
            await this.sendPush(job.data);
            results.push = true;
            break;

          case 'email':
            await this.sendEmail(job.data);
            results.email = true;
            break;
        }
      } catch (err) {
        this.logger.error(
          `Failed to send ${channel} notification: ${(err as Error).message}`,
        );
        results[channel] = false;
      }
    }

    this.logger.log(`Notification [${type}] processed: ${JSON.stringify(results)}`);
    return { success: true, results };
  }

  /* ── Channel Implementations ──────────────────────────────── */

  /**
   * In-app notification — stores in a notifications table.
   * The frontend polls or uses Supabase realtime to show toast/badge.
   */
  private async sendInApp(data: NotificationJobData): Promise<void> {
    // In production: insert into a `notifications` table in Supabase
    // For now, log it (table will be created in Phase 6 security hardening)
    this.logger.log(
      `[IN_APP] ${data.title}: ${data.body} → ${data.recipientWallet ?? data.recipientUserId}`,
    );
  }

  /**
   * Push notification via Firebase Cloud Messaging.
   * Requires: firebase-admin SDK + user's FCM token stored in DB.
   */
  private async sendPush(data: NotificationJobData): Promise<void> {
    // TODO: Integrate firebase-admin when mobile app (Phase 4) is ready
    // 1. Look up user's FCM token from DB
    // 2. Send via admin.messaging().send({ token, notification: { title, body }, data })
    this.logger.log(
      `[PUSH] ${data.title}: ${data.body} → ${data.recipientWallet ?? data.recipientUserId} (FCM not yet configured)`,
    );
  }

  /**
   * Email notification via transactional email service.
   * Requires: SendGrid / Resend API key + user's email from DB.
   */
  private async sendEmail(data: NotificationJobData): Promise<void> {
    // TODO: Integrate SendGrid/Resend when email addresses are collected
    // 1. Look up user's email from DB
    // 2. Send via email API with templated HTML
    this.logger.log(
      `[EMAIL] ${data.title}: ${data.body} → ${data.recipientWallet ?? data.recipientUserId} (email not yet configured)`,
    );
  }
}
