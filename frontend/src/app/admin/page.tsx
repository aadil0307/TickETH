'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { adminApi } from '@/lib/api';
import { parseError } from '@/lib/error-parser';
import { TiltCard, SpotlightSection } from '@/components/ui/AnimatedElements';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';
import type { DashboardStats } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function AdminDashboardPage() {
  useRequireAuth(['admin']);
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.dashboard();
      setStats(data);
    } catch (err) {
      toast.error(parseError(err).message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats]);

  if (!user || !isAdmin) {
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
        <div className="mx-auto max-w-7xl">
          <PageHeader category="Control Panel" title="Dashboard" highlight="Admin" highlightFirst description="Platform overview and management" />

          {/* Stats */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
                <StatCard title="Total Users" value={String(stats?.totalUsers ?? 0)} icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                } />
              </motion.div>
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
                <StatCard title="Total Events" value={String(stats?.totalEvents ?? 0)} icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                  </svg>
                } />
              </motion.div>
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
                <StatCard title="Tickets Minted" value={String(stats?.totalTickets ?? 0)} icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  </svg>
                } />
              </motion.div>
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
                <StatCard title="Pending Requests" value={String(stats?.pendingRequests ?? 0)} icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                } />
              </motion.div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'User Management',
                description: 'View and manage platform users, change roles',
                href: '/admin/users',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
              },
              {
                title: 'Organizer Requests',
                description: 'Review and approve organizer role requests',
                href: '/admin/requests',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                ),
              },
              {
                title: 'All Events',
                description: 'Browse all events on the platform',
                href: '/events',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                ),
              },
              {
                title: 'Support Tickets',
                description: 'Manage user support requests and issues',
                href: '/admin/support',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
              },
            ].map((link, i) => (
              <motion.div
                key={link.title}
                initial="hidden" animate="visible" variants={fadeUp} custom={i}
              >
                <Link href={link.href} className="group block">
                  <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/5 group-hover:from-primary/25 group-hover:to-accent/10 transition-colors shadow-lg shadow-primary/5">
                      {link.icon}
                    </div>
                    <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                      {link.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{link.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
