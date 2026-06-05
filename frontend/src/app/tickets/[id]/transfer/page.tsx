'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { prepareContractCall, getContract } from 'thirdweb';
import { useSendTransaction, useActiveAccount } from 'thirdweb/react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { TransactionTracker } from '@/components/TransactionTracker';
import { ticketsApi } from '@/lib/api';
import { thirdwebClient, activeChain, BLOCK_EXPLORER } from '@/lib/constants';
import { shortenAddress } from '@/lib/utils';
import { toast } from 'sonner';
import { useEffect, useCallback } from 'react';
import { DetailSkeleton } from '@/components/Skeleton';
import { useTransaction } from '@/lib/hooks';
import type { Ticket } from '@/lib/types';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default function TransferTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendTransaction();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  // Transaction tracking
  const tx = useTransaction();
  const [showTxModal, setShowTxModal] = useState(false);

  const loadTicket = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ticketsApi.getById(id);
      setTicket(data);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadTicket();
  }, [id, loadTicket]);

  const isValidAddress = ADDRESS_REGEX.test(recipientAddress);
  const isSelfTransfer = account?.address?.toLowerCase() === recipientAddress.toLowerCase();
  const contractAddr = ticket?.contractAddress || ticket?.contract_address || ticket?.event?.contractAddress || ticket?.event?.contract_address || '';
  const tokenId = ticket?.tokenId ?? ticket?.token_id;

  const handleTransfer = async () => {
    if (!account || !contractAddr || tokenId == null || !isValidAddress) return;

    setShowTxModal(true);
    await tx.execute(async ({ setStep, setHash }) => {
      const contract = getContract({
        client: thirdwebClient,
        chain: activeChain,
        address: contractAddr,
      });

      const prepared = prepareContractCall({
        contract,
        method: 'function safeTransferFrom(address from, address to, uint256 tokenId)',
        params: [account.address, recipientAddress, BigInt(tokenId)],
      });

      setStep('awaiting-signature');
      const result = await sendTx(prepared);

      setStep('broadcasting');
      setHash(result.transactionHash);

      setStep('confirming');
      setStep('success');
      toast.success('Ticket transferred successfully!');
    });
  };

  const closeModal = () => {
    setShowTxModal(false);
    const wasSuccess = tx.step === 'success';
    tx.reset();
    if (wasSuccess) router.push('/tickets');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-lg"><DetailSkeleton /></div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Ticket not found</h2>
            <p className="text-muted">This ticket may have been removed or doesn&apos;t exist.</p>
            <Button onClick={() => router.push('/tickets')}>Back to Tickets</Button>
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
        <div className="mx-auto max-w-lg">
          {/* Back */}
          <button
            onClick={() => router.push('/tickets')}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Tickets
          </button>

          <motion.div
            className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 space-y-6 shadow-xl shadow-primary/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 shadow-lg shadow-accent/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">Transfer</span> Ticket
                </h1>
                <p className="text-sm text-muted">Send your NFT ticket to another wallet</p>
              </div>
            </div>

            {/* Ticket summary */}
            <div className="rounded-xl bg-surface-light/80 backdrop-blur-sm border border-border/20 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Event</span>
                <span className="font-medium">{ticket.event?.name || ticket.event?.title || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tier</span>
                <span className="font-medium">{ticket.tier?.name || 'General'}</span>
              </div>
              {tokenId != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Token ID</span>
                  <span className="font-mono text-primary">#{tokenId}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">From</span>
                <span className="font-mono text-xs">{account ? shortenAddress(account.address) : '—'}</span>
              </div>
            </div>

            {/* Recipient input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient Address</label>
              <Input
                placeholder="0x..."
                value={recipientAddress}
                onChange={(e) => {
                  setRecipientAddress(e.target.value);
                  setConfirmStep(false);
                }}
              />
              {recipientAddress && !isValidAddress && (
                <p className="text-xs text-error">Please enter a valid Ethereum address (0x...40 hex chars)</p>
              )}
              {isSelfTransfer && (
                <p className="text-xs text-warning">You cannot transfer to yourself</p>
              )}
            </div>

            {/* Warnings */}
            <div className="rounded-xl bg-warning/10 border border-warning/20 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning mt-0.5 shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div className="text-xs text-warning/90 space-y-1">
                  <p className="font-medium">This action is irreversible</p>
                  <p>Once transferred, you will lose ownership of this NFT ticket. Double-check the recipient address — tokens sent to the wrong address cannot be recovered.</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {!confirmStep ? (
              <Button
                className="w-full"
                disabled={!isValidAddress || isSelfTransfer || !account}
                onClick={() => setConfirmStep(true)}
              >
                Continue
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm text-center">
                    Confirm transfer to <span className="font-mono text-primary">{shortenAddress(recipientAddress)}</span>?
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmStep(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleTransfer}>
                    Transfer Now
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Transaction Modal */}
      <Modal
        open={showTxModal}
        onClose={tx.step === 'success' || tx.step === 'error' ? closeModal : () => {}}
        title="Transferring Ticket"
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
              <Button variant="outline" onClick={closeModal}>Close</Button>
              <Button onClick={() => router.push('/tickets')}>My Tickets</Button>
            </div>
          )}

          {tx.step === 'error' && (
            <div className="mt-6 flex gap-3 justify-center">
              <Button variant="outline" onClick={closeModal}>Cancel</Button>
              <Button onClick={handleTransfer}>Try Again</Button>
            </div>
          )}
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
