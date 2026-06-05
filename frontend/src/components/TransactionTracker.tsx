'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export type TxStep = 'preparing' | 'awaiting-signature' | 'broadcasting' | 'confirming' | 'success' | 'error';

interface StepConfig {
  label: string;
  description: string;
}

const STEP_CONFIG: Record<TxStep, StepConfig> = {
  preparing: { label: 'Preparing', description: 'Building your transaction…' },
  'awaiting-signature': { label: 'Awaiting Signature', description: 'Please confirm in your wallet…' },
  broadcasting: { label: 'Broadcasting', description: 'Sending transaction to network…' },
  confirming: { label: 'Confirming', description: 'Waiting for blockchain confirmation…' },
  success: { label: 'Complete', description: 'Transaction confirmed!' },
  error: { label: 'Failed', description: 'Transaction failed' },
};

const ORDERED_STEPS: TxStep[] = ['preparing', 'awaiting-signature', 'broadcasting', 'confirming', 'success'];

function stepIndex(step: TxStep): number {
  const idx = ORDERED_STEPS.indexOf(step);
  return idx === -1 ? -1 : idx;
}

export function TransactionTracker({
  currentStep,
  errorMessage,
  txHash,
  blockExplorer,
  className,
}: {
  currentStep: TxStep;
  errorMessage?: string;
  txHash?: string;
  blockExplorer?: string;
  className?: string;
}) {
  const currentIdx = stepIndex(currentStep);
  const isError = currentStep === 'error';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Steps */}
      <div className="space-y-1">
        {ORDERED_STEPS.slice(0, -1).map((step, i) => {
          const config = STEP_CONFIG[step];
          const isCurrent = currentStep === step;
          const isDone = currentIdx > i;
          const isActive = isCurrent && !isError;

          return (
            <div key={step} className="flex items-start gap-3 py-2">
              {/* Icon */}
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isDone && 'border-success bg-success/15 text-success',
                    isActive && 'border-primary bg-primary/15 text-primary animate-pulse-glow',
                    !isDone && !isActive && 'border-border bg-surface text-muted',
                    isError && isCurrent && 'border-error bg-error/15 text-error',
                  )}
                >
                  {isDone ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : isActive ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : isError && isCurrent ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                {/* Connector line */}
                {i < ORDERED_STEPS.length - 2 && (
                  <div
                    className={cn(
                      'w-0.5 h-4 mt-1',
                      isDone ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}
              </div>

              {/* Text */}
              <div className="pt-1">
                <p className={cn(
                  'text-sm font-semibold',
                  isDone && 'text-success',
                  isActive && 'text-primary',
                  !isDone && !isActive && 'text-muted',
                  isError && isCurrent && 'text-error',
                )}>
                  {isError && isCurrent ? STEP_CONFIG.error.label : config.label}
                </p>
                {(isActive || (isError && isCurrent)) && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('text-xs mt-0.5', isError ? 'text-error' : 'text-muted')}
                  >
                    {isError ? (errorMessage || STEP_CONFIG.error.description) : config.description}
                  </motion.p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Success state */}
      {currentStep === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-success/10 border border-success/30 p-4 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-success font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Transaction Confirmed!
          </div>
          {txHash && blockExplorer && (
            <a
              href={`${blockExplorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-accent hover:underline"
            >
              View on Explorer →
            </a>
          )}
        </motion.div>
      )}
    </div>
  );
}
