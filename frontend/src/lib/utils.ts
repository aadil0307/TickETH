import { formatEther, parseEther } from 'ethers';
import { format, formatDistanceToNow } from 'date-fns';

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatPrice(value: string | number | undefined | null, symbol = 'POL'): string {
  try {
    if (value === undefined || value === null || value === '') return 'Free';
    const str = String(value);
    // If value looks like wei (large integer, no decimal, > 1e9), convert from wei
    const isWei = /^\d+$/.test(str) && str.length > 9;
    const num = isWei ? parseFloat(formatEther(str)) : parseFloat(str);
    if (isNaN(num) || num === 0) return 'Free';
    return `${num % 1 === 0 ? num.toFixed(0) : num.toFixed(4)} ${symbol}`;
  } catch {
    return `${value} wei`;
  }
}

/** Get the best available price for display (prefer price_wei, fallback to price) */
export function getTierPrice(tier: { price?: string | number; price_wei?: string; priceWei?: string }): string {
  return tier.price_wei || tier.priceWei || String(tier.price ?? '0');
}

/**
 * Get the tier price as a valid wei BigInt string (for on-chain transactions).
 * Handles both proper wei strings ("10000000000000000") and MATIC decimals ("0.01").
 */
export function getTierPriceWei(tier: { price?: string | number; price_wei?: string; priceWei?: string }): bigint {
  const raw = getTierPrice(tier);
  // If it's a valid integer string, treat as wei
  if (/^\d+$/.test(raw) && raw.length > 6) {
    return BigInt(raw);
  }
  // Otherwise treat as MATIC amount and convert to wei
  try {
    return parseEther(raw);
  } catch {
    return BigInt(0);
  }
}

export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'MMM d, yyyy');
}

export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), 'MMM d, yyyy h:mm a');
}

export function formatRelativeTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'N/A';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function statusBg(status: string): string {
  switch (status) {
    case 'published':
    case 'active':
    case 'minted':
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-400';
    case 'live':
      return 'bg-blue-500/15 text-blue-400';
    case 'draft':
    case 'pending':
      return 'bg-yellow-500/15 text-yellow-400';
    case 'sold':
    case 'checked_in':
    case 'completed':
      return 'bg-violet-500/15 text-violet-400';
    case 'cancelled':
    case 'rejected':
    case 'invalidated':
      return 'bg-red-500/15 text-red-400';
    default:
      return 'bg-gray-500/15 text-gray-400';
  }
}
