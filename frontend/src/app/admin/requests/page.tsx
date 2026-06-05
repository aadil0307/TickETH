'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { TableRowSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { organizerRequestsApi } from '@/lib/api';
import { BLOCK_EXPLORER } from '@/lib/constants';
import { shortenAddress, formatRelativeTime } from '@/lib/utils';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';
import type { OrganizerRequest } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';

export default function AdminRequestsPage() {
  useRequireAuth(['admin']);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState<OrganizerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await organizerRequestsApi.list();
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : (res as any)?.data ?? [];
      setRequests(data);
    } catch (err) {
      toast.error(parseError(err).message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadRequests();
  }, [isAdmin, loadRequests]);

  const handleReview = async (requestId: string, decision: 'approved' | 'rejected') => {
    setProcessing(requestId);
    try {
      await organizerRequestsApi.review(requestId, { approved: decision === 'approved' });
      toast.success(`Request ${decision}`);
      loadRequests();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setProcessing(null);
    }
  };

  const filtered = Array.isArray(requests)
    ? requests.filter((r) => filter === 'all' || r.status === filter)
    : [];

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="mt-2 text-muted">Admin access required.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div>
            <button
              onClick={() => history.back()}
              className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Admin
            </button>
            <PageHeader category="Review" title="Organizer" highlight="Requests" description={`${requests.filter((r) => r.status === 'pending').length} pending review`} />
          </div>



          {/* Filter tabs */}
          <div className="mb-6 flex gap-2">
            {['pending', 'approved', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/25'
                    : 'bg-surface/80 border border-border/30 text-muted hover:text-foreground backdrop-blur-sm'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span className="ml-2 text-xs opacity-70">
                    ({requests.filter((r) => r.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Requests */}
          {loading ? (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <table className="w-full">
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={4} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={filter === 'pending' ? 'No pending requests' : 'No requests'}
              message={filter === 'pending' ? 'All organizer requests have been reviewed' : 'No requests match this filter'}
              icon={
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((req) => (
                <motion.div
                  key={req.id}
                  className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 hover:border-primary/20 transition-all"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <a
                          href={`${BLOCK_EXPLORER}/address/${(req as any).user?.walletAddress ?? (req as any).user?.wallet_address ?? ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {shortenAddress((req as any).user?.walletAddress ?? req.userId)}
                        </a>
                        <Badge status={req.status} />
                      </div>
                      {req.reason && (
                        <p className="text-sm text-muted">&ldquo;{req.reason}&rdquo;</p>
                      )}
                      <p className="text-xs text-muted mt-2">
                        Submitted {formatRelativeTime(req.submitted_at ?? req.createdAt)}
                      </p>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReview(req.id, 'rejected')}
                          loading={processing === req.id}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReview(req.id, 'approved')}
                          loading={processing === req.id}
                        >
                          Approve
                        </Button>
                      </div>
                    )}

                    {req.status === 'approved' && (
                      <span className="text-xs text-green-400">✓ Approved</span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="text-xs text-red-400">✗ Rejected</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
