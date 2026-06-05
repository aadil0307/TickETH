'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { CardSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ticketsApi } from '@/lib/api';
import { BLOCK_EXPLORER } from '@/lib/constants';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { formatDate, shortenAddress } from '@/lib/utils';
import { cn } from '@/lib/cn';
import { parseError } from '@/lib/error-parser';
import { TiltCard, SpotlightSection } from '@/components/ui/AnimatedElements';
import { toast } from 'sonner';
import type { Ticket, TicketStatus } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Valid', value: 'valid' },
  { label: 'Used', value: 'used' },
  { label: 'Listed', value: 'listed' },
  { label: 'Transferred', value: 'transferred' },
];

function statusColor(status: TicketStatus | string): string {
  switch (status) {
    case 'valid': case 'minted': return 'text-success';
    case 'used': case 'checked_in': return 'text-muted';
    case 'listed': return 'text-accent';
    case 'transferred': return 'text-warning';
    case 'invalidated': return 'text-error';
    default: return 'text-muted';
  }
}

export default function MyTicketsPage() {
  useRequireAuth();
  const { user } = useAuthStore();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ticketsApi.mine();
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : (res as any)?.data ?? [];
      setTickets(data);
    } catch (err) {
      setError(parseError(err).message);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadTickets();
    else setLoading(false);
  }, [user, loadTickets]);

  const filtered = Array.isArray(tickets)
    ? tickets.filter((t) => filter === 'all' || t.status === filter)
    : [];

  const counts = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  /* ─── Not signed in ──── */
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Connect your wallet"
            message="Sign in with your wallet to view your NFT tickets"
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M22 10H2" /><path d="M6 14h.01" />
              </svg>
            }
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          {/* Header + Stats */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <PageHeader
                category="Collection"
                title="My"
                highlight="Tickets"
                description={
                  tickets.length > 0
                    ? `${tickets.length} NFT ticket${tickets.length !== 1 ? 's' : ''} in your collection`
                    : 'Your NFT ticket collection'
                }
              />
              <Button variant="outline" onClick={loadTickets} size="sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                Refresh
              </Button>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => {
                const count = f.value === 'all' ? tickets.length : (counts[f.value] || 0);
                return (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all',
                      filter === f.value
                        ? 'bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/25'
                        : 'bg-surface/80 border border-border/30 text-muted hover:border-primary/30 hover:text-foreground backdrop-blur-sm',
                    )}
                  >
                    {f.label}
                    <span className={cn(
                      'ml-1 text-xs tabular-nums',
                      filter === f.value ? 'text-white/70' : 'text-muted/70',
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error state */}
          {error && !loading && (
            <div className="mb-8 rounded-2xl border border-error/30 bg-error/5 p-6 text-center">
              <p className="text-sm text-error mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={loadTickets}>Retry</Button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`}
              message={
                filter === 'all'
                  ? 'Browse events and mint your first NFT ticket'
                  : 'Try a different filter'
              }
              icon={
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
                </svg>
              }
              action={
                filter === 'all' ? (
                  <Link
                    href="/events"
                    className="inline-flex items-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-light transition-colors"
                  >
                    Browse Events
                  </Link>
                ) : (
                  <button
                    onClick={() => setFilter('all')}
                    className="inline-flex items-center rounded-xl border border-border px-6 py-2.5 text-sm font-semibold hover:border-primary/30 transition-colors"
                  >
                    Clear Filter
                  </button>
                )
              }
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {filtered.map((ticket, i) => {
                  const tokenId = ticket.tokenId ?? ticket.token_id;
                  const eventName = ticket.event?.name || ticket.event?.title || `Event #${ticket.eventId || ticket.event_id}`;
                  const eventDate = ticket.event?.date || ticket.event?.start_time || ticket.event?.startTime;
                  const tierName = ticket.tier?.name || 'General';
                  const hash = ticket.txHash || ticket.tx_hash;
                  const eventId = ticket.eventId || ticket.event_id;
                  const ticketStatus = ticket.status;

                  return (
                    <motion.div
                      key={ticket.id}
                      initial="hidden" animate="visible" variants={fadeUp} custom={i}
                    >
                      <TiltCard glowColor="rgba(108, 99, 255, 0.1)">
                      <div className="group rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all">
                        {/* Ticket header */}
                        <div className="relative h-32 bg-gradient-to-br from-primary/25 via-accent/10 to-primary/5 flex items-center justify-center">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/50">
                            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                            <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
                          </svg>
                          <div className="absolute top-3 right-3">
                            <Badge status={ticketStatus} />
                          </div>
                          {tokenId != null && (
                            <span className="absolute bottom-3 left-3 text-xs font-mono text-primary/70 bg-background/80 backdrop-blur-sm rounded-md px-2 py-0.5">
                              #{tokenId}
                            </span>
                          )}
                        </div>

                        <div className="p-5 space-y-3">
                          <h3 className="font-bold text-lg line-clamp-1">{eventName}</h3>

                          <div className="flex items-center gap-2 text-sm text-muted">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                              <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                            {tierName}
                          </div>

                          {eventDate && (
                            <div className="flex items-center gap-2 text-sm text-muted">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              {formatDate(eventDate)}
                            </div>
                          )}

                          {hash && (
                            <a
                              href={`${BLOCK_EXPLORER}/tx/${hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              View on Polygonscan
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </a>
                          )}

                          <div className="flex gap-2 pt-2">
                            {(ticketStatus === 'valid' || ticketStatus === 'minted') && (
                              <>
                                <Link
                                  href={`/marketplace?list=${ticket.id}`}
                                  className="flex-1 rounded-lg border border-border bg-surface-light px-3 py-2 text-center text-xs font-semibold hover:border-primary/30 transition-colors"
                                >
                                  List for Sale
                                </Link>
                                <Link
                                  href={`/tickets/${ticket.id}/transfer`}
                                  className="flex-1 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
                                >
                                  Transfer
                                </Link>
                              </>
                            )}
                            <Link
                              href={`/events/${eventId}`}
                              className={cn(
                                'rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/20 transition-colors',
                                ticketStatus !== 'valid' && ticketStatus !== 'minted' ? 'flex-1' : '',
                              )}
                            >
                              View Event
                            </Link>
                          </div>
                        </div>
                      </div>
                      </TiltCard>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
