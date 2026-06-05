import { SIWE_DOMAIN, SIWE_URI, CHAIN_ID } from './constants';

interface SiweParams {
  address: string;
  nonce: string;
  chainId?: number;
  domain?: string;
  statement?: string;
}

export function buildSiweMessage({
  address,
  nonce,
  chainId = CHAIN_ID,
  domain = SIWE_DOMAIN,
  statement = 'Sign in to TickETH',
}: SiweParams): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${SIWE_URI}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}
