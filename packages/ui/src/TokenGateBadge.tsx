/**
 * @degenfeed/ui — TokenGateBadge
 *
 * Badge components for token-gated content displayed on post cards
 * and community cards. Shows the token/NFT requirement and whether
 * the current viewer has access.
 *
 * Features:
 *   - "🔒 Token-gated: Hold SYMBOL to view" on post cards
 *   - "🔒 SYMBOL holders only" on community cards
 *   - Click to verify wallet → reveals content if holder
 *   - If not holder: shows "You need MIN_BALANCE SYMBOL to view"
 *   - Shows where to acquire the token
 */

import { CHAIN_LABELS, type TokenGate, formatGateDescription } from '@degenfeed/token-gate';
import { useCallback, useEffect, useState } from 'react';

// ─── Post Card Gate Badge ──────────────────────────────────────────────────

export interface PostGateBadgeProps {
  gate: TokenGate;
  displaySymbol?: string;
  /** Current wallet address of the viewer */
  viewerWallet?: string;
  /** Called when the user passes the gate check */
  onVerified?: () => void;
  /** Called when verification is in progress */
  onVerifying?: (verifying: boolean) => void;
  /** Called when the user wants to acquire the token */
  onAcquire?: () => void;
  /** If the content is unlocked by a parent/context check */
  unlocked?: boolean;
}

export function PostGateBadge({
  gate,
  displaySymbol,
  viewerWallet,
  onVerified,
  onVerifying,
  onAcquire,
  unlocked: initiallyUnlocked,
}: PostGateBadgeProps) {
  const [checked, setChecked] = useState(false);
  const [holdsToken, setHoldsToken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(initiallyUnlocked ?? false);
  const [error, setError] = useState<string | null>(null);

  const symbol = displaySymbol ?? gate.contractAddress.slice(0, 8);
  const chainLabel = CHAIN_LABELS[gate.chain];

  useEffect(() => {
    if (initiallyUnlocked) setUnlocked(true);
  }, [initiallyUnlocked]);

  const handleVerify = useCallback(async () => {
    if (!viewerWallet) return;
    setVerifying(true);
    setError(null);
    onVerifying?.(true);

    try {
      const res = await fetch('/api/token-gate/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gate,
          walletAddress: viewerWallet,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Verification failed');
      }

      const data = (await res.json()) as { holds: boolean };
      setHoldsToken(data.holds);
      setChecked(true);

      if (data.holds) {
        setUnlocked(true);
        onVerified?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
      onVerifying?.(false);
    }
  }, [gate, viewerWallet, onVerified, onVerifying]);

  // If content was unlocked externally (e.g., parent check already passed)
  if (unlocked) return null;

  // If we've checked and they don't hold the token
  if (checked && !holdsToken) {
    const balance = gate.minBalance ?? 1;
    return (
      <div className="mb-3 rounded-xl border border-yellow-900/30 bg-yellow-950/20 p-4 text-center">
        <div className="mb-2 text-2xl">🔒</div>
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          You need <span className="font-semibold text-yellow-300">{balance} {symbol}</span> on{' '}
          <span className="font-semibold">{chainLabel}</span> to view this content.
        </p>
        {onAcquire && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAcquire();
            }}
            className="rounded-lg bg-yellow-700/40 px-4 py-2 text-xs font-semibold text-yellow-200 hover:bg-yellow-700/60 transition-colors"
          >
            Get {symbol}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-yellow-900/30 bg-yellow-950/20 p-4 text-center">
      <div className="mb-2 text-2xl">🔒</div>
      <p className="mb-3 text-sm text-[var(--color-muted)]">
        Token-gated: Hold <span className="font-semibold text-yellow-300">{symbol}</span> to view
      </p>
      {viewerWallet ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleVerify();
          }}
          disabled={verifying}
          className="rounded-lg bg-yellow-700/40 px-4 py-2 text-xs font-semibold text-yellow-200 hover:bg-yellow-700/60 transition-colors disabled:opacity-50"
        >
          {verifying ? 'Verifying...' : 'Verify Wallet'}
        </button>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">Connect your wallet to verify access</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Community Card Gate Badge ─────────────────────────────────────────────

export interface CommunityGateBadgeProps {
  gate: TokenGate;
  displaySymbol?: string;
  /** Current wallet address of the viewer */
  viewerWallet?: string;
  compact?: boolean;
}

export function CommunityGateBadge({
  gate,
  displaySymbol,
  viewerWallet,
  compact,
}: CommunityGateBadgeProps) {
  const [holdsToken, setHoldsToken] = useState(false);
  const [checking, setChecking] = useState(false);

  const symbol = displaySymbol ?? gate.contractAddress.slice(0, 8);
  const label = compact
    ? `🔒 ${symbol} holders only`
    : formatGateDescription(gate, symbol);

  // Auto-verify if we have a wallet
  useEffect(() => {
    if (!viewerWallet || holdsToken || checking) return;
    setChecking(true);
    fetch('/api/token-gate/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gate, walletAddress: viewerWallet }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ holds: boolean }>) : null))
      .then((data) => {
        if (data) setHoldsToken(data.holds);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [gate, viewerWallet, holdsToken, checking]);

  if (holdsToken) return null; // They can join freely

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-yellow-900/30 bg-yellow-950/20 px-2.5 py-0.5 text-[11px] font-medium text-yellow-300"
      title={label}
    >
      🔒
      {compact ? symbol : label.substring(0, 50)}
      {!compact && label.length > 50 && '...'}
    </span>
  );
}
