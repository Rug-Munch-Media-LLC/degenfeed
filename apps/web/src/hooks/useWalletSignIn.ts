'use client';

import type { WalletSession } from '@degenfeed/auth';
import { buildSiweMessage, requestWalletNonce, verifyWalletSignature } from '@degenfeed/auth';
import { saveWalletIdentity } from '@degenfeed/storage';
import { useCallback, useState } from 'react';
import { useWeb3 } from '../components/Web3Provider';

export function useWalletSignIn() {
  const { account, isConnected, connect, signMessage } = useWeb3();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithEthereum = useCallback(async (): Promise<WalletSession | null> => {
    let address = account?.toLowerCase();
    if (!address) {
      try {
        address = (await connect()).toLowerCase();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Wallet connection failed');
        return null;
      }
    }

    setSigningIn(true);
    setError(null);

    try {
      const nonce = await requestWalletNonce(address);
      const message = buildSiweMessage(address, nonce);
      const signature = await signMessage(message);

      const session = await verifyWalletSignature(address, signature, message, 'ethereum', nonce);
      await saveWalletIdentity(session.address, session.chain);

      return session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ethereum sign-in failed');
      return null;
    } finally {
      setSigningIn(false);
    }
  }, [account, connect, signMessage]);

  return {
    address: account,
    isConnected,
    signingIn,
    error,
    signInWithEthereum,
  };
}
