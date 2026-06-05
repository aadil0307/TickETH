'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { usersApi, adminApi } from '@/lib/api';
import { BLOCK_EXPLORER } from '@/lib/constants';
import { shortenAddress, formatDate } from '@/lib/utils';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';
import type { User } from '@/lib/types';

/** Validate Ethereum address (0x + 40 hex chars) */
const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

export default function VolunteerManagementPage() {
  useRequireAuth(['organizer', 'admin']);
  const { user } = useAuthStore();
  const router = useRouter();

  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [walletInput, setWalletInput] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [volunteers, setVolunteers] = useState<User[]>([]);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  // Load current volunteer list (admin-only — uses admin endpoint)
  const loadVolunteers = useCallback(async () => {
    if (!isAdmin) return; // Only admins can list all users
    try {
      setLoadingVolunteers(true);
      const res = await adminApi.users({ role: 'volunteer' });
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : (res as any)?.data ?? [];
      setVolunteers(data);
    } catch (err) {
      toast.error(parseError(err).message);
      setVolunteers([]);
    } finally {
      setLoadingVolunteers(false);
      setLoaded(true);
    }
  }, [isAdmin]);

  // Load on first render if admin
  useState(() => {
    if (isAdmin) loadVolunteers();
  });

  const handleAssign = async () => {
    setInputError(null);

    const trimmed = walletInput.trim();

    if (!trimmed) {
      setInputError('Please enter a wallet address');
      return;
    }

    if (!isValidAddress(trimmed)) {
      setInputError('Invalid Ethereum address. Must be 0x followed by 40 hex characters.');
      return;
    }

    // Prevent self-assignment
    const userWallet = (user?.walletAddress || user?.wallet_address || '').toLowerCase();
    if (trimmed.toLowerCase() === userWallet) {
      setInputError('You cannot assign yourself as a volunteer.');
      return;
    }

    setAssigning(true);
    try {
      await usersApi.assignVolunteer(trimmed);
      toast.success(`${shortenAddress(trimmed)} has been promoted to Volunteer`, {
        description: 'They will see the Scanner tab on the mobile app next time they open it.',
      });
      setWalletInput('');
      // Refresh list if admin
      if (isAdmin) loadVolunteers();
    } catch (err) {
      const parsed = parseError(err);

      // Handle specific edge cases
      if (parsed.message.toLowerCase().includes('not found')) {
        setInputError('No user found with this wallet address. They need to sign in at least once first.');
      } else if (parsed.message.toLowerCase().includes('already')) {
        setInputError('This user already has an elevated role (volunteer, organizer, or admin).');
      } else {
        setInputError(parsed.message);
      }
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (walletAddress: string) => {
    if (!confirm(`Revoke volunteer access for ${shortenAddress(walletAddress)}? They will lose Scanner access.`)) {
      return;
    }
    setRevoking(walletAddress);
    try {
      await usersApi.revokeVolunteer(walletAddress);
      toast.success(`Volunteer access revoked for ${shortenAddress(walletAddress)}`);
      // Refresh list
      if (isAdmin) loadVolunteers();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setRevoking(null);
    }
  };

  // Not authorized
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Connect your wallet"
            message="Sign in to access volunteer management"
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

  if (!isOrganizer) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="mt-2 text-muted">Organizer or admin access required.</p>
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
        <div className="mx-auto max-w-3xl">
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
          <div className="mb-8">
            <span className="text-xs font-bold text-accent uppercase tracking-[0.3em]">Team</span>
            <h1 className="mt-2 text-4xl font-extrabold">
              Volunteer{' '}
              <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="mt-2 text-muted">
              Assign volunteer roles to attendees by their wallet address. Volunteers gain access
              to the ticket scanner on the mobile app for check-in at events.
            </p>
          </div>

          {/* How it works */}
          <div className="mb-8 rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              How Volunteer Assignment Works
            </h2>
            <ol className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
                <span>The user must <strong className="text-foreground">sign in at least once</strong> with their wallet on either the website or mobile app. This creates their account.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
                <span>Enter their <strong className="text-foreground">wallet address</strong> below and assign. Only attendees can be promoted — organizers and admins already have scanner access.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
                <span>The user&apos;s role is updated instantly. <strong className="text-foreground">Next time they open the mobile app</strong>, the Scanner tab will appear automatically — no re-login needed.</span>
              </li>
            </ol>
          </div>

          {/* Assign Volunteer Form */}
          <motion.div
            className="mb-8 rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 shadow-xl shadow-primary/5"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-bold mb-4">Assign Volunteer</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="wallet-input" className="block text-sm font-medium mb-2">
                  Wallet Address
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      id="wallet-input"
                      type="text"
                      placeholder="0x..."
                      value={walletInput}
                      onChange={(e) => {
                        setWalletInput(e.target.value);
                        setInputError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAssign();
                      }}
                      className={`w-full rounded-xl border bg-background px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:ring-1 transition-colors ${
                        inputError
                          ? 'border-error focus:border-error focus:ring-error'
                          : 'border-border focus:border-primary focus:ring-primary'
                      }`}
                      aria-describedby={inputError ? 'wallet-error' : undefined}
                      aria-invalid={!!inputError}
                    />
                    {walletInput && isValidAddress(walletInput) && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <Button
                    onClick={handleAssign}
                    loading={assigning}
                    disabled={!walletInput.trim()}
                  >
                    Assign
                  </Button>
                </div>
                <AnimatePresence>
                  {inputError && (
                    <motion.p
                      id="wallet-error"
                      className="mt-2 text-sm text-error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      role="alert"
                    >
                      {inputError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Current Volunteers (admin only) */}
          {isAdmin && (
            <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Current Volunteers</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadVolunteers}
                  loading={loadingVolunteers}
                >
                  Refresh
                </Button>
              </div>

              {loadingVolunteers && !loaded ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-surface-light animate-pulse" />
                  ))}
                </div>
              ) : volunteers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-muted/50">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  No volunteers assigned yet. Use the form above to add one.
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {volunteers.map((v) => {
                      const wallet = v.walletAddress || v.wallet_address || '';
                      return (
                        <motion.div
                          key={v.id}
                          className="flex items-center justify-between rounded-xl border border-border/30 bg-background/80 p-4 hover:border-primary/20 transition-all"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          layout
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: `#${wallet.slice(2, 8)}` }}
                            >
                              {wallet.slice(2, 4).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`${BLOCK_EXPLORER}/address/${wallet}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-mono text-primary hover:underline truncate"
                                >
                                  {shortenAddress(wallet)}
                                </a>
                                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-400">
                                  Volunteer
                                </span>
                              </div>
                              <p className="text-xs text-muted mt-0.5">
                                {v.displayName || v.display_name || 'No display name'}
                                {(v.createdAt || v.created_at) && (
                                  <> · Joined {formatDate(v.createdAt || v.created_at || '')}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => handleRevoke(wallet)}
                            loading={revoking === wallet}
                          >
                            Revoke
                          </Button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {/* Note for organizers who aren't admin */}
              {!isAdmin && (
                <p className="text-xs text-muted mt-4">
                  Only admins can view the full volunteer list. As an organizer, you can still assign volunteers above.
                </p>
              )}
            </div>
          )}

          {/* Edge cases info */}
          <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Important Notes
            </h3>
            <ul className="space-y-1 text-xs text-muted">
              <li>• Only users with the <strong className="text-foreground">attendee</strong> role can be promoted to volunteer.</li>
              <li>• Users who are already <strong className="text-foreground">organizers</strong> or <strong className="text-foreground">admins</strong> already have scanner access.</li>
              <li>• The user must have signed in at least once for their account to exist.</li>
              <li>• Revoking volunteer access demotes the user back to attendee immediately.</li>
              <li>• Role changes take effect on the mobile app when it next checks the user profile (on app focus or re-open).</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
