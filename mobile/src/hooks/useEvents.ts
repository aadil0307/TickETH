import { useState, useEffect, useCallback } from 'react';
import * as eventsApi from '../api/events';
import type { EventFilters } from '../api/events';
import type { TickETHEvent, PaginatedResponse } from '../types';

/** Hook to fetch and manage events list */
export function useEvents(filters?: EventFilters) {
  const [events, setEvents] = useState<TickETHEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const fetch = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        setLoading(true);
        setError(null);
        const result = await eventsApi.getEvents({ ...filters, page: pageNum, limit: 20 });
        setEvents((prev) => (append ? [...prev, ...result.data] : result.data));
        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Failed to load events');
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    fetch(1);
  }, [fetch]);

  const refresh = useCallback(() => fetch(1), [fetch]);
  const loadMore = useCallback(() => {
    if (hasMore && !loading) fetch(page + 1, true);
  }, [hasMore, loading, page, fetch]);

  return { events, loading, error, hasMore, refresh, loadMore };
}

/** Hook to fetch a single event */
export function useEvent(eventId: string) {
  const [event, setEvent] = useState<TickETHEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await eventsApi.getEventById(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { event, loading, error, refresh: fetch };
}
