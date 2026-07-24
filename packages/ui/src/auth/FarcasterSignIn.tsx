'use client';

import { memo, useState } from 'react';

export interface FarcasterSignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}

export const FarcasterSignIn = memo(function FarcasterSignIn({
  onSignIn,
  onBack,
}: FarcasterSignInProps) {
  const [mode, setMode] = useState<'choice' | 'form'>('choice');
  const [fid, setFid] = useState('');
  const [username, setUsername] = useState('');
  const [signerKey, setSignerKey] = useState('');
  const [error, setError] = useState('');

  if (mode === 'choice') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onSignIn({ method: 'warpcast' })}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🔗</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">
              Sign in with Warpcast
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              Use your Warpcast account via OAuth
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('form')}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🔐</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">
              Enter FID + signer key
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              For self-custody Farcaster signers
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)]"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="alice"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          FID (numeric)
        </span>
        <input
          type="text"
          value={fid}
          onChange={(e) => setFid(e.target.value)}
          placeholder="12345"
          className="input w-full"
          inputMode="numeric"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          Signer private key (hex)
        </span>
        <input
          type="password"
          value={signerKey}
          onChange={(e) => setSignerKey(e.target.value)}
          placeholder="0x... or hex"
          className="input w-full font-mono text-xs"
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Signer key is used to sign casts. Stored encrypted in your browser.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('choice')}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!username.trim() || !fid.trim() || !signerKey.trim()) {
              setError('All fields required');
              return;
            }
            onSignIn({ username: username.trim(), fid: fid.trim(), signerKey: signerKey.trim() });
          }}
          className="btn-primary flex-1"
        >
          Sign in
        </button>
      </div>
    </div>
  );
});
