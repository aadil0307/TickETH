import { apiClient } from './client';
import type { Listing } from '../types';

/** Get active marketplace listings */
export async function getListings(params?: {
  eventId?: string;
  page?: number;
  limit?: number;
}): Promise<Listing[]> {
  const { data } = await apiClient.get<Listing[]>('/marketplace/listings', { params });
  return data;
}

/** Get a single listing by ID */
export async function getListingById(id: string): Promise<Listing> {
  const { data } = await apiClient.get<Listing>(`/marketplace/listings/${id}`);
  return data;
}

/** Get current user's listings */
export async function getMyListings(): Promise<Listing[]> {
  const { data } = await apiClient.get<Listing[]>('/marketplace/my-listings');
  return data;
}

/** Create a new listing (record after on-chain listTicket tx) */
export async function createListing(payload: {
  ticketId: string;
  askingPriceWei: string;
  askingPrice?: number;
  listingTxHash?: string;
}): Promise<Listing> {
  const { data } = await apiClient.post<Listing>('/marketplace/list', payload);
  return data;
}

/** Record a completed sale (after on-chain buyTicket tx) */
export async function completeSale(payload: {
  listingId: string;
  txHash: string;
  buyerWallet: string;
}): Promise<Listing> {
  const { data } = await apiClient.post<Listing>('/marketplace/complete-sale', payload);
  return data;
}

/** Cancel a listing (after on-chain cancelListing tx) */
export async function cancelListing(listingId: string): Promise<void> {
  await apiClient.post(`/marketplace/cancel/${listingId}`);
}
