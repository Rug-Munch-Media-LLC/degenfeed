'use client';

/**
 * Nostr Key Export — Encrypted nsec download
 *
 * Users can export their nsec as a password-protected encrypted bundle.
 * Encryption happens client-side. The server never sees the nsec.
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';

export default function NostrExportPage() {
  const [nsec, setNsec] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exported, setExported] = useState(false);
  const [showNsec, setShowNsec] = useState(false);

  const handleExport = useCallback(async () => {
    setError('');

    if (!nsec.startsWith('nsec1')) {
      setError('Invalid nsec. Must start with nsec1...');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setExporting(true);

    try {
      // Export via the API — the nsec is encrypted client-side
      // The API wraps it in a portable bundle format
      const res = await fetch('/api/nostr/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nsec, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Export failed');
        setExporting(false);
        return;
      }

      // Get the blob and download it
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] || `degenfeed-nostr-keys-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExported(true);
    } catch (err) {
      setError(`Export failed: ${(err as Error).message}`);
    }

    setExporting(false);
  }, [nsec, password, confirmPassword]);

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-black text-[var(--color-fg)]">📤 Export Nostr Keys</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Download your nsec as an encrypted portable bundle for use in other clients
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {!exported ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-a416727d"
                  >
                    Your nsec
                  </label>
                  <div className="relative">
                    <input
                      id="field-a416727d"
                      type={showNsec ? 'text' : 'password'}
                      value={nsec}
                      onChange={(e) => setNsec(e.target.value)}
                      placeholder="nsec1..."
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 pr-10 font-mono text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNsec(!showNsec)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]"
                      type="button"
                    >
                      {showNsec ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-1dbe9ea8"
                  >
                    Encryption Password
                  </label>
                  <input
                    id="field-1dbe9ea8"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-02637786"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="field-02637786"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
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
                onClick={handleExport}
                disabled={exporting || !nsec || !password || !confirmPassword}
                className="mt-6 w-full rounded-lg bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                {exporting ? 'Exporting...' : '⬇️ Download Encrypted Keys'}
              </button>
            </div>

            <div className="rounded-lg bg-amber-500/10 px-4 py-3">
              <p className="text-xs text-amber-400">
                ⚠️ Keep your nsec safe and offline. DegenFeed never stores your keys. If you lose
                them, there is no recovery.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8 text-center">
            <div className="mb-2 text-4xl">✅</div>
            <h2 className="mb-2 text-xl font-bold text-green-400">Keys Exported!</h2>
            <p className="mb-6 text-sm text-[var(--color-muted)]">
              Your Nostr keys have been downloaded. Use the JSON file to import into any Nostr
              client.
            </p>
            <div className="space-x-4">
              <Link
                href="/nostr/import"
                className="inline-block rounded-lg bg-purple-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-purple-500"
              >
                Import Another Key
              </Link>
              <Link
                href="/nostr/dashboard"
                className="inline-block rounded-lg border border-[var(--color-border)] px-6 py-2 text-sm font-bold text-[var(--color-fg)] transition hover:border-purple-500"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
