/**
 * @degenfeed/auth — Web3 Wallet Authentication
 *
 * Sign in with Ethereum (SIWE) or Solana wallet.
 * Uses the Worker's /api/auth/wallet/* endpoints for nonce exchange and verification.
 */

import type { StoredIdentity } from '@degenfeed/storage';

export interface WalletSession {
  address: string;
  chain: 'ethereum' | 'solana';
  accessToken: string;
  profile?: Record<string, any> | null;
}

/**
 * Request a nonce from the server for wallet authentication.
 */
export async function requestWalletNonce(address: string): Promise<string> {
  const res = await fetch(`/api/auth/wallet/nonce?address=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Nonce request failed' }));
    throw new Error(err.error || 'Nonce request failed');
  }
  const data = await res.json();
  return data.nonce;
}

/**
 * Build the SIWE message for Ethereum wallets.
 */
export function buildSiweMessage(address: string, nonce: string): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'degenfeed.xyz';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://degenfeed.xyz';
  const now = new Date().toISOString();
  const exp = new Date(Date.now() + 300_000).toISOString();

  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to DegenFeed\n\nURI: ${origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${now}\nExpiration Time: ${exp}`;
}

/**
 * Build the Solana sign-in message.
 */
export function buildSolanaMessage(address: string, nonce: string): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'degenfeed.xyz';
  const now = new Date().toISOString();
  return `${domain} wants you to sign in with your Solana account:\n${address}\n\nSign in to DegenFeed\n\nNonce: ${nonce}\nIssued At: ${now}`;
}

/**
 * Verify the wallet signature with the server and get a session.
 */
export async function verifyWalletSignature(
  address: string,
  signature: string,
  message: string,
  chain: 'ethereum' | 'solana',
  nonce: string,
): Promise<WalletSession> {
  const res = await fetch('/api/auth/wallet/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, signature, message, chain, nonce }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(err.error || 'Verification failed');
  }

  return res.json();
}
