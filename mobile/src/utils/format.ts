import { ethers } from 'ethers';
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';

/** Shorten a wallet address: 0x1234...5678 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Format wei to ETH/POL with symbol */
export function formatPrice(weiString: string, symbol = 'POL'): string {
  try {
    const formatted = ethers.formatEther(weiString);
    // Remove trailing zeros
    const num = parseFloat(formatted);
    return `${num} ${symbol}`;
  } catch {
    return `0 ${symbol}`;
  }
}

/** Format a date string for display */
export function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

/** Format a date with time */
export function formatDateTime(dateString: string): string {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
  } catch {
    return dateString;
  }
}

/** Relative time (e.g., "2 hours ago") */
export function formatRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

/** Check if an event has started */
export function hasEventStarted(startTime: string): boolean {
  try {
    return isBefore(parseISO(startTime), new Date());
  } catch {
    return false;
  }
}

/** Check if an event is upcoming (within 24 hours) */
export function isEventSoon(startTime: string): boolean {
  try {
    const start = parseISO(startTime);
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return isAfter(start, now) && isBefore(start, twentyFourHoursFromNow);
  } catch {
    return false;
  }
}

/** Format ticket status with proper display text */
export function formatTicketStatus(status: string): string {
  const map: Record<string, string> = {
    minted: 'Active',
    checked_in: 'Checked In',
    transferred: 'Transferred',
    listed: 'Listed for Sale',
    invalidated: 'Invalidated',
  };
  return map[status] ?? status;
}

/** Format large numbers (e.g., 1234 → 1.2K) */
export function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
