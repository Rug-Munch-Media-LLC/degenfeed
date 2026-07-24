'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTip } from '../hooks/useTip';
import { useWeb3 } from './Web3Provider';

interface QuickTipButtonProps {
  recipientProtocol: string;
  recipientAuthorId: string;
  recipientDisplayName: string;
  publicationId?: string;
  /** Callback when tip is sent */
  onTipSent?: () => void;
  /** Show subtle variant (icon only) */
  subtle?: boolean;
}

// === Fiat-to-crypto quick amounts =========================================

interface QuickAmount {
  fiat: string;
  label: string;
  value: string;
  symbol: string;
  approx?: string;
}

const QUICK_AMOUNTS: QuickAmount[] = [
  { fiat: '$1', label: '$1', value: '0.0003', symbol: 'ETH', approx: '≈ $1' },
  { fiat: '$5', label: '$5', value: '0.0015', symbol: 'ETH', approx: '≈ $5' },
  { fiat: '$10', label: '$10', value: '0.003', symbol: 'ETH', approx: '≈ $10' },
  { fiat: '$25', label: '$25', value: '0.008', symbol: 'ETH', approx: '≈ $25' },
  { fiat: '⚡', label: '⚡', value: '50000', symbol: 'sats', approx: '≈ $30' },
];

const CURRENCIES = [
  { symbol: 'ETH', icon: '⟠' },
  { symbol: 'SOL', icon: '◎' },
  { symbol: 'USDC', icon: '●' },
  { symbol: '⚡', icon: '⚡' },
];

/**
 * One-click tip button with multi-currency quick-amount presets.
 * Shows fiat equivalents ($1, $5, $10, $25) and supports ETH/SOL/USDC/Lightning.
 * Opens the wallet connection if not connected, then sends the tip.
 */
export function QuickTipButton({
  recipientProtocol,
  recipientAuthorId,
  recipientDisplayName,
  publicationId,
  onTipSent,
  subtle = false,
}: QuickTipButtonProps) {
  const { createTip } = useTip();
  const { account, connect: connectWallet } = useWeb3();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('ETH');
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset sent state after 3 seconds
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 3000);
    return () => clearTimeout(t);
  }, [sent]);

  // Confetti cleanup
  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), 1500);
  }, []);

  const handleQuickTip = useCallback(
    async (amount: string, currency: string) => {
      if (!account) {
        await connectWallet();
        return;
      }
      if (sending) return;
      setSending(true);
      try {
        await createTip(recipientAuthorId, recipientProtocol, currency, amount, publicationId);
        setSent(true);
        triggerConfetti();
        onTipSent?.();
      } catch {
        // Error handled by useTip state
      } finally {
        setSending(false);
      }
    },
    [
      account,
      connectWallet,
      createTip,
      recipientProtocol,
      recipientAuthorId,
      publicationId,
      sending,
      onTipSent,
      triggerConfetti,
    ],
  );

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-degen-400 animate-slide-up">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Sent!
      </span>
    );
  }

  if (subtle) {
    return (
      <div className="inline-flex items-center gap-0.5">
        {/* Currency selector */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: handled by button */}
        <div
          className="relative"
          onClick={(e) => {
            e.stopPropagation();
            const el = e.currentTarget;
            const next = el.querySelector('select') as HTMLSelectElement | null;
            if (next) {
              next.style.display = next.style.display === 'none' ? 'block' : 'none';
            }
          }}
        >
          <button
            type="button"
            onClick={() => handleQuickTip('0.001', selectedCurrency)}
            disabled={sending}
            className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-degen-500/10 hover:text-degen-400 disabled:opacity-40"
            aria-label={`Quick tip ${recipientDisplayName} 0.001 ${selectedCurrency}`}
            title={`Quick tip 0.001 ${selectedCurrency} (≈ $1)`}
          >
            {sending ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
            ) : (
              <span className="relative text-sm">
                ⚡
                {showConfetti && (
                  <span className="absolute -inset-2 animate-tip-pulse rounded-full bg-degen-500/20" />
                )}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1.5">
      {/* Currency selector row */}
      <div className="flex items-center gap-1">
        {CURRENCIES.map((cur) => (
          <button
            key={cur.symbol}
            type="button"
            onClick={() => setSelectedCurrency(cur.symbol)}
            className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${
              selectedCurrency === cur.symbol
                ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-[var(--color-fg)]'
            }`}
            aria-label={`Select ${cur.symbol}`}
          >
            {cur.icon} {cur.symbol}
          </button>
        ))}
      </div>

      {/* Quick amount buttons */}
      <div className="inline-flex items-center gap-1">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt.fiat}
            type="button"
            onClick={() => handleQuickTip(amt.value, selectedCurrency)}
            disabled={sending}
            className="group relative rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)]/50 px-2.5 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:bg-degen-500/10 hover:text-degen-400 disabled:opacity-40"
            aria-label={`Tip ${amt.fiat} (${amt.value} ${amt.symbol})`}
          >
            <span className="font-semibold">{amt.fiat}</span>
            {amt.approx && <span className="ml-1 opacity-60">/ {amt.value}</span>}
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[9px] text-[var(--color-muted)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {amt.fiat} ({amt.value} {amt.symbol})
            </span>
          </button>
        ))}
        {sending && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        )}
      </div>

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-lg"
              style={{
                animation: `confetti-fall ${0.8 + Math.random() * 0.5}s ease-out forwards`,
                animationDelay: `${i * 0.04}s`,
                left: `${30 + Math.random() * 40}%`,
                top: '40%',
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
              aria-hidden="true"
            >
              {['✨', '⚡', '💎', '🔥', '⭐', '💚'][i % 6]}
            </span>
          ))}
        </div>
      )}

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) scale(0.3) rotate(0deg); opacity: 1; }
          40% { transform: translateY(-30px) scale(1.2) rotate(180deg); opacity: 1; }
          100% { transform: translateY(60px) scale(0.5) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
