'use client';

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// WalletConnect / Reown integration — lightweight EIP-1193 wrapper with
// multi-wallet detection. Can be upgraded to use @reown/appkit when that
// dependency is added to the workspace (see WalletConnect QR placeholder).
// ---------------------------------------------------------------------------

export type WalletConnector = 'injected' | 'walletconnect' | 'none' | 'solana';

export type WalletInfo =
  | { id: 'metamask'; label: 'MetaMask'; icon: string; color: string; detected: boolean }
  | { id: 'rabby'; label: 'Rabby'; icon: string; color: string; detected: boolean }
  | { id: 'rainbow'; label: 'Rainbow'; icon: string; color: string; detected: boolean }
  | { id: 'coinbase'; label: 'Coinbase Wallet'; icon: string; color: string; detected: boolean }
  | { id: 'phantom'; label: 'Phantom'; icon: string; color: string; detected: boolean }
  | { id: 'solflare'; label: 'Solflare'; icon: string; color: string; detected: boolean }
  | { id: 'walletconnect'; label: 'WalletConnect'; icon: string; color: string; detected: boolean };

export type WalletId = WalletInfo['id'];

export interface WalletConnectState {
  /** Connected wallet address (lowercased) or null */
  address: string | null;
  /** Current chain ID as integer or null */
  chainId: number | null;
  /** Whether a wallet is connected */
  isConnected: boolean;
  /** Which connector type was used */
  connector: WalletConnector;
  /** Human-readable wallet name (e.g. 'MetaMask', 'Phantom') */
  walletName: string | null;
}

// ---------------------------------------------------------------------------
// Global type augmentation — compatible with SolanaProvider declarations
// by extending the already-declared Window interface only with additional
// wallet-detection properties, not full provider shapes.
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      selectedAddress?: string;
      isMetaMask?: boolean;
      isRabby?: boolean;
      isRainbow?: boolean;
      isCoinbaseWallet?: boolean;
    };
  }
}

// ---------------------------------------------------------------------------
// Wallet definitions with brand metadata
// ---------------------------------------------------------------------------
const ALL_WALLETS: WalletInfo[] = [
  { id: 'metamask', label: 'MetaMask', icon: '🦊', color: '#f6851b', detected: false },
  { id: 'rabby', label: 'Rabby', icon: '🐰', color: '#7c3aed', detected: false },
  { id: 'rainbow', label: 'Rainbow', icon: '🌈', color: '#00a3ff', detected: false },
  { id: 'coinbase', label: 'Coinbase Wallet', icon: '🔷', color: '#0052ff', detected: false },
  { id: 'phantom', label: 'Phantom', icon: '👻', color: '#ab9ff2', detected: false },
  { id: 'solflare', label: 'Solflare', icon: '🔥', color: '#ff6b35', detected: false },
  { id: 'walletconnect', label: 'WalletConnect', icon: '🔗', color: '#3b99fc', detected: false },
];

/** Detect which browser wallets are available */
export function detectAvailableWallets(): WalletInfo[] {
  const ethereum = typeof window !== 'undefined' ? window.ethereum : null;

  function setDetected(w: WalletInfo, detected: boolean): WalletInfo {
    return { ...w, detected } as WalletInfo;
  }

  return ALL_WALLETS.map((w: WalletInfo) => {
    switch (w.id) {
      case 'metamask':
        return setDetected(w, !!ethereum?.isMetaMask);
      case 'rabby':
        return setDetected(w, !!ethereum?.isRabby);
      case 'rainbow':
        return setDetected(w, !!ethereum?.isRainbow);
      case 'coinbase':
        return setDetected(w, !!ethereum?.isCoinbaseWallet);
      case 'phantom':
        return setDetected(
          w,
          !!(typeof window !== 'undefined' && window.phantom?.solana?.isPhantom),
        );
      case 'solflare':
        return setDetected(w, !!(typeof window !== 'undefined' && window.solflare?.isSolflare));
      case 'walletconnect':
        // WalletConnect is always available as a UI option (QR modal)
        return setDetected(w, true);
      default:
        return setDetected(w, false);
    }
  });
}

/** Derive a human-readable wallet name from the detected environment */
export function detectWalletName(): string | null {
  if (typeof window === 'undefined') return null;
  const eth = window.ethereum;
  if (eth?.isMetaMask) return 'MetaMask';
  if (eth?.isRabby) return 'Rabby';
  if (eth?.isRainbow) return 'Rainbow';
  if (eth?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (eth) return 'Injected Wallet';
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useWalletConnect() {
  const [state, setState] = useState<WalletConnectState>({
    address: null,
    chainId: null,
    isConnected: false,
    connector: 'none',
    walletName: null,
  });

  const [availableWallets, setAvailableWallets] = useState<WalletInfo[]>([]);

  // Detect available wallets on mount
  useEffect(() => {
    setAvailableWallets(detectAvailableWallets());
    setState((prev) => ({ ...prev, walletName: detectWalletName() }));
  }, []);

  // ---------- connect ----------
  const connect = useCallback(async (walletType?: string) => {
    const ethereum = typeof window !== 'undefined' ? window.ethereum : null;

    if (walletType === 'walletconnect') {
      // WalletConnect QR placeholder — integrate @reown/appkit here
      console.info(
        '[useWalletConnect] WalletConnect QR flow not yet wired. Install @reown/appkit and wire the modal here.',
      );
      return;
    }

    if (!ethereum) {
      console.warn('[useWalletConnect] No EIP-1193 provider detected');
      return;
    }

    try {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;

      setState({
        address: accounts[0]?.toLowerCase() ?? null,
        chainId: chainIdHex ? Number.parseInt(chainIdHex, 16) : null,
        isConnected: !!accounts[0],
        connector: 'injected',
        walletName: detectWalletName(),
      });
    } catch (err) {
      console.error('[useWalletConnect] Connection failed:', err);
    }
  }, []);

  // ---------- disconnect ----------
  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      connector: 'none',
      walletName: null,
    });
  }, []);

  // ---------- event listeners ----------
  useEffect(() => {
    const ethereum = typeof window !== 'undefined' ? window.ethereum : null;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const addrs = Array.isArray(accounts) ? (accounts as string[]) : [];
      const next = addrs[0] ?? null;
      setState((prev) => ({
        ...prev,
        address: next?.toLowerCase() ?? null,
        isConnected: !!next,
        walletName: detectWalletName(),
      }));
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      setState((prev) => ({
        ...prev,
        chainId: Number.parseInt(String(chainIdHex), 16),
      }));
    };

    const handleDisconnect = () => {
      disconnect();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    // Some wallets emit a 'disconnect' event
    if (typeof ethereum.on === 'function') {
      try {
        ethereum.on('disconnect', handleDisconnect);
      } catch {
        /* not all providers support it */
      }
    }

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
      try {
        ethereum.removeListener('disconnect', handleDisconnect);
      } catch {
        /* not all providers support it */
      }
    };
  }, [disconnect]);

  return {
    ...state,
    availableWallets,
    connect,
    disconnect,
  };
}
