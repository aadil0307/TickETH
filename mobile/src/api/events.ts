import { apiClient } from './client';
import type { TickETHEvent, PaginatedResponse } from '../types';

export interface EventFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Fetch published events (public) */
export async function getEvents(filters?: EventFilters): Promise<PaginatedResponse<TickETHEvent>> {
  const { data } = await apiClient.get<PaginatedResponse<TickETHEvent>>('/events', {
    params: filters,
  });
  return data;
}

/** Fetch a single event by ID */
export async function getEventById(id: string): Promise<TickETHEvent> {
  const { data } = await apiClient.get<TickETHEvent>(`/events/${id}`);
  return data;
}

/** Delete an event (organizer/admin only) */
export async function deleteEvent(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.delete<{ success: boolean; message: string }>(`/events/${id}`);
  return data;
}
