'use client';

import { CURRENCY_META } from '@degenfeed/utils';
import { useCallback, useState } from 'react';

/**
 * All 6 tipping methods supported by DegenFeed for Lemmy content.
 * Each method maps to a currency key in CURRENCY_META.
 */
const LEMMY_TIP_METHODS = [
  { key: 'eth', label: 'Ethereum', symbol: 'ETH', icon: '◆', color: '#627eea' },
  { key: 'sol', label: 'Solana', symbol: 'SOL', icon: '◎', color: '#9945ff' },
  { key: 'btc', label: 'Lightning', symbol: 'BTC', icon: '⚡', color: '#f7931a' },
  { key: 'usdc', label: 'USD Coin', symbol: 'USDC', icon: '●', color: '#2775ca' },
  { key: 'base', label: 'Farcaster', symbol: 'ETH', icon: '🔵', color: '#0052FF' },
  { key: 'matic', label: 'Lens', symbol: 'MATIC', icon: '🌿', color: '#8247e5' },
] as const;

export interface LemmyTipButtonProps {
  /** Unique identifier for the post or comment being tipped */
  contentId: string;
  /** Human-readable label: "post" or "comment" */
  contentType: 'post' | 'comment';
  /** Wallet addresses from the author profile */
  authorEvmAddress?: string;
  authorSolanaAddress?: string;
  /** Tip totals to display — "⚡ N tips ($X.XX)" */
  tipCount?: number;
  tipTotalUsd?: number;
  /** Don't show the "More methods" expander — for compact comment buttons */
  compact?: boolean;
  /** Connected protocol for default currency detection */
  connectedProtocol?: string;
}

/**
 * Map of protocol → default LEMMY_TIP_METHODS key.
 * Used for auto-detecting the best tip currency based on the comment author's protocol.
 */
const PROTOCOL_TO_TIP_METHOD: Record<string, string> = {
  farcaster: 'base',
  lens: 'matic',
  nostr: 'btc',
  solana: 'sol',
  ethereum: 'eth',
  bluesky: 'eth',
  mastodon: 'eth',
  threads: 'eth',
  lemmy: 'eth',
};

