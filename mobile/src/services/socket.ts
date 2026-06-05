import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

const TOKEN_KEY = 'ticketh_access_token';

/**
 * Singleton Socket.IO client for the `/checkin` namespace.
 * Connects to the backend WebSocket gateway for real-time check-in events.
 */
class CheckinSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  /** Derive the WS URL from the REST API base URL */
  private get wsUrl(): string {
    // API_BASE_URL is e.g. http://192.168.0.234:3001/api/v1
    // Socket.IO connects to the root origin with a namespace
    return API_BASE_URL.replace('/api/v1', '');
  }

  /** Connect (or reconnect) to the /checkin namespace */
  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    this.socket = io(`${this.wsUrl}/checkin`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to /checkin namespace');
      // Re-register any buffered event listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach((cb) => this.socket?.on(event, cb));
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }

  /** Disconnect and clean up */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /** Join a ticket-specific room to receive confirmationRequest events */
  joinTicketRoom(ticketId: string): void {
    this.socket?.emit('joinTicket', { ticketId });
  }

  /** Leave a ticket room */
  leaveTicketRoom(ticketId: string): void {
    this.socket?.emit('leaveTicket', { ticketId });
  }

  /** Join an event room (for volunteers to receive attendee counts) */
  joinEventRoom(eventId: string): void {
    this.socket?.emit('joinEvent', { eventId });
  }

  /** Leave an event room */
  leaveEventRoom(eventId: string): void {
    this.socket?.emit('leaveEvent', { eventId });
  }

  /** Subscribe to a socket event (survives reconnects) */
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback);
  }

  /** Unsubscribe from a socket event */
  off(event: string, callback: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }

  /** Whether the socket is currently connected */
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}

/** Singleton instance */
export const checkinSocket = new CheckinSocketService();
