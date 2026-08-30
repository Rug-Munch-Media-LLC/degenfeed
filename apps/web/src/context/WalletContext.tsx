'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import {
  addStoredWallet,
  clearStoredWallets,
  getActiveWalletIndex,
  getStoredWallets,
  removeStoredWallet,
  type StoredWalletMeta,
  setActiveWalletIndex,
} from '../lib/walletStorage';

/** Scoped wallet state + actions (multi-wallet connect/switch/remove). */
export interface WalletContextValue {
  /** All connected wallet addresses */
  walletAddresses: string[];
  /** Index of the currently active wallet */
  activeWalletIndex: number;
  /** Active wallet address (backward-compat: first wallet in the list) */
  walletAddress?: string;
  /** Metadata for each connected wallet */
  walletMeta: Record<string, StoredWalletMeta>;
  /** Number of connected wallets */
  walletCount: number;
  /** Reload wallet list from localStorage into state */
  loadWallets: () => void;
  /** Persist a wallet, append it to state, and make it active (used by sign-in flows) */
  attachWallet: (meta: StoredWalletMeta) => void;
  /** Switch to a different connected wallet by index */
  switchWallet: (index: number) => void;
  /** Connect a new wallet without disconnecting the current one */
  addWallet: () => Promise<void>;
  /** Remove a wallet from the connected list */
  removeWallet: (index: number) => void;
  /** Wipe stored wallets and reset state (sign-out) */
  clearWallets: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/** Read wallet state/actions. Must be used within a WalletProvider. */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
  const [activeWalletIndex, setActiveWalletIndexState] = useState<number>(0);
  const [walletMeta, setWalletMeta] = useState<Record<string, StoredWalletMeta>>({});
  const { showToast } = useToast();

  /** Load wallet list from localStorage and merge with any stored identities */
  const loadWallets = useCallback(() => {
    const stored = getStoredWallets();
    const addresses = stored.map((m) => m.address);
    const meta: Record<string, StoredWalletMeta> = {};
    for (const m of stored) meta[m.address] = m;
    setWalletMeta(meta);
    setWalletAddresses(addresses);
    const idx = getActiveWalletIndex();
    setActiveWalletIndexState(idx < addresses.length ? idx : 0);
  }, []);

  /** Persist a wallet, add it to state, and make it active (sign-in flows). */
  const attachWallet = useCallback((meta: StoredWalletMeta) => {
    const updated = addStoredWallet(meta);
    setWalletMeta((prev) => ({ ...prev, [meta.address]: meta }));
    setWalletAddresses(updated.map((w) => w.address));
    setActiveWalletIndexState(updated.length - 1);
    setActiveWalletIndex(updated.length - 1);
  }, []);

  const switchWallet = useCallback((index: number) => {
    const stored = getStoredWallets();
    if (index < 0 || index >= stored.length) return;
    setActiveWalletIndexState(index);
    setActiveWalletIndex(index);
  }, []);

  const addWallet = useCallback(async () => {
    // Connect a NEW wallet via the Web3 provider (without disconnecting current).
    // We call connect() which prompts the browser wallet to switch accounts.
    try {
      interface Eip1193Provider {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        on?: (event: string, handler: (...args: unknown[]) => void) => void;
        removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      }
      const provider: Eip1193Provider | null =
        typeof window !== 'undefined'
          ? ((window as unknown as { ethereum?: Eip1193Provider }).ethereum ?? null)
          : null;
      if (!provider) {
        showToast('error', 'No Ethereum wallet detected');
        return;
      }
      // Request accounts — the wallet may prompt the user to select an account.
      // If they select a new/different account, it gets added to our list.
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const newAddress = accounts[0]?.toLowerCase();
      if (!newAddress) {
        showToast('error', 'No account selected');
        return;
      }

      const stored = getStoredWallets();
      if (stored.some((w) => w.address === newAddress)) {
        // Already connected — just switch to it
        const existingIdx = stored.findIndex((w) => w.address === newAddress);
        switchWallet(existingIdx);
        showToast('success', 'Switched to wallet');
        return;
      }

      const meta: StoredWalletMeta = {
        address: newAddress,
        chain: 'ethereum',
        walletName: null,
        chainId: null,
        addedAt: Date.now(),
      };
      attachWallet(meta);
      showToast('success', 'Wallet added');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add wallet';
      showToast('error', message);
    }
  }, [switchWallet, showToast, attachWallet]);

  const removeWallet = useCallback(
    (index: number) => {
      const stored = getStoredWallets();
      if (index < 0 || index >= stored.length) return;
      const removed = stored[index];
      if (!removed) return;
      const updated = removeStoredWallet(removed.address);
      setWalletMeta((prev) => {
        const next = { ...prev };
        delete next[removed.address];
        return next;
      });
      setWalletAddresses(updated.map((w) => w.address));

      // Adjust active wallet index
      if (updated.length === 0) {
        setActiveWalletIndexState(0);
        setActiveWalletIndex(0);
      } else if (index >= updated.length) {
        setActiveWalletIndexState(updated.length - 1);
        setActiveWalletIndex(updated.length - 1);
      } else if (index === activeWalletIndex) {
        // Active wallet was removed — keep index at same position (it shifted)
        // No change needed
      } else if (index < activeWalletIndex) {
        setActiveWalletIndexState(activeWalletIndex - 1);
        setActiveWalletIndex(activeWalletIndex - 1);
      }
    },
    [activeWalletIndex],
  );

  const clearWallets = useCallback(() => {
    clearStoredWallets();
    setWalletAddresses([]);
    setActiveWalletIndexState(0);
    setWalletMeta({});
  }, []);

  const walletAddress = walletAddresses[activeWalletIndex] ?? undefined;
  const walletCount = walletAddresses.length;

  const value = useMemo(
    () => ({
      walletAddresses,
      activeWalletIndex,
      walletMeta,
      walletAddress,
      walletCount,
      loadWallets,
      attachWallet,
      switchWallet,
      addWallet,
      removeWallet,
      clearWallets,
    }),
    [
      walletAddresses,
      activeWalletIndex,
      walletMeta,
      walletAddress,
      walletCount,
      loadWallets,
      attachWallet,
      switchWallet,
      addWallet,
      removeWallet,
      clearWallets,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
