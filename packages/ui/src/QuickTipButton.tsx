'use client';

import { CURRENCY_META } from '@degenfeed/utils';
import { useState } from 'react';

/**
 * Map of connected protocol → default currency key.
 * Used when `connectedProtocol` is provided as a prop.
 */
const PROTOCOL_CURRENCY: Record<string, string> = {
  farcaster: 'base',
  lens: 'matic',
  solana: 'sol',
  ethereum: 'eth',
  nostr: 'btc',
  bluesky: 'eth',
  mastodon: 'eth',
  threads: 'eth',
};

interface QuickTipButtonProps {
  postId: string;
  authorAddress?: string; // ETH or SOL address
  tipAmounts?: number[]; // predefined amounts in USD
  tipCount?: number;
  onOpenModal?: () => void; // opens the full TipModal with all methods
  defaultCurrency?: 'eth' | 'sol' | 'usdc' | 'base' | 'matic' | 'btc';
  connectedProtocol?: string; // e.g. 'farcaster', 'lens', 'nostr', 'solana', 'ethereum'
}

export function QuickTipButton({
  postId,
  authorAddress,
  tipAmounts = [1, 5, 10],
  tipCount = 0,
  onOpenModal,
  defaultCurrency: defaultCurrencyProp,
  connectedProtocol,
}: QuickTipButtonProps) {
  // Derive the effective currency: prop > protocol mapping > eth
  const effectiveCurrency =
    defaultCurrencyProp ??
    (connectedProtocol ? PROTOCOL_CURRENCY[connectedProtocol] : undefined) ??
    'eth';

  const currencyMeta = (CURRENCY_META[effectiveCurrency] ?? CURRENCY_META.eth)!;

  const [showAmounts, setShowAmounts] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipped, setTipped] = useState(false);

  const handleTip = async (amount: number) => {
    setTipping(true);
    setShowAmounts(false);
    try {
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, amount, currency: 'usd', method: effectiveCurrency }),
      });
      if (res.ok) {
        setTipped(true);
        setTimeout(() => setTipped(false), 2000);
      }
    } catch {
      // fail silently
    } finally {
      setTipping(false);
    }
  };

  const handleOpenModal = () => {
    setShowAmounts(false);
    onOpenModal?.();
  };

  const showTipCount = tipCount > 0 && !tipped;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setShowAmounts((v) => !v)}
        disabled={tipping}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-colors ${
          tipped
            ? 'bg-green-500/20 text-green-400'
            : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'
        }`}
        aria-label={`Tip ${authorAddress || 'author'}`}
      >
        {tipping ? (
          <span className="animate-spin">⚡</span>
        ) : tipped ? (
          <>
            <span>✓</span>
            <span className="text-green-400">Tipped</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>Tip</span>
          </>
        )}
        {showTipCount && <span className="text-xs">{tipCount}</span>}
      </button>

      {showAmounts && (
        <div className="absolute bottom-full left-0 mb-1 flex flex-col gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lg z-50 min-w-[120px]">
          {/* Currency label */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 border-b border-[var(--color-border)] mb-1">
            <span
              className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full"
              style={{ backgroundColor: `${currencyMeta.color}20`, color: currencyMeta.color }}
            >
              {currencyMeta.icon}
            </span>
            <span>
              {currencyMeta.label} ({currencyMeta.symbol})
            </span>
          </div>

          <div className="flex gap-1">
            {tipAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleTip(amount)}
                className="rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-primary/10 hover:text-primary text-muted-foreground"
              >
                ${amount}
              </button>
            ))}
          </div>

          {onOpenModal && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="flex items-center gap-1 rounded-md px-3 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors border-t border-[var(--color-border)] mt-0.5 pt-1"
            >
              <span>⚡</span>
              <span>More methods</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
