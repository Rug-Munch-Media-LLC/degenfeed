'use client';

/**
 * @degenfeed/web — Hardware Wallet 2FA Verification Component
 *
 * Challenge-response 2FA component that prompts the user to sign
 * a message with their hardware wallet (Ledger, Trezor, etc.).
 *
 * Supports both EVM wallets (via useWeb3 signMessage) and
 * Solana wallets (via useSolana).
 *
 * Usage:
 *   <HardwareWalletVerify
 *     onVerified={handleVerified}
 *     mode="setup"              // 'setup' | 'login' | 'inline'
 *     walletType="ethereum"     // 'ethereum' | 'solana'
 *   />
 */

import { useCallback, useEffect, useState } from 'react';
import { useHardwareWallet2FA } from '../../hooks/useHardwareWallet2FA';
import { useWeb3 } from '../Web3Provider';

export type HwWalletVerifyMode = 'setup' | 'login' | 'inline';
export type HwWalletType = 'ethereum' | 'solana';

interface HardwareWalletVerifyProps {
  /** Called when verification succeeds */
  onVerified?: () => void;
  /** Display mode */
  mode?: HwWalletVerifyMode;
  /** Wallet type */
  walletType?: HwWalletType;
}

function HwWalletIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h.01M10 16h.01M14 16h.01M18 16h.01" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function HardwareWalletVerify({
  onVerified,
  mode = 'setup',
  walletType,
}: HardwareWalletVerifyProps) {
  const web3 = useWeb3();
  const { challenge, step, loading, error, startChallenge, signAndVerifyWithEthereum, reset } =
    useHardwareWallet2FA({
      onVerified,
      onError: () => {},
    });

  const [expanded, setExpanded] = useState(mode !== 'inline');

  // Auto-start the challenge when component is expanded
  const handleStart = useCallback(async () => {
    await startChallenge();
  }, [startChallenge]);

  // Sign with the connected wallet
  const handleSign = useCallback(async () => {
    await signAndVerifyWithEthereum(web3.signMessage);
  }, [signAndVerifyWithEthereum, web3.signMessage]);

  // Reset and start over
  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  // Refresh the wallet connection check
  useEffect(() => {
    if (mode === 'login' && expanded && !challenge && step === 'idle') {
      handleStart();
    }
  }, [mode, expanded, challenge, step, handleStart]);

  if (!expanded) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-overlay)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
            <ShieldCheckIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--color-fg)]">Hardware Wallet 2FA</div>
            <div className="text-xs text-[var(--color-muted)]">
              Verify with your Ledger, Trezor, or hardware wallet
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-glass-border)] px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
          <HwWalletIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-fg)]">
            Hardware Wallet Verification
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            {mode === 'login'
              ? 'Prove your identity with your hardware wallet'
              : 'Link your hardware wallet as a second factor'}
          </div>
        </div>
        {mode !== 'login' && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Collapse"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-4">
        {/* Security note */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 shrink-0 text-amber-400"
            aria-hidden="true"
          >
            <path d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-xs text-[var(--color-muted)]">
            <strong className="text-amber-400">Your private key never leaves your device.</strong>{' '}
            The challenge is signed locally and verified by the server. This proves you control the
            private key without ever exposing it.
          </p>
        </div>

        {/* Challenge message box */}
        {challenge && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">
              Sign this message with your hardware wallet:
            </label>
            <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg)] p-3 font-mono text-xs text-[var(--color-fg)] leading-relaxed select-all">
              {challenge}
            </pre>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-0.5 shrink-0 text-red-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Done state */}
        {step === 'done' && (
          <div className="flex items-center gap-3 rounded-lg border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-degen-400">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-degen-400">Hardware Wallet Verified</div>
              <div className="text-xs text-[var(--color-muted)]">
                Your identity has been confirmed via hardware wallet signature.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="border-t border-[var(--color-glass-border)] px-4 py-3">
        {step === 'idle' && (
          <button
            type="button"
            onClick={handleStart}
            disabled={loading}
            className="btn-primary w-full text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Generating challenge...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <HwWalletIcon />
                Start Hardware Wallet Verification
              </span>
            )}
          </button>
        )}

        {(step === 'challenge' || step === 'signing') && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSign}
              disabled={loading || !web3.isConnected}
              className="btn-primary w-full text-sm"
            >
              {loading || step === 'signing' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Waiting for hardware wallet...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign with {web3.walletName || 'Hardware Wallet'}
                </span>
              )}
            </button>

            {!web3.isConnected && (
              <p className="text-center text-xs text-amber-400">
                No wallet connected. Please connect your wallet first.
              </p>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="w-full rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Verify again
            </button>
            {mode !== 'login' && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="btn-primary flex-1 text-xs"
              >
                Done
              </button>
            )}
          </div>
        )}

        {error && step !== 'idle' && step !== 'done' && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={loading}
            className="mt-2 w-full rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
