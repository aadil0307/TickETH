import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationType,
  NotificationJobData,
} from './notification.processor';
import {
  AnalyticsEventType,
  AnalyticsJobData,
} from './analytics.processor';

/**
 * Central service for enqueuing notification and analytics jobs.
 * Inject this service into any module that needs to send notifications
 * or track analytics events.
 */
@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue('notifications') private readonly notifQueue: Queue,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
  ) {}

  /* ── Notifications ────────────────────────────────────────── */

  /** Enqueue a notification job */
  async notify(data: NotificationJobData) {
    await this.notifQueue.add(`notif:${data.type}`, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400 },  // keep completed for 24h
      removeOnFail: { age: 604_800 },     // keep failed for 7 days (DLQ review)
    });
    this.logger.debug(`Queued notification: ${data.type}`);
  }

  /** Convenience: notify ticket minted */
  async notifyTicketMinted(wallet: string, eventName: string, tokenId: number) {
    await this.notify({
      type: NotificationType.TICKET_MINTED,
      recipientWallet: wallet,
      title: 'Ticket Minted!',
      body: `Your ticket #${tokenId} for "${eventName}" has been minted successfully.`,
      data: { tokenId, eventName },
      channels: ['in_app'],
    });
  }

  /** Convenience: notify listing sold */
  async notifyListingSold(
    sellerWallet: string,
    buyerWallet: string,
    eventName: string,
    tokenId: number,
    price: string,
  ) {
    // Notify seller
    await this.notify({
      type: NotificationType.LISTING_SOLD,
      recipientWallet: sellerWallet,
      title: 'Ticket Sold!',
      body: `Your ticket #${tokenId} for "${eventName}" sold for ${price}.`,
      data: { tokenId, eventName, price, role: 'seller' },
      channels: ['in_app'],
    });

    // Notify buyer
    await this.notify({
      type: NotificationType.TICKET_TRANSFERRED,
      recipientWallet: buyerWallet,
      title: 'Ticket Purchased!',
      body: `You bought ticket #${tokenId} for "${eventName}".`,
      data: { tokenId, eventName, price, role: 'buyer' },
      channels: ['in_app'],
    });
  }

  /** Convenience: notify event published */
  async notifyEventPublished(organizerWallet: string, eventName: string) {
    await this.notify({
      type: NotificationType.EVENT_PUBLISHED,
      recipientWallet: organizerWallet,
      title: 'Event Published!',
      body: `"${eventName}" is now live and accepting ticket sales.`,
      data: { eventName },
      channels: ['in_app'],
    });
  }

  /** Convenience: notify organizer request reviewed */
  async notifyOrganizerRequestReviewed(
    wallet: string,
    approved: boolean,
    reason?: string,
  ) {
    await this.notify({
      type: NotificationType.ORGANIZER_REQUEST_REVIEWED,
      recipientWallet: wallet,
      title: approved ? 'Request Approved!' : 'Request Rejected',
      body: approved
        ? 'Your organizer request has been approved. You can now create events!'
        : `Your organizer request was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      data: { approved, reason },
      channels: ['in_app'],
    });
  }

  /** Convenience: notify check-in confirmed */
  async notifyCheckinConfirmed(wallet: string, eventName: string) {
    await this.notify({
      type: NotificationType.CHECKIN_CONFIRMED,
      recipientWallet: wallet,
      title: 'Checked In!',
      body: `Welcome to "${eventName}"! Enjoy the event.`,
      data: { eventName },
      channels: ['in_app'],
    });
  }

  /* ── Analytics ────────────────────────────────────────────── */

  /** Enqueue an analytics event */
  async track(data: AnalyticsJobData) {
    await this.analyticsQueue.add(`analytics:${data.eventType}`, {
      ...data,
      timestamp: data.timestamp ?? new Date().toISOString(),
    }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 3_000 },
      removeOnComplete: { age: 3_600 },   // keep completed for 1h
      removeOnFail: { age: 172_800 },      // keep failed for 2 days
    });
  }

  /** Convenience: track ticket minted */
  async trackTicketMinted(eventId: string, tierId: string, wallet: string) {
    await this.track({
      eventType: AnalyticsEventType.TICKET_MINTED,
      entityType: 'ticket',
      actorWallet: wallet,
      metadata: { eventId, tierId },
    });
  }

  /** Convenience: track ticket sold */
  async trackTicketSold(eventId: string, salePrice: string, wallet: string) {
    await this.track({
      eventType: AnalyticsEventType.TICKET_SOLD,
      entityType: 'ticket',
      actorWallet: wallet,
      metadata: { eventId, salePrice },
    });
  }

  /** Convenience: track check-in */
  async trackCheckin(eventId: string, ticketId: string) {
    await this.track({
      eventType: AnalyticsEventType.TICKET_CHECKED_IN,
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { eventId },
    });
  }

  /* ── Queue Health ─────────────────────────────────────────── */

  /** Get queue health stats (for admin dashboard) */
  async getQueueHealth() {
    const [notifCounts, analyticsCounts] = await Promise.all([
      this.getQueueCounts(this.notifQueue),
      this.getQueueCounts(this.analyticsQueue),
    ]);

    return {
      notifications: notifCounts,
      analytics: analyticsCounts,
    };
  }

  private async getQueueCounts(queue: Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
