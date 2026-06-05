import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/offlineStore';
import { checkinApi, ticketsApi, eventsApi } from '../api';
import type { OwnershipSnapshot } from '../types';

/**
 * Offline sync service for volunteer QR scanning.
 * Monitors network state and syncs queued scans when connectivity returns.
 */

let unsubscribeNetInfo: (() => void) | null = null;

/** Start listening to network state changes */
export function startNetworkMonitor(): void {
  if (unsubscribeNetInfo) return; // Already monitoring

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const wasOffline = !useOfflineStore.getState().isOnline;
    const isNowOnline = state.isConnected === true && state.isInternetReachable !== false;

    useOfflineStore.getState().setOnline(isNowOnline);

    // Auto-sync when coming back online
    if (wasOffline && isNowOnline) {
      syncPendingScans().catch(console.error);
    }
  });
}

/** Stop listening to network state */
export function stopNetworkMonitor(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
}

/** Sync all pending offline scans with the backend */
export async function syncPendingScans(): Promise<{
  synced: number;
  failed: number;
} | null> {
  const store = useOfflineStore.getState();

  if (store.syncing) return null;
  if (store.pendingScans.length === 0) return { synced: 0, failed: 0 };
  if (!store.isOnline) return null;

  store.setSyncing(true);

  try {
    const scansToSync = store.pendingScans.filter((s) => !s.synced);

    if (scansToSync.length === 0) {
      store.setSyncing(false);
      return { synced: 0, failed: 0 };
    }

    const result = await checkinApi.syncOfflineScans(
      scansToSync.map((s) => ({
        qrData: s.qrData,
        scannedAt: s.scannedAt,
      })),
    );

    // Mark synced scans
    await store.markSynced(scansToSync.map((s) => s.id));

    return { synced: result.synced, failed: result.failed };
  } catch (err) {
    console.error('Offline sync failed:', err);
    return null;
  } finally {
    store.setSyncing(false);
  }
}

/** Check current network state */
export async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  const online = state.isConnected === true && state.isInternetReachable !== false;
  useOfflineStore.getState().setOnline(online);
  return online;
}

/**
 * Download ownership snapshot for an event (for offline verification).
 * Fetches all tickets for the event and stores them locally.
 */
export async function downloadEventSnapshot(eventId: string): Promise<number> {
  const result = await ticketsApi.getTicketsByEvent(eventId, 1, 2000);
  const snapshot: OwnershipSnapshot = {
    eventId,
    tickets: result.data.map((t) => ({
      ticketId: t.id,
      tokenId: t.token_id,
      ownerWallet: t.owner_wallet,
      status: t.status,
    })),
    fetchedAt: Date.now(),
  };
  await useOfflineStore.getState().setSnapshot(eventId, snapshot);
  return snapshot.tickets.length;
}

/**
 * Download snapshots for all published events.
 * Returns the total number of tickets cached.
 */
export async function downloadAllSnapshots(): Promise<{
  events: number;
  tickets: number;
}> {
  const result = await eventsApi.getEvents({ status: 'published', limit: 50 });
  let totalTickets = 0;
  for (const event of result.data) {
    const count = await downloadEventSnapshot(event.id);
    totalTickets += count;
  }
  return { events: result.data.length, tickets: totalTickets };
}
