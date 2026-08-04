'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  createSolanaConnection,
  transferSol,
  transferSPLToken,
} from '../lib/solana-spl';

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

export interface SolanaTransferOptions {
  /** SPL token mint address. When omitted, sends native SOL. */
  mint?: string;
}

interface SolanaContextValue {
  account: string | null;
  isConnected: boolean;
  connect: () => Promise<string>;
  disconnect: () => void;
  signAndSendTransaction: (
    to: string,
    amount: number,
    opts?: SolanaTransferOptions,
  ) => Promise<{ signature: string }>;
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

/** Coerce a provider public key into a plain string address. */
function publicKeyToString(pubKey: { toString(): string } | undefined): string {
  return pubKey ? pubKey.toString() : '';
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
      const pubKey = publicKeyToString(resp.publicKey) || publicKeyToString(provider.publicKey);
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
    async (to: string, amount: number, opts?: SolanaTransferOptions): Promise<{ signature: string }> => {
      const provider = getProvider();
      if (!provider)
        throw new Error('No Solana wallet detected. Install Phantom, Solflare, or Backpack.');

      // Ensure we have an account (connect on demand).
      let from = account;
      if (!from) from = await connect();
      if (!from) throw new Error('Could not determine Solana wallet address');

      const wallet = {
        publicKey: { toString: () => from },
        signTransaction: provider.signTransaction,
      };
      const connection = createSolanaConnection();

      // SPL token transfer (USDC / USDT / BONK / any mint).
      if (opts?.mint) {
        return transferSPLToken(connection, wallet, to, opts.mint, amount);
      }

      // Native SOL transfer.
      return transferSol(connection, wallet, to, amount);
    },
    [account, connect, getProvider],
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