export function LemmyTipButton({
  contentId,
  contentType,
  authorEvmAddress,
  authorSolanaAddress,
  tipCount = 0,
  tipTotalUsd = 0,
  compact = false,
  connectedProtocol,
}: LemmyTipButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipped, setTipped] = useState(false);

  // Auto-select default method based on the comment author's protocol
  const defaultMethodKey = connectedProtocol
    ? (PROTOCOL_TO_TIP_METHOD[connectedProtocol] ?? 'eth')
    : 'eth';
  const defaultMethod =
    LEMMY_TIP_METHODS.find((m) => m.key === defaultMethodKey) ?? LEMMY_TIP_METHODS[0];
  const [selectedMethod, setSelectedMethod] =
    useState<(typeof LEMMY_TIP_METHODS)[number]>(defaultMethod);

  const handleTip = useCallback(
    async (amount: number) => {
      setTipping(true);
      setShowMenu(false);
      try {
        const res = await fetch('/api/lemmy/tip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            contentId,
            contentType,
            amount: String(amount),
            currency: selectedMethod.key,
            method: selectedMethod.key,
            recipientEvm: authorEvmAddress || undefined,
            recipientSol: authorSolanaAddress || undefined,
          }),
        });
        if (res.ok) {
          setTipped(true);
          setTimeout(() => setTipped(false), 2500);
        }
      } catch {
        // fail silently
      } finally {
        setTipping(false);
      }
    },
    [contentId, contentType, selectedMethod, authorEvmAddress, authorSolanaAddress],
  );

  const showTipMeta = tipCount > 0 && !tipped;

  // Compact mode: inline button for comments
  if (compact) {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }
          }}
          disabled={tipping}
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition-colors ${
            tipped
              ? 'bg-green-500/20 text-green-400'
              : 'text-gray-600 hover:text-green-400 hover:bg-green-500/10'
          }`}
          aria-label={`Tip ${contentType}`}
        >
          {tipping ? (
            <span className="animate-spin text-[10px]">⚡</span>
          ) : tipped ? (
            <>
              <span className="text-[10px]">✓</span>
              <span className="text-green-400">Tipped</span>
            </>
          ) : (
            <>
              <span className="text-[10px]">⚡</span>
              <span className="text-[10px]">Tip</span>
            </>
          )}
          {showTipMeta && <span className="text-[10px] text-[var(--color-muted)]">{tipCount}</span>}
        </button>

        {showMenu && (
          <div
            role="menu"
            className="absolute bottom-full left-0 mb-1 z-50 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowMenu(false);
            }}
          >
            {/* Method selector */}
            <div className="mb-1.5 flex flex-wrap gap-1">
              {LEMMY_TIP_METHODS.map((method) => (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedMethod(method);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
                    selectedMethod.key === method.key
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-muted)] hover:bg-white/5'
                  }`}
                >
                  <span>{method.icon}</span>
                  <span>{method.symbol}</span>
                </button>
              ))}
            </div>
            {/* Amount buttons */}
            <div className="flex gap-1">
              {[1, 5, 10].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleTip(amount)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleTip(amount);
                  }}
                  className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-green-500/15 hover:text-green-400 text-[var(--color-muted)]"
                >
                  ${amount}
                </button>
              ))}
            </div>
            {/* Selected method label */}
            <div className="mt-1 flex items-center gap-1 border-t border-[var(--color-border)] pt-1 text-[9px] text-gray-600">
              <span
                className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px]"
                style={{
                  backgroundColor: `${selectedMethod.color}22`,
                  color: selectedMethod.color,
                }}
              >
                {selectedMethod.icon}
              </span>
              <span>
                {selectedMethod.label} ({selectedMethod.symbol})
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode: for posts (non-compact)
  const currencyMeta = CURRENCY_META[selectedMethod.key] ?? CURRENCY_META.eth;
  // biome-ignore lint/style/noNonNullAssertion: fallback to eth is guaranteed above
  const meta = currencyMeta!;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            setShowMenu((v) => !v);
          }
        }}
        disabled={tipping}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
          tipped
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'border border-green-500/20 text-[var(--color-muted)] hover:text-green-400 hover:bg-green-500/10 hover:border-green-500/40'
        }`}
        aria-label={`Tip this ${contentType}`}
      >
        {tipping ? (
          <span className="animate-spin text-sm">⚡</span>
        ) : tipped ? (
          <>
            <span>✓</span>
            <span className="text-green-400 text-xs">Tipped!</span>
          </>
        ) : (
          <>
            <span className="text-sm">⚡</span>
            <span className="text-xs">Tip</span>
          </>
        )}
        {showTipMeta && (
          <span className="text-[11px] text-green-500/70 font-medium">
            {tipCount} tips
            {tipTotalUsd > 0 && ` ($${tipTotalUsd.toFixed(2)})`}
          </span>
        )}
      </button>

      {showMenu && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 z-50 min-w-[200px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowMenu(false);
          }}
        >
          {/* Currency method tabs */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {LEMMY_TIP_METHODS.map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => setSelectedMethod(method)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedMethod(method);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all ${
                  selectedMethod.key === method.key
                    ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-muted)] hover:bg-white/5'
                }`}
              >
                <span className="text-sm">{method.icon}</span>
                <span className="font-medium">{method.symbol}</span>
              </button>
            ))}
          </div>

          {/* Amount buttons */}
          <div className="flex gap-1.5 mb-2">
            {[1, 5, 10, 25].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleTip(amount)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleTip(amount);
                }}
                className="flex-1 rounded-lg border border-green-500/15 px-3 py-2 text-sm font-semibold transition-all hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/30 text-[var(--color-muted)]"
              >
                ${amount}
              </button>
            ))}
          </div>

          {/* Method info */}
          <div className="flex items-center gap-1.5 border-t border-[var(--color-border)] pt-1.5 text-[10px] text-gray-600">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
              style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
            >
              {meta.icon}
            </span>
            <span>
              {meta.label} ({meta.symbol})
            </span>
            {authorEvmAddress && (
              <span
                className="ml-auto font-mono text-[9px] text-gray-700"
                title="Recipient address"
              >
                {authorEvmAddress.slice(0, 6)}...{authorEvmAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
