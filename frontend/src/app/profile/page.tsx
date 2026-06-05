'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/lib/store';
import { usersApi, uploadsApi } from '@/lib/api';
import { BLOCK_EXPLORER } from '@/lib/constants';
import { shortenAddress, formatDate } from '@/lib/utils';
import { useCopyToClipboard, useRequireAuth } from '@/lib/hooks';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ImageUpload';
import { PageHeader } from '@/components/PageHeader';

/** Simple email regex */
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function ProfilePage() {
  useRequireAuth();
  const { user, refreshUser } = useAuthStore();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { copied, copy } = useCopyToClipboard();

  // Sync form state when user data loads or changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.displayName || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || user.avatarUrl || '');
    }
  }, [user]);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};

    if (!email.trim()) {
      errs.email = 'Email is required — you\'ll receive ticket copies here';
    } else if (!isValidEmail(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (displayName.trim() && displayName.trim().length < 2) {
      errs.displayName = 'Display name must be at least 2 characters';
    }

    if (displayName.trim().length > 50) {
      errs.displayName = 'Display name must be 50 characters or fewer';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [email, displayName]);

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await usersApi.updateProfile({
        displayName: displayName.trim() || undefined,
        email: email.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        consentGiven: true,
      });
      await refreshUser();
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      const parsed = parseError(err);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to current user data
    setDisplayName(user?.display_name || user?.displayName || '');
    setEmail(user?.email || '');
    setAvatarUrl(user?.avatar_url || user?.avatarUrl || '');
    setErrors({});
    setEditing(false);
  };

  const walletAddress = user?.wallet_address || user?.walletAddress || '';
  const avatarColor = walletAddress ? `#${walletAddress.slice(2, 8)}` : '#6C63FF';
  const avatarInitial = walletAddress ? walletAddress.slice(2, 4).toUpperCase() : '??';
  const hasEmail = !!(user?.email);

  // Not logged in
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Connect your wallet"
            message="Sign in to view and edit your profile"
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
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
        <div className="mx-auto max-w-2xl">
          <PageHeader category="Account" title="My" highlight="Profile" description="Manage your account details and preferences" />

          {/* Email missing prompt */}
          <AnimatePresence>
            {!hasEmail && !editing && (
              <motion.div
                className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400 shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-400">Email Required</p>
                  <p className="text-xs text-muted mt-1">
                    Please add your email to receive ticket copies and event updates.
                  </p>
                </div>
                <Button size="xs" onClick={() => setEditing(true)}>
                  Add Email
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Profile Card */}
          <motion.div
            className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm overflow-hidden shadow-xl shadow-primary/5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Banner + Avatar */}
            <div className="relative h-28 bg-gradient-to-r from-primary/25 via-accent/15 to-primary/10">
              <div className="absolute -bottom-10 left-6">
                {(user.avatar_url || user.avatarUrl) ? (
                  <img
                    src={user.avatar_url || user.avatarUrl}
                    alt="Avatar"
                    className="h-20 w-20 rounded-full border-4 border-surface object-cover"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-surface text-2xl font-bold text-white"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {avatarInitial}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pt-14 pb-6">
              {/* Name + Role */}
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">
                  {user.display_name || user.displayName || 'TickETH User'}
                </h2>
                <Badge status={user.role} />
              </div>

              {/* Wallet */}
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={`${BLOCK_EXPLORER}/address/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-primary hover:underline"
                >
                  {shortenAddress(walletAddress)}
                </a>
                <button
                  onClick={() => copy(walletAddress)}
                  className="text-muted hover:text-foreground transition-colors"
                  aria-label="Copy address"
                >
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  )}
                </button>
              </div>

              {/* Email */}
              {user.email && (
                <p className="mt-1 text-sm text-muted flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  {user.email}
                </p>
              )}

              {/* Member since */}
              <p className="mt-1 text-xs text-muted">
                Member since {formatDate(user.createdAt || user.created_at || '')}
              </p>

              {/* Edit button */}
              {!editing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => setEditing(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  Edit Profile
                </Button>
              )}
            </div>
          </motion.div>

          {/* Edit Form */}
          <AnimatePresence>
            {editing && (
              <motion.div
                className="mt-6 rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6"
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 10, height: 0 }}
              >
                <h3 className="text-lg font-bold mb-5">Edit Profile</h3>

                <div className="space-y-5">
                  {/* Display Name */}
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
                      Display Name
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      placeholder="How should we call you?"
                      value={displayName}
                      onChange={(e) => { setDisplayName(e.target.value); setErrors((p) => ({ ...p, displayName: '' })); }}
                      maxLength={50}
                      className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 transition-colors ${
                        errors.displayName ? 'border-error focus:border-error focus:ring-error' : 'border-border focus:border-primary focus:ring-primary'
                      }`}
                      aria-invalid={!!errors.displayName}
                    />
                    <div className="flex items-center justify-between mt-1">
                      {errors.displayName ? (
                        <p className="text-xs text-error">{errors.displayName}</p>
                      ) : (
                        <p className="text-xs text-muted">This appears on your tickets and listings</p>
                      )}
                      <span className="text-xs text-muted tabular-nums">{displayName.length}/50</span>
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                      Email Address <span className="text-error">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                      className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 transition-colors ${
                        errors.email ? 'border-error focus:border-error focus:ring-error' : 'border-border focus:border-primary focus:ring-primary'
                      }`}
                      aria-invalid={!!errors.email}
                      aria-describedby="email-help"
                      required
                    />
                    {errors.email ? (
                      <p className="mt-1 text-xs text-error">{errors.email}</p>
                    ) : (
                      <p id="email-help" className="mt-1 text-xs text-muted">
                        Required — ticket copies and event updates will be sent here
                      </p>
                    )}
                  </div>

                  {/* Avatar Upload */}
                  <div>
                    <ImageUpload
                      label="Avatar"
                      folder="avatar"
                      currentUrl={avatarUrl}
                      onUpload={(url) => {
                        setAvatarUrl(url);
                        setErrors((p) => ({ ...p, avatarUrl: '' }));
                      }}
                      hint="Upload an image (PNG, JPG, WebP, GIF). Leave empty for wallet-generated avatar."
                      shape="circle"
                      disabled={saving}
                    />
                  </div>

                  {/* Consent */}
                  <div className="rounded-xl bg-surface-light p-4">
                    <p className="text-xs text-muted">
                      By saving your profile, you consent to TickETH storing your email address and display name
                      for the purpose of sending ticket copies, event updates, and platform notifications.
                      You can delete your data at any time.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button onClick={handleSave} loading={saving}>
                      Save Profile
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info sections */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Account Info */}
            <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-5 hover:border-primary/20 transition-all">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-primary/70 mb-3">Account</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">User ID</span>
                  <span className="font-mono text-xs">{user.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Role</span>
                  <span className="capitalize font-medium">{user.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Email</span>
                  <span>{user.email || <span className="text-error text-xs">Not set</span>}</span>
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-5 hover:border-accent/20 transition-all">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-accent/70 mb-3">Network</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Chain</span>
                  <span>Polygon Amoy</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Chain ID</span>
                  <span className="font-mono">80002</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Currency</span>
                  <span>POL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Explorer</span>
                  <a href={BLOCK_EXPLORER} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                    amoy.polygonscan.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
