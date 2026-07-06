"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

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
  connect: async () => { throw new Error('Web3 not available'); },
  disconnect: () => {},
  signMessage: async () => { throw new Error('Web3 not available'); },
  isMetaMask: false,
};

const Web3Context = createContext<Web3ContextValue>(DEFAULT_CONTEXT);

export function useWeb3(): Web3ContextValue {
  return useContext(Web3Context);
}

function getProvider() {
  if (typeof window === 'undefined' || !(window as any).ethereum) return null;
  return (window as any).ethereum;
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const isConnected = !!account;

  useEffect(() => {
    setMounted(true);
    const check = async () => {
      const provider = getProvider();
      if (!provider) return;
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (accounts?.[0]) {
          setAccount(accounts[0]);
          const id = await provider.request({ method: 'eth_chainId' });
          setChainId(parseInt(id, 16));
        }
      } catch { /* ignore */ }
    };
    check();

    const handleAccountsChanged = (accounts: string[]) => {
      setAccount(accounts[0] || null);
    };
    const handleChainChanged = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16));
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
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const selected = accounts?.[0] || provider.selectedAddress;
      if (selected) setAccount(selected);
      const id = await provider.request({ method: 'eth_chainId' });
      setChainId(parseInt(id, 16));
      return selected || '';
    } catch (err: any) {
      throw new Error(err.message || 'User rejected connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const provider = getProvider();
    if (!provider || !account) throw new Error('No wallet connected');
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, account],
    });
    return signature;
  }, [account]);

  const value: Web3ContextValue = {
    account,
    chainId,
    isConnected,
    connect,
    disconnect,
    signMessage,
    isMetaMask: typeof window !== 'undefined' && !!(window as any)?.ethereum?.isMetaMask,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}
