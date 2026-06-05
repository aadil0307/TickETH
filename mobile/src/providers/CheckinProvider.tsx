/**
 * CheckinProvider — manages the Socket.IO connection for real-time check-in events.
 *
 * When the user is authenticated:
 *   - Connects to the /checkin namespace
 *   - Joins ticket rooms for all the user's active (minted) tickets
 *   - Listens for `confirmationRequest` events (volunteer scanned the QR)
 *   - Auto-navigates the attendee to the checkin-confirm screen
 *
 * Place this inside the provider tree AFTER AuthProvider & WalletProvider
 * so it has access to auth state and wallet context.
 */

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './AuthProvider';
import { checkinSocket } from '../services/socket';
import { showToast } from '../services/toast';

interface CheckinContextValue {
  /** Whether the socket is connected */
  connected: boolean;
  /** Join a specific ticket room (attendee) */
  joinTicket: (ticketId: string) => void;
  /** Join an event room (volunteer / organizer) */
  joinEvent: (eventId: string) => void;
}

const CheckinContext = createContext<CheckinContextValue>({
  connected: false,
  joinTicket: () => {},
  joinEvent: () => {},
});

export function CheckinProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const navigatingRef = useRef(false);

  // Connect / disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      checkinSocket.connect().catch(console.warn);
    } else {
      checkinSocket.disconnect();
    }
    return () => {
      checkinSocket.disconnect();
    };
  }, [isAuthenticated]);

  // Listen for confirmationRequest → navigate attendee to check-in confirm screen
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleConfirmationRequest = (data: {
      ticketId: string;
      checkinLogId: string;
    }) => {
      // Prevent double-navigation
      if (navigatingRef.current) return;
      navigatingRef.current = true;

      showToast({
        type: 'info',
        title: 'Check-in Request',
        message: 'A volunteer scanned your ticket. Please confirm.',
      });

      router.push(
        `/checkin-confirm?checkinLogId=${data.checkinLogId}&ticketId=${data.ticketId}`,
      );

      // Reset after a short delay
      setTimeout(() => {
        navigatingRef.current = false;
      }, 3000);
    };

    checkinSocket.on('confirmationRequest', handleConfirmationRequest);

    return () => {
      checkinSocket.off('confirmationRequest', handleConfirmationRequest);
    };
  }, [isAuthenticated]);

  // Reconnect when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        isAuthenticated
      ) {
        checkinSocket.connect().catch(console.warn);
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  const value: CheckinContextValue = {
    connected: checkinSocket.connected,
    joinTicket: (ticketId: string) => checkinSocket.joinTicketRoom(ticketId),
    joinEvent: (eventId: string) => checkinSocket.joinEventRoom(eventId),
  };

  return (
    <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>
  );
}

export function useCheckin(): CheckinContextValue {
  return useContext(CheckinContext);
}
