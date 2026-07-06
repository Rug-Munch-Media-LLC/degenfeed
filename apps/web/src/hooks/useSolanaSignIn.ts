'use client';

import { buildSolanaMessage, verifyWalletSignature } from '@degenfeed/auth';
import { saveWalletIdentity } from '@degenfeed/storage';
import { useCallback, useState } from 'react';

interface SolanaWallet {
  publicKey?: { toBase58: () => string };
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  isConnected?: boolean;
}

interface SolanaWindow {
  solana?: SolanaWallet;
  solflare?: SolanaWallet;
}

function getSolanaWallet(): SolanaWallet | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SolanaWindow;
  return w.solana || w.solflare || null;
}

export function useSolanaSignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithSolana = useCallback(async () => {
    const wallet = getSolanaWallet();
    if (!wallet) throw new Error('No Solana wallet detected. Install Phantom or Solflare.');

    setSigningIn(true);
    setError(null);

    try {
      let address = wallet.publicKey?.toBase58();
      if (!address || !wallet.isConnected) {
        const res = await wallet.connect();
        address = res.publicKey.toBase58();
      }
      if (!address) throw new Error('Could not get Solana address');

      const nonce = await requestWalletNonce(address);
      const message = buildSolanaMessage(address, nonce);
      const messageBytes = new TextEncoder().encode(message);
      const signed = await wallet.signMessage(messageBytes);
      const signature = Array.from(signed.signature)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const session = await verifyWalletSignature(address, signature, message, 'solana', nonce);
      await saveWalletIdentity(session.address, session.chain);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Solana sign-in failed';
      setError(message);
      throw new Error(message);
    } finally {
      setSigningIn(false);
    }
  }, []);

  return {
    available: typeof window !== 'undefined' && !!getSolanaWallet(),
    signingIn,
    error,
    signInWithSolana,
  };
}

async function requestWalletNonce(address: string): Promise<string> {
  const res = await fetch(`/api/auth/wallet/nonce?address=${encodeURIComponent(address)}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Nonce request failed' }));
    throw new Error(err.error || 'Nonce request failed');
  }
  const data = await res.json();
  return data.nonce;
}
