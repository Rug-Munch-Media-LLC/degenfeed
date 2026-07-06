"use client";

import { useCallback, useState } from 'react';
import { useWeb3 } from '../components/Web3Provider';
import { requestWalletNonce, buildSiweMessage, verifyWalletSignature } from '@degenfeed/auth';
import type { WalletSession } from '@degenfeed/auth';

export function useWalletSignIn() {
  const { account, isConnected, connect, signMessage } = useWeb3();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithEthereum = useCallback(async (): Promise<WalletSession | null> => {
    if (!account) {
      try {
        await connect();
      } catch (err: any) {
        setError(err?.message || 'Wallet connection failed');
        return null;
      }
    }

    setSigningIn(true);
    setError(null);

    try {
      const nonce = await requestWalletNonce(account!.toLowerCase());
      const message = buildSiweMessage(account!.toLowerCase(), nonce);
      const signature = await signMessage(message);

      const session = await verifyWalletSignature(
        account!.toLowerCase(),
        signature,
        message,
        'ethereum',
        nonce,
      );

      return session;
    } catch (err: any) {
      setError(err?.message || 'Ethereum sign-in failed');
      return null;
    } finally {
      setSigningIn(false);
    }
  }, [account, isConnected, connect, signMessage]);

  return {
    address: account,
    isConnected,
    signingIn,
    error,
    signInWithEthereum,
  };
}
