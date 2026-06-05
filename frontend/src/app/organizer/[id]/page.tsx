'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { StatCard } from '@/components/StatCard';
import { Skeleton } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import { eventsApi, tiersApi, blockchainApi, checkinApi } from '@/lib/api';
import { BLOCK_EXPLORER } from '@/lib/constants';
import { formatDate, formatDateTime, formatPrice, getTierPrice, shortenAddress, formatCompact } from '@/lib/utils';
import { useCopyToClipboard, useRequireAuth } from '@/lib/hooks';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';
import type { TickETHEvent, TicketTier } from '@/lib/types';

export default function ManageEventPage() {
  useRequireAuth(['organizer', 'admin']);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<TickETHEvent | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, tiersData] = await Promise.all([
        eventsApi.getById(id),
        tiersApi.list(id),
      ]);
      setEvent(eventData);
      setTiers(Array.isArray(tiersData) ? tiersData : []);

      // Try getting live check-in count
      try {
        const countData = await checkinApi.liveCount(id);
        setLiveCount(countData?.count ?? 0);
      } catch {}
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      await blockchainApi.deploy(id);
      toast.success('Contract deployed successfully!');
      loadData();
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setDeploying(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await eventsApi.publish(id);
      toast.success('Event published successfully!');
      loadData();
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await eventsApi.cancel(id);
      toast.success('Event cancelled');
      setShowCancel(false);
      loadData();
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await eventsApi.delete(id);
      toast.success('Event deleted successfully');
      setShowDelete(false);
      router.push('/organizer');
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setDeleting(false);
    }
  };

  const totalCapacity = tiers.reduce((sum, t) => sum + (t.maxSupply || t.max_supply || 0), 0);
  const totalMinted = tiers.reduce((sum, t) => sum + (t.mintedCount || t.minted || 0), 0);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-5xl">
            <Skeleton className="h-8 w-64 mb-6" />
            <div className="grid gap-4 sm:grid-cols-4 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Event not found</h2>
            <Button className="mt-6" onClick={() => router.push('/organizer')}>
              Back to Dashboard
            </Button>
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
          {/* Back */}
          <button
            onClick={() => router.push('/organizer')}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold">
                  <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">{event.name || event.title}</span>
                </h1>
                <Badge status={event.status} />
              </div>
              <p className="mt-2 text-muted">
                {(event.start_time || event.startTime || event.date) ? formatDateTime(event.start_time || event.startTime || event.date || '') : 'TBA'}
                {(event.venue || event.location) ? ` · ${event.venue || event.location}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!(event.contractAddress || event.contract_address) && (
                <Button onClick={handleDeploy} loading={deploying} size="sm">
                  Deploy Contract
                </Button>
              )}
              {event.status === 'draft' && (event.contractAddress || event.contract_address) && (
                <Button onClick={handlePublish} loading={publishing} size="sm">
                  Publish Event
                </Button>
              )}
              {event.status !== 'cancelled' && event.status !== 'completed' && (
                <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}>
                  Cancel Event
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Event
              </Button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)} className="hover:text-error/70">✕</button>
            </div>
          )}

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Capacity" value={formatCompact(totalCapacity)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              </svg>
            } />
            <StatCard title="Tickets Minted" value={formatCompact(totalMinted)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
            } />
            <StatCard title="Mint Rate" value={totalCapacity > 0 ? `${Math.round((totalMinted / totalCapacity) * 100)}%` : '0%'} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            } />
            <StatCard title="Live Check-ins" value={String(liveCount)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            } />
          </div>

          {/* Contract info */}
          {(event.contractAddress || event.contract_address) && (
            <motion.div
              className="mb-8 rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              <h2 className="text-lg font-bold mb-4">
                Smart{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Contract</span>
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">Address:</span>
                <a
                  href={`${BLOCK_EXPLORER}/address/${event.contractAddress || event.contract_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-primary hover:underline"
                >
                  {event.contractAddress || event.contract_address}
                </a>
                <button
                  onClick={() => copy(event.contractAddress || event.contract_address || '')}
                  className="text-muted hover:text-foreground transition-colors"
                  aria-label="Copy contract address"
                >
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Tiers */}
          <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6">
            <h2 className="text-lg font-bold mb-4">
              Ticket{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Tiers</span>
            </h2>
            {tiers.length === 0 ? (
              <p className="text-sm text-muted">No tiers configured</p>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier) => {
                  const supply = tier.maxSupply || tier.max_supply || 0;
                  const minted = tier.mintedCount || tier.minted || 0;
                  const percent = supply ? (minted / supply) * 100 : 0;
                  return (
                    <div
                      key={tier.id}
                      className="rounded-xl border border-border/30 bg-background/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-primary/20 transition-all"
                    >
                      <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{tier.name}</h3>
                        {tier.description && (
                          <p className="text-xs text-muted mt-1">{tier.description}</p>
                        )}
                      </div>
                    </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-muted">Price: </span>
                          <span className="font-semibold text-primary">{formatPrice(getTierPrice(tier))}</span>
                        </div>
                        <div>
                          <span className="text-muted">Sold: </span>
                          <span className="font-semibold">{tier.mintedCount || tier.minted || 0}/{tier.maxSupply || tier.max_supply}</span>
                        </div>
                        <div className="w-24 h-2 rounded-full bg-surface-light overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Cancel Modal */}
      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel Event">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to cancel <strong>{event.name || event.title}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCancel(false)}>
              Keep Event
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              Cancel Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Event">
        <div className="space-y-4">
          <div className="rounded-xl border border-error/30 bg-error/5 p-4">
            <p className="text-sm text-error font-medium mb-2">⚠️ This action is permanent</p>
            <p className="text-xs text-muted">
              Deleting <strong className="text-foreground">{event.name || event.title}</strong> will
              permanently remove the event, its tiers, and all associated data from the platform.
              Events with minted tickets cannot be deleted.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
