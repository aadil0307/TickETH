import { apiClient } from './client';
import type { Ticket, TicketTier, PaginatedResponse } from '../types';

/** Get all tickets owned by the current user (paginated) */
export async function getMyTickets(page = 1, limit = 50): Promise<PaginatedResponse<Ticket>> {
  const { data } = await apiClient.get<PaginatedResponse<Ticket>>('/tickets/mine', {
    params: { page, limit },
  });
  return data;
}

/** Get a single ticket by ID */
export async function getTicketById(id: string): Promise<Ticket> {
  const { data } = await apiClient.get<Ticket>(`/tickets/${id}`);
  return data;
}

/** Get tickets for a specific event (paginated) */
export async function getTicketsByEvent(
  eventId: string,
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<Ticket>> {
  const { data } = await apiClient.get<PaginatedResponse<Ticket>>(`/tickets/event/${eventId}`, {
    params: { page, limit },
  });
  return data;
}

/** Record a mint from the frontend (after on-chain tx succeeds) */
export async function recordMint(payload: {
  eventId: string;
  tierId: string;
  contractAddress: string;
  tokenId: number;
  txHash: string;
  ownerWallet: string;
}): Promise<Ticket> {
  const { data } = await apiClient.post<Ticket>('/tickets/record-mint', payload);
  return data;
}

/** Get ticket tiers for an event */
export async function getEventTiers(eventId: string): Promise<TicketTier[]> {
  const { data } = await apiClient.get<TicketTier[]>(`/events/${eventId}/tiers`);
  return data;
}
