'use client';

/**
 * RecoveryCodeInput — Input for a single recovery code
 *
 * Used when the user has lost access to their authenticator app
 * and needs to use a recovery code instead.
 *
 * Format: XXXX-XXXX-XXXX (auto-formats with dashes)
 */

import { useCallback, useState } from 'react';

interface RecoveryCodeInputProps {
  /** Called when the recovery code is accepted */
  onVerified: () => void;
  /** Called to go back to TOTP input */
  onBackToTOTP: () => void;
  /** Called on cancel */
  onCancel: () => void;
}

export default function RecoveryCodeInput({
  onVerified,
  onBackToTOTP,
  onCancel,
}: RecoveryCodeInputProps) {
  const [rawCode, setRawCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Format the code as XXXX-XXXX-XXXX while typing
  const handleInput = useCallback((value: string) => {
    // Remove non-hex characters
    const hex = value.replace(/[^0-9a-fA-F]/g, '').toLowerCase().slice(0, 12);

    // Auto-insert dashes at positions 4 and 8
    let formatted = hex;
    if (hex.length > 4) {
      formatted = `${hex.slice(0, 4)}-${hex.slice(4)}`;
    }
    if (hex.length > 8) {
      formatted = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8)}`;
    }

    setRawCode(formatted);
    setError(null);
  }, []);

  const handleVerify = useCallback(async () => {
    // Validate format: XXXX-XXXX-XXXX
    const normalized = rawCode.replace(/-/g, '').toLowerCase();
    if (normalized.length !== 12 || !/^[0-9a-f]{12}$/.test(normalized)) {
      setError('Please enter a complete recovery code (XXXX-XXXX-XXXX)');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      // Use the same disable endpoint with the recovery code
      // The /disable endpoint accepts both TOTP and recovery codes
      const res = await fetch('/api/auth/totp/disable', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: rawCode }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Invalid recovery code');
      }

      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid recovery code');
    } finally {
      setVerifying(false);
    }
  }, [rawCode, onVerified]);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-amber-400"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
          Recovery Code
        </h3>
        <p className="text-xs text-[var(--color-muted)]">
          Enter one of your recovery codes. Each code can only be used once.
        </p>
      </div>

      {/* Input */}
      <div className="flex justify-center">
        <input
          type="text"
          inputMode="text"
          value={rawCode}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && rawCode.length >= 14) {
              handleVerify();
            }
          }}
          placeholder="XXXX-XXXX-XXXX"
          className="w-56 text-center text-lg tracking-wider font-mono font-bold bg-[var(--color-overlay)] border-2 border-[var(--color-glass-border)] rounded-xl px-4 py-3 text-[var(--color-fg)] focus:border-degen-500 focus:outline-none focus:ring-2 focus:ring-degen-500/30 placeholder:text-[var(--color-muted)]/30"
          autoFocus
          aria-label="Recovery code"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400 text-center">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleVerify}
        disabled={rawCode.length < 14 || verifying}
        className="btn-primary w-full text-sm disabled:opacity-50"
      >
        {verifying ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Verifying...
          </span>
        ) : (
          'Verify Recovery Code'
        )}
      </button>

      <button
        type="button"
        onClick={onBackToTOTP}
        className="w-full text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        Back to authenticator code
      </button>

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
