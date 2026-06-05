'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { eventsApi, marketplaceApi } from '@/lib/api';
import { formatPrice, formatDate, shortenAddress } from '@/lib/utils';
import {
  TiltCard,
  GlowBorder,
  SpotlightSection,
  AnimatedCounter,
  MagneticButton,
} from '@/components/ui/AnimatedElements';
import type { TickETHEvent, Listing } from '@/lib/types';

/* ─── Lazy-load Three.js (no SSR) ─── */
const ParticleField = dynamic(
  () => import('@/components/three/ParticleField').then((m) => ({ default: m.ParticleField })),
  { ssr: false },
);
const FloatingTicket3D = dynamic(
  () => import('@/components/three/FloatingTicket').then((m) => ({ default: m.FloatingTicket3D })),
  { ssr: false },
);

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ─── Data ─── */
const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Fraud-Proof',
    description: 'Each ticket is a unique NFT on Polygon — impossible to duplicate or counterfeit.',
    gradient: 'from-violet-500/20 to-purple-600/20',
    glow: 'group-hover:shadow-violet-500/20',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: 'Secure Check-in',
    description: 'Two-step verification with QR scan + wallet signature. No fake entries.',
    gradient: 'from-emerald-500/20 to-teal-600/20',
    glow: 'group-hover:shadow-emerald-500/20',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Instant Transfers',
    description: 'Send or resell tickets peer-to-peer. Ownership transfers on-chain in seconds.',
    gradient: 'from-cyan-500/20 to-blue-600/20',
    glow: 'group-hover:shadow-cyan-500/20',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    ),
    title: 'Low Gas Fees',
    description: 'Built on Polygon L2 — minting costs a fraction of a cent.',
    gradient: 'from-amber-500/20 to-orange-600/20',
    glow: 'group-hover:shadow-amber-500/20',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Connect Wallet',
    description: 'Sign in with MetaMask, Coinbase, or any supported wallet in one click.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Mint Your Ticket',
    description: 'Browse events, select your tier, and mint an NFT ticket directly to your wallet.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Attend & Enjoy',
    description: 'Show your NFT ticket at the venue for instant QR-code verification.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 12 2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
];

const trustLogos = ['Polygon', 'Thirdweb', 'ERC-721', 'IPFS', 'SIWE'];

const faqs = [
  { q: 'What is TickETH?', a: 'TickETH is a blockchain-based event ticketing platform built on Polygon. Every ticket is a unique ERC-721 NFT that you truly own.' },
  { q: 'Do I need crypto to buy tickets?', a: "You need a small amount of POL (Polygon's native token) to pay for gas fees and the ticket price. Gas costs less than $0.01." },
  { q: 'What wallets are supported?', a: 'We support MetaMask, Coinbase Wallet, Rainbow, and email/phone-based wallets via social login.' },
  { q: 'Can I resell my ticket?', a: 'Yes! If the organizer allows resale, you can list your ticket on our built-in marketplace. All transfers happen on-chain.' },
  { q: 'How does check-in work?', a: "A volunteer scans your QR code, you confirm via wallet signature. It's 2-step, fraud-proof verification." },
  { q: 'Is this on mainnet?', a: 'Currently deployed on Polygon Amoy testnet. Mainnet deployment is planned after security audits.' },
];

