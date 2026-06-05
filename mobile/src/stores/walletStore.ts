import { create } from 'zustand';

export type AppMode = 'attendee' | 'volunteer';

interface WalletState {
  /** Connected wallet address */
  address: string | null;
  /** Whether the wallet is currently connected */
  connected: boolean;
  /** Chain ID of the connected network */
  chainId: number | null;
  /** App mode: attendee views tickets, volunteer scans */
  mode: AppMode;
  /** Whether wallet is connecting */
  connecting: boolean;

  /** Set wallet connection state */
  setWallet: (address: string, chainId: number) => void;
  /** Disconnect wallet */
  disconnect: () => void;
  /** Toggle app mode */
  setMode: (mode: AppMode) => void;
  /** Set connecting state */
  setConnecting: (connecting: boolean) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  connected: false,
  chainId: null,
  mode: 'attendee',
  connecting: false,

  setWallet: (address, chainId) =>
    set({ address, connected: true, chainId, connecting: false }),

  disconnect: () =>
    set({ address: null, connected: false, chainId: null, connecting: false }),

  setMode: (mode) => set({ mode }),

  setConnecting: (connecting) => set({ connecting }),
}));
