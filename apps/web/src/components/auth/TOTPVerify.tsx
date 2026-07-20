'use client';

/**
 * TOTPVerify — 6-digit TOTP code input for login flow
 *
 * Used when a user has 2FA enabled and needs to enter
 * their authenticator app code during sign-in.
 * Optionally falls back to recovery code input.
 */

import { useCallback, useState } from 'react';

interface TOTPVerifyProps {
  /** Wallet address being authenticated */
  address: string;
  /** Called when TOTP verification succeeds */
  onVerified: () => void;
  /** Called when the user wants to use a recovery code instead */
  onUseRecoveryCode: () => void;
  /** Called on cancel / back */
  onCancel: () => void;
}

export default function TOTPVerify({
  address,
  onVerified,
  onUseRecoveryCode,
  onCancel,
}: TOTPVerifyProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/totp/authenticate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, code }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Invalid code');
      }

      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setCode('');
    } finally {
      setVerifying(false);
    }
  }, [code, address, onVerified]);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/15">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-degen-400"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
          Two-Factor Authentication
        </h3>
        <p className="text-xs text-[var(--color-muted)]">
          Enter the code from your authenticator app
        </p>
      </div>

      {/* Code Input */}
      <div className="flex justify-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(val);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.length === 6) {
              handleVerify();
            }
          }}
          placeholder="000000"
          className="w-40 text-center text-2xl tracking-[0.5em] font-mono font-bold bg-[var(--color-overlay)] border-2 border-[var(--color-glass-border)] rounded-xl px-4 py-3 text-[var(--color-fg)] focus:border-degen-500 focus:outline-none focus:ring-2 focus:ring-degen-500/30 placeholder:text-[var(--color-muted)]/30"
          autoFocus
          aria-label="6-digit authentication code"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400 text-center">
          {error}
        </div>
      )}

      {/* Verify button */}
      <button
        type="button"
        onClick={handleVerify}
        disabled={code.length !== 6 || verifying}
        className="btn-primary w-full text-sm disabled:opacity-50"
      >
        {verifying ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Verifying...
          </span>
        ) : (
          'Verify'
        )}
      </button>

      {/* Recovery code link */}
      <button
        type="button"
        onClick={onUseRecoveryCode}
        className="w-full text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        Use a recovery code instead
      </button>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-xs text-[var(--color-muted)] hover:text-red-400 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
