'use client';

import { ThirdwebProvider } from 'thirdweb/react';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // Suppress Thirdweb's nested <button> hydration warning (their DetailsModal
  // renders CopyIcon <button> inside a Styled <button> — can't fix upstream)
  useEffect(() => {
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && (
        args[0].includes('<button> cannot be a descendant of <button>') ||
        args[0].includes('<button> cannot contain a nested <button>') ||
        args[0].includes('In HTML, <button> cannot be a descendant of <button>')
      )) return;
      orig.apply(console, args);
    };
    return () => { console.error = orig; };
  }, []);

  return (
    <ThirdwebProvider>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A2E',
              border: '1px solid #2A2A3E',
              color: '#F5F5F5',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
          richColors
          closeButton
          duration={4000}
        />
      </ThirdwebProvider>
  );
}
