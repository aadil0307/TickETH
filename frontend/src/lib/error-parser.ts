/**
 * Centralized error parser for TickETH.
 * Maps blockchain RPC errors, wallet errors, API errors, and generic exceptions
 * into clean, user-friendly messages. No raw hex or RPC codes ever shown to users.
 */

export interface ParsedError {
  title: string;
  message: string;
  code?: string;
  retry: boolean;
}

/* ─── Known blockchain revert reasons ──────────────────── */
const REVERT_MAP: Record<string, string> = {
  'SaleNotActive': 'Ticket sales have not started yet for this event.',
  'SoldOut': 'This ticket tier is sold out.',
  'Sold out': 'This ticket tier is sold out.',
  'ExceedsMaxPerWallet': 'You have reached the maximum tickets per wallet for this tier.',
  'InsufficientPayment': 'The payment amount is insufficient. Please check the ticket price.',
  'InvalidTier': 'This ticket tier does not exist or has been removed.',
  'NotWhitelisted': 'Your wallet is not on the whitelist for this event.',
  'TransferNotAllowed': 'Transfer is not allowed for this ticket.',
  'ResaleNotAllowed': 'Resale is not permitted for this ticket tier.',
  'NotTicketOwner': 'You do not own this ticket.',
  'AlreadyListed': 'This ticket is already listed on the marketplace.',
  'ListingNotActive': 'This listing is no longer available.',
  'CannotBuyOwnListing': 'You cannot buy your own listing.',
  'EventCancelled': 'This event has been cancelled.',
  'AlreadyCheckedIn': 'This ticket has already been used for check-in.',
  'TicketInvalidated': 'This ticket has been invalidated.',
  'Paused': 'This contract is currently paused by the organizer.',
};

/* ─── Match a revert reason from error ─────────────────── */
function matchRevert(msg: string): string | null {
  for (const [key, value] of Object.entries(REVERT_MAP)) {
    if (msg.includes(key)) return value;
  }
  return null;
}

/* ─── Parse blockchain/wallet errors ───────────────────── */
function parseWeb3Error(error: unknown): ParsedError | null {
  const err = error as Record<string, unknown>;
  const message = String(err?.message || err?.reason || '');
  const code = err?.code as string | number | undefined;

  // User rejected transaction (MetaMask, WalletConnect, etc.)
  if (
    code === 4001 ||
    code === 'ACTION_REJECTED' ||
    message.includes('user rejected') ||
    message.includes('User rejected') ||
    message.includes('user denied') ||
    message.includes('User denied') ||
    message.includes('rejected the request') ||
    message.includes('declined')
  ) {
    return {
      title: 'Transaction Cancelled',
      message: 'You cancelled the transaction. No changes were made.',
      code: 'USER_REJECTED',
      retry: true,
    };
  }

  // Insufficient funds
  if (
    message.includes('insufficient funds') ||
    message.includes('INSUFFICIENT_FUNDS') ||
    message.includes('not enough balance')
  ) {
    return {
      title: 'Insufficient Funds',
      message: 'Your wallet doesn\'t have enough POL to complete this transaction. Please add funds and try again.',
      code: 'INSUFFICIENT_FUNDS',
      retry: true,
    };
  }

  // Gas estimation failed (often a revert)
  if (
    message.includes('gas required exceeds') ||
    message.includes('UNPREDICTABLE_GAS_LIMIT') ||
    message.includes('cannot estimate gas')
  ) {
    const revert = matchRevert(message);
    if (revert) {
      return {
        title: 'Transaction Failed',
        message: revert,
        code: 'REVERT',
        retry: false,
      };
    }
    return {
      title: 'Transaction Failed',
      message: 'This transaction would fail. The contract conditions may not be met (e.g., sale not active, sold out, or not whitelisted).',
      code: 'GAS_ESTIMATE_FAILED',
      retry: true,
    };
  }

  // Network timeout / connection
  if (
    message.includes('timeout') ||
    message.includes('TIMEOUT') ||
    message.includes('network error') ||
    message.includes('NETWORK_ERROR') ||
    message.includes('could not detect network')
  ) {
    return {
      title: 'Network Error',
      message: 'Unable to reach the blockchain network. Please check your internet connection and try again.',
      code: 'NETWORK_ERROR',
      retry: true,
    };
  }

  // Nonce too low (double transaction)
  if (message.includes('nonce') && message.includes('too low')) {
    return {
      title: 'Transaction Conflict',
      message: 'A previous transaction is still pending. Please wait for it to confirm and try again.',
      code: 'NONCE_TOO_LOW',
      retry: true,
    };
  }

  // Transaction replaced / speed-up
  if (message.includes('TRANSACTION_REPLACED') || message.includes('transaction was replaced')) {
    return {
      title: 'Transaction Replaced',
      message: 'Your transaction was replaced by another one. Please check your wallet for details.',
      code: 'TX_REPLACED',
      retry: true,
    };
  }

  // Contract revert — try to match specific reason
  if (
    message.includes('execution reverted') ||
    message.includes('CALL_EXCEPTION') ||
    message.includes('revert')
  ) {
    const revert = matchRevert(message);
    return {
      title: 'Transaction Failed',
      message: revert || 'The transaction was rejected by the smart contract. Please verify the conditions and try again.',
      code: 'REVERT',
      retry: true,
    };
  }

  // Wrong chain
  if (
    message.includes('wrong network') ||
    message.includes('chain mismatch') ||
    message.includes('Unsupported chain')
  ) {
    return {
      title: 'Wrong Network',
      message: 'Please switch your wallet to the Polygon Amoy network to continue.',
      code: 'WRONG_NETWORK',
      retry: true,
    };
  }

  return null;
}

