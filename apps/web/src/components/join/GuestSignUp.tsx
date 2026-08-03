'use client';

/**
 * @components/join/GuestSignUp — One-click sign-up from source platform.
 *
 * Shows a streamlined registration card that captures the user's source
 * platform and suggests a pre-filled username. Offers multiple sign-up
 * paths: email+wallet, wallet-only, or platform-based registration.
 * Designed for the anonymous viewer who wants to upgrade.
 */

import { useCallback, useEffect, useState } from 'react';
import { PLATFORM_CONFIG, type SourcePlatform } from './types';

/* === Props ====================================================== */

interface GuestSignUpProps {
  sourcePlatform: SourcePlatform;
  /** Optional suggested username from the source platform. */
  suggestedHandle?: string;
  /** Called after successful sign-up. */
  onComplete?: () => void;
  /** If true, renders a compact version. */
  compact?: boolean;
}

/* === Types ====================================================== */

type SignUpMethod = 'wallet' | 'email' | 'platform';

/* === Component ================================================== */

export function GuestSignUp({
  sourcePlatform,
  suggestedHandle,
  onComplete,
  compact = false,
}: GuestSignUpProps) {
  const cfg = PLATFORM_CONFIG[sourcePlatform];
  const isDegenFeed = sourcePlatform === 'degenfeed';
  const isDirect = sourcePlatform === 'direct';

  const [method, setMethod] = useState<SignUpMethod>('wallet');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(suggestedHandle ?? '');
  const [step, setStep] = useState<'form' | 'connecting' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);

  // Pre-fill username from suggested handle
  useEffect(() => {
    if (suggestedHandle && !username) {
      setUsername(suggestedHandle.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30));
    }
  }, [suggestedHandle, username]);

  const handleSignUp = useCallback(async () => {
    setStep('connecting');
    setError(null);

    try {
      const payload: Record<string, unknown> = {};

      if (method === 'wallet') {
        // Wallet-based sign-up: redirect to auth with wallet flow
        payload.method = 'wallet';
        payload.username = username || undefined;
        payload.referrer = sourcePlatform;
      } else if (method === 'email') {
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('Please enter a valid email address');
        }
        payload.method = 'email';
        payload.email = email.trim();
        payload.username = username || undefined;
        payload.referrer = sourcePlatform;
      } else {
        payload.method = 'platform';
        payload.platform = sourcePlatform;
        payload.username = username || undefined;
        payload.referrer = sourcePlatform;
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Sign-up failed (${res.status})`);
      }

      setStep('done');
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed');
      setStep('form');
    }
  }, [method, email, username, sourcePlatform, onComplete]);

  const handleWalletConnect = useCallback(async () => {
    setMethod('wallet');
    setStep('connecting');
    setError(null);

    try {
      const payload = {
        method: 'wallet',
        username: username || undefined,
        referrer: sourcePlatform,
      };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Wallet sign-up failed');
      }

      setStep('done');
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed');
      setStep('form');
    }
  }, [username, sourcePlatform, onComplete]);

  if (isDegenFeed) return null;

  if (step === 'connecting') {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center"
        role="status"
        aria-label="Creating your account"
      >
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        <p className="text-sm font-medium text-[var(--color-fg)]">Creating your account...</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {method === 'wallet'
            ? 'Connect your wallet to continue.'
            : method === 'email'
              ? 'Setting up your email account.'
              : `Setting up your ${cfg?.label ?? ''} account.`}
        </p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div
        className="rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/[0.04] to-transparent p-5 text-center"
        role="status"
        aria-label="Account created"
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/20 text-degen-400">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[var(--color-fg)]">Account created!</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Welcome to DegenFeed. You can now stream, tip, and post.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-2xl border border-degen-500/10 bg-gradient-to-br from-degen-500/[0.03] to-transparent p-4">
        <p className="mb-3 text-xs font-semibold text-[var(--color-fg)]">
          {cfg
            ? `Create your DegenFeed account${isDirect ? '' : ` with ${cfg.label}`}`
            : 'Create your DegenFeed account'}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleWalletConnect}
            className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400"
          >
            Connect Wallet
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('platform');
              handleSignUp();
            }}
            className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-border)]"
          >
            {cfg ? `Continue as ${cfg.label} guest` : 'Continue as guest'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[10px] text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4"
        style={
          cfg && !isDirect
            ? {
                borderBottom: `1px solid ${cfg.color}15`,
                background: `linear-gradient(135deg, ${cfg.color}08, transparent)`,
              }
            : {
                borderBottom: '1px solid var(--color-glass-border)',
              }
        }
      >
        <div className="flex items-center gap-3">
          {cfg && (
            <span className="text-2xl" aria-hidden="true">
              {cfg.icon}
            </span>
          )}
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">
              {cfg ? `Create your DegenFeed account` : 'Create your free account'}
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              {suggestedHandle
                ? `Suggested username: @${suggestedHandle}`
                : 'No account needed to watch. Sign up to unlock full access.'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 p-5">
        {/* Username */}
        <div>
          <label
            htmlFor="guest-signup-username"
            className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
          >
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">
              @
            </span>
            <input
              id="guest-signup-username"
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))
              }
              placeholder="username"
              maxLength={30}
              pattern="[a-zA-Z0-9_]{2,30}"
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] pl-7 pr-3 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50"
              aria-describedby="username-hint"
            />
          </div>
          <p id="username-hint" className="mt-1 text-[10px] text-[var(--color-muted)]">
            Letters, numbers, and underscores. 2-30 characters.
          </p>
        </div>

        {/* Method selector */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">
            Sign up with
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleWalletConnect}
              className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2.5 text-center text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30"
            >
              <span className="block">🔑 Wallet</span>
              <span className="block text-[9px] text-[var(--color-muted)]">Connect & done</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('email');
              }}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-medium transition-colors ${
                method === 'email'
                  ? 'border-degen-500/40 bg-degen-500/10 text-degen-400'
                  : 'border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-[var(--color-border)]'
              }`}
            >
              <span className="block">📧 Email</span>
              <span className="block text-[9px] text-[var(--color-muted)]">Verify later</span>
            </button>
          </div>
        </div>

        {/* Email field (conditional) */}
        {method === 'email' && (
          <div>
            <label
              htmlFor="guest-signup-email"
              className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
            >
              Email address
            </label>
            <input
              id="guest-signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50"
              autoComplete="email"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2" role="alert">
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        {method === 'email' && (
          <button
            type="button"
            onClick={handleSignUp}
            disabled={!email.trim()}
            className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-50"
          >
            Create account
          </button>
        )}

        {/* Platform-specific CTA */}
        {method === 'platform' && (
          <button
            type="button"
            onClick={handleSignUp}
            className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-50"
          >
            {cfg ? `Continue with ${cfg.label}` : 'Continue'}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-glass-border)] px-5 py-3">
        <p className="text-center text-[10px] text-[var(--color-muted)]">
          By creating an account you agree to our{' '}
          <a href="/terms" className="text-degen-400 hover:underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-degen-400 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
