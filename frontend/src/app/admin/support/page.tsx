'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Badge } from '@/components/Badge';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { supportApi } from '@/lib/api';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';
import { shortenAddress, formatDate } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const STATUS_OPTIONS = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/20',
  closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    wallet_address: string;
    display_name?: string;
    avatar_url?: string;
    role: string;
  };
  replies?: Array<{
    id: string;
    message: string;
    is_admin: boolean;
    created_at: string;
    user?: { display_name?: string; wallet_address: string };
  }>;
}

export default function AdminSupportPage() {
  useRequireAuth(['admin', 'organizer']);
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const isAuthorized = user?.role === 'admin' || user?.role === 'organizer';

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page: 1, limit: 50 };
      if (filter !== 'all') params.status = filter;
      const result = await supportApi.listAll(params);
      setTickets(result.data ?? []);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (isAuthorized) loadTickets();
  }, [isAuthorized, loadTickets]);

  const openTicketDetail = useCallback(async (ticketId: string) => {
    try {
      setDetailLoading(true);
      const detail = await supportApi.getTicket(ticketId);
      setSelectedTicket(detail);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleReply = useCallback(async () => {
    if (!selectedTicket || !replyText.trim()) return;
    try {
      setReplying(true);
      await supportApi.reply(selectedTicket.id, { message: replyText.trim() });
      toast.success('Reply sent');
      setReplyText('');
      // Refresh ticket detail
      await openTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setReplying(false);
    }
  }, [selectedTicket, replyText, openTicketDetail, loadTickets]);

  const handleStatusChange = useCallback(async (ticketId: string, newStatus: string) => {
    try {
      await supportApi.updateStatus(ticketId, newStatus);
      toast.success(`Ticket marked as ${STATUS_LABELS[newStatus] ?? newStatus}`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status: newStatus } : null);
      }
      await loadTickets();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  }, [selectedTicket, loadTickets]);

  if (!user || !isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="mt-2 text-muted">Admin or organizer access required.</p>
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
        <div className="mx-auto max-w-7xl">
          <PageHeader
            category="Support"
            title="Tickets"
            highlight="Support"
            highlightFirst
            description="Manage user support requests and issues"
          />

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                  filter === s
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-surface/50 text-muted border-border/30 hover:border-primary/20'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s] ?? s}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Ticket List */}
            <div className="lg:col-span-2 space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))
              ) : tickets.length === 0 ? (
                <div className="rounded-2xl border border-border/30 bg-surface/50 p-8 text-center">
                  <p className="text-muted">No support tickets found.</p>
                </div>
              ) : (
                tickets.map((ticket, i) => (
                  <motion.div
                    key={ticket.id}
                    initial="hidden" animate="visible" variants={fadeUp} custom={i}
                  >
                    <button
                      onClick={() => openTicketDetail(ticket.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
                        selectedTicket?.id === ticket.id
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/30 bg-surface/50 hover:border-primary/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold line-clamp-1">{ticket.subject}</h4>
                        <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[ticket.status] ?? ''}`}>
                          {STATUS_LABELS[ticket.status] ?? ticket.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-1 mb-2">{ticket.message}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>{ticket.user?.display_name || shortenAddress(ticket.user?.wallet_address || '')}</span>
                        <span>{formatDate(ticket.created_at)}</span>
                      </div>
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Ticket Detail */}
            <div className="lg:col-span-3">
              {detailLoading ? (
                <Skeleton className="h-96 rounded-xl" />
              ) : selectedTicket ? (
                <div className="rounded-2xl border border-border/30 bg-surface/50 backdrop-blur-sm overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b border-border/30">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-lg font-bold">{selectedTicket.subject}</h3>
                        <p className="text-xs text-muted mt-1">
                          Category: {selectedTicket.category} &bull; {formatDate(selectedTicket.created_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold uppercase px-3 py-1 rounded-full border ${STATUS_COLORS[selectedTicket.status] ?? ''}`}>
                        {STATUS_LABELS[selectedTicket.status] ?? selectedTicket.status}
                      </span>
                    </div>

                    <p className="text-sm text-muted mb-4">
                      From: <span className="text-foreground">{selectedTicket.user?.display_name || shortenAddress(selectedTicket.user?.wallet_address || '')}</span>
                      {' '}({selectedTicket.user?.role})
                    </p>

                    <div className="p-4 rounded-xl bg-background/50 border border-border/20 text-sm leading-relaxed">
                      {selectedTicket.message}
                    </div>

                    {/* Status actions */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {['open', 'in_progress', 'resolved', 'closed']
                        .filter((s) => s !== selectedTicket.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(selectedTicket.id, s)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${STATUS_COLORS[s]} hover:opacity-80`}
                          >
                            Mark as {STATUS_LABELS[s]}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Replies */}
                  <div className="p-6 space-y-4 max-h-80 overflow-y-auto">
                    {selectedTicket.replies?.map((reply) => (
                      <div
                        key={reply.id}
                        className={`p-4 rounded-xl border text-sm ${
                          reply.is_admin
                            ? 'bg-primary/5 border-primary/20 ml-4'
                            : 'bg-surface/80 border-border/20 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold">
                            {reply.is_admin ? '🛡️ ' : ''}
                            {reply.user?.display_name || shortenAddress(reply.user?.wallet_address || '')}
                          </span>
                          <span className="text-[10px] text-muted">{formatDate(reply.created_at)}</span>
                        </div>
                        <p className="leading-relaxed">{reply.message}</p>
                      </div>
                    ))}
                    {(!selectedTicket.replies || selectedTicket.replies.length === 0) && (
                      <p className="text-sm text-muted text-center py-4">No replies yet.</p>
                    )}
                  </div>

                  {/* Reply box */}
                  <div className="p-6 border-t border-border/30">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={3}
                      className="w-full rounded-xl bg-background/50 border border-border/30 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none resize-none"
                    />
                    <div className="flex justify-end mt-3">
                      <Button
                        onClick={handleReply}
                        disabled={replying || !replyText.trim()}
                      >
                        {replying ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/30 bg-surface/50 p-12 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-muted/30 mb-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-muted">Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
