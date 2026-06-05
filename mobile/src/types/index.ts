/* ─── User ──────────────────────────────────────────────── */

export type UserRole = 'visitor' | 'attendee' | 'organizer' | 'admin' | 'super_admin' | 'volunteer';

export interface User {
  id: string;
  wallet_address: string;
  email?: string;
  role: UserRole;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

/* ─── Auth ──────────────────────────────────────────────── */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface NonceResponse {
  nonce: string;
}

export interface VerifyResponse extends AuthTokens {
  user: User;
}

/* ─── Event ─────────────────────────────────────────────── */

export type EventStatus = 'draft' | 'published' | 'live' | 'completed' | 'cancelled';

export interface TickETHEvent {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  banner_url?: string;
  venue: string;
  start_time: string;
  end_time?: string;
  contract_address?: string;
  status: EventStatus;
  chain_id?: number;
  created_at: string;
  updated_at: string;
  // Joined / computed
  organizer?: User;
  tiers?: TicketTier[];
  total_tickets?: number;
  tickets_sold?: number;
}

/* ─── Ticket Tier ───────────────────────────────────────── */

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  price: string; // MATIC decimal (e.g. "0.01")
  price_wei: string; // exact wei string for on-chain calls
  tier_index?: number;
  max_supply: number;
  minted: number;
  resale_allowed: boolean;
  max_resales: number; // 0 = unlimited
  max_price_deviation_bps: number; // 0 = no cap, e.g. 1000 = 10%
  metadata_uri?: string;
  description?: string;
}

/* ─── Ticket ────────────────────────────────────────────── */

export type TicketStatus = 'minted' | 'listed' | 'transferred' | 'checked_in' | 'invalidated';

export interface Ticket {
  id: string;
  token_id: number;
  contract_address: string;
  event_id: string;
  tier_id: string;
  owner_wallet: string;
  status: TicketStatus;
  minted_at: string;
  checked_in_at?: string;
  tx_hash?: string;
  metadata_uri?: string;
  transfer_count: number;
  original_price_wei?: string;
  // Joined
  event?: TickETHEvent;
  tier?: TicketTier;
}

/* ─── Check-in ──────────────────────────────────────────── */

export interface QRPayload {
  ticketId: string;
  eventId: string;
  nonce: string;
  expiresAt: number;
  hmac: string;
}

export interface ScanResult {
  checkinLogId: string;
  result: 'success' | 'failed_invalid_ticket' | 'failed_already_checked_in' | 'failed_invalid_nonce' | 'failed_confirmation_timeout' | 'pending_confirmation';
  ticketId: string;
  message: string;
}

export interface CheckinLog {
  id: string;
  ticket_id: string;
  volunteer_id: string;
  scanned_at: string;
  confirmed_at?: string;
  result: 'success' | 'failed_invalid_ticket' | 'failed_already_checked_in' | 'failed_invalid_nonce' | 'failed_confirmation_timeout' | 'pending_confirmation';
}

/* ─── Marketplace ───────────────────────────────────────── */

export interface Listing {
  id: string;
  ticket_id: string;
  seller_wallet: string;
  price: string;  // wei string
  status: 'active' | 'sold' | 'cancelled';
  created_at: string;
  sold_at?: string;
  buyer_wallet?: string;
  tx_hash?: string;
  // Joined
  ticket?: Ticket;
}

/* ─── Organizer Request ─────────────────────────────────── */

export interface OrganizerRequest {
  id: string;
  wallet_address: string;
  org_name: string;
  bio: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
}

/* ─── API Responses ─────────────────────────────────────── */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

/* ─── Offline ───────────────────────────────────────────── */

export interface OfflineScan {
  id: string;
  qrData: string;
  scannedAt: number;
  synced: boolean;
}

export interface OwnershipSnapshot {
  eventId: string;
  tickets: Array<{
    ticketId: string;
    tokenId: number;
    ownerWallet: string;
    status: TicketStatus;
  }>;
  fetchedAt: number;
}
