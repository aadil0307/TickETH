'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { useActiveAccount } from 'thirdweb/react';
import { signMessage } from 'thirdweb/utils';
import { thirdwebClient, activeChain } from '@/lib/constants';
import { authApi } from '@/lib/api';
import { buildSiweMessage } from '@/lib/siwe';
import { useAuthStore } from '@/lib/store';
import { shortenAddress } from '@/lib/utils';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const wallets = [
  inAppWallet({ auth: { options: ['email', 'google', 'apple', 'phone'] } }),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
];

const navLinks = [
  { href: '/events', label: 'Events', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z' },
  { href: '/tickets', label: 'My Tickets', icon: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z' },
  { href: '/marketplace', label: 'Marketplace', icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z' },
];

const orgLinks = [{ href: '/organizer', label: 'Dashboard', icon: 'M3 3v18h18' }];
const adminLinks = [{ href: '/admin', label: 'Admin', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z' }];

export function Navbar() {
  const pathname = usePathname();
  const { user, hydrated, hydrate, setUser, refreshUser, logout } = useAuthStore();
  const activeAccount = useActiveAccount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Hydrate auth on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Re-fetch user on window focus to pick up role changes (volunteer/organizer promotion)
  useEffect(() => {
    const onFocus = () => { if (user) refreshUser(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refreshUser]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // SIWE auto-login when wallet connects
  useEffect(() => {
    if (!activeAccount?.address || user || signingIn) return;

    let cancelled = false;
    (async () => {
      setSigningIn(true);
      try {
        const { nonce } = await authApi.getNonce(activeAccount.address);
        const message = buildSiweMessage({ address: activeAccount.address, nonce });
        const signature = await signMessage({ message, account: activeAccount });
        if (cancelled) return;
        const result = await authApi.verify(message, signature);
        if (cancelled) return;
        setUser(result.user);
        toast.success('Wallet connected successfully');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('rejected') || msg.includes('denied')) {
          toast.error('Signature rejected. Please sign to authenticate.');
        } else {
          console.error('SIWE auth failed:', err);
          toast.error('Authentication failed. Please try again.');
        }
      } finally {
        if (!cancelled) setSigningIn(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.address, user]);

  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const isVolunteer = user?.role === 'volunteer';

  const links = [
    ...navLinks,
    ...(isOrganizer ? orgLinks : []),
    ...(isAdmin ? adminLinks : []),
  ];

  // Role badge color mapping
  const roleBadge = user ? {
    admin: { label: 'Admin', cls: 'bg-red-500/15 text-red-400' },
    organizer: { label: 'Organizer', cls: 'bg-yellow-500/15 text-yellow-400' },
    volunteer: { label: 'Volunteer', cls: 'bg-cyan-500/15 text-cyan-400' },
    attendee: { label: '', cls: '' },
    visitor: { label: '', cls: '' },
  }[user.role] : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/70 backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-accent/10 text-primary transition-all group-hover:from-primary/35 group-hover:to-accent/20 group-hover:shadow-lg group-hover:shadow-primary/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">
            Tick<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">ETH</span>
          </span>
        </Link>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:text-foreground hover:bg-surface-light',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && (
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-surface-light group"
              title="Edit profile"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted group-hover:text-foreground transition-colors shrink-0">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-xs text-muted group-hover:text-foreground transition-colors">
                {user.display_name || user.displayName || shortenAddress(user.wallet_address ?? user.walletAddress ?? '')}
              </span>
              {!user.email && (
                <span className="relative flex h-2 w-2 shrink-0" title="Email not set">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                </span>
              )}
              {roleBadge?.label && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', roleBadge.cls)}>
                  {roleBadge.label}
                </span>
              )}
            </Link>
          )}
          <ConnectButton
            client={thirdwebClient}
            wallets={wallets}
            chain={activeChain}
            connectButton={{
              label: signingIn ? 'Signing in…' : 'Connect Wallet',
              className: '!bg-primary !text-white !rounded-lg !px-4 !py-2 !text-sm !font-semibold hover:!bg-primary-light !transition-colors',
            }}
            detailsButton={{
              className: '!bg-surface !text-foreground !rounded-lg !border !border-border hover:!bg-surface-light !transition-colors',
            }}
            onDisconnect={() => {
              logout();
              toast('Wallet disconnected');
            }}
          />

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-lg p-2 text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile nav — slide down */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="flex flex-col px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:text-foreground hover:bg-surface-light',
                )}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/profile"
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors flex items-center gap-2',
                  pathname === '/profile'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:text-foreground hover:bg-surface-light',
                )}
              >
                My Profile
                {!user.email && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
