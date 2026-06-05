/** User roles matching the DB enum */
export enum UserRole {
  VISITOR = 'visitor',
  ATTENDEE = 'attendee',
  ORGANIZER = 'organizer',
  ADMIN = 'admin',
  VOLUNTEER = 'volunteer',
}

/** Event status matching the DB enum */
export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  LIVE = 'live',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/** Ticket status matching the DB enum */
export enum TicketStatus {
  MINTED = 'minted',
  LISTED = 'listed',
  TRANSFERRED = 'transferred',
  CHECKED_IN = 'checked_in',
  INVALIDATED = 'invalidated',
}

/** Organizer request status */
export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** Check-in result */
export enum CheckinResult {
  SUCCESS = 'success',
  FAILED_INVALID_TICKET = 'failed_invalid_ticket',
  FAILED_ALREADY_CHECKED_IN = 'failed_already_checked_in',
  FAILED_INVALID_NONCE = 'failed_invalid_nonce',
  FAILED_CONFIRMATION_TIMEOUT = 'failed_confirmation_timeout',
  PENDING_CONFIRMATION = 'pending_confirmation',
}

/** Audit actions */
export enum AuditAction {
  USER_CREATED = 'user_created',
  ROLE_CHANGED = 'role_changed',
  ORGANIZER_REQUEST_SUBMITTED = 'organizer_request_submitted',
  ORGANIZER_REQUEST_APPROVED = 'organizer_request_approved',
  ORGANIZER_REQUEST_REJECTED = 'organizer_request_rejected',
  EVENT_CREATED = 'event_created',
  EVENT_PUBLISHED = 'event_published',
  EVENT_COMPLETED = 'event_completed',
  EVENT_CANCELLED = 'event_cancelled',
  EVENT_DELETED = 'event_deleted',
  TICKET_MINTED = 'ticket_minted',
  TICKET_TRANSFERRED = 'ticket_transferred',
  TICKET_CHECKED_IN = 'ticket_checked_in',
  TICKET_INVALIDATED = 'ticket_invalidated',
  TICKET_LISTED = 'ticket_listed',
  TICKET_DELISTED = 'ticket_delisted',
  TICKET_RESOLD = 'ticket_resold',
  LISTING_CANCELLED = 'listing_cancelled',
  ADMIN_ACTION = 'admin_action',
}

/** Marketplace listing status */
export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

/** Support ticket status */
export enum SupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}