/* ─── FAQ Accordion ─── */
function FAQItem({ q, a, open, toggle, index }: { q: string; a: string; open: boolean; toggle: () => void; index: number }) {
  return (
    <motion.div
      className="border-b border-border/50 last:border-0"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeUp}
      custom={index}
    >
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between py-5 text-left group cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold group-hover:text-primary transition-colors">{q}</span>
        <div className={`flex h-6 w-6 items-center justify-center rounded-full border border-border/50 transition-all duration-300 ${open ? 'bg-primary border-primary rotate-45' : 'group-hover:border-primary/50'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? 'white' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-sm text-muted leading-relaxed">{a}</p>
      </motion.div>
    </motion.div>
  );
}

/* ─── Page ─── */
export default function HomePage() {
  const [featuredEvents, setFeaturedEvents] = useState<TickETHEvent[]>([]);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  useEffect(() => {
    eventsApi.list({ page: 1, limit: 6 }).then((r) => setFeaturedEvents(r.data ?? [])).catch(() => {});
    marketplaceApi.listings({ page: 1, limit: 4, status: 'active' }).then((r) => setRecentListings(r.data ?? [])).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        {/* ═══ HERO — 3D Particle Background + Floating Ticket ═══ */}
        <section ref={heroRef} className="relative min-h-[90vh] flex items-center overflow-hidden px-4 pt-20 pb-24">
          <ParticleField />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[150px] pointer-events-none" />

          <motion.div
            className="mx-auto max-w-7xl w-full grid lg:grid-cols-2 gap-10 items-center relative z-10"
            style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          >
            <div className="text-center lg:text-left">
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold text-primary mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Live on Polygon Amoy Testnet
                </span>
              </motion.div>

              <motion.h1
                className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[0.95]"
                initial="hidden" animate="visible" variants={fadeUp} custom={1}
              >
                Event Tickets
                <br />
                <span className="gradient-text bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient-shift">
                  as NFTs
                </span>
              </motion.h1>

              <motion.p
                className="mt-6 text-lg text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed"
                initial="hidden" animate="visible" variants={fadeUp} custom={2}
              >
                Blockchain-based ticketing that eliminates fraud, enables transparent
                ownership, and powers secure event-day check-in — all on Polygon L2.
              </motion.p>

              <motion.div
                className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
                initial="hidden" animate="visible" variants={fadeUp} custom={3}
              >
                <Link
                  href="/events"
                  className="group w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:bg-primary-light transition-all active:scale-[0.97] relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                  Browse Events
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-2 transition-transform group-hover:translate-x-0.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link
                  href="/organizer"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-border/50 bg-surface/50 backdrop-blur-sm px-8 py-3.5 text-base font-semibold text-foreground hover:bg-surface-light hover:border-primary/30 transition-all active:scale-[0.97]"
                >
                  Become an Organizer
                </Link>
              </motion.div>

              <motion.div
                className="mt-14 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2"
                initial="hidden" animate="visible" variants={fadeUp} custom={4}
              >
                <span className="text-xs text-muted/60 mr-1">Powered by</span>
                {trustLogos.map((name) => (
                  <span key={name} className="text-[11px] font-bold text-muted/40 uppercase tracking-[0.2em]">
                    {name}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <FloatingTicket3D className="h-[420px]" />
            </motion.div>
          </motion.div>

          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <div className="flex flex-col items-center gap-2 text-muted/40">
              <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
              <div className="h-8 w-[1px] bg-gradient-to-b from-muted/40 to-transparent animate-pulse" />
            </div>
          </motion.div>
        </section>

        {/* ═══ STATS ═══ */}
        <section className="relative border-y border-border/30">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
          <div className="mx-auto max-w-5xl px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center relative">
            {[
              { label: 'Gas per Mint', display: '<$0.01' },
              { value: 2, label: 'Confirmation', suffix: 's', prefix: '~' },
              { label: 'Network', display: 'Polygon' },
              { label: 'Standard', display: 'ERC-721' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="relative group"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={scaleIn} custom={i}
              >
                <div className="absolute inset-0 bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative py-3">
                  <p className="text-2xl font-bold text-primary">
                    {s.display ?? <AnimatedCounter value={s.value!} prefix={s.prefix} suffix={s.suffix} />}
                  </p>
                  <p className="text-sm text-muted mt-1">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <SpotlightSection className="px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-5xl">
            <motion.div
              className="text-center mb-16"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
            >
              <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-3 block">Getting Started</span>
              <h2 className="text-3xl font-extrabold sm:text-5xl">
                How It <span className="gradient-text">Works</span>
              </h2>
              <p className="mt-4 text-muted max-w-xl mx-auto">
                Three simple steps to own your event experience.
              </p>
            </motion.div>

            <div className="grid gap-8 sm:grid-cols-3">
              {howItWorks.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i + 1}
                >
                  <TiltCard className="relative text-center p-8 rounded-2xl border border-border/30 bg-surface/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
                    <span className="absolute top-4 right-4 text-4xl font-black text-primary/[0.07]">{step.step}</span>
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 text-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
                      {step.icon}
                    </div>
                    <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">{step.description}</p>
                    {i < howItWorks.length - 1 && (
                      <div className="hidden sm:block absolute top-1/2 -right-4 w-8 border-t border-dashed border-primary/20" />
                    )}
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </div>
        </SpotlightSection>

        {/* ═══ FEATURES ═══ */}
        <section className="relative px-4 py-24 sm:py-32">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[120px]" />
          </div>

          <div className="mx-auto max-w-6xl">
            <motion.div
              className="text-center mb-16"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
            >
              <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-3 block">Features</span>
              <h2 className="text-3xl font-extrabold sm:text-5xl">
                Why <span className="gradient-text">TickETH</span>?
              </h2>
              <p className="mt-4 text-muted max-w-xl mx-auto">
                Every feature is designed to solve real problems in event ticketing.
              </p>
            </motion.div>

            <motion.div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={staggerContainer}
            >
              {features.map((f) => (
                <motion.div key={f.title} variants={fadeUp}>
                  <TiltCard
                    className={`group rounded-2xl border border-border/30 bg-surface/60 backdrop-blur-sm p-6 hover:border-primary/40 hover:shadow-2xl ${f.glow} transition-all duration-500`}
                    glowColor={
                      f.gradient.includes('violet') ? 'rgba(139,131,255,0.12)' :
                      f.gradient.includes('emerald') ? 'rgba(16,185,129,0.12)' :
                      f.gradient.includes('cyan') ? 'rgba(0,217,255,0.12)' :
                      'rgba(245,158,11,0.12)'
                    }
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-primary group-hover:scale-110 transition-transform duration-300`}>
                      {f.icon}
                    </div>
                    <h3 className="text-base font-bold">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">{f.description}</p>
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══ FEATURED EVENTS ═══ */}
        {featuredEvents.length > 0 && (
          <section className="px-4 py-24 sm:py-32">
            <div className="mx-auto max-w-6xl">
              <motion.div
                className="flex items-end justify-between mb-10"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={0}
              >
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-2 block">Discover</span>
                  <h2 className="text-3xl font-extrabold sm:text-4xl">Upcoming Events</h2>
                  <p className="mt-2 text-muted">Browse events and mint your tickets</p>
                </div>
                <Link href="/events" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-light transition-colors group">
                  View All
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
              </motion.div>

              <motion.div
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={staggerContainer}
              >
                {featuredEvents.slice(0, 6).map((event) => (
                  <motion.div key={event.id} variants={fadeUp}>
                    <TiltCard className="rounded-2xl overflow-hidden">
                      <Link
                        href={`/events/${event.id}`}
                        className="group block border border-border/30 bg-surface/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
                      >
                        <div className="h-44 bg-gradient-to-br from-primary/15 via-surface to-accent/10 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(108,99,255,0.15),transparent_60%)]" />
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/30 group-hover:scale-110 transition-transform duration-500">
                            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                            <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
                          </svg>
                        </div>
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge status={event.status} />
                            {event.city && <span className="text-xs text-muted">{event.city}</span>}
                          </div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {event.title || event.name}
                          </h3>
                          <p className="mt-1 text-sm text-muted">
                            {event.start_time || event.startTime
                              ? formatDate(event.start_time || event.startTime || '')
                              : event.date ? formatDate(event.date) : 'TBA'}
                          </p>
                          {event.venue && <p className="mt-0.5 text-xs text-muted truncate">{event.venue}</p>}
                        </div>
                      </Link>
                    </TiltCard>
                  </motion.div>
                ))}
              </motion.div>

              <div className="mt-8 text-center sm:hidden">
                <Link href="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  View All Events
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ═══ MARKETPLACE PREVIEW ═══ */}
        {recentListings.length > 0 && (
          <section className="relative px-4 py-24 sm:py-32">
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-surface/30 via-transparent to-surface/30" />
            <div className="mx-auto max-w-6xl">
              <motion.div
                className="flex items-end justify-between mb-10"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={0}
              >
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-2 block">Trade</span>
                  <h2 className="text-3xl font-extrabold sm:text-4xl">Marketplace</h2>
                  <p className="mt-2 text-muted">Browse and buy resale tickets from other users</p>
                </div>
                <Link href="/marketplace" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-light transition-colors group">
                  Browse All
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
              </motion.div>

              <motion.div
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={staggerContainer}
              >
                {recentListings.map((listing) => (
                  <motion.div key={listing.id} variants={fadeUp}>
                    <TiltCard className="rounded-2xl">
                      <Link
                        href={`/marketplace/${listing.id}`}
                        className="group block rounded-2xl border border-border/30 bg-surface/60 backdrop-blur-sm p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-500"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                              {listing.event?.name || listing.ticket?.event?.name || 'Ticket'}
                            </p>
                            <p className="text-xs text-muted">
                              {shortenAddress(listing.sellerWallet || listing.seller_wallet || listing.sellerAddress || '')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold gradient-text">{formatPrice(listing.asking_price_wei || listing.askingPriceWei || listing.price)}</span>
                          <Badge status={listing.status} />
                        </div>
                      </Link>
                    </TiltCard>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

        {/* ═══ FAQ ═══ */}
        <section className="px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl">
            <motion.div
              className="text-center mb-12"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
            >
              <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-3 block">Support</span>
              <h2 className="text-3xl font-extrabold sm:text-5xl">
                Frequently Asked <span className="gradient-text">Questions</span>
              </h2>
            </motion.div>

            <div className="rounded-2xl border border-border/30 bg-surface/30 backdrop-blur-sm p-6 sm:p-8">
              {faqs.map((faq, i) => (
                <FAQItem
                  key={i}
                  q={faq.q}
                  a={faq.a}
                  open={openFaq === i}
                  toggle={() => setOpenFaq(openFaq === i ? null : i)}
                  index={i}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="px-4 pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={scaleIn} custom={0}
            >
              <GlowBorder>
                <div className="p-12 relative overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px]" />
                  <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-accent/10 rounded-full blur-[80px]" />

                  <div className="relative">
                    <h2 className="text-2xl sm:text-4xl font-extrabold">
                      Ready to experience the
                      <br />
                      <span className="gradient-text">future of ticketing</span>?
                    </h2>
                    <p className="mt-4 text-muted max-w-lg mx-auto">
                      Connect your wallet and start exploring events on Polygon. Secure, transparent, and fraud-proof.
                    </p>
                    <div className="mt-8">
                      <MagneticButton className="inline-flex items-center rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:bg-primary-light transition-all active:scale-[0.97] cursor-pointer">
                        <Link href="/events" className="inline-flex items-center">
                          Get Started
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </Link>
                      </MagneticButton>
                    </div>
                  </div>
                </div>
              </GlowBorder>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
