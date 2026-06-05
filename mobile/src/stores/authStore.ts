import { create } from 'zustand';
import type { User, AuthTokens } from '../types';
import { authApi, clearTokens, setTokens } from '../api';

interface AuthState {
  /** Current user or null if not authenticated */
  user: User | null;
  /** Whether auth state has been loaded from storage */
  hydrated: boolean;
  /** Loading state for auth operations */
  loading: boolean;
  /** Last auth error */
  error: string | null;

  /** Hydrate auth state from secure storage */
  hydrate: () => Promise<void>;
  /** Log in with SIWE message + signature */
  login: (message: string, signature: string) => Promise<User>;
  /** Log out and clear tokens */
  logout: () => Promise<void>;
  /** Refresh user data from backend */
  refreshUser: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    await clearTokens();
    set({ user: null, hydrated: true });
  },

  login: async (message: string, signature: string) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.verify(message, signature);
      set({ user: result.user, loading: false });
      return result.user;
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Login failed';
      set({ loading: false, error: msg });
      throw err;
    }
  },

  logout: async () => {
    await clearTokens();
    set({ user: null, error: null });
  },

  refreshUser: async () => {
    try {
      const user = await authApi.getMe();
      set({ user });
    } catch {
      // Silently fail — user will be prompted to re-auth
    }
  },

  clearError: () => set({ error: null }),
}));
