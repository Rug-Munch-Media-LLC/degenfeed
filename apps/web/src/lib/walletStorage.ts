/**
 * walletStorage — Persistence for connected wallet metadata.
 *
 * Uses localStorage to keep the wallet list small and simple.
 * The wallet list is an ordered array of addresses; the active
 * wallet is tracked by index.
 *
 * Keys:
 *   df_connected_wallets  → StoredWalletMeta[]  (JSON)
 *   df_active_wallet_idx  → number              (0-based)
 */

export interface StoredWalletMeta {
  address: string;
  chain: 'ethereum' | 'solana';
  walletName: string | null;
  chainId: number | null;
  addedAt: number;
}

const WALLETS_KEY = 'df_connected_wallets';
const ACTIVE_IDX_KEY = 'df_active_wallet_idx';

export function getStoredWallets(): StoredWalletMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WALLETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredWalletMeta[];
  } catch {
    return [];
  }
}

export function saveStoredWallets(wallets: StoredWalletMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
  } catch {
    /* storage full — silently ignore */
  }
}

export function addStoredWallet(meta: StoredWalletMeta): StoredWalletMeta[] {
  const wallets = getStoredWallets();
  // Deduplicate by address
  const existing = wallets.findIndex((w) => w.address === meta.address);
  if (existing !== -1) {
    wallets[existing] = meta;
  } else {
    wallets.push(meta);
  }
  saveStoredWallets(wallets);
  return wallets;
}

export function removeStoredWallet(address: string): StoredWalletMeta[] {
  const wallets = getStoredWallets().filter((w) => w.address !== address);
  saveStoredWallets(wallets);
  return wallets;
}

export function getActiveWalletIndex(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(ACTIVE_IDX_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function setActiveWalletIndex(index: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_IDX_KEY, String(index));
}

export function clearStoredWallets(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WALLETS_KEY);
  localStorage.removeItem(ACTIVE_IDX_KEY);
}
