'use client';

/**
 * Nostr Dashboard — Account Management, Relay Config, Key Export/Import
 *
 * Complete Nostr account management:
 *   - View npub, NIP-05, relay status
 *   - Export nsec (encrypted)
 *   - Import existing nsec
 *   - Publish relay list (kind 10002)
 *   - Publish kind 1 notes
 *   - Check relay health
 */

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';

interface RelayInfo {
  ws: string;
  wss: string;
  connected?: boolean;
  latencyMs?: number;
  nip05Domain: string;
  nip05WellKnown: string;
}


export default function NostrDashboardPage() {
  const [relayInfo, setRelayInfo] = useState<RelayInfo | null>(null);
  const [relayHealth, setRelayHealth] = useState<{
    ok: boolean;
    connected: boolean;
    latencyMs: number;
  } | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [nsecStored, setNsecStored] = useState<string | null>(null);
  const [showNsec, setShowNsec] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'publish' | 'relays' | 'keys'>(
    'overview',
  );

  // Load stored nsec from sessionStorage (never localStorage, never persistent)
  useEffect(() => {
    const stored = sessionStorage.getItem('nostr_nsec');
    if (stored) setNsecStored(stored);
  }, []);

  // Fetch relay info
  useEffect(() => {
    fetch('/api/nostr/relays')
      .then((r) => r.json())
      .then((data) => {
        setRelayInfo(data.relay);
        setTotalUsers(data.totalUsers || 0);
      })
      .catch(() => {
        setRelayInfo({
          ws: 'ws://127.0.0.1:8085',
          wss: 'wss://nostr.degenfeed.xyz',
          nip05Domain: 'nostr.degenfeed.xyz',
          nip05WellKnown: 'https://nostr.degenfeed.xyz/.well-known/nostr.json',
        });
      });

    // Check relay health
    fetch('/api/nostr/health')
      .then((r) => r.json())
      .then((data) => {
        setRelayHealth({
          ok: data.ok,
          connected: data.relay?.connected,
          latencyMs: data.relay?.latencyMs,
        });
      })
      .catch(() => {});
  }, []);

  // Load nostr-sdk dynamically
  const getSdk = useCallback(async () => {
    try {
      return await import('@degenfeed/nostr-sdk');
    } catch {
      return null;
    }
  }, []);

  // Store nsec in session for publishing
  const handleStoreNsec = useCallback(() => {
    const nsec = prompt('Enter your nsec (stored only in session, cleared on tab close):');
    if (nsec && nsec.startsWith('nsec1')) {
      sessionStorage.setItem('nostr_nsec', nsec);
      setNsecStored(nsec);
    } else if (nsec) {
      alert('Invalid nsec format. Must start with nsec1...');
    }
  }, []);

  const handleClearNsec = useCallback(() => {
    sessionStorage.removeItem('nostr_nsec');
    setNsecStored(null);
    setShowNsec(false);
  }, []);

  // Publish a kind 1 note
  const handlePublish = useCallback(async () => {
    if (!nsecStored || !noteContent.trim()) return;
    setPublishing(true);
    setPublishResult(null);

    try {
      const sdk = await getSdk();
      if (!sdk) {
        setPublishResult('Failed to load Nostr SDK');
        setPublishing(false);
        return;
      }

      // Create and sign the event client-side
      const event = sdk.createTextNote(noteContent.trim(), sdk.nsecDecode(nsecStored).hex);

      // Publish via our API
      const res = await fetch('/api/nostr/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishResult(`✅ Published! Event ID: ${data.eventId.slice(0, 16)}…`);
        setNoteContent('');
      } else {
        setPublishResult(`❌ ${data.error?.message || 'Publish failed'}`);
      }
    } catch (err) {
      setPublishResult(`❌ Error: ${(err as Error).message}`);
    }

    setPublishing(false);
  }, [nsecStored, noteContent, getSdk]);

  // Publish relay list
  const handlePublishRelayList = useCallback(async () => {
    if (!nsecStored) {
      alert('Enter your nsec first');
      return;
    }

    try {
      const sdk = await getSdk();
      if (!sdk) return;

      const defaultRelays = [
        { url: 'wss://nostr.degenfeed.xyz', usage: 'write' as const },
        { url: 'wss://nostr.degenfeed.xyz', usage: 'read' as const },
        { url: 'wss://relay.damus.io', usage: 'read' as const },
        { url: 'wss://nos.lol', usage: 'read' as const },
        { url: 'wss://relay.nostr.band', usage: 'read' as const },
        { url: 'wss://relay.primal.net', usage: 'read' as const },
      ];

      const event = sdk.createRelayListEvent(defaultRelays, sdk.nsecDecode(nsecStored).hex);

      const res = await fetch('/api/nostr/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });

      const data = await res.json();
      if (data.ok) {
        alert('✅ Relay list published! Your Nostr clients will now know your preferred relays.');
      } else {
        alert(`❌ ${data.error?.message || 'Failed'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${(err as Error).message}`);
    }
  }, [nsecStored, getSdk]);

  // Render
  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <Script id="nostr-dashboard-breadcrumb" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Nostr',
              item: 'https://app.degenfeed.xyz/nostr',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Dashboard',
              item: 'https://app.degenfeed.xyz/nostr/dashboard',
            },
          ],
        })}
      </Script>

      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--color-fg)]">
              Nostr Dashboard
            </h1>
            <p className="text-sm text-[var(--color-muted)]">
              Manage your Nostr identity on DegenFeed
            </p>
          </div>
          <Link
            href="/nostr/register"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-500"
          >
            + New Account
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-6">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'publish', label: 'Publish' },
                { id: 'relays', label: 'Relays' },
                { id: 'keys', label: 'Keys' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Relay Status */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">
                ⚡ DegenFeed Nostr Relay
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">Relay URL</span>
                  <p className="font-mono text-sm text-green-400">
                    {relayInfo?.wss || 'wss://nostr.degenfeed.xyz'}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">Status</span>
                  <p className="text-sm">
                    {relayHealth === null ? (
                      <span className="text-[var(--color-muted)]">Checking...</span>
                    ) : relayHealth.connected ? (
                      <span className="text-green-400">
                        ✅ Connected ({relayHealth.latencyMs}ms)
                      </span>
                    ) : (
                      <span className="text-red-400">❌ Disconnected</span>
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">NIP-05 Domain</span>
                  <p className="font-mono text-sm text-purple-400">
                    @{relayInfo?.nip05Domain || 'nostr.degenfeed.xyz'}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">Registered Users</span>
                  <p className="text-sm text-[var(--color-fg)]">{totalUsers}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/nostr/register"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition hover:border-purple-500"
              >
                <h3 className="mb-1 font-bold text-[var(--color-fg)]">🔐 Create Account</h3>
                <p className="text-sm text-[var(--color-muted)]">
                  Generate a new Nostr keypair and register on our relay
                </p>
              </Link>
              <Link
                href="/nostr/import"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition hover:border-purple-500"
              >
                <h3 className="mb-1 font-bold text-[var(--color-fg)]">📥 Import Keys</h3>
                <p className="text-sm text-[var(--color-muted)]">
                  Import an existing nsec from another Nostr client
                </p>
              </Link>
              <Link
                href="/nostr/export"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition hover:border-purple-500"
              >
                <h3 className="mb-1 font-bold text-[var(--color-fg)]">📤 Export Keys</h3>
                <p className="text-sm text-[var(--color-muted)]">
                  Download your encrypted nsec for use elsewhere
                </p>
              </Link>
              <Link
                href="/nostr"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition hover:border-purple-500"
              >
                <h3 className="mb-1 font-bold text-[var(--color-fg)]">📰 Nostr Feed</h3>
                <p className="text-sm text-[var(--color-muted)]">
                  Browse notes from the Nostr network
                </p>
              </Link>
            </div>

            {/* Key Sovereignty Notice */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
              <h3 className="mb-2 font-bold text-amber-400">🔑 Full Key Sovereignty</h3>
              <ul className="space-y-1 text-sm text-amber-300/70">
                <li>• Your nsec is generated in-browser — DegenFeed never sees it</li>
                <li>• Use your nsec with any Nostr client (Damus, Primal, Snort, Amethyst)</li>
                <li>• Publish a relay list (kind 10002) to tell clients which relays to use</li>
                <li>• Your NIP-05 identifier: username@nostr.degenfeed.xyz</li>
                <li>• DegenFeed cannot recover your keys — back them up!</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab: Publish */}
        {activeTab === 'publish' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">
                Publish a Nostr Note
              </h2>

              {!nsecStored ? (
                <div className="mb-6 rounded-lg bg-amber-500/10 px-4 py-3">
                  <p className="text-sm text-amber-400">
                    Enter your nsec to publish. It stays in session storage — cleared on tab close.
                  </p>
                  <button
                    onClick={handleStoreNsec}
                    className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-500"
                    type="button"
                  >
                    Enter nsec
                  </button>
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-2">
                  <span className="text-xs text-green-400">✅ nsec loaded in session</span>
                  <button
                    onClick={handleClearNsec}
                    className="ml-3 text-xs text-red-400 underline"
                    type="button"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowNsec(!showNsec)}
                    className="ml-3 text-xs text-[var(--color-muted)] underline"
                    type="button"
                  >
                    {showNsec ? 'Hide' : 'Show'}
                  </button>
                  {showNsec && nsecStored && (
                    <p className="mt-1 font-mono text-xs text-red-400">
                      {nsecStored.slice(0, 16)}…{nsecStored.slice(-4)}
                    </p>
                  )}
                </div>
              )}

              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="What's happening?"
                maxLength={50000}
                rows={4}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
              />

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[var(--color-muted)]">
                  Kind 1 · Published to wss://nostr.degenfeed.xyz
                </span>
                <button
                  onClick={handlePublish}
                  disabled={!nsecStored || !noteContent.trim() || publishing}
                  className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  {publishing ? 'Publishing...' : '⚡ Publish'}
                </button>
              </div>

              {publishResult && (
                <div className="mt-4 rounded-lg bg-[var(--color-bg)] px-4 py-3 text-sm">
                  {publishResult}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">
                Publish Relay List (kind 10002)
              </h2>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                This sets your preferred relays so Nostr clients know where to find you. Your
                DegenFeed relay is set as write relay + several public read relays.
              </p>
              <button
                onClick={handlePublishRelayList}
                disabled={!nsecStored}
                className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                📡 Publish Relay List
              </button>
            </div>
          </div>
        )}

        {/* Tab: Relays */}
        {activeTab === 'relays' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">Your Relays</h2>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                These are the default relays configured for DegenFeed users. Your relay list (kind
                10002) tells clients which relays to use.
              </p>

              <div className="space-y-3">
                {[
                  { url: 'wss://nostr.degenfeed.xyz', usage: 'Read + Write', owned: true },
                  { url: 'wss://relay.damus.io', usage: 'Read', owned: false },
                  { url: 'wss://nos.lol', usage: 'Read', owned: false },
                  { url: 'wss://relay.nostr.band', usage: 'Read', owned: false },
                  { url: 'wss://relay.primal.net', usage: 'Read', owned: false },
                ].map((relay) => (
                  <div
                    key={relay.url}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
                  >
                    <div>
                      <p className="font-mono text-sm text-[var(--color-fg)]">
                        {relay.owned && '🏠 '}
                        {relay.url}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">{relay.usage}</p>
                    </div>
                    {relay.owned && (
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                        Our Relay
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg bg-blue-500/10 px-4 py-3">
                <p className="text-sm text-blue-400">
                  ℹ️ Users can add/remove relays by publishing kind 10002 events. Your relay list is
                  fully under your control.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg])">NIP-05 Verification</h2>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                NIP-05 lets you verify your identity with username@nostr.degenfeed.xyz. Nostr
                clients (Damus, Primal) display a ✓ badge when NIP-05 is verified.
              </p>
              <div className="rounded-lg bg-[var(--color-bg)] p-3">
                <span className="text-xs text-[var(--color-muted)]">Well-Known URL</span>
                <p className="font-mono text-sm text-purple-400">
                  {relayInfo?.nip05WellKnown ||
                    'https://nostr.degenfeed.xyz/.well-known/nostr.json'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Keys */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-lg font-bold text-[var(--color-fg])">Key Management</h2>
              <p className="mb-6 text-sm text-[var(--color-muted)]">
                Your Nostr keys are your identity. DegenFeed never stores your nsec. Manage them
                here.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/nostr/export"
                  className="rounded-lg border border-[var(--color-border)] p-4 transition hover:border-purple-500"
                >
                  <h3 className="mb-1 font-bold text-[var(--color-fg)]">📤 Export Keys</h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Download your nsec as an encrypted portable bundle
                  </p>
                </Link>
                <Link
                  href="/nostr/import"
                  className="rounded-lg border border-[var(--color-border)] p-4 transition hover:border-purple-500"
                >
                  <h3 className="mb-1 font-bold text-[var(--color-fg)]">📥 Import Keys</h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Import an existing nsec from another client
                  </p>
                </Link>
              </div>

              <div className="mt-6 space-y-2">
                <h3 className="font-bold text-[var(--color-fg)]">Compatible Clients</h3>
                <p className="text-sm text-[var(--color-muted)]">
                  Your nsec works with all Nostr clients. Take it anywhere:
                </p>
                <ul className="space-y-1 text-sm text-[var(--color-muted)]">
                  <li>• 📱 Damus (iOS) — App Store</li>
                  <li>• 📱 Primal (iOS/Android) — primal.net</li>
                  <li>• 💻 Snort (Web) — snort.social</li>
                  <li>• 📱 Amethyst (Android) — Play Store</li>
                  <li>• 💻 Coracle (Web) — coracle.social</li>
                  <li>• 💻 Iris (Web) — iris.to</li>
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
              <h3 className="mb-2 font-bold text-red-400">⚠️ Security Warning</h3>
              <ul className="space-y-1 text-sm text-red-300/70">
                <li>• Never share your nsec with anyone</li>
                <li>• DegenFeed will never ask for your nsec</li>
                <li>• Store your nsec in a password manager or offline</li>
                <li>• If you lose your nsec, there is no recovery</li>
                <li>• Session-stored nsec is cleared when you close the tab</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
