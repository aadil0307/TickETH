/**
 * Smart-contract interaction service for TickETH.
 *
 * Uses thirdweb v5 to prepare & send transactions and ethers.js to
 * wait for receipts / parse logs (guaranteed to work regardless of
 * thirdweb internal API changes).
 */

import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { ethers } from 'ethers';
import { thirdwebClient, activeChain, CHAIN_CONFIG } from '../constants/config';

/* ─── Helpers ──────────────────────────────────────────── */

function getRpcProvider() {
  return new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl, {
    chainId: CHAIN_CONFIG.chainId,
    name: CHAIN_CONFIG.chainName,
  });
}

/** Wrap a thirdweb contract reference */
export function getTicketContract(contractAddress: string) {
  return getContract({
    client: thirdwebClient,
    chain: activeChain,
    address: contractAddress,
  });
}

/** Turn a raw error into a user-friendly message */
function userFriendlyTxError(err: any): string {
  const msg: string = err?.message ?? err?.toString() ?? '';
  if (msg.includes('rejected') || msg.includes('denied'))
    return 'Transaction was rejected by the user.';
  if (msg.includes('insufficient funds'))
    return 'Insufficient POL balance for this transaction.';
  if (msg.includes('revert') || msg.includes('CALL_EXCEPTION'))
    return 'Transaction reverted. The tier may be sold out or minting is paused.';
  if (msg.includes('timeout'))
    return 'Transaction timed out. It may still confirm — check your wallet.';
  return msg || 'Transaction failed.';
}

/* ─── Mint ─────────────────────────────────────────────── */

export interface MintResult {
  txHash: string;
  tokenId: number;
}

/**
 * Mint a ticket NFT on-chain.
 *
 * @param contractAddress – The event's ERC-721 ticket contract
 * @param tierIndex       – 0-based on-chain tier index (order in backend tiers array)
 * @param price           – Wei string (from TicketTier.price)
 * @param account         – thirdweb Account from useActiveAccount()
 */
export async function mintTicketOnChain(params: {
  contractAddress: string;
  tierIndex: number;
  price: string;
  account: any; // thirdweb Account (from useActiveAccount)
}): Promise<MintResult> {
  try {
    const contract = getTicketContract(params.contractAddress);

    const transaction = prepareContractCall({
      contract,
      method: 'function mint(uint256 tierId, bytes32[] proof) payable',
      params: [BigInt(params.tierIndex), []],
      value: BigInt(params.price),
    });

    const { transactionHash } = await sendTransaction({
      transaction,
      account: params.account,
    });

    // Wait for on-chain confirmation
    const provider = getRpcProvider();
    const receipt = await provider.waitForTransaction(transactionHash, 1, 120_000);

    // Parse ERC-721 Transfer event  → tokenId
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const transferLog = receipt?.logs.find((l) => l.topics[0] === transferTopic);

    let tokenId = 0;
    if (transferLog && transferLog.topics.length >= 4) {
      tokenId = Number(BigInt(transferLog.topics[3]));
    }

    return { txHash: transactionHash, tokenId };
  } catch (err: any) {
    throw new Error(userFriendlyTxError(err));
  }
}

/* ─── Transfer ─────────────────────────────────────────── */

export interface TransferResult {
  txHash: string;
}

/**
 * Transfer an NFT ticket to another wallet on-chain (ERC-721 transferFrom).
 */
export async function transferTicketOnChain(params: {
  contractAddress: string;
  tokenId: number;
  fromAddress: string;
  toAddress: string;
  account: any; // thirdweb Account
}): Promise<TransferResult> {
  try {
    const contract = getTicketContract(params.contractAddress);

    const transaction = prepareContractCall({
      contract,
      method:
        'function transferFrom(address from, address to, uint256 tokenId)',
      params: [
        params.fromAddress,
        params.toAddress,
        BigInt(params.tokenId),
      ],
    });

    const { transactionHash } = await sendTransaction({
      transaction,
      account: params.account,
    });

    // Wait for confirmation
    const provider = getRpcProvider();
    await provider.waitForTransaction(transactionHash, 1, 120_000);

    return { txHash: transactionHash };
  } catch (err: any) {
    throw new Error(userFriendlyTxError(err));
  }
}
