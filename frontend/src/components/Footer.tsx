import Link from 'next/link';
import { BLOCK_EXPLORER, FACTORY_ADDRESS, MARKETPLACE_ADDRESS } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="relative border-t border-border/30 bg-surface/30 backdrop-blur-sm mt-auto overflow-hidden">
      {/* Subtle gradient glow at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-accent/10 text-primary shadow-sm shadow-primary/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
                </svg>
              </div>
              <span className="font-bold">
                Tick<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">ETH</span>
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Blockchain NFT ticketing platform on Polygon. Secure, transparent, fraud-resistant.
            </p>
            {/* Social links */}
            <div className="mt-4 flex gap-3">
              <a href="https://github.com/RogerrMonkey/TickETH" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-muted hover:text-foreground transition-colors duration-300 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Platform</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link href="/events" className="hover:text-primary transition-colors duration-300">Browse Events</Link></li>
              <li><Link href="/tickets" className="hover:text-primary transition-colors duration-300">My Tickets</Link></li>
              <li><Link href="/marketplace" className="hover:text-primary transition-colors duration-300">Marketplace</Link></li>
              <li><Link href="/organizer" className="hover:text-primary transition-colors duration-300">Organize Events</Link></li>
            </ul>
          </div>

          {/* Smart Contracts */}
          <div>
            <h3 className="text-sm font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Smart Contracts</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <a
                  href={`${BLOCK_EXPLORER}/address/${FACTORY_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors duration-300 inline-flex items-center gap-1"
                >
                  Factory
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                </a>
              </li>
              <li>
                <a
                  href={`${BLOCK_EXPLORER}/address/${MARKETPLACE_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors duration-300 inline-flex items-center gap-1"
                >
                  Marketplace
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                </a>
              </li>
            </ul>
          </div>

          {/* Network & Legal */}
          <div>
            <h3 className="text-sm font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Network</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
              <p className="text-sm text-muted">Polygon Amoy Testnet</p>
            </div>
            <p className="text-xs text-muted font-mono">Chain ID: 80002</p>
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p><Link href="/terms" className="hover:text-primary transition-colors duration-300">Terms of Service</Link></p>
              <p><Link href="/privacy" className="hover:text-primary transition-colors duration-300">Privacy Policy</Link></p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-2 relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-semibold">TickETH</span>. All rights reserved.
          </p>
          <p className="text-xs text-muted">
            Built with <span className="text-foreground/70">Next.js</span>, <span className="text-primary/70">Polygon</span> &amp; <span className="text-accent/70">Thirdweb</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
