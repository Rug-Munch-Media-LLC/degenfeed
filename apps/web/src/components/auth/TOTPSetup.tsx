'use client';

/**
 * TOTPSetup — Two-step TOTP 2FA setup flow
 *
 * Step 1: Shows QR code + manual setup key for the user to add
 *         to their authenticator app (Google Authenticator, Authy, etc.)
 * Step 2: User enters the 6-digit code from the app to verify + activate
 *
 * After successful activation, the parent component should display
 * the recovery codes (from the verify API response).
 */

import { useCallback, useState } from 'react';

interface TOTPSetupData {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
}

interface TOTPSetupProps {
  /** Called after successful verification with recovery codes */
  onVerified: (recoveryCodes: string[]) => void;
  /** Called when the user cancels setup */
  onCancel: () => void;
}

export default function TOTPSetup({ onVerified, onCancel }: TOTPSetupProps) {
  const [step, setStep] = useState<'loading' | 'show-qr' | 'verify' | 'error'>('loading');
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Initialize setup — fetch secret from API
  const initSetup = useCallback(async () => {
    setSetupError(null);
    try {
      const res = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Failed to start 2FA setup');
      }
      const data = (await res.json()) as TOTPSetupData;
      setSetupData(data);
      setStep('show-qr');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Failed to start setup');
      setStep('error');
    }
  }, []);

  // Auto-init on mount
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    initSetup();
  }

  // Verify the TOTP code
  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Verification failed');
      }

      const data = (await res.json()) as { verified: boolean; recoveryCodes: string[] };
      if (data.verified && data.recoveryCodes) {
        onVerified(data.recoveryCodes);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [code, onVerified]);

  // Render error state
  if (step === 'error') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{setupError || 'Failed to set up 2FA'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={initSetup} className="btn-primary text-sm">
            Try Again
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'loading' || !setupData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1: QR Code + Manual Key */}
      {step === 'show-qr' && (
        <>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
              Scan with Authenticator App
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Use Google Authenticator, Authy, 1Password, or any TOTP app
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-white p-3">
              <img
                src={setupData.qrCodeUrl}
                width="200"
                height="200"
                className="rounded-lg"
                alt="QR code for TOTP setup"
              />
            </div>
          </div>

          {/* Or manual entry */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-4">
            <p className="text-xs font-medium text-[var(--color-muted)] mb-2">
              Or enter this key manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all rounded-lg bg-[var(--color-card)] px-3 py-2 text-xs font-mono text-[var(--color-fg)] border border-[var(--color-glass-border)] break-all">
                {setupData.secret}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(setupData.secret).catch(() => {});
                }}
                className="shrink-0 rounded-lg bg-degen-500/15 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/25 transition-colors"
                title="Copy secret key"
              >
                Copy
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('verify')}
            className="btn-primary w-full text-sm"
          >
            I&apos;ve scanned the code
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Cancel
          </button>
        </>
      )}

      {/* Step 2: Verify Code */}
      {step === 'verify' && (
        <>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
              Enter the 6-digit code
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Enter the code shown in your authenticator app to confirm setup
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
              aria-label="6-digit verification code"
            />
          </div>

          {/* Remaining attempts hint */}
          <p className="text-center text-[10px] text-[var(--color-muted)]">
            Code refreshes every 30 seconds
          </p>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400 text-center">
              {error}
            </div>
          )}

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
              'Verify & Activate'
            )}
          </button>

          <button
            type="button"
            onClick={() => setStep('show-qr')}
            className="w-full text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Back to QR code
          </button>
        </>
      )}
    </div>
  );
}
