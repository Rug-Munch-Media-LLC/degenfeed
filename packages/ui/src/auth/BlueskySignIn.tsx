'use client';

import { memo, useState } from 'react';

export interface BlueskySignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}

export const BlueskySignIn = memo(function BlueskySignIn({ onSignIn, onBack }: BlueskySignInProps) {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Handle</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="alice.bsky.social"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          App Password
        </span>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            className="input w-full font-mono text-xs pr-16"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)]"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <a
          href="https://bsky.app/settings/app-passwords"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-degen-400 hover:underline"
        >
          Create one at bsky.app/settings/app-passwords →
        </a>
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!handle.trim() || !appPassword.trim()) {
              setError('All fields required');
              return;
            }
            onSignIn({ handle: handle.trim(), appPassword: appPassword.trim() });
          }}
          className="btn-primary flex-1"
        >
          Sign in
        </button>
      </div>
    </div>
  );
});
