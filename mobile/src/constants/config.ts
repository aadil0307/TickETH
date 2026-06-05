import Constants from 'expo-constants';
import { createThirdwebClient } from 'thirdweb';
import { polygonAmoy } from 'thirdweb/chains';

function getExpoHostIp(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  const [host] = hostUri.split(':');
  return host || null;
}

/** Backend API base URL */
export const API_BASE_URL =
  __DEV__
    ? (() => {
        const expoHostIp = getExpoHostIp();
        if (expoHostIp) {
          return `http://${expoHostIp}:3001/api/v1`;
        }
        return Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://127.0.0.1:3001/api/v1';
      })()
    : (Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://api.ticketh.io/api/v1');

/** Thirdweb client — uses clientId from Expo config */
export const THIRDWEB_CLIENT_ID =
  Constants.expoConfig?.extra?.thirdwebClientId ?? '';

export const thirdwebClient = createThirdwebClient({
  clientId: THIRDWEB_CLIENT_ID || '98ae3d982a02db9fa69f6aeec72166e2',
});

/** Active chain for the app */
export const activeChain = polygonAmoy;

/** Polygon Amoy testnet config */
export const CHAIN_CONFIG = {
  chainId: 80002,
  chainName: 'Polygon Amoy Testnet',
  rpcUrl: 'https://rpc-amoy.polygon.technology/',
  blockExplorer: 'https://amoy.polygonscan.com',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
} as const;

/** Deployed contract addresses (Polygon Amoy) — from env or dev defaults */
export const CONTRACTS = {
  factory: Constants.expoConfig?.extra?.factoryAddress ?? '0x8E0237fed96693c36c5A5021A6893b7B9F3494B2',
  marketplace: Constants.expoConfig?.extra?.marketplaceAddress ?? '0x828bE7efB199b867684bE502A8e93F817697a543',
  implementation: Constants.expoConfig?.extra?.implementationAddress ?? '0x164d162Da6edF739A0bCd610FBd5d808c165870e',
} as const;

/** WalletConnect project ID — get one at https://cloud.walletconnect.com */
export const WALLETCONNECT_PROJECT_ID =
  Constants.expoConfig?.extra?.walletConnectProjectId ?? '';

/** If true, app never restores previous auth session automatically. */
export const REQUIRE_EXPLICIT_LOGIN =
  Constants.expoConfig?.extra?.requireExplicitLogin ?? true;

/** QR code refresh interval (ms) — refresh nonce every 25 seconds */
export const QR_REFRESH_INTERVAL = 25_000;

/** Push notification channel (Android) */
export const NOTIFICATION_CHANNEL_ID = 'ticketh-checkin';

/** Offline scan cache TTL (ms) — 24 hours */
export const OFFLINE_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Max offline scans to queue before forcing sync */
export const MAX_OFFLINE_QUEUE = 200;

/** Minimum app version for forced updates */
export const MIN_APP_VERSION = '1.0.0';
