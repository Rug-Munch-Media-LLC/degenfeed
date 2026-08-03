'use client';

/**
 * SecuritySettings — 2FA security management component
 *
 * Manages TOTP (RFC 6238) two-factor authentication:
 * - View 2FA status (enabled/disabled)
 * - Enable TOTP with QR code setup flow
 * - Display recovery codes after setup
 * - Disable TOTP (requires current code or recovery code)
 *
 * Integrates with the settings page as a "Security" section.
 */

import { useCallback, useEffect, useState } from 'react';
import TOTPSetup from './TOTPSetup';

type SecurityView =
  | 'idle' // Showing current status
  | 'loading' // Fetching status
  | 'setup' // TOTP setup flow (QR code → verify)
  | 'recovery-codes' // Showing recovery codes after setup
  | 'disable' // Disable 2FA — needs code input
  | 'error'; // Error state

interface SecuritySettingsProps {
  /** Called when 2FA state changes (for parent to track) */
  onStateChange?: (enabled: boolean) => void;
}

export default function SecuritySettings({ onStateChange }: SecuritySettingsProps) {
  const [view, setView] = useState<SecurityView>('loading');
  const [enabled, setEnabled] = useState(false);
  const [disableInput, setDisableInput] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  // Fetch 2FA status on mount
  const checkStatus = useCallback(async () => {
    setView('loading');
    try {
      const res = await fetch('/api/auth/totp/status', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { enabled: boolean };
        setEnabled(data.enabled);
        onStateChange?.(data.enabled);
      }
    } catch {
      // Failed to check status — show as disabled
      setEnabled(false);
    } finally {
      setView('idle');
    }
  }, [onStateChange]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Called after successful TOTP setup with recovery codes
  const handleVerified = useCallback(
    (_recoveryCodes: string[]) => {
      setEnabled(true);
      onStateChange?.(true);
      setView('recovery-codes');
    },
    [onStateChange],
  );

  // Confirm disable with TOTP or recovery code
  const handleDisable = useCallback(async () => {
    if (!disableInput.trim()) return;

    setDisabling(true);
    setDisableError(null);

    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: disableInput.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Failed to disable 2FA');
      }

      setEnabled(false);
      onStateChange?.(false);
      setView('idle');
      setDisableInput('');
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setDisabling(false);
    }
  }, [disableInput, onStateChange]);

  // Cancel setup
  const handleSetupCancel = useCallback(() => {
    setView('idle');
  }, []);

  // === Render ================================================

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
      </div>
    );
  }

  if (view === 'setup') {
    return <TOTPSetup onVerified={handleVerified} onCancel={handleSetupCancel} />;
  }

  if (view === 'recovery-codes') {
    // Parent should pass codes here from the verify response
    return (
      <div className="text-center text-xs text-[var(--color-muted)] py-4">
        Recovery codes were shown after setup. If you missed them, you can disable and re-enable 2FA
        to regenerate them.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              enabled
                ? 'bg-degen-500/15 text-degen-400'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--color-fg)]">
              Authenticator App (TOTP)
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              {enabled ? 'Two-factor authentication is active' : 'Add an extra layer of security'}
            </p>
          </div>
        </div>

        {enabled ? (
          <span className="rounded-full bg-degen-500/15 px-2.5 py-1 text-[10px] font-medium text-degen-400">
            Enabled
          </span>
        ) : (
          <button type="button" onClick={() => setView('setup')} className="btn-primary text-xs">
            Enable
          </button>
        )}
      </div>

      {/* Disable section (only when enabled) */}
      {enabled && (
        <>
          {/* Explanation */}
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            To disable two-factor authentication, enter a code from your authenticator app or one of
            your recovery codes.
          </p>

          {/* Code input */}
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              value={disableInput}
              onChange={(e) => {
                setDisableInput(e.target.value);
                setDisableError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && disableInput.trim()) {
                  handleDisable();
                }
              }}
              placeholder="TOTP code or recovery code (XXXX-XXXX-XXXX)"
              className="input flex-1 text-xs font-mono"
              aria-label="Code to disable 2FA"
              disabled={disabling}
            />
            <button
              type="button"
              onClick={handleDisable}
              disabled={!disableInput.trim() || disabling}
              className="shrink-0 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
              {disabling ? 'Disabling...' : 'Disable'}
            </button>
          </div>

          {/* Error */}
          {disableError && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {disableError}
            </div>
          )}

          {/* Note about recovery codes */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="text-[10px] text-amber-400/70">
              Lost your authenticator app? Use one of your recovery codes instead. Each code can
              only be used once.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
