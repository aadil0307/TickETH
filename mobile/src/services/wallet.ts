import { ethers } from 'ethers';
import { CHAIN_CONFIG } from '../constants/config';

/**
 * Wallet service — provides ethers.js utilities for signing messages
 * and interacting with the Polygon network.
 *
 * In a React Native context, the actual wallet connection goes through
 * WalletConnect. This service handles the on-chain parts.
 */

/** Get a read-only provider for Polygon Amoy */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl, {
    chainId: CHAIN_CONFIG.chainId,
    name: CHAIN_CONFIG.chainName,
  });
}

/** Construct a SIWE (Sign-In with Ethereum) message */
export function buildSiweMessage(params: {
  address: string;
  nonce: string;
  chainId?: number;
  domain?: string;
  statement?: string;
}): string {
  const {
    address,
    nonce,
    chainId = CHAIN_CONFIG.chainId,
    domain = 'ticketh.io',
    statement = 'Sign in to TickETH',
  } = params;

  const issuedAt = new Date().toISOString();

  // EIP-4361 format
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: https://${domain}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

/** Validate that an address is a valid Ethereum address */
export function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address); // Checksums and validates
    return true;
  } catch {
    return false;
  }
}

/** Get Polygonscan URL for a transaction */
export function getTxUrl(txHash: string): string {
  return `${CHAIN_CONFIG.blockExplorer}/tx/${txHash}`;
}

/** Get Polygonscan URL for an address */
export function getAddressUrl(address: string): string {
  return `${CHAIN_CONFIG.blockExplorer}/address/${address}`;
}

/** Get Polygonscan URL for a token */
export function getTokenUrl(contractAddress: string, tokenId: number): string {
  return `${CHAIN_CONFIG.blockExplorer}/token/${contractAddress}?a=${tokenId}`;
}
