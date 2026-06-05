'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { StatCard } from '@/components/StatCard';
import { CardSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { eventsApi, organizerRequestsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { formatDate, formatCompact } from '@/lib/utils';
import { parseError } from '@/lib/error-parser';
import { TiltCard, GlowBorder } from '@/components/ui/AnimatedElements';
import { toast } from 'sonner';
import type { TickETHEvent, OrganizerRequest } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function OrganizerDashboardPage() {
  useRequireAuth();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<TickETHEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await eventsApi.getMyEvents();
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : (res as any)?.data ?? [];
      setEvents(data);
    } catch (err) {
      toast.error(parseError(err).message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOrganizerRequest = useCallback(async () => {
    try {
      const mineData = await organizerRequestsApi.mine();
      const data = Array.isArray(mineData) ? mineData : [];
      if (data.length > 0) {
        const latest = data.sort(
          (a: OrganizerRequest, b: OrganizerRequest) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        setRequestStatus(latest.status);
      }
    } catch {
      setRequestStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (isOrganizer) {
        loadEvents();
      } else {
        checkOrganizerRequest();
      }
    }
  }, [user, isOrganizer, loadEvents, checkOrganizerRequest]);

  const handleRequestRole = async () => {
    if (!orgName.trim()) {
      toast.error('Please enter your organization name.');
      return;
    }
    setSubmitting(true);
    try {
      await organizerRequestsApi.submit({ orgName: orgName.trim() });
      setRequestStatus('pending');
      toast.success('Request submitted successfully!');
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await eventsApi.delete(deleteId);
      toast.success('Event deleted successfully');
      setEvents((prev) => prev.filter((e) => e.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const totalTickets = events.reduce((sum, e) => {
    const tiers = (e as any).tiers ?? [];
    return sum + tiers.reduce((s: number, t: any) => s + (t.max_supply || 0), 0);
  }, 0);

  const totalMinted = events.reduce((sum, e) => {
    const tiers = (e as any).tiers ?? [];
    return sum + tiers.reduce((s: number, t: any) => s + (t.minted || 0), 0);
  }, 0);

  // Not signed in
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Connect your wallet"
            message="Sign in to access the organizer dashboard"
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M22 10H2" />
              </svg>
            }
          />
        </main>
        <Footer />
      </div>
    );
  }

  // Not an organizer — show request page
  if (!isOrganizer) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <motion.div
            className="max-w-md w-full rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-8 text-center shadow-2xl shadow-primary/10"
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">
              Become an{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Organizer</span>
            </h2>
            <p className="mt-2 text-sm text-muted">
              Request organizer access to create and manage events on TickETH.
            </p>

            {requestStatus === 'pending' && (
              <div className="mt-6 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4">
                <p className="text-sm text-yellow-400 font-medium">Your request is pending review</p>
                <p className="text-xs text-muted mt-1">An admin will review your request shortly.</p>
              </div>
            )}
            {requestStatus === 'rejected' && (
              <div className="mt-6 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                <p className="text-sm text-red-400 font-medium">Your request was declined</p>
                <p className="text-xs text-muted mt-1">You can submit a new request.</p>
              </div>
            )}
            {(requestStatus === null || requestStatus === 'rejected') && (
              <div className="mt-6 space-y-3">
                <input
                  type="text"
                  placeholder="Organization / Brand name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-light px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <Button
                  className="w-full"
                  onClick={handleRequestRole}
                  loading={submitting}
                  disabled={!orgName.trim()}
                >
                  Request Organizer Access
                </Button>
              </div>
            )}
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // Organizer dashboard
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <PageHeader
            category="Dashboard"
            title="Dashboard"
            highlight="Organizer"
            highlightFirst
            description="Manage your events and track performance"
            right={
              <div className="flex items-center gap-3">
                <Link href="/organizer/volunteers">
                  <Button variant="outline">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Manage Volunteers
                  </Button>
                </Link>
                <Link href="/organizer/create">
                  <Button>+ Create Event</Button>
                </Link>
              </div>
            }
          />

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Events" value={String(events.length)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            } />
            <StatCard title="Published" value={String(events.filter((e) => e.status === 'published').length)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            } />
            <StatCard title="Total Capacity" value={formatCompact(totalTickets)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              </svg>
            } />
            <StatCard title="Tickets Minted" value={formatCompact(totalMinted)} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            } />
          </div>

          {/* Events list */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              title="No events yet"
              message="Create your first event to get started"
              icon={
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              action={
                <Link href="/organizer/create">
                  <Button>Create Your First Event</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial="hidden" animate="visible" variants={fadeUp} custom={i}
                >
                  <Link href={`/organizer/${event.id}`} className="group block">
                    <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all">
                      <div className="h-36 bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center relative">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/40">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                        </svg>
                        <div className="absolute top-3 left-3">
                          <button
                            type="button"
                            title="Delete event"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTitle(event.title || event.name);
                              setDeleteId(event.id);
                            }}
                            className="rounded-lg bg-surface/80 backdrop-blur p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </div>
                        <div className="absolute top-3 right-3">
                          <Badge status={event.status} />
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">
                          {event.title || event.name}
                        </h3>
                        <p className="mt-2 text-sm text-muted">
                          {(event.start_time || event.startTime || event.date) ? formatDate(event.start_time || event.startTime || event.date!) : 'TBA'}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted">
                          <span>{(event as any).tiers?.length ?? 0} tiers</span>
                          <span>
                            {(event as any).tiers?.reduce((s: number, t: any) => s + (t.minted || 0), 0) ?? 0} minted
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteId} onClose={() => !deleting && setDeleteId(null)}>
        <h2 className="text-lg font-bold">Delete Event</h2>
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
          <p className="text-sm text-red-400 font-medium">⚠️ This action is permanent</p>
          <p className="mt-1 text-xs text-muted">
            &ldquo;{deleteTitle}&rdquo; will be permanently removed. Events with minted tickets cannot be deleted.
          </p>
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteEvent}
            loading={deleting}
            className="!bg-red-600 hover:!bg-red-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            Delete Permanently
          </Button>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