/* ─── Parse API (backend) errors ───────────────────────── */
function parseApiError(error: unknown): ParsedError | null {
  const err = error as Record<string, unknown>;

  // Axios error shape
  const response = err?.response as Record<string, unknown> | undefined;
  if (!response) return null;

  const status = response.status as number;
  const body = response.data as Record<string, unknown> | undefined;
  const serverMessage = body?.message as string | undefined;

  switch (status) {
    case 400:
      return {
        title: 'Invalid Request',
        message: serverMessage || 'The request was invalid. Please check your inputs and try again.',
        code: 'BAD_REQUEST',
        retry: false,
      };
    case 401:
      return {
        title: 'Session Expired',
        message: 'Your session has expired. Please reconnect your wallet to continue.',
        code: 'UNAUTHORIZED',
        retry: true,
      };
    case 403:
      return {
        title: 'Access Denied',
        message: serverMessage || 'You don\'t have permission to perform this action.',
        code: 'FORBIDDEN',
        retry: false,
      };
    case 404:
      return {
        title: 'Not Found',
        message: serverMessage || 'The requested resource was not found.',
        code: 'NOT_FOUND',
        retry: false,
      };
    case 409:
      return {
        title: 'Conflict',
        message: serverMessage || 'This action conflicts with the current state. Please refresh and try again.',
        code: 'CONFLICT',
        retry: true,
      };
    case 429:
      return {
        title: 'Too Many Requests',
        message: 'You\'re making too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
        retry: true,
      };
    case 500:
    case 502:
    case 503:
      return {
        title: 'Server Error',
        message: 'Something went wrong on our end. Please try again in a moment.',
        code: 'SERVER_ERROR',
        retry: true,
      };
    default:
      return {
        title: 'Error',
        message: serverMessage || 'An unexpected error occurred. Please try again.',
        code: `HTTP_${status}`,
        retry: true,
      };
  }
}

/* ─── Main export ──────────────────────────────────────── */
export function parseError(error: unknown): ParsedError {
  // 1. Try blockchain/wallet error
  const web3 = parseWeb3Error(error);
  if (web3) return web3;

  // 2. Try API error
  const api = parseApiError(error);
  if (api) return api;

  // 3. Standard Error
  if (error instanceof Error) {
    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred.',
      retry: true,
    };
  }

  // 4. String error
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
      retry: true,
    };
  }

  // 5. Unknown
  return {
    title: 'Unknown Error',
    message: 'Something went wrong. Please try again.',
    retry: true,
  };
}

/** Quick helper: get just the user-friendly message */
export function getErrorMessage(error: unknown): string {
  return parseError(error).message;
}
