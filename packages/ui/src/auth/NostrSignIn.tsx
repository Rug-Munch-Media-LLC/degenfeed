'use client';

import { memo, useEffect, useRef, useState } from 'react';

export interface NostrSignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}

export const NostrSignIn = memo(function NostrSignIn({ onSignIn, onBack }: NostrSignInProps) {
  const [mode, setMode] = useState<'choice' | 'nsec' | 'extension'>('choice');
  const [nsec, setNsec] = useState('');
  const [error, setError] = useState('');

  // Fix: NIP-07 extension auto-detection in useEffect, not during render
  const autoDetectedRef = useRef(false);
  useEffect(() => {
    if (mode === 'extension' && !autoDetectedRef.current) {
      const hasNip07 =
        typeof window !== 'undefined' && !!(window as unknown as { nostr?: unknown }).nostr;
      if (hasNip07) {
        autoDetectedRef.current = true;
        onSignIn({ method: 'extension' });
      }
    }
  }, [mode, onSignIn]);

  if (mode === 'choice') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMode('nsec')}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🔑</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">Paste nsec / NIP-07</div>
            <div className="text-xs text-[var(--color-muted)]">
              Enter your secret key or use a browser extension
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('extension')}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🧩</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">
              Use browser extension
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              Alby, nos2x, or any NIP-07 signer
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

  if (mode === 'extension') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-muted)]">
          No NIP-07 extension detected. Install{' '}
          <a
            href="https://getalby.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-degen-400 underline"
          >
            Alby
          </a>{' '}
          or{' '}
          <a
            href="https://github.com/fiatjaf/nos2x"
            target="_blank"
            rel="noopener noreferrer"
            className="text-degen-400 underline"
          >
            nos2x
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setMode('choice')}
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
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          nsec (secret key)
        </span>
        <input
          type="password"
          value={nsec}
          onChange={(e) => {
            setNsec(e.target.value);
            setError('');
          }}
          placeholder="nsec1..."
          className="input w-full font-mono text-xs"
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Stored encrypted in your browser. Never sent to any server in plaintext.
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
            if (!nsec.trim()) {
              setError('Please enter your nsec');
              return;
            }
            if (!nsec.startsWith('nsec1') && nsec.length !== 64) {
              setError('Invalid nsec format');
              return;
            }
            onSignIn({ nsec: nsec.trim(), method: 'nsec' });
          }}
          className="btn-primary flex-1"
        >
          Sign in
        </button>
      </div>
    </div>
  );
});
