'use client';

import { requestWalletNonce, verifyWalletSignature } from '@degenfeed/auth';
import { saveWalletIdentity } from '@degenfeed/storage';
import { base58 } from '@scure/base';
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

/**
 * Solana wallet sign-in via Better Auth (custom SIWS plugin).
 *
 * Flow: nonce → the server returns the EXACT message to sign → wallet signs
 * it (Ed25519 detached) → base58 signature verified at
 * /api/auth/better/solana/verify. Better Auth sets the httpOnly session cookie.
 */
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

      // The server returns the authoritative message to sign (binds domain,
      // address, nonce and time bounds — no client-side message drift).
      const { nonce, message } = await requestWalletNonce(address, 'solana');
      if (!message) throw new Error('Solana nonce response missing message');

      const signed = await wallet.signMessage(new TextEncoder().encode(message));
      const signature = base58.encode(signed.signature);

      const session = await verifyWalletSignature({
        address,
        signature,
        chain: 'solana',
        nonce,
      });
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
