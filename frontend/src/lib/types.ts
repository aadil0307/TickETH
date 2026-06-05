/* ─── User Roles ─────────────────────────────────────────── */
export type UserRole = 'visitor' | 'attendee' | 'organizer' | 'admin' | 'volunteer';

export interface User {
  id: string;
  walletAddress: string;
  wallet_address?: string;
  email?: string;
  role: UserRole;
  displayName?: string;
  display_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  createdAt: string;
  created_at?: string;
}

/* ─── Auth ───────────────────────────────────────────────── */
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

/* ─── Events ─────────────────────────────────────────────── */
export type EventStatus = 'draft' | 'published' | 'live' | 'completed' | 'cancelled';

export interface TickETHEvent {
  id: string;
  organizerId?: string;
  organizer_id?: string;
  name: string;
  title?: string;
  description: string;
  bannerUrl?: string;
  banner_url?: string;
  venue?: string;
  location?: string;
  city?: string;
  date?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  contractAddress?: string;
  contract_address?: string;
  status: EventStatus;
  chainId?: number;
  createdAt?: string;
  updatedAt?: string;
  organizer?: User;
  tiers?: TicketTier[];
  totalTickets?: number;
  ticketsSold?: number;
}

/* ─── Ticket Tiers ───────────────────────────────────────── */
export interface TicketTier {
  id: string;
  eventId?: string;
  event_id?: string;
  name: string;
  price: string;
  price_wei?: string;
  priceWei?: string;
  supply?: number;
  max_supply?: number;
  maxSupply?: number;
  minted?: number;
  mintedCount?: number;
  resaleAllowed?: boolean;
  resale_allowed?: boolean;
  max_resales?: number;
  maxResales?: number;
  max_price_deviation_bps?: number;
  maxPriceDeviationBps?: number;
  metadataUri?: string;
  description?: string;
  tier_index?: number;
  tierId?: number;
  currency?: string;
  active?: boolean;
}

/* ─── Tickets ────────────────────────────────────────────── */
export type TicketStatus = 'valid' | 'minted' | 'listed' | 'transferred' | 'used' | 'checked_in' | 'invalidated';

export interface Ticket {
  id: string;
  tokenId?: number;
  token_id?: number;
  contractAddress?: string;
  contract_address?: string;
  eventId: string;
  event_id?: string;
  tierId?: string;
  tier_id?: string;
  ownerWallet?: string;
  owner_wallet?: string;
  status: TicketStatus;
  mintedAt?: string;
  minted_at?: string;
  checkedInAt?: string;
  txHash?: string;
  tx_hash?: string;
  metadataUri?: string;
  transferCount?: number;
  transfer_count?: number;
  originalPriceWei?: string;
  original_price_wei?: string;
  event?: TickETHEvent;
  tier?: TicketTier;
}

/* ─── Marketplace ────────────────────────────────────────── */
export type ListingStatus = 'active' | 'sold' | 'cancelled';

export interface Listing {
  id: string;
  ticketId?: string;
  ticket_id?: string;
  sellerAddress?: string;
  sellerWallet?: string;
  seller_wallet?: string;
  listingId?: number;
  listing_id?: number;
  price?: string;
  askingPrice?: number;
  asking_price?: number;
  askingPriceWei?: string;
  asking_price_wei?: string;
  originalPrice?: number;
  original_price?: number;
  originalPriceWei?: string;
  original_price_wei?: string;
  contractAddress?: string;
  contract_address?: string;
  tokenId?: number;
  token_id?: number;
  eventId?: string;
  event_id?: string;
  status: ListingStatus;
  createdAt?: string;
  created_at?: string;
  soldAt?: string;
  buyerWallet?: string;
  buyer_wallet?: string;
  txHash?: string;
  tx_hash?: string;
  ticket?: Ticket;
  event?: TickETHEvent;
}

/* ─── Organizer Requests ─────────────────────────────────── */
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizerRequest {
  id: string;
  userId?: string;
  walletAddress?: string;
  wallet_address?: string;
  orgName?: string;
  org_name?: string;
  bio?: string;
  reason?: string;
  status: RequestStatus;
  createdAt: string;
  submitted_at?: string;
  reviewedAt?: string;
  reviewed_at?: string;
  user?: User;
}

/* ─── Check-in ───────────────────────────────────────────── */
export interface CheckinLog {
  id: string;
  ticketId?: string;
  ticket_id?: string;
  volunteerId?: string;
  volunteer_id?: string;
  scannedAt?: string;
  scanned_at?: string;
  confirmedAt?: string;
  confirmed_at?: string;
  result: string;
}

/* ─── Pagination ─────────────────────────────────────────── */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  hasMore?: boolean;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}


/* ─── Dashboard Stats ────────────────────────────────────── */
export interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  totalTickets: number;
  totalRevenue?: string;
  pendingRequests?: number;
}

export interface EventStats {
  totalTickets: number;
  ticketsSold: number;
  ticketsCheckedIn: number;
  revenue: string;
}
