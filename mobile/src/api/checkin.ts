import { apiClient } from './client';
import type { QRPayload, ScanResult, CheckinLog } from '../types';

/** Get a fresh QR code payload for a ticket */
export async function getQRCode(ticketId: string, eventId: string): Promise<QRPayload> {
  const { data } = await apiClient.get<QRPayload>(`/checkin/qr/${ticketId}`, {
    params: { eventId },
  });
  return data;
}

/**
 * Volunteer: scan a QR code.
 * The QR content is a JSON string representing QRPayload.
 * We parse it and send the individual fields as ScanTicketDto.
 */
export async function scanQR(qrData: string): Promise<ScanResult> {
  // Parse the JSON QR payload
  let parsed: QRPayload;
  try {
    parsed = JSON.parse(qrData) as QRPayload;
  } catch {
    throw new Error('Invalid QR code — could not parse data');
  }
  const { data } = await apiClient.post<ScanResult>('/checkin/scan', {
    ticketId: parsed.ticketId,
    eventId: parsed.eventId,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt,
    hmac: parsed.hmac,
  });
  return data;
}

/** Attendee: confirm check-in (matches ConfirmCheckinDto) */
export async function confirmCheckin(
  checkinLogId: string,
  attendeeWallet?: string,
): Promise<{ success: boolean }> {
  const { data } = await apiClient.post('/checkin/confirm', {
    checkinLogId,
    attendeeWallet,
  });
  return data;
}

/** Sync offline scans (volunteer) */
export async function syncOfflineScans(scans: Array<{ qrData: string; scannedAt: number }>): Promise<{
  synced: number;
  failed: number;
  results: ScanResult[];
}> {
  const { data } = await apiClient.post('/checkin/offline-sync', { scans });
  return data;
}

/** Get a single check-in log by ID (for polling confirmation status) */
export async function getCheckinStatus(checkinLogId: string): Promise<CheckinLog> {
  const { data } = await apiClient.get<CheckinLog>(`/checkin/status/${checkinLogId}`);
  return data;
}

/** Get check-in count for an event */
export async function getCheckinCount(eventId: string): Promise<{ checked_in: number; total: number }> {
  const { data } = await apiClient.get(`/checkin/event/${eventId}/count`);
  return data;
}

/** Get check-in logs for an event */
export async function getCheckinLogs(eventId: string): Promise<CheckinLog[]> {
  const { data } = await apiClient.get<CheckinLog[]>(`/checkin/event/${eventId}/logs`);
  return data;
}
