import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineScan, OwnershipSnapshot } from '../types';
import { MAX_OFFLINE_QUEUE, OFFLINE_CACHE_TTL } from '../constants/config';

const SCANS_KEY = 'ticketh_offline_scans';
const SNAPSHOTS_KEY = 'ticketh_ownership_snapshots';

interface OfflineState {
  /** Whether the device is online */
  isOnline: boolean;
  /** Queued offline scans waiting to sync */
  pendingScans: OfflineScan[];
  /** Cached ownership snapshots per event */
  snapshots: Record<string, OwnershipSnapshot>;
  /** Whether a sync is in progress */
  syncing: boolean;

  /** Set online/offline status */
  setOnline: (online: boolean) => void;
  /** Add a scan to the offline queue */
  addScan: (scan: Omit<OfflineScan, 'synced'>) => Promise<void>;
  /** Mark scans as synced */
  markSynced: (ids: string[]) => Promise<void>;
  /** Store an ownership snapshot */
  setSnapshot: (eventId: string, snapshot: OwnershipSnapshot) => Promise<void>;
  /** Get a snapshot if still valid */
  getSnapshot: (eventId: string) => OwnershipSnapshot | null;
  /** Load offline state from AsyncStorage */
  hydrate: () => Promise<void>;
  /** Clear all offline data */
  clear: () => Promise<void>;
  /** Set syncing state */
  setSyncing: (syncing: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: true,
  pendingScans: [],
  snapshots: {},
  syncing: false,

  setOnline: (online) => set({ isOnline: online }),

  addScan: async (scan) => {
    const pending = get().pendingScans;
    if (pending.length >= MAX_OFFLINE_QUEUE) {
      throw new Error('Offline queue is full. Please sync before scanning more.');
    }
    const newScan: OfflineScan = { ...scan, synced: false };
    const updated = [...pending, newScan];
    set({ pendingScans: updated });
    await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(updated));
  },

  markSynced: async (ids) => {
    const updated = get().pendingScans.map((s) =>
      ids.includes(s.id) ? { ...s, synced: true } : s,
    );
    // Remove synced scans
    const remaining = updated.filter((s) => !s.synced);
    set({ pendingScans: remaining });
    await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(remaining));
  },

  setSnapshot: async (eventId, snapshot) => {
    const snapshots = { ...get().snapshots, [eventId]: snapshot };
    set({ snapshots });
    await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  },

  getSnapshot: (eventId) => {
    const snapshot = get().snapshots[eventId];
    if (!snapshot) return null;
    // Check TTL
    if (Date.now() - snapshot.fetchedAt > OFFLINE_CACHE_TTL) return null;
    return snapshot;
  },

  hydrate: async () => {
    try {
      const [scansJson, snapshotsJson] = await Promise.all([
        AsyncStorage.getItem(SCANS_KEY),
        AsyncStorage.getItem(SNAPSHOTS_KEY),
      ]);
      const pendingScans = scansJson ? JSON.parse(scansJson) : [];
      // Prune expired snapshots on hydrate
      const raw: Record<string, OwnershipSnapshot> = snapshotsJson ? JSON.parse(snapshotsJson) : {};
      const now = Date.now();
      const snapshots: Record<string, OwnershipSnapshot> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (now - v.fetchedAt <= OFFLINE_CACHE_TTL) snapshots[k] = v;
      }
      set({ pendingScans, snapshots });
    } catch {
      // Silently fail — start with empty state
    }
  },

  clear: async () => {
    set({ pendingScans: [], snapshots: {} });
    await AsyncStorage.multiRemove([SCANS_KEY, SNAPSHOTS_KEY]);
  },

  setSyncing: (syncing) => set({ syncing }),
}));
