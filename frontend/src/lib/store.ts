'use client';

import { create } from 'zustand';
import { authApi } from './api';
import { clearTokens, getAccessToken } from './api-client';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  setUser: (user: User | null) => void;
  /** Re-fetch user from backend to pick up role changes (volunteer/organizer promotion) */
  refreshUser: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  hydrated: false,
  error: null,

  hydrate: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    try {
      set({ loading: true });
      const user = await authApi.getMe();
      set({ user, hydrated: true, loading: false });
    } catch {
      clearTokens();
      set({ user: null, hydrated: true, loading: false });
    }
  },

  setUser: (user) => set({ user }),

  refreshUser: async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const user = await authApi.getMe();
      set({ user });
    } catch {
      // Silently fail — user stays with current state
    }
  },

  logout: () => {
    clearTokens();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
