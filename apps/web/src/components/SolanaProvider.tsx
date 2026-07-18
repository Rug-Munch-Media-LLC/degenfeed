'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface SolanaWalletProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  connect: () => Promise<{ publicKey?: { toString(): string } }>;
  disconnect: () => void;
  publicKey?: { toString(): string };
  signTransaction: (tx: unknown) => Promise<{ serialize(): Uint8Array }>;
}

declare global {
  interface Window {
    phantom?: { solana?: SolanaWalletProvider };
    solflare?: SolanaWalletProvider;
    backpack?: { solana?: SolanaWalletProvider };
    solana?: SolanaWalletProvider;
  }
}

interface SolanaContextValue {
  account: string | null;
  isConnected: boolean;
  connect: () => Promise<string>;
  disconnect: () => void;
  signAndSendTransaction: (to: string, amount: number) => Promise<{ signature: string }>;
  providerName: string;
}

const DEFAULT_SOLANA: SolanaContextValue = {
  account: null,
  isConnected: false,
  connect: async () => {
    throw new Error('No Solana wallet');
  },
  disconnect: () => {},
  signAndSendTransaction: async () => {
    throw new Error('No Solana wallet');
  },
  providerName: '',
};

const SolanaContext = createContext<SolanaContextValue>(DEFAULT_SOLANA);

export function useSolana(): SolanaContextValue {
  return useContext(SolanaContext);
}

function getSolanaProvider(): { provider: SolanaWalletProvider; name: string } | null {
  if (typeof window === 'undefined') return null;
  // Phantom
  const phantom = window.phantom?.solana;
  if (phantom?.isPhantom) return { provider: phantom as SolanaWalletProvider, name: 'Phantom' };
  // Solflare
  const solflare = window.solflare;
  if (solflare?.isSolflare) return { provider: solflare as SolanaWalletProvider, name: 'Solflare' };
  // Backpack
  const backpack = window.backpack?.solana;
  if (backpack?.isBackpack) return { provider: backpack as SolanaWalletProvider, name: 'Backpack' };
  // Fallback: window.solana
  const fallback = window.solana;
  if (fallback)
    return {
      provider: fallback as SolanaWalletProvider,
      name: fallback.isPhantom ? 'Phantom' : 'Solana Wallet',
    };
  return null;
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [providerName, setProviderName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getProvider = useCallback(() => {
    const p = getSolanaProvider();
    if (p) setProviderName(p.name);
    return p?.provider || null;
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider)
      throw new Error('No Solana wallet detected. Install Phantom, Solflare, or Backpack.');
    try {
      const resp = await provider.connect();
      const pubKey = resp.publicKey?.toString() || provider.publicKey?.toString() || '';
      if (pubKey) setAccount(pubKey);
      return pubKey;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'User rejected Solana connection');
    }
  }, [getProvider]);

  const disconnect = useCallback(() => {
    const provider = getProvider();
    provider?.disconnect();
    setAccount(null);
  }, [getProvider]);

  const signAndSendTransaction = useCallback(
    async (_to: string, _amount: number): Promise<{ signature: string }> => {
      // NOTE: @solana/web3.js was removed to save 200KB bundle weight.
      // Re-add via `pnpm add @solana/web3.js` if Solana tx sending is needed.
      throw new Error(
        'Solana transaction sending is not available in this build. ' +
          'Contact the team if you need this feature.',
      );
    },
    [],
  );

  const value: SolanaContextValue = {
    account,
    isConnected: !!account,
    connect,
    disconnect,
    signAndSendTransaction,
    providerName,
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return <SolanaContext.Provider value={value}>{children}</SolanaContext.Provider>;
}
