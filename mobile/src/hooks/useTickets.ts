import { useState, useEffect, useCallback } from 'react';
import { ticketsApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { Ticket } from '../types';

/** Hook to fetch the current user's tickets */
export function useMyTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const fetchTickets = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await ticketsApi.getMyTickets();
      setTickets(result.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Please reconnect your wallet to view tickets.');
      } else {
        setError(err?.response?.data?.message ?? 'Failed to load tickets');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return { tickets, loading, error, refresh: fetchTickets };
}

/** Hook to fetch a single ticket */
export function useTicket(ticketId: string) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!ticketId) {
      setTicket(null);
      setError('Invalid ticket id');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await ticketsApi.getTicketById(ticketId);
      setTicket(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ticket, loading, error, refresh: fetch };
}
