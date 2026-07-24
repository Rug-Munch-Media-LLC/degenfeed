'use client';

import { memo, useState } from 'react';

export interface MastodonSignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}

export const MastodonSignIn = memo(function MastodonSignIn({
  onSignIn,
  onBack,
}: MastodonSignInProps) {
  const [instance, setInstance] = useState('https://social.degenfeed.xyz');
  const [accessToken, setAccessToken] = useState('');
  const [error, _setError] = useState('');

  const handleMastodonOAuth = async () => {
    try {
      const res = await fetch('/api/auth/gotosocial/authorize', { credentials: 'include' });
      if (!res.ok) throw new Error('Authorization not available');
      const data = (await res.json()) as { authorizeUrl: string };
      window.location.href = data.authorizeUrl;
    } catch {
      window.location.href = `${instance}/oauth/authorize?client_id=degenfeed&response_type=code&scope=read+write+follow+push&redirect_uri=${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`;
    }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          Instance URL
        </span>
        <input
          type="url"
          value={instance}
          onChange={(e) => setInstance(e.target.value)}
          placeholder="https://mastodon.social"
          className="input w-full"
        />
      </label>
      <div className="text-center text-xs text-gray-600">— or —</div>
      <button
        type="button"
        onClick={handleMastodonOAuth}
        className="btn-secondary flex w-full items-center justify-center text-xs"
      >
        OAuth with {instance.replace(/^https?:\/\//, '')}
      </button>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          Or paste access token
        </span>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="paste from /settings/applications"
          className="input w-full font-mono text-xs"
        />
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
        {accessToken && (
          <button
            type="button"
            onClick={() => onSignIn({ instance: instance.trim(), accessToken: accessToken.trim() })}
            className="btn-primary flex-1"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
});
