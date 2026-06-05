/**
 * Analytics tracking service.
 *
 * Provides a light abstraction over a future analytics provider
 * (PostHog / Firebase Analytics). Right now it logs to console
 * in __DEV__ and collects into a buffer for batch sending.
 *
 * Usage:
 *   analytics.track('mint_started', { eventId, tierId });
 */

/* ─── Event Types ───────────────────────────────────────── */

export type AnalyticsEvent =
  | 'app_open'
  | 'auth_started'
  | 'auth_success'
  | 'auth_failed'
  | 'auth_cancelled'
  | 'event_viewed'
  | 'tier_selected'
  | 'mint_started'
  | 'mint_success'
  | 'mint_failed'
  | 'transfer_started'
  | 'transfer_success'
  | 'transfer_failed'
  | 'transfer_initiated'
  | 'ticket_viewed'
  | 'listing_created'
  | 'listing_bought'
  | 'listing_cancelled'
  | 'listing_viewed'
  | 'listing_create_started'
  | 'listing_create_failed'
  | 'listing_buy_started'
  | 'listing_buy_failed'
  | 'listing_cancel_started'
  | 'listing_cancel_failed'
  | 'scan_started'
  | 'scan_success'
  | 'scan_failed'
  | 'scan_attempted'
  | 'manual_code_entered'
  | 'offline_sync_completed'
  | 'checkin_confirmed'
  | 'checkin_denied'
  | 'checkin_timeout'
  | 'checkin_confirm_started'
  | 'checkin_confirm_failed'
  | 'wallet_disconnected'
  | 'marketplace_opened'
  | 'edit_profile_opened'
  | 'profile_updated'
  | 'offline_queue_size'
  | 'offline_sync'
  | 'qr_refreshed'
  | 'screen_view'
  | 'error';

export type AnalyticsProperties = Record<string, string | number | boolean | undefined>;

/* ─── Buffer for batching ───────────────────────────────── */

interface BufferedEvent {
  event: AnalyticsEvent;
  properties: AnalyticsProperties;
  timestamp: number;
}

const _buffer: BufferedEvent[] = [];
const MAX_BUFFER = 100;

/* ─── Public API ────────────────────────────────────────── */

function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  const entry: BufferedEvent = {
    event,
    properties: {
      ...properties,
      ts: Date.now(),
    },
    timestamp: Date.now(),
  };

  if (__DEV__) {
    console.log(`[analytics] ${event}`, properties);
  }

  _buffer.push(entry);
  if (_buffer.length > MAX_BUFFER) {
    _buffer.splice(0, _buffer.length - MAX_BUFFER);
  }
}

function screenView(name: string, properties: AnalyticsProperties = {}) {
  track('screen_view', { screen: name, ...properties });
}

function getBuffer(): ReadonlyArray<BufferedEvent> {
  return [..._buffer];
}

function flush() {
  // TODO: send _buffer to PostHog / Firebase
  _buffer.length = 0;
}

export const analytics = {
  track,
  screenView,
  getBuffer,
  flush,
};
