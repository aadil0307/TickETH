import { useState, useEffect, useCallback, useRef } from 'react';
import { checkinApi } from '../api';
import type { QRPayload, ScanResult } from '../types';
import { QR_REFRESH_INTERVAL } from '../constants/config';
import { useOfflineStore } from '../stores/offlineStore';

/**
 * Hook for attendees — manages dynamic QR code that refreshes automatically
 */
export function useTicketQR(ticketId: string, eventId: string) {
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canFetch = Boolean(ticketId && eventId);

  const fetchQR = useCallback(async () => {
    if (!canFetch) {
      setQrPayload(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await checkinApi.getQRCode(ticketId, eventId);
      setQrPayload(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to get QR code');
    } finally {
      setLoading(false);
    }
  }, [ticketId, eventId, canFetch]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchQR();
    intervalRef.current = setInterval(fetchQR, QR_REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchQR]);

  return { qrPayload, loading, error, refresh: fetchQR };
}

/**
 * Hook for volunteers — manages QR scanning and result handling
 */
export function useScanCheckin() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const addScan = useOfflineStore((s) => s.addScan);

  const handleScan = useCallback(
    async (qrData: string) => {
      setLoading(true);
      setError(null);
      setScanResult(null);

      if (!isOnline) {
        // Queue offline
        try {
          await addScan({
            id: `scan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            qrData,
            scannedAt: Date.now(),
          });
          setScanResult({
            checkinLogId: '',
            result: 'pending_confirmation',
            ticketId: '',
            message: 'Scan queued for sync (offline mode)',
          });
        } catch (err: any) {
          setError(err.message);
        }
        setLoading(false);
        return;
      }

      try {
        const result = await checkinApi.scanQR(qrData);
        setScanResult(result);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Scan failed');
      } finally {
        setLoading(false);
      }
    },
    [isOnline, addScan],
  );

  const reset = useCallback(() => {
    setScanResult(null);
    setError(null);
  }, []);

  // ── Auto-poll for confirmation when result is pending ──────
  useEffect(() => {
    if (
      !scanResult ||
      scanResult.result !== 'pending_confirmation' ||
      !scanResult.checkinLogId
    ) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const status = await checkinApi.getCheckinStatus(scanResult.checkinLogId);
        if (status.result === 'success') {
          setScanResult({
            ...scanResult,
            result: 'success',
            message: 'Attendee confirmed — entry granted!',
          });
        } else if (status.result !== 'pending_confirmation') {
          setScanResult({
            ...scanResult,
            result: status.result as ScanResult['result'],
            message:
              status.result === 'failed_confirmation_timeout'
                ? 'Attendee did not confirm in time.'
                : 'Check-in failed.',
          });
        }
      } catch {
        // Silently retry on next tick
      }
    }, 3_000);

    // Hard timeout after 2 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      setScanResult((prev) =>
        prev && prev.result === 'pending_confirmation'
          ? {
              ...prev,
              result: 'failed_confirmation_timeout',
              message: 'Confirmation timed out after 2 minutes.',
            }
          : prev,
      );
    }, 120_000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [scanResult?.checkinLogId, scanResult?.result]);

  return { scanResult, loading, error, handleScan, reset };
}
