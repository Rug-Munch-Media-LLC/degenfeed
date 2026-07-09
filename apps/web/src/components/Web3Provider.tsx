'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  selectedAddress?: string;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

interface Web3ContextValue {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  connect: () => Promise<string>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
  isMetaMask: boolean;
}

const DEFAULT_CONTEXT: Web3ContextValue = {
  account: null,
  chainId: null,
  isConnected: false,
  connect: async () => {
    throw new Error('Web3 not available');
  },
  disconnect: () => {},
  signMessage: async () => {
    throw new Error('Web3 not available');
  },
  isMetaMask: false,
};

const Web3Context = createContext<Web3ContextValue>(DEFAULT_CONTEXT);

export function useWeb3(): Web3ContextValue {
  return useContext(Web3Context);
}

function getProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return window.ethereum;
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const isConnected = !!account;

  useEffect(() => {
    const check = async () => {
      const provider = getProvider();
      if (!provider) return;
      try {
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
        if (accounts?.[0]) {
          setAccount(accounts[0]);
          const id = await provider.request({ method: 'eth_chainId' });
          setChainId(Number.parseInt(id as string, 16));
        }
      } catch {
        /* ignore */
      }
    };
    check();

    const handleAccountsChanged = (accounts: unknown) => {
      const addrs = Array.isArray(accounts) ? (accounts as string[]) : [];
      setAccount(addrs[0] || null);
    };
    const handleChainChanged = (chainIdHex: unknown) => {
      setChainId(Number.parseInt(String(chainIdHex), 16));
    };

    const provider = getProvider();
    if (provider) {
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
      return () => {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) throw new Error('No Ethereum wallet detected');
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const selected = accounts?.[0] || provider.selectedAddress;
      if (selected) setAccount(selected);
      const id = await provider.request({ method: 'eth_chainId' });
      setChainId(Number.parseInt(id as string, 16));
      return selected || '';
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'User rejected connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      const provider = getProvider();
      if (!provider || !account) throw new Error('No wallet connected');
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, account],
      })) as string;
      return signature;
    },
    [account],
  );

  const value: Web3ContextValue = {
    account,
    chainId,
    isConnected,
    connect,
    disconnect,
    signMessage,
    isMetaMask: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}
