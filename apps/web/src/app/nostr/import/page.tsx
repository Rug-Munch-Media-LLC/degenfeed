'use client';

/**
 * Nostr Key Import — Import existing nsec from other clients
 *
 * Users can import their existing nsec to register on our relay.
 * The nsec is decoded client-side to derive the pubkey.
 * Only the pubkey is sent to the server for registration.
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';

export default function NostrImportPage() {
  const [nsec, setNsec] = useState('');
  const [username, setUsername] = useState('');
  const [showNsec, setShowNsec] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    npub: string;
    nip05: string;
    username: string;
  } | null>(null);

  const handleImport = useCallback(async () => {
    setError('');
    setResult(null);

    if (!nsec.startsWith('nsec1')) {
      setError('Invalid nsec. Must start with nsec1...');
      return;
    }

    if (!username || username.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    setImporting(true);

    try {
      // Decode nsec client-side to get pubkey
      const { bech32 } = await import('@scure/base');
      const { bytesToHex } = await import('@noble/hashes/utils');
      const { schnorr } = await import('@noble/curves/secp256k1');

      const decoded = bech32.decode(nsec as unknown as `${string}1${string}`, 5000);
      if (decoded.prefix !== 'nsec') {
        setError('Invalid nsec prefix');
        setImporting(false);
        return;
      }

      const secretKeyBytes = bech32.fromWords(decoded.words);
      const pubkeyHex = bytesToHex(schnorr.getPublicKey(secretKeyBytes));

      // Register with server (only pubkey sent)
      const res = await fetch('/api/nostr/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: pubkeyHex,
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Import/registration failed');
        setImporting(false);
        return;
      }

      // Store nsec in session for dashboard use
      sessionStorage.setItem('nostr_nsec', nsec);

      setResult({
        npub: data.user?.npub || data.npub || '',
        nip05: data.user?.nip05 || data.nip05 || `${username}@nostr.degenfeed.xyz`,
        username: data.user?.username || username,
      });
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
    }

    setImporting(false);
  }, [nsec, username]);

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-black text-[var(--color-fg)]">📥 Import Nostr Keys</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Import your existing nsec from another Nostr client and register it on our relay
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {!result ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-7bb98ea2"
                  >
                    Your Existing nsec
                  </label>
                  <div className="relative">
                    <input
                      id="field-7bb98ea2"
                      type={showNsec ? 'text' : 'password'}
                      value={nsec}
                      onChange={(e) => setNsec(e.target.value)}
                      placeholder="nsec1..."
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 pr-10 font-mono text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setShowNsec(!showNsec)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]"
                      type="button"
                    >
                      {showNsec ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    The nsec is decoded in-browser. Only your pubkey is sent to the server.
                  </p>
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-66b6d507"
                  >
                    Desired Username
                    <span className="text-[var(--color-muted)]"> @nostr.degenfeed.xyz</span>
                  </label>
                  <input
                    id="field-66b6d507"
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="yourname"
                    maxLength={30}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || !nsec || !username}
                className="mt-6 w-full rounded-lg bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                {importing ? 'Importing...' : '📥 Import & Register'}
              </button>
            </div>

            <div className="text-center text-sm text-[var(--color-muted)]">
              Don&apos;t have keys yet?{' '}
              <Link
                href="/nostr/register"
                className="text-purple-400 underline hover:text-purple-300"
              >
                Create a new Nostr account
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8 text-center">
              <div className="mb-2 text-4xl">✅</div>
              <h2 className="mb-2 text-xl font-bold text-green-400">Imported Successfully!</h2>
              <p className="text-sm text-[var(--color-muted)]">
                Your existing Nostr key is now registered on our relay.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="mb-4 font-bold text-[var(--color-fg)]">Your Nostr Identity</h3>
              <div className="space-y-3">
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">NIP-05</span>
                  <p className="font-mono text-sm text-purple-400">{result.nip05}</p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">npub</span>
                  <p className="font-mono text-sm text-green-400">{result.npub}</p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">Username</span>
                  <p className="text-sm text-[var(--color-fg)]">{result.username}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/nostr/dashboard"
                className="flex-1 rounded-lg bg-purple-600 px-6 py-3 text-center font-bold text-white transition hover:bg-purple-500"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/nostr"
                className="flex-1 rounded-lg border border-[var(--color-border)] px-6 py-3 text-center font-bold text-[var(--color-fg)] transition hover:border-purple-500"
              >
                Browse Nostr Feed
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
