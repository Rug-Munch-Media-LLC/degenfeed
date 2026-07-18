'use client';

import type { ProtocolId } from '@degenfeed/utils';
import { PROTOCOL_ID_REGISTRY } from '@degenfeed/utils';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { getLinkedProtocols, useCrossProtocolIdentity } from '../hooks/useCrossProtocolIdentity';
import { useAuth } from './AuthProvider';

// ─── Chain badge ──────────────────────────────────────────────

function ChainBadge({ chain }: { chain: string }) {
  const isEth = chain === 'ethereum';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isEth ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
      }`}
    >
      {isEth ? (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2L3 13.5l9 3 9-3L12 2zm0 15.5l-9-3 9 8 9-8-9 3z" />
        </svg>
      ) : (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
      {chain === 'ethereum' ? 'ETH' : 'SOL'}
    </span>
  );
}

// ─── Truncate helper ──────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Protocol badge ───────────────────────────────────────────

function ProtocolBadge({ protocol }: { protocol: string }) {
  const meta = PROTOCOL_ID_REGISTRY[protocol as ProtocolId];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium"
      style={{
        backgroundColor: `${meta.color}18`,
        color: meta.color,
      }}
    >
      {meta.icon} {meta.displayName}
    </span>
  );
}

// ─── Wallet entry ─────────────────────────────────────────────

function WalletEntry({
  address,
  meta,
  isActive,
  index,
  onSwitch,
  onRemove,
}: {
  address: string;
  meta: { chain: string; walletName: string | null };
  isActive: boolean;
  index: number;
  onSwitch: (idx: number) => void;
  onRemove: (idx: number) => void;
}) {
  const { identity } = useCrossProtocolIdentity(address, true);
  const linkedProtocols = identity ? getLinkedProtocols(identity) : [];

  return (
    <button
      type="button"
      onClick={() => onSwitch(index)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        isActive ? 'bg-degen-500/10 ring-1 ring-degen-500/30' : 'hover:bg-white/[0.04]'
      }`}
      aria-current={isActive ? 'true' : undefined}
    >
      {/* Wallet avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-mono font-bold ${
          isActive ? 'bg-degen-500/20 text-degen-400' : 'bg-white/5 text-gray-400'
        }`}
      >
        {address.slice(2, 4).toUpperCase()}
      </div>

      {/* Wallet details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${
              isActive ? 'text-[var(--color-fg)]' : 'text-gray-300'
            }`}
          >
            {meta.walletName ?? truncateAddress(address)}
          </span>
          {isActive && (
            <span className="shrink-0 rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-degen-400">
              Active
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <code className="text-xs font-mono text-gray-500 truncate">
            {truncateAddress(address)}
          </code>
          <ChainBadge chain={meta.chain} />
          {linkedProtocols.length > 0 && (
            <span className="text-[10px] text-gray-600">{linkedProtocols.length} linked</span>
          )}
        </div>
        {linkedProtocols.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {linkedProtocols.slice(0, 3).map((lp) => (
              <ProtocolBadge key={lp.protocol} protocol={lp.protocol} />
            ))}
            {linkedProtocols.length > 3 && (
              <span className="text-[9px] text-gray-600">+{linkedProtocols.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Remove button (not for active wallet) */}
      {!isActive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="shrink-0 rounded-full p-1 text-gray-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          aria-label={`Remove wallet ${truncateAddress(address)}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </button>
  );
}

// ─── WalletSwitcher component ─────────────────────────────────

export const WalletSwitcher = memo(function WalletSwitcher({
  align = 'left',
}: {
  /** Dropdown alignment — 'left' or 'right' */
  align?: 'left' | 'right';
}) {
  const {
    walletAddress,
    walletAddresses,
    activeWalletIndex,
    walletCount,
    walletMeta,
    switchWallet,
    addWallet,
    removeWallet,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const activeMeta = walletAddress ? walletMeta[walletAddress] : undefined;
  const chain = activeMeta?.chain ?? 'ethereum';

  const handleSwitch = useCallback(
    (idx: number) => {
      switchWallet(idx);
      setOpen(false);
    },
    [switchWallet],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      removeWallet(idx);
    },
    [removeWallet],
  );

  const handleAdd = useCallback(() => {
    addWallet();
    setOpen(false);
  }, [addWallet]);

  if (!walletAddress || walletAddresses.length === 0) return null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Wallets: ${truncateAddress(walletAddress)} (${walletCount} connected)`}
      >
        <ChainBadge chain={chain} />
        <code className="flex-1 text-xs font-mono text-gray-400 truncate">
          {truncateAddress(walletAddress)}
        </code>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform text-gray-500 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className={`absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'left-auto right-0' : ''
          }`}
          role="listbox"
          aria-label="Connected wallets"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold text-[var(--color-fg)]">Wallets</span>
            <span className="text-[10px] text-gray-500">{walletCount} connected</span>
          </div>

          {/* Wallet list */}
          <div className="space-y-0.5">
            {walletAddresses.map((addr, idx) => {
              const meta = walletMeta[addr] ?? {
                address: addr,
                chain: 'ethereum' as const,
                walletName: null,
                chainId: null,
                addedAt: 0,
              };
              return (
                <div key={addr} className="group">
                  <WalletEntry
                    address={addr}
                    meta={meta}
                    isActive={idx === activeWalletIndex}
                    index={idx}
                    onSwitch={handleSwitch}
                    onRemove={handleRemove}
                  />
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[var(--color-glass-border)]" />

          {/* Add wallet button */}
          <button
            type="button"
            onClick={handleAdd}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-degen-400 transition-colors hover:bg-degen-500/10"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-xs font-medium">Add wallet</span>
          </button>
        </div>
      )}
    </div>
  );
});
