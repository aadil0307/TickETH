import { apiClient, setTokens, clearTokens } from './api-client';
import type {
  User,
  VerifyResponse,
  NonceResponse,
  TickETHEvent,
  TicketTier,
  Ticket,
  Listing,
  OrganizerRequest,
  PaginatedResponse,
  DashboardStats,
} from './types';

/* ════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════ */
export const authApi = {
  getNonce: async (address: string): Promise<NonceResponse> => {
    const { data } = await apiClient.get<NonceResponse>('/auth/nonce', {
      params: { address },
    });
    return data;
  },

  verify: async (message: string, signature: string): Promise<VerifyResponse> => {
    const { data } = await apiClient.post<VerifyResponse>('/auth/verify', {
      message,
      signature,
    });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },

  logout: () => clearTokens(),
};

/* ════════════════════════════════════════════════════
   USERS
   ════════════════════════════════════════════════════ */
export const usersApi = {
  getMe: () => apiClient.get<User>('/users/me').then((r) => r.data),
  updateProfile: (body: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
    consentGiven?: boolean;
  }) => apiClient.patch<User>('/users/me', body).then((r) => r.data),
  assignVolunteer: (walletAddress: string) =>
    apiClient.post('/users/assign-volunteer', { walletAddress }),
  revokeVolunteer: (walletAddress: string) =>
    apiClient.post('/users/revoke-volunteer', { walletAddress }),
};

/* ════════════════════════════════════════════════════
   EVENTS
   ════════════════════════════════════════════════════ */
export const eventsApi = {
  list: (params?: { page?: number; limit?: number; city?: string; search?: string }) =>
    apiClient
      .get<PaginatedResponse<TickETHEvent>>('/events', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<TickETHEvent>(`/events/${id}`).then((r) => r.data),

  getMyEvents: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<TickETHEvent>>('/events/organizer/mine', { params })
      .then((r) => r.data),

  create: (body: Record<string, any>) =>
    apiClient.post<TickETHEvent>('/events', body).then((r) => r.data),

  publish: (id: string) =>
    apiClient.post<TickETHEvent>(`/events/${id}/publish`).then((r) => r.data),

  cancel: (id: string) =>
    apiClient.post<TickETHEvent>(`/events/${id}/cancel`).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/events/${id}`).then((r) => r.data),
};

/* ════════════════════════════════════════════════════
   TIERS
   ════════════════════════════════════════════════════ */
export const tiersApi = {
  list: (eventId: string) =>
    apiClient.get<TicketTier[]>(`/events/${eventId}/tiers`).then((r) => r.data),

  batchCreate: (eventId: string, tiers: Record<string, any>[]) =>
    apiClient
      .post<TicketTier[]>(`/events/${eventId}/tiers/batch`, tiers)
      .then((r) => r.data),
};

/* ════════════════════════════════════════════════════
   TICKETS
   ════════════════════════════════════════════════════ */
export const ticketsApi = {
  mine: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<Ticket>>('/tickets/mine', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Ticket>(`/tickets/${id}`).then((r) => r.data),

  recordMint: (body: Record<string, any>) =>
    apiClient.post<Ticket>('/tickets/record-mint', body).then((r) => r.data),
};

/* ════════════════════════════════════════════════════
   MARKETPLACE
   ════════════════════════════════════════════════════ */
export const marketplaceApi = {
  listings: (params?: { eventId?: string; page?: number; limit?: number; status?: string }) =>
    apiClient
      .get<PaginatedResponse<Listing>>('/marketplace/listings', { params })
      .then((r) => r.data),

  create: (body: { ticketId: string; askingPriceWei: string; askingPrice?: number; listingTxHash?: string }) =>
    apiClient.post<Listing>('/marketplace/list', body).then((r) => r.data),

  completeSale: (listingId: string, body?: Record<string, any>) =>
    apiClient.post(`/marketplace/complete-sale/${listingId}`, body),

  cancel: (listingId: string) =>
    apiClient.post(`/marketplace/cancel/${listingId}`),
};

/* ════════════════════════════════════════════════════
   ORGANIZER REQUESTS
   ════════════════════════════════════════════════════ */
export const organizerRequestsApi = {
  submit: (body: Record<string, any>) =>
    apiClient.post<OrganizerRequest>('/organizer-requests', body).then((r) => r.data),

  mine: () =>
    apiClient.get<OrganizerRequest[]>('/organizer-requests/mine').then((r) => r.data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient
      .get<PaginatedResponse<OrganizerRequest>>('/organizer-requests', { params })
      .then((r) => r.data),

  review: (id: string, body: { approved: boolean; rejectionReason?: string }) =>
    apiClient.patch(`/organizer-requests/${id}/review`, body),
};

/* ════════════════════════════════════════════════════
   ADMIN
   ════════════════════════════════════════════════════ */
export const adminApi = {
  dashboard: () =>
    apiClient.get<DashboardStats>('/admin/dashboard').then((r) => r.data),

  users: (params?: { page?: number; limit?: number; role?: string }) =>
    apiClient
      .get<PaginatedResponse<User>>('/admin/users', { params })
      .then((r) => r.data),

  changeRole: (userId: string, role: string) =>
    apiClient.patch(`/admin/users/${userId}/role`, { role }),

  deleteUser: (userId: string) => apiClient.delete(`/admin/users/${userId}`),
};

/* ════════════════════════════════════════════════════
   BLOCKCHAIN
   ════════════════════════════════════════════════════ */
export const blockchainApi = {
  deploy: (eventIdOrBody: string | Record<string, any>) => {
    const body = typeof eventIdOrBody === 'string' ? { eventId: eventIdOrBody } : eventIdOrBody;
    return apiClient.post('/blockchain/deploy', body).then((r) => r.data);
  },
};

/* ════════════════════════════════════════════════════

   CHECK-IN (Organizer dashboard)
   ════════════════════════════════════════════════════ */
export const checkinApi = {
  liveCount: (eventId: string) =>
    apiClient
      .get<{ count: number }>(`/checkin/event/${eventId}/count`)
      .then((r) => r.data),
};

/* ════════════════════════════════════════════════════
   UPLOADS (Image upload for avatars & banners)
   ════════════════════════════════════════════════════ */
export const uploadsApi = {
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<{ url: string; message: string }>('/uploads/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  uploadBanner: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<{ url: string; message: string }>('/uploads/banner', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

/* ════════════════════════════════════════════════════
   SUPPORT
   ════════════════════════════════════════════════════ */
export const supportApi = {
  getFaq: () =>
    apiClient.get<any[]>('/support/faq').then((r) => r.data),

  createTicket: (body: { category: string; subject: string; message: string }) =>
    apiClient.post('/support/tickets', body).then((r) => r.data),

  getMyTickets: (params?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/support/tickets/mine', { params }).then((r) => r.data),

  getTicket: (id: string) =>
    apiClient.get<any>(`/support/tickets/${id}`).then((r) => r.data),

  reply: (ticketId: string, body: { message: string }) =>
    apiClient.post(`/support/tickets/${ticketId}/reply`, body).then((r) => r.data),

  // Admin
  listAll: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<PaginatedResponse<any>>('/support/admin/tickets', { params }).then((r) => r.data),

  updateStatus: (ticketId: string, status: string) =>
    apiClient.patch(`/support/admin/tickets/${ticketId}/status`, { status }).then((r) => r.data),
};
