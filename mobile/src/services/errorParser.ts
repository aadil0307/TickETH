/**
 * Global centralised error parser.
 *
 * Converts raw RPC errors, Axios errors, timeout errors, wallet
 * rejection, and insufficient-funds errors into clean,
 * user-friendly messages that can be displayed in the UI.
 *
 * RULE: **Never** show raw stack traces or RPC hex codes to the user.
 */

import { AxiosError } from 'axios';

/* ─── Error categories ──────────────────────────────────── */

export type ErrorCategory =
  | 'wallet_rejected'
  | 'insufficient_funds'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'server'
  | 'contract_revert'
  | 'offline'
  | 'unknown';

export interface ParsedError {
  /** Human-readable message for the UI */
  message: string;
  /** Machine-readable category */
  category: ErrorCategory;
  /** Whether a "Retry" CTA makes sense */
  retryable: boolean;
}

/* ─── Pattern matchers ──────────────────────────────────── */

const PATTERNS: Array<{
  test: (msg: string) => boolean;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}> = [
  // Wallet / signature rejection
  {
    test: (m) =>
      /reject|denied|cancel|user\s+cancel|ACTION_REJECTED/i.test(m),
    category: 'wallet_rejected',
    message: 'Operation cancelled by user.',
    retryable: false,
  },
  // Insufficient funds
  {
    test: (m) =>
      /insufficient\s+funds|not\s+enough|INSUFFICIENT_FUNDS/i.test(m),
    category: 'insufficient_funds',
    message: 'Insufficient POL balance for this transaction.',
    retryable: false,
  },
  // Contract reverts
  {
    test: (m) =>
      /revert|CALL_EXCEPTION|execution\s+reverted|out\s+of\s+gas/i.test(m),
    category: 'contract_revert',
    message:
      'Transaction reverted. The tier may be sold out, minting paused, or a contract rule was violated.',
    retryable: false,
  },
  // Timeout
  {
    test: (m) => /timeout|ETIMEDOUT|ECONNABORTED|timed?\s*out/i.test(m),
    category: 'timeout',
    message: 'Request timed out. Please check your connection and try again.',
    retryable: true,
  },
  // Network / CORS / DNS
  {
    test: (m) =>
      /network|ENOTFOUND|ERR_NETWORK|ECONNREFUSED|ECONNRESET|fetch\s+failed/i.test(
        m,
      ),
    category: 'network',
    message: 'Network error. Please check your internet connection.',
    retryable: true,
  },
  // Nonce expired
  {
    test: (m) => /nonce\s+expired|session\s+expired/i.test(m),
    category: 'auth',
    message: 'Session expired. Please try again.',
    retryable: true,
  },
  // Wrong network
  {
    test: (m) => /wrong\s+network|chain\s+mismatch|unsupported\s+chain/i.test(m),
    category: 'network',
    message: 'Please switch to the Polygon network to continue.',
    retryable: false,
  },
];

/* ─── Main parser ───────────────────────────────────────── */

export function parseError(err: unknown): ParsedError {
  if (!err) {
    return { message: 'An unknown error occurred.', category: 'unknown', retryable: true };
  }

  // 1. Axios errors
  if (isAxiosError(err)) {
    return parseAxiosError(err);
  }

  // 2. Extract raw string
  const raw = extractMessage(err);

  // 3. Match patterns
  for (const p of PATTERNS) {
    if (p.test(raw)) {
      return { message: p.message, category: p.category, retryable: p.retryable };
    }
  }

  // 4. Fallback — truncated, no stack trace
  const clean = raw.split('\n')[0].slice(0, 120);
  return {
    message: clean || 'Something went wrong. Please try again.',
    category: 'unknown',
    retryable: true,
  };
}

/* ─── Axios-specific ────────────────────────────────────── */

function parseAxiosError(err: AxiosError<any>): ParsedError {
  // Offline / no response
  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      return { message: 'Request timed out. Please try again.', category: 'timeout', retryable: true };
    }
    return { message: 'Network error. Please check your connection.', category: 'network', retryable: true };
  }

  const status = err.response.status;
  const serverMsg: string =
    err.response.data?.message ??
    err.response.data?.error ??
    err.response.statusText ??
    '';

  if (status === 401) {
    return { message: 'Session expired. Please reconnect your wallet.', category: 'auth', retryable: false };
  }
  if (status === 403) {
    return { message: 'You do not have permission for this action.', category: 'auth', retryable: false };
  }
  if (status === 404) {
    return { message: 'The requested resource was not found.', category: 'unknown', retryable: false };
  }
  if (status === 429) {
    return { message: 'Too many requests. Please wait a moment.', category: 'network', retryable: true };
  }
  if (status >= 500) {
    return { message: 'Server error. Please try again later.', category: 'server', retryable: true };
  }

  // Use the server message if it's clean
  if (serverMsg && serverMsg.length < 120 && !serverMsg.includes('Error:')) {
    return { message: serverMsg, category: 'unknown', retryable: true };
  }

  return { message: 'Something went wrong. Please try again.', category: 'unknown', retryable: true };
}

/* ─── Helpers ───────────────────────────────────────────── */

function isAxiosError(err: unknown): err is AxiosError<any> {
  return typeof err === 'object' && err !== null && 'isAxiosError' in err;
}

function extractMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const obj = err as any;
    return obj.message ?? obj.reason ?? obj.shortMessage ?? JSON.stringify(obj);
  }
  return String(err);
}
