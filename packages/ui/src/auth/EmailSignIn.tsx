'use client';

import { memo, useState } from 'react';

export interface EmailSignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
  /** Default to the registration form (used by the "Create Account" tab) */
  defaultMode?: 'signin' | 'register';
  /** True while the sign-in/registration request is in flight */
  busy?: boolean;
}

export const EmailSignIn = memo(function EmailSignIn({
  onSignIn,
  onBack,
  defaultMode = 'signin',
  busy = false,
}: EmailSignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(defaultMode === 'register');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  // ── Password recovery state ───────────────────────────────────────
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (isNewUser) {
      onSignIn({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        method: 'register',
      });
    } else {
      onSignIn({ email: email.trim(), password, method: 'signin' });
    }
  };

  const handleForgotSubmit = async () => {
    setForgotError('');
    setForgotSent(false);
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }
    setForgotBusy(true);
    try {
      // The api-server implements POST /api/auth/forgot-password — it issues a
      // single-use, 1h reset token and emails the user a reset link. It never
      // reveals whether the account exists (anti-enumeration).
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Failed to request password reset');
      setForgotSent(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to request password reset');
    } finally {
      setForgotBusy(false);
    }
  };

  if (showForgot) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Reset your password</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Enter your account email and we'll send you a password reset link.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Email</span>
          <input
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="you@example.com"
            className="input w-full"
            autoComplete="email"
          />
        </label>
        {forgotError && <p className="text-xs text-red-400">{forgotError}</p>}
        {forgotSent && (
          <p className="text-xs text-green-500">
            If that email is registered, a password reset link has been sent.
          </p>
        )}
        <button
          type="button"
          onClick={handleForgotSubmit}
          disabled={forgotBusy}
          className="btn-primary w-full disabled:opacity-60"
        >
          {forgotBusy ? 'Sending…' : 'Send reset link'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForgot(false);
            setForgotError('');
            setForgotSent(false);
          }}
          className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)]"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isNewUser && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Display Name (optional)
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="input w-full"
            maxLength={64}
            autoComplete="name"
          />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input w-full"
          autoComplete="email"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isNewUser ? 'At least 8 characters' : 'Your password'}
          className="input w-full"
          autoComplete={isNewUser ? 'new-password' : 'current-password'}
        />
      </label>
      {!isNewUser && (
        <div className="text-right">
          <button
            type="button"
            onClick={() => {
              setShowForgot(true);
              setForgotError('');
              setForgotSent(false);
            }}
            className="text-xs text-degen-400 hover:underline"
          >
            Forgot password?
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="btn-primary w-full disabled:opacity-60"
      >
        {busy ? 'Please wait…' : isNewUser ? 'Create Account' : 'Sign In'}
      </button>
      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsNewUser((v) => !v)}
          className="text-xs text-degen-400 hover:underline"
        >
          {isNewUser ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)]"
      >
        ← Back
      </button>
    </div>
  );
});
