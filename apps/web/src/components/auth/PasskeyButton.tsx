'use client';

/**
 * "Sign in with Passkey" button
 *
 * Uses @simplewebauthn/browser for client-side WebAuthn.
 * Supports: fingerprint, Face ID, YubiKey, platform passkeys,
 * cross-device passkeys (iCloud Keychain, Google Password Manager).
 *
 * Flow:
 *   1. User enters wallet address (or it's pre-filled)
 *   2. Calls POST /api/auth/webauthn/authenticate/begin → get options
 *   3. Calls startAuthentication() → browser prompts for biometric/security key
 *   4. Calls POST /api/auth/webauthn/authenticate/complete → get session
 */

import { startAuthentication } from '@simplewebauthn/browser';
import { useCallback, useState } from 'react';
import { setCsrfToken } from '../../lib/csrf';

interface PasskeyButtonProps {
  /** Pre-filled wallet address, if known */
  wallet?: string;
  /** Called on successful authentication */
  onSuccess?: (session: { address: string; token: string }) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Optional additional class names */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Disable the button */
  disabled?: boolean;
}

export function PasskeyButton({
  wallet,
  onSuccess,
  onError,
  className = '',
  size = 'md',
  disabled = false,
}: PasskeyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    if (!wallet) {
      const msg = 'Wallet address required';
      setError(msg);
      onError?.(msg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get authentication options from server
      const beginRes = await fetch('/api/auth/webauthn/authenticate/begin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: wallet.toLowerCase() }),
      });

      if (!beginRes.ok) {
        const errData = (await beginRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || 'Failed to start authentication');
      }

      const options = await beginRes.json();

      // Step 2: Prompt the browser's WebAuthn authenticator
      const authResponse = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify the authentication with the server
      const completeRes = await fetch('/api/auth/webauthn/authenticate/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.toLowerCase(),
          credential: authResponse,
        }),
      });

      if (!completeRes.ok) {
        const errData = (await completeRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || 'Authentication failed');
      }

      const result = (await completeRes.json()) as {
        verified: boolean;
        session: { address: string; exp: number };
        token: string;
      };

      if (!result.verified) {
        throw new Error('Authentication not verified');
      }

      // Store CSRF token from the new session
      // The session cookie is set via Set-Cookie header
      setCsrfToken(null);

      onSuccess?.({
        address: result.session.address,
        token: result.token,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message === 'Error: The operation either timed out or was not allowed.'
            ? 'Authentication cancelled or timed out. Please try again.'
            : err.message
          : 'Passkey authentication failed';

      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [wallet, onSuccess, onError]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading || disabled || !wallet}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-degen-500/50 focus:ring-offset-2 focus:ring-offset-[var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${
          loading
            ? 'bg-degen-500/20 text-degen-400 cursor-wait'
            : 'bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 hover:text-degen-300 active:bg-degen-500/30 border border-degen-500/20'
        }`}
        aria-label={loading ? 'Authenticating with passkey...' : 'Sign in with passkey'}
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            {/* Fingerprint icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
              <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
              <path d="M2 12a10 10 0 0 1 18-6" />
              <path d="M2 16h.01" />
              <path d="M21.8 16c.2-2 .13-2.94 0-4.07" />
              <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2" />
            </svg>
            <span>Sign in with Passkey</span>
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
