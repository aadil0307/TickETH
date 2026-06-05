'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { prepareContractCall, getContract } from 'thirdweb';
import { useSendTransaction, useActiveAccount } from 'thirdweb/react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Skeleton, DetailSkeleton } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import { TransactionTracker } from '@/components/TransactionTracker';
import { eventsApi, tiersApi, ticketsApi } from '@/lib/api';
import { thirdwebClient, activeChain, BLOCK_EXPLORER } from '@/lib/constants';
import { formatDate, formatDateTime, formatPrice, getTierPrice, getTierPriceWei, shortenAddress } from '@/lib/utils';
import { cn } from '@/lib/cn';
import { useCountdown, useCopyToClipboard, useTransaction } from '@/lib/hooks';
import { parseError } from '@/lib/error-parser';
import { SpotlightSection, GlowBorder } from '@/components/ui/AnimatedElements';
import { toast } from 'sonner';
import type { TickETHEvent, TicketTier } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

/* ─── Countdown Display ──────────────────────────────── */
function CountdownDisplay({ targetDate }: { targetDate: string }) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);
  if (isExpired) return <span className="text-sm text-muted">Event has started</span>;
  return (
    <div className="flex gap-3">
      {[
        { value: days, label: 'Days' },
        { value: hours, label: 'Hrs' },
        { value: minutes, label: 'Min' },
        { value: seconds, label: 'Sec' },
      ].map((unit) => (
        <div key={unit.label} className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 text-primary shadow-lg shadow-primary/5">
            <span className="text-xl font-bold tabular-nums">{String(unit.value).padStart(2, '0')}</span>
          </div>
          <span className="mt-1.5 text-[10px] text-muted uppercase tracking-wider">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────── */
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendTransaction();
  const { copied, copy } = useCopyToClipboard();

  const [event, setEvent] = useState<TickETHEvent | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [mintQty, setMintQty] = useState(1);

  // Transaction tracking
  const tx = useTransaction();
  const [showMintModal, setShowMintModal] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventData, tiersData] = await Promise.all([
        eventsApi.getById(id),
        tiersApi.list(id).catch(() => []),
      ]);
      setEvent(eventData);
      setTiers(Array.isArray(tiersData) ? tiersData : []);
    } catch (err) {
      setError(parseError(err).message);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadEvent();
  }, [id, loadEvent]);

  const handleMint = async () => {
    if (!selectedTier || !account || !event?.contractAddress && !event?.contract_address) return;

    const contractAddr = event.contractAddress || event.contract_address || '';
    setShowMintModal(true);
    await tx.execute(async ({ setStep, setHash }) => {
      const contract = getContract({
        client: thirdwebClient,
        chain: activeChain,
        address: contractAddr,
      });

      const tierPrice = getTierPriceWei(selectedTier);
      const tierId = BigInt(selectedTier.tier_index ?? selectedTier.tierId ?? 0);
      let lastResult: any;

      setStep('awaiting-signature');

      // Contract supports 1 mint per call — loop for quantity > 1
      for (let i = 0; i < mintQty; i++) {
        const prepared = prepareContractCall({
          contract,
          method: 'function mint(uint256 tierId, bytes32[] proof) payable',
          params: [tierId, []],
          value: tierPrice,
        });

        lastResult = await sendTx(prepared);

        if (i === 0) {
          setStep('broadcasting');
          setHash(lastResult.transactionHash);
        }

        // Record mint in backend (non-blocking — chain listener is primary source)
        ticketsApi.recordMint({
          tokenId: 0, // Will be resolved by chain listener from on-chain event
          contractAddress: contractAddr,
          eventId: event.id,
          tierId: selectedTier.id,
          ownerWallet: account.address,
          txHash: lastResult.transactionHash,
        }).catch(() => {}); // Non-critical — chain listener handles reconciliation
      }

      setStep('confirming');
      setStep('success');
      toast.success(mintQty > 1 ? `${mintQty} tickets minted successfully!` : 'Ticket minted successfully!');
      loadEvent(); // Refresh tiers availability
    });
  };

  const closeMintModal = () => {
    setShowMintModal(false);
    tx.reset();
    setSelectedTier(null);
    setMintQty(1);
  };

  /* ─── Loading ──── */
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-4xl"><DetailSkeleton /></div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ─── Error / Not Found ──── */
  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-error/15">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
            </div>
            <h2 className="text-2xl font-bold">{error ? 'Failed to load event' : 'Event not found'}</h2>
            <p className="text-muted">{error || "This event may have been removed or doesn't exist."}</p>
            <div className="flex gap-3 justify-center">
              {error && <Button variant="outline" onClick={loadEvent}>Retry</Button>}
              <Button onClick={() => router.push('/events')}>Back to Events</Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const contractAddr = event.contractAddress || event.contract_address || '';
  const startTime = event.start_time || event.startTime || event.date || '';
  const showCountdown = startTime && new Date(startTime).getTime() > Date.now();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-4xl">
          {/* Back link */}
          <button
            onClick={() => router.push('/events')}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Events
          </button>

          {/* Hero banner */}
          <motion.div
            className="relative h-64 sm:h-80 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/5 to-primary/10 flex items-center justify-center overflow-hidden mb-8 border border-border/20 shadow-2xl shadow-primary/5"
            initial="hidden" animate="visible" variants={fadeUp}
          >
            {(event.banner_url || event.bannerUrl) ? (
              <img
                src={event.banner_url || event.bannerUrl}
                alt={event.title || event.name}
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/30">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            )}
            <div className="absolute top-4 right-4"><Badge status={event.status} /></div>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left — details */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                <h1 className="text-3xl sm:text-4xl font-extrabold">
                  <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">{event.title || event.name}</span>
                </h1>
                {event.description && (
                  <p className="mt-3 text-muted leading-relaxed">{event.description}</p>
                )}
              </motion.div>

              {/* Countdown */}
              {showCountdown && (
                <motion.div
                  className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-6 backdrop-blur-sm"
                  initial="hidden" animate="visible" variants={fadeUp}
                >
                  <p className="text-sm font-medium text-muted mb-3">Event starts in</p>
                  <CountdownDisplay targetDate={startTime} />
                </motion.div>
              )}

              {/* Event details card */}
              <motion.div
                className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 space-y-4"
                initial="hidden" animate="visible" variants={fadeUp}
              >
                <h2 className="text-lg font-bold">Event Details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Date</p>
                      <p className="text-sm font-medium">{startTime ? formatDateTime(startTime) : event.date ? formatDate(event.date) : 'TBA'}</p>
                    </div>
                  </div>

                  {(event.location || event.venue) && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Location</p>
                        <p className="text-sm font-medium">{event.location || event.venue}</p>
                      </div>
                    </div>
                  )}

                  {contractAddr && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Contract</p>
                        <div className="flex items-center gap-2">
                          <a
                            href={`${BLOCK_EXPLORER}/address/${contractAddr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {shortenAddress(contractAddr)}
                          </a>
                          <button
                            onClick={() => copy(contractAddr)}
                            className="text-muted hover:text-foreground transition-colors"
                            aria-label="Copy contract address"
                          >
                            {copied ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success"><path d="M20 6 9 17l-5-5"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Organizer</p>
                      <p className="text-sm font-medium">
                        {event.organizer?.displayName || event.organizer?.display_name || (event.organizer?.walletAddress || event.organizer?.wallet_address ? shortenAddress(event.organizer.walletAddress || event.organizer.wallet_address || '') : 'Unknown')}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right — tiers & mint */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Ticket Tiers</h2>
              {tiers.length === 0 ? (
                <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 text-center">
                  <p className="text-sm text-muted">No ticket tiers available yet</p>
                </div>
              ) : (
                tiers.map((tier) => {
                  const available = (tier.maxSupply ?? tier.max_supply ?? tier.supply ?? 0) - (tier.mintedCount ?? tier.minted ?? 0);
                  const total = tier.maxSupply ?? tier.max_supply ?? tier.supply ?? 0;
                  const soldOut = available <= 0 && total > 0;
                  const progress = total > 0 ? ((total - available) / total) * 100 : 0;

                  return (
                    <motion.div
                      key={tier.id}
                      className={cn(
                        'rounded-2xl border p-5 transition-all cursor-pointer backdrop-blur-sm',
                        selectedTier?.id === tier.id
                          ? 'border-primary bg-primary/10 shadow-xl shadow-primary/15'
                          : 'border-border/30 bg-surface/80 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
                        soldOut && 'opacity-50 cursor-not-allowed',
                      )}
                      onClick={() => !soldOut && setSelectedTier(selectedTier?.id === tier.id ? null : tier)}
                      initial="hidden" animate="visible" variants={fadeUp}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold">{tier.name}</h3>
                        {soldOut && <Badge label="Sold Out" className="bg-error/15 text-error" />}
                      </div>
                      {tier.description && (
                        <p className="text-sm text-muted mb-3">{tier.description}</p>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-primary">{formatPrice(getTierPrice(tier))}</span>
                        <span className="text-xs text-muted">{available}/{total} left</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            progress >= 90 ? 'bg-error' : progress >= 70 ? 'bg-warning' : 'bg-primary',
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </motion.div>
                  );
                })
              )}

              {/* Mint section */}
              <AnimatePresence>
                {selectedTier && (
                  <motion.div
                    className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4"
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  >
                    <h3 className="font-bold">Mint: {selectedTier.name}</h3>

                    {/* Quantity selector */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-muted">Qty:</label>
                      <div className="flex items-center rounded-lg border border-border bg-surface">
                        <button
                          onClick={() => setMintQty((q) => Math.max(1, q - 1))}
                          className="px-3 py-1.5 text-muted hover:text-foreground transition-colors"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-bold tabular-nums">{mintQty}</span>
                        <button
                          onClick={() => setMintQty((q) => Math.min(10, q + 1))}
                          className="px-3 py-1.5 text-muted hover:text-foreground transition-colors"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Price breakdown */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Price per ticket</span>
                        <span>{formatPrice(getTierPrice(selectedTier))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Quantity</span>
                        <span>×{mintQty}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">
                          {formatPrice(String(getTierPriceWei(selectedTier) * BigInt(mintQty)))}
                        </span>
                      </div>
                    </div>

                    {!account ? (
                      <p className="text-xs text-muted text-center py-2">Connect your wallet to mint tickets</p>
                    ) : !contractAddr ? (
                      <p className="text-xs text-warning text-center py-2">Contract not deployed yet</p>
                    ) : (
                      <Button className="w-full" size="lg" onClick={handleMint}>
                        Mint {mintQty} Ticket{mintQty > 1 ? 's' : ''}
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Mint Transaction Modal */}
      <Modal
        open={showMintModal}
        onClose={tx.step === 'success' || tx.step === 'error' ? closeMintModal : () => {}}
        title="Minting Tickets"
        size="sm"
      >
        <div className="py-2">
          {tx.step && (
            <TransactionTracker
              currentStep={tx.step}
              errorMessage={tx.error || undefined}
              txHash={tx.hash || undefined}
              blockExplorer={BLOCK_EXPLORER}
            />
          )}

          {tx.step === 'success' && (
            <div className="mt-6 flex gap-3 justify-center">
              <Button variant="outline" onClick={closeMintModal}>Close</Button>
              <Button onClick={() => router.push('/tickets')}>View My Tickets</Button>
            </div>
          )}

          {tx.step === 'error' && (
            <div className="mt-6 flex gap-3 justify-center">
              <Button variant="outline" onClick={closeMintModal}>Cancel</Button>
              <Button onClick={handleMint}>Try Again</Button>
            </div>
          )}
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
