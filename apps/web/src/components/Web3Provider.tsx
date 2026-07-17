'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  detectAvailableWallets,
  useWalletConnect,
  type WalletInfo,
} from '../hooks/useWalletConnect';

/**
 * @reown/appkit integration note:
 * This provider works with raw window.ethereum (EIP-1193) by default.
 * When @reown/appkit is added as a project dependency, the connect flow
 * can be upgraded to use its modal for WalletConnect + multi-chain support.
 * See useWalletConnect hook for the integration point.
 */

// --------------- Types ---------------

export type WalletConnector = 'injected' | 'walletconnect' | 'none' | 'solana';

export interface Web3ContextValue {
  /** Connected EVM account address (lowercased) or null */
  account: string | null;
  /** Current chain ID as integer */
  chainId: number | null;
  /** True when an EVM wallet is connected */
  isConnected: boolean;
  /** Connect via window.ethereum (legacy flow, unchanged) */
  connect: () => Promise<string>;
  /** Connect to a specific wallet type (metamask, rabby, walletconnect, etc.) */
  connectWithWallet: (walletType?: string) => Promise<void>;
  /** Disconnect — clears local state */
  disconnect: () => void;
  /** Sign a personal_message with the connected wallet */
  signMessage: (message: string) => Promise<string>;
  /** True if the detected provider is MetaMask */
  isMetaMask: boolean;
  /** Which connector was used */
  connector: WalletConnector;
  /** Human-readable wallet name (e.g. 'MetaMask', 'Rabby', 'Phantom') */
  walletName: string | null;
  /** List of detected browser wallets and their detection status */
  availableWallets: WalletInfo[];
}

// --------------- Default context ---------------

const DEFAULT_CONTEXT: Web3ContextValue = {
  account: null,
  chainId: null,
  isConnected: false,
  connect: async () => {
    throw new Error('Web3 not available');
  },
  connectWithWallet: async () => {
    throw new Error('Web3 not available');
  },
  disconnect: () => {},
  signMessage: async () => {
    throw new Error('Web3 not available');
  },
  isMetaMask: false,
  connector: 'none',
  walletName: null,
  availableWallets: [],
};

// --------------- Context ---------------

const Web3Context = createContext<Web3ContextValue>(DEFAULT_CONTEXT);

export function useWeb3(): Web3ContextValue {
  return useContext(Web3Context);
}

// --------------- Provider ---------------

export function Web3Provider({ children }: { children: ReactNode }) {
  // Use the new hook for wallet detection + event listeners
  const walletConnect = useWalletConnect();

  // Legacy state kept for backward compatibility
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connector, setConnector] = useState<WalletConnector>('none');
  const [walletName, setWalletName] = useState<string | null>(null);

  const isConnected = !!account;

  // ---------- wallet name helper ----------
  const detectWalletNameFromProvider = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const eth = window.ethereum;
    if (eth?.isMetaMask) return 'MetaMask';
    if (eth?.isRabby) return 'Rabby';
    if (eth?.isRainbow) return 'Rainbow';
    if (eth?.isCoinbaseWallet) return 'Coinbase Wallet';
    if (eth) return 'Injected Wallet';
    return null;
  }, []);

  // Sync from useWalletConnect
  useEffect(() => {
    if (walletConnect.isConnected && walletConnect.address) {
      setAccount(walletConnect.address);
      setChainId(walletConnect.chainId);
      setConnector(walletConnect.connector);
      setWalletName(walletConnect.walletName);
    } else if (!walletConnect.isConnected && account) {
      // Only clear if we were connected — avoids race on initial mount
      setAccount(null);
      setChainId(null);
      setConnector('none');
      setWalletName(null);
    }
  }, [
    walletConnect.isConnected,
    walletConnect.address,
    walletConnect.chainId,
    walletConnect.connector,
    walletConnect.walletName,
    account,
  ]);

  // Legacy initial check (for backward compat with direct window.ethereum access)
  useEffect(() => {
    const check = async () => {
      if (walletConnect.isConnected) return; // already handled above
      const provider = typeof window !== 'undefined' ? window.ethereum : null;
      if (!provider) return;
      try {
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
        if (accounts?.[0]) {
          setAccount(accounts[0].toLowerCase());
          const id = await provider.request({ method: 'eth_chainId' });
          setChainId(Number.parseInt(id as string, 16));
          setConnector('injected');
          setWalletName(detectWalletNameFromProvider());
        }
      } catch {
        /* ignore */
      }
    };
    check();
  }, [walletConnect.isConnected, detectWalletNameFromProvider]);

  // Legacy event listeners (backward compat — also handled in useWalletConnect)
  useEffect(() => {
    const provider = typeof window !== 'undefined' ? window.ethereum : null;
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const addrs = Array.isArray(accounts) ? (accounts as string[]) : [];
      setAccount(addrs[0]?.toLowerCase() || null);
      if (!addrs[0]) setConnector('none');
    };
    const handleChainChanged = (chainIdHex: unknown) => {
      setChainId(Number.parseInt(String(chainIdHex), 16));
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // ---------- connect (legacy, wallet-agnostic) ----------
  const connect = useCallback(async () => {
    const provider = typeof window !== 'undefined' ? window.ethereum : null;
    if (!provider) throw new Error('No Ethereum wallet detected');
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const selected = accounts?.[0] || provider.selectedAddress;
      if (selected) {
        setAccount(selected.toLowerCase());
        setConnector('injected');
        setWalletName(detectWalletNameFromProvider());
      }
      const id = await provider.request({ method: 'eth_chainId' });
      setChainId(Number.parseInt(id as string, 16));
      return selected?.toLowerCase() || '';
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'User rejected connection');
    }
  }, [detectWalletNameFromProvider]);

  // ---------- connectWithWallet (wallet-aware) ----------
  const connectWithWallet = useCallback(
    async (walletType?: string) => {
      if (walletType === 'walletconnect') {
        // WalletConnect QR placeholder — wire up @reown/appkit here
        console.info(
          '[Web3Provider] WalletConnect QR — install @reown/appkit and wire AppKit modal.',
        );
        return;
      }
      // For all injected wallets, just call the standard connect
      await connect();
    },
    [connect],
  );

  // ---------- disconnect ----------
  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setConnector('none');
    setWalletName(null);
  }, []);

  // ---------- signMessage ----------
  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      const provider = typeof window !== 'undefined' ? window.ethereum : null;
      if (!provider || !account) throw new Error('No wallet connected');
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, account],
      })) as string;
      return signature;
    },
    [account],
  );

  // ---------- available wallets ----------
  const availableWallets = useMemo(() => {
    return detectAvailableWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Web3ContextValue = useMemo(
    () => ({
      account,
      chainId,
      isConnected,
      connect,
      connectWithWallet,
      disconnect,
      signMessage,
      isMetaMask: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
      connector,
      walletName,
      availableWallets,
    }),
    [
      account,
      chainId,
      isConnected,
      connect,
      connectWithWallet,
      disconnect,
      signMessage,
      connector,
      walletName,
      availableWallets,
    ],
  );

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}
