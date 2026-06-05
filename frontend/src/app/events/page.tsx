'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CardSkeleton } from '@/components/Skeleton';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { eventsApi } from '@/lib/api';
import { formatDate, formatPrice, getTierPrice } from '@/lib/utils';
import { cn } from '@/lib/cn';
import { useDebounce } from '@/lib/hooks';
import { getErrorMessage } from '@/lib/error-parser';
import { SpotlightSection, TiltCard } from '@/components/ui/AnimatedElements';
import type { TickETHEvent, TicketTier } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: 'easeOut' as const },
  }),
};

type ViewMode = 'grid' | 'list';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'published', label: 'Published' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name', label: 'Name A-Z' },
];

function EventsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-synced state
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  const debouncedSearch = useDebounce(search, 300);

  const [events, setEvents] = useState<TickETHEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sort !== 'newest') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    const str = params.toString();
    router.replace(`/events${str ? `?${str}` : ''}`, { scroll: false });
  }, [debouncedSearch, statusFilter, sort, page, router]);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await eventsApi.list({
        page,
        limit: 12,
        search: debouncedSearch || undefined,
      });
      let data = Array.isArray(res.data) ? res.data : (res as unknown as { data: TickETHEvent[] }).data ?? [];

      // Client-side status filter
      if (statusFilter !== 'all') {
        data = data.filter((e) => e.status === statusFilter);
      }

      // Client-side sort
      if (sort === 'oldest') {
        data.sort((a, b) => new Date(a.createdAt ?? a.date ?? '').getTime() - new Date(b.createdAt ?? b.date ?? '').getTime());
      } else if (sort === 'name') {
        data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else {
        data.sort((a, b) => new Date(b.createdAt ?? b.date ?? '').getTime() - new Date(a.createdAt ?? a.date ?? '').getTime());
      }

      setEvents(data);
      setTotal(res.total ?? res.meta?.total ?? data.length);
      setTotalPages(res.totalPages ?? res.meta?.totalPages ?? 1);
    } catch (err) {
      setError(getErrorMessage(err));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, sort]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sort]);

  const getMinPrice = (tiers?: TicketTier[]) => {
    if (!tiers || tiers.length === 0) return null;
    const prices = tiers.map((t) => getTierPrice(t)).filter((p) => p && p !== '0');
    if (prices.length === 0) return null;
    return prices.reduce((min, p) => {
      const a = parseFloat(min || '0');
      const b = parseFloat(p || '0');
      return b < a ? p : min;
    }, prices[0]);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <PageHeader
            category="Discover"
            title="Browse"
            highlight="Events"
            description={loading ? 'Loading...' : `${total} event${total !== 1 ? 's' : ''} found`}
            right={
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-md p-1.5 transition-colors',
                    viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground',
                  )}
                  aria-label="Grid view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-md p-1.5 transition-colors',
                    viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground',
                  )}
                  aria-label="List view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                </button>
              </div>
            }
          />

          {/* Filters */}
          <div className="mb-8 flex flex-col sm:flex-row gap-3 rounded-2xl border border-border/30 bg-surface/60 backdrop-blur-sm p-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" /><path strokeLinecap="round" strokeWidth="2" d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search events by name or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-background/80 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all backdrop-blur-sm"
                aria-label="Search events"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-border/50 bg-background/80 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all backdrop-blur-sm"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-border/50 bg-background/80 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all backdrop-blur-sm"
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-8 rounded-xl border border-error/30 bg-error/10 p-4 flex items-center justify-between">
              <p className="text-sm text-error">{error}</p>
              <Button variant="outline" size="sm" onClick={loadEvents}>Retry</Button>
            </div>
          )}

          {/* Grid/List */}
          {loading ? (
            <div className={cn(
              viewMode === 'grid' ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-4',
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : events.length === 0 && !error ? (
            <EmptyState
              title="No events found"
              message={search ? 'Try a different search term or clear your filters' : 'Check back later for upcoming events'}
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              action={
                search || statusFilter !== 'all' ? (
                  <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === 'grid' ? (
            <AnimatePresence mode="wait">
              <motion.div
                key="grid"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {events.map((event, i) => {
                  const minPrice = getMinPrice(event.tiers);
                  return (
                    <motion.div key={event.id} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
                      <TiltCard glowColor="rgba(108, 99, 255, 0.1)">
                      <Link href={`/events/${event.id}`} className="group block">
                        <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                          <div className="relative h-48 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center overflow-hidden">
                            {(event.banner_url || event.bannerUrl) ? (
                              <img src={event.banner_url || event.bannerUrl} alt={event.title || event.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/40">
                                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            )}
                            <div className="absolute top-3 right-3"><Badge status={event.status} /></div>
                          </div>
                          <div className="p-5">
                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">{event.title || event.name}</h3>
                            <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              {event.start_time || event.startTime ? formatDate(event.start_time || event.startTime || '') : event.date ? formatDate(event.date) : 'TBA'}
                            </div>
                            {(event.location || event.venue) && (
                              <div className="mt-1.5 flex items-center gap-2 text-sm text-muted">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                <span className="line-clamp-1">{event.location || event.venue}</span>
                              </div>
                            )}
                            <div className="mt-4 flex items-center justify-between">
                              {minPrice !== null ? (
                                <span className="text-sm font-semibold text-primary">From {formatPrice(minPrice)}</span>
                              ) : (
                                <span className="text-sm text-muted">Price TBA</span>
                              )}
                              {event.tiers && event.tiers.length > 0 && (
                                <span className="text-xs text-muted">
                                  {event.tiers.reduce((sum, t) => sum + (t.maxSupply ?? t.supply ?? 0), 0)} tickets
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                      </TiltCard>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="list"
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {events.map((event, i) => {
                  const minPrice = getMinPrice(event.tiers);
                  return (
                    <motion.div key={event.id} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
                      <Link href={`/events/${event.id}`} className="group block">
                        <div className="rounded-xl border border-border/30 bg-surface/80 backdrop-blur-sm p-4 sm:p-5 flex gap-4 items-center hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
                          <div className="shrink-0 h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/50">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold group-hover:text-primary transition-colors truncate">{event.title || event.name}</h3>
                              <Badge status={event.status} />
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                              <span>{event.start_time || event.startTime ? formatDate(event.start_time || event.startTime || '') : event.date ? formatDate(event.date) : 'TBA'}</span>
                              {(event.location || event.venue) && <span>{event.location || event.venue}</span>}
                            </div>
                          </div>
                          <div className="hidden sm:block text-right shrink-0">
                            {minPrice !== null ? (
                              <span className="text-sm font-semibold text-primary">From {formatPrice(minPrice)}</span>
                            ) : (
                              <span className="text-sm text-muted">TBA</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="px-4 text-sm text-muted tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8"><div className="h-9 w-48 rounded-lg animate-shimmer" /><div className="mt-2 h-5 w-64 rounded-lg animate-shimmer" /></div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          </div>
        </main>
      </div>
    }>
      <EventsContent />
    </Suspense>
  );
}
