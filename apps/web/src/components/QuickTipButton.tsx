'use client';

import { useCallback, useEffect, useState } from 'react';
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

const QUICK_AMOUNTS = [
  { label: '0.001', value: '0.001', symbol: 'ETH' },
  { label: '0.003', value: '0.003', symbol: 'ETH' },
  { label: '0.01', value: '0.01', symbol: 'ETH' },
  { label: '⚡', value: 'zap', symbol: 'BTC' },
];

/**
 * One-click tip button with quick-amount presets.
 * Opens the wallet connection if not connected, then sends the tip.
 * Reduces the tip flow from 4 clicks to 2.
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

  // Reset sent state after 3 seconds
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 3000);
    return () => clearTimeout(t);
  }, [sent]);

  const handleQuickTip = useCallback(
    async (amount: string) => {
      if (!account) {
        await connectWallet();
        return;
      }
      if (sending) return;
      setSending(true);
      try {
        await createTip({
          protocol: recipientProtocol,
          authorId: recipientAuthorId,
          displayName: recipientDisplayName,
          publicationId,
          amount,
          currency: 'ETH',
        });
        setSent(true);
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
      recipientDisplayName,
      publicationId,
      sending,
      onTipSent,
    ],
  );

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-degen-400">
        ✓ Sent!
      </span>
    );
  }

  if (subtle) {
    return (
      <button
        type="button"
        onClick={() => handleQuickTip('0.001')}
        disabled={sending}
        className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-degen-500/10 hover:text-degen-400"
        aria-label={`Quick tip ${recipientDisplayName} 0.001 ETH`}
        title="Quick tip 0.001 ETH"
      >
        {sending ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        ) : (
          <span className="text-sm">⚡</span>
        )}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      {QUICK_AMOUNTS.map((amt) => (
        <button
          key={amt.value}
          type="button"
          onClick={() => handleQuickTip(amt.value)}
          disabled={sending}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-2 py-1 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:bg-degen-500/10 hover:text-degen-400 disabled:opacity-40"
          aria-label={`Tip ${amt.label} ${amt.symbol}`}
        >
          {sending ? '...' : `${amt.label}`}
        </button>
      ))}
    </div>
  );
}
