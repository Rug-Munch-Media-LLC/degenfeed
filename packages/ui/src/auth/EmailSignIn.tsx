'use client';

import { memo, useState } from 'react';

export interface EmailSignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}

export const EmailSignIn = memo(function EmailSignIn({ onSignIn, onBack }: EmailSignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

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
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button type="button" onClick={handleSubmit} className="btn-primary w-full">
        {isNewUser ? 'Create Account' : 'Sign In'}
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
