import React, { useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import {
  configureNotifications,
  registerForPushNotifications,
  onNotificationReceived,
  onNotificationResponse,
} from '../services/notifications';
import { startNetworkMonitor, stopNetworkMonitor } from '../services/offline';
import { useOfflineStore } from '../stores/offlineStore';
import { usersApi } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (message: string, signature: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, hydrated, error, hydrate, login, logout, refreshUser } = useAuthStore();
  const notifListenerRef = useRef<ReturnType<typeof onNotificationReceived> | null>(null);
  const responseListenerRef = useRef<ReturnType<typeof onNotificationResponse> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Hydrate auth + offline stores on mount
  useEffect(() => {
    hydrate();
    useOfflineStore.getState().hydrate();

    // Configure notifications
    configureNotifications();

    // Start network monitor for offline sync
    startNetworkMonitor();

    // Notification listeners
    notifListenerRef.current = onNotificationReceived((notification) => {
      if (__DEV__) console.log('Notification received:', notification.request.content);
    });

    responseListenerRef.current = onNotificationResponse((response) => {
      const data = response.notification.request.content.data;
      if (__DEV__) console.log('Notification tapped:', data);

      // Navigate to check-in confirmation screen when a check-in request arrives
      if (
        data?.type === 'checkin_request' &&
        data?.checkinLogId &&
        data?.ticketId
      ) {
        router.push(
          `/checkin-confirm?checkinLogId=${data.checkinLogId}&ticketId=${data.ticketId}`,
        );
      }
    });

    return () => {
      stopNetworkMonitor();
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, []);

  // Auto-refresh user profile when app comes to foreground
  // This picks up role changes (e.g., attendee → volunteer promotion) without re-login
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        user
      ) {
        if (__DEV__) console.log('App foregrounded — refreshing user profile for role changes');
        refreshUser();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [user, refreshUser]);

  // Register for push notifications once authenticated + send token to backend
  useEffect(() => {
    if (user) {
      registerForPushNotifications()
        .then((token) => {
          if (token) {
            usersApi.setPushToken(token).catch(console.warn);
          }
        })
        .catch(console.warn);
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    await logout();
    useWalletStore.getState().disconnect();
  }, [logout]);

  const value: AuthContextValue = {
    user,
    loading,
    hydrated,
    error,
    isAuthenticated: !!user,
    login,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
