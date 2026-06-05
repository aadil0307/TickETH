import { createThirdwebClient } from 'thirdweb';
import { polygonAmoy } from 'thirdweb/chains';

/* ─── Thirdweb ───────────────────────────────────────────── */
export const THIRDWEB_CLIENT_ID =
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? '';

export const thirdwebClient = createThirdwebClient({
  clientId: THIRDWEB_CLIENT_ID || '98ae3d982a02db9fa69f6aeec72166e2', // fallback for dev only
});

export const activeChain = polygonAmoy;

/* ─── API ────────────────────────────────────────────────── */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/* ─── Contracts ──────────────────────────────────────────── */
export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? '0x8E0237fed96693c36c5A5021A6893b7B9F3494B2';
export const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? '0x828bE7efB199b867684bE502A8e93F817697a543';
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 80002);
export const BLOCK_EXPLORER = process.env.NEXT_PUBLIC_BLOCK_EXPLORER ?? 'https://amoy.polygonscan.com';

/* ─── App ────────────────────────────────────────────────── */

// Use actual origin in dev so SIWE domain matches the browser's location
const isBrowser = typeof window !== 'undefined';
export const SIWE_DOMAIN =
  process.env.NEXT_PUBLIC_SIWE_DOMAIN ??
  (isBrowser ? window.location.host : 'ticketh.io');
export const SIWE_URI =
  process.env.NEXT_PUBLIC_SIWE_URI ??
  (isBrowser ? window.location.origin : 'https://ticketh.io');
