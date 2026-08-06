'use client';

import { memo, useState } from 'react';

interface OAuthProtocolInfo {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  method: 'oauth' | 'key' | 'extension' | 'password' | 'wallet';
  authUrl?: string;
}

export interface OAuthProvidersSignInProps {
  protocol: OAuthProtocolInfo;
  onBack: () => void;
}

export const OAuthProvidersSignIn = memo(function OAuthProvidersSignIn({
  protocol,
  onBack,
}: OAuthProvidersSignInProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Better Auth social sign-in (equivalent to the client's
      // `signIn.social({ provider })`): POST to the auth server and redirect
      // the browser to the returned provider authorize URL. Better Auth
      // completes the OAuth callback server-side and sets the session cookie.
      const res = await fetch('/api/auth/better/sign-in/social', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: protocol.id,
          callbackURL: '/home',
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `${protocol.label} sign-in is not available right now.`);
      }

      const data = (await res.json()) as { url?: string; redirect?: boolean; message?: string };
      const authorizeUrl = data.url;
      if (!authorizeUrl) {
        throw new Error('No authorization URL received');
      }

      window.location.href = authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sign-in');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        You will be redirected to {protocol.label} to authorize DegenFeed. No password is shared
        with us.
      </p>
      <button
        type="button"
        onClick={handleOAuthLogin}
        disabled={loading}
        className="btn-primary flex w-full items-center justify-center gap-2"
        style={
          loading
            ? undefined
            : {
                borderColor: `${protocol.color}40`,
                background: `${protocol.color}15`,
                color: protocol.color,
              }
        }
      >
        {loading ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Connecting...
          </>
        ) : (
          <>
            <span>{protocol.icon}</span>
            Sign in with {protocol.label}
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)]"
      >
        ← Back
      </button>
      <p className="text-center text-[10px] text-gray-600">
        By signing in, you agree to our{' '}
        <a href="/terms" className="text-degen-500 hover:underline">
          Terms
        </a>{' '}
        and{' '}
        <a href="/privacy" className="text-degen-500 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
});
