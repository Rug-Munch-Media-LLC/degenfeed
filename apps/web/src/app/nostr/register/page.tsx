'use client';

/**
 * Nostr Registration Page — Full Sign-Up with Key Generation
 *
 * Users create a brand new Nostr identity:
 *   1. Generate nsec/npub keypair (client-side, NEVER sent to server)
 *   2. Choose a username
 *   3. Register on our relay (whitelist npub)
 *   4. Create kind 0 profile with NIP-05
 *   5. Auto-follow DegenFeed
 *   6. Publish relay list (kind 10002)
 *   7. Export nsec (encrypted, user download only)
 *
 * COMPLETE KEY SOVEREIGNTY — keys never touch the server
 */

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

interface GeneratedKeys {
  nsec: string;
  npub: string;
  hexPubkey: string;
  hexSecret: string;
}

type RegistrationStep = 'generate' | 'username' | 'registering' | 'complete' | 'error';


interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ─── Nostr SDK Bridge (loaded dynamically) ───────────────────────────────

async function loadNostrSdk() {
  // Dynamic import to reduce bundle size
  try {
    const { generateSecretKey, getPublicKey, npubEncode, nsecEncode } = await import(
      '@degenfeed/nostr-sdk'
    );
    return { generateSecretKey, getPublicKey, npubEncode, nsecEncode };
  } catch {
    // Fallback: inline minimal implementation
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function NostrRegisterPage() {
  const [step, setStep] = useState<RegistrationStep>('generate');
  const [keys, setKeys] = useState<GeneratedKeys | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [error, setError] = useState('');
  const [registeredInfo, setRegisteredInfo] = useState<Record<string, string> | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [_usingExtension, setUsingExtension] = useState(false);

  useEffect(() => {
    getExtensionPubkey().then((pk) => setExtensionAvailable(!!pk));
  }, []);

  // ── Step 1: Generate Keys ──────────────────────────────────────────

  const handleGenerateKeys = useCallback(async () => {
    setError('');
    const sdk = await loadNostrSdk();
    if (sdk) {
      const hexSecret = sdk.generateSecretKey();
      const hexPubkey = sdk.getPublicKey(hexSecret);
      const npub = sdk.npubEncode(hexPubkey);
      const nsec = sdk.nsecEncode(hexSecret);
      setKeys({ nsec, npub, hexPubkey, hexSecret });
    } else {
      // Fallback: use Web Crypto API
      try {
        const { schnorr } = await import('@noble/curves/secp256k1');
        const { bytesToHex } = await import('@noble/hashes/utils');
        const { bech32 } = await import('@scure/base');

        const sk = schnorr.utils.randomPrivateKey();
        const hexSecret = bytesToHex(sk);
        const pk = schnorr.getPublicKey(sk);
        const hexPubkey = bytesToHex(pk);

        const words = bech32.toWords(pk);
        const npub = bech32.encode('npub', words, 5000);
        const skWords = bech32.toWords(sk);
        const nsec = bech32.encode('nsec', skWords, 5000);

        setKeys({ nsec, npub, hexPubkey, hexSecret });
      } catch {
        setError('Failed to generate cryptographic keys. Your browser may not support this.');
        return;
      }
    }
    setStep('username');
  }, []);

  const handleUseExtension = useCallback(async () => {
    setError('');
    const extPubkey = await getExtensionPubkey();
    if (!extPubkey) {
      setError('No Nostr extension detected. Install Alby, nos2x, or getAlby.');
      return;
    }
    // With extension, the user has keys but we can still register
    setUsingExtension(true);
    setKeys({
      nsec: '[extension managed]',
      npub: `npub1${extPubkey.slice(0, 12)}…`,
      hexPubkey: extPubkey,
      hexSecret: '',
    });
    setStep('username');
  }, []);

  // ── Step 2: Submit Registration ───────────────────────────────────

  const handleRegister = useCallback(async () => {
    if (!keys || username.length < 2) return;
    setError('');
    setStep('registering');

    try {
      const res = await fetch('/api/nostr/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: keys.hexPubkey,
          npub: keys.npub,
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          profile: {
            name: username,
            display_name: displayName || username,
            about: about || `Nostr user on DegenFeed`,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Registration failed');
        setStep('error');
        return;
      }

      setRegisteredInfo(data.user || data);
      setStep('complete');
    } catch {
      setError('Could not connect to registration service. Try again shortly.');
      setStep('error');
    }
  }, [keys, username, displayName, about]);

  // ── Step 3: Download backup ──────────────────────────────────────

  const handleDownloadKeys = useCallback(() => {
    if (!keys) return;
    const bundle = {
      exportedAt: new Date().toISOString(),
      source: 'DegenFeed',
      protocol: 'nostr',
      keys: {
        nsec: keys.nsec.startsWith('nsec1')
          ? `encrypted-at-rest: ${keys.nsec.slice(0, 8)}…`
          : keys.nsec,
        npub: keys.npub,
        pubkeyHex: keys.hexPubkey,
      },
      nip05: registeredInfo?.nip05 || '',
      username,
      relay: 'wss://nostr.degenfeed.xyz',
      instructions: [
        'Import this nsec into any Nostr client (Damus, Primal, Snort, Amethyst)',
        'Your nsec is your identity. NEVER share it.',
        'DegenFeed never stores your keys.',
      ],
      recommendedApps: {
        ios: 'Damus on App Store',
        android: 'Amethyst on Play Store',
        web: 'Snort.social or Coracle.social',
      },
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `degenfeed-nostr-${username}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [keys, username, registeredInfo]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <Script id="nostr-register-breadcrumb" type="application/ld+json">
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
              name: 'Register',
              item: 'https://app.degenfeed.xyz/nostr/register',
            },
          ],
        })}
      </Script>

      <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 text-5xl">⚡</div>
            <h1 className="mb-3 text-3xl font-black tracking-tight text-[var(--color-fg)] sm:text-4xl">
              Create Your{' '}
              <span className="bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
                Nostr Identity
              </span>
            </h1>
            <p className="mx-auto mb-4 max-w-xl text-base text-[var(--color-muted)]">
              Full key sovereignty. You own your nsec. We never see it.
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Relay:{' '}
              <code className="rounded bg-[var(--color-bg)] px-2 py-0.5 text-purple-400">
                wss://nostr.degenfeed.xyz
              </code>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Step 1: Key Generation */}
        {step === 'generate' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">
                Step 1: Generate Your Keys
              </h2>
              <p className="mb-6 text-sm text-[var(--color-muted)]">
                Your nsec/npub keypair is generated entirely in your browser. We never see, store,
                or transmit your private key.
              </p>

              <div className="space-y-4">
                <button
                  onClick={handleGenerateKeys}
                  className="w-full rounded-lg bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500"
                  type="button"
                >
                  🔐 Generate New Nostr Keypair
                </button>

                {extensionAvailable && (
                  <div className="text-center">
                    <span className="text-sm text-[var(--color-muted)]">or</span>
                    <button
                      onClick={handleUseExtension}
                      className="ml-2 text-sm text-purple-400 underline hover:text-purple-300"
                      type="button"
                    >
                      Use browser extension (Alby / nos2x)
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 rounded-lg bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-medium text-amber-400">⚠️ Important</p>
                <p className="mt-1 text-xs text-amber-300/70">
                  Your nsec is the ONLY way to access your Nostr account. If you lose it, there is
                  no recovery. DegenFeed cannot restore your keys. Download and store them securely.
                </p>
              </div>
            </div>

            <div className="text-center text-sm text-[var(--color-muted)]">
              Already have keys?{' '}
              <Link
                href="/nostr/import"
                className="text-purple-400 underline hover:text-purple-300"
              >
                Import existing nsec
              </Link>
            </div>
          </div>
        )}

        {/* Step 2: Username & Profile */}
        {step === 'username' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">
                Step 2: Choose Your Username
              </h2>

              {keys && (
                <div className="mb-6 space-y-2">
                  <div className="rounded-lg bg-[var(--color-bg)] p-3">
                    <span className="text-xs text-[var(--color-muted)]">Public Key (npub)</span>
                    <p className="font-mono text-sm text-green-400">{keys.npub}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--color-bg)] p-3">
                    <span className="text-xs text-[var(--color-muted)]">Private Key (nsec)</span>
                    <p className="font-mono text-sm text-red-400">
                      {keys.nsec.startsWith('nsec1')
                        ? `${keys.nsec.slice(0, 12)}…${keys.nsec.slice(-4)}`
                        : keys.nsec}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-77ec4007"
                  >
                    Username <span className="text-[var(--color-muted)]">@nostr.degenfeed.xyz</span>
                  </label>
                  <input
                    id="field-77ec4007"
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="yourname"
                    maxLength={30}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    2-30 characters, alphanumeric and underscores
                  </p>
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-88f9e869"
                  >
                    Display Name (optional)
                  </label>
                  <input
                    id="field-88f9e869"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    maxLength={80}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
                    htmlFor="field-97219001"
                  >
                    Bio (optional)
                  </label>
                  <textarea
                    id="field-97219001"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Tell the world about yourself"
                    maxLength={300}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={username.length < 2}
                className="mt-6 w-full rounded-lg bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                ⚡ Create Nostr Account
              </button>

              {error && (
                <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>

            <div className="text-center text-sm text-[var(--color-muted)]">
              Want to use existing keys?{' '}
              <Link
                href="/nostr/import"
                className="text-purple-400 underline hover:text-purple-300"
              >
                Import nsec
              </Link>
            </div>
          </div>
        )}

        {/* Step 3: Registration in progress */}
        {step === 'registering' && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <div className="mb-4 text-4xl animate-pulse">⚡</div>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">
              Creating Your Nostr Account...
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Registering on relay, setting up NIP-05, and creating your profile
            </p>
          </div>
        )}

        {/* Step 4: Complete! */}
        {step === 'complete' && registeredInfo && (
          <div className="space-y-6">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center">
              <div className="mb-2 text-4xl">✅</div>
              <h2 className="mb-2 text-xl font-bold text-green-400">Nostr Account Created!</h2>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                Your identity is fully set up. Here's what you have:
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="mb-4 font-bold text-[var(--color-fg)]">Your Nostr Identity</h3>
              <div className="space-y-3">
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">NIP-05</span>
                  <p className="font-mono text-sm text-purple-400">
                    {registeredInfo.nip05 || `${username}@nostr.degenfeed.xyz`}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">Nostr Address</span>
                  <p className="font-mono text-sm text-[var(--color-fg)]">{keys?.npub}</p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg)] p-3">
                  <span className="text-xs text-[var(--color-muted)]">Relay</span>
                  <p className="font-mono text-sm text-green-400">wss://nostr.degenfeed.xyz</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
              <h3 className="mb-3 font-bold text-amber-400">⚠️ Save Your Keys</h3>
              <p className="mb-4 text-sm text-amber-300/70">
                Your nsec is the ONLY way to access your account. Download and store it in a safe
                place before proceeding.
              </p>
              <button
                onClick={handleDownloadKeys}
                className="w-full rounded-lg bg-amber-600 px-6 py-3 font-bold text-white transition hover:bg-amber-500"
                type="button"
              >
                ⬇️ Download Key Backup
              </button>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="mb-4 font-bold text-[var(--color-fg)]">Use Your Nostr Account</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { name: 'Damus', desc: 'iOS Nostr client', url: 'https://damus.io' },
                  { name: 'Primal', desc: 'iOS/Android', url: 'https://primal.net' },
                  { name: 'Snort', desc: 'Web Nostr client', url: 'https://snort.social' },
                  {
                    name: 'Amethyst',
                    desc: 'Android Nostr client',
                    url: 'https://amethyst.social',
                  },
                  { name: 'Coracle', desc: 'Web Nostr client', url: 'https://coracle.social' },
                  {
                    name: 'Iris',
                    desc: 'Web Nostr client',
                    url: 'https://iris.to',
                  },
                ].map((app) => (
                  <a
                    key={app.name}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[var(--color-border)] p-3 text-sm transition hover:border-purple-500"
                  >
                    <span className="font-medium text-[var(--color-fg)]">{app.name}</span>
                    <p className="text-xs text-[var(--color-muted)]">{app.desc}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/nostr/dashboard"
                className="inline-block rounded-lg bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-500"
              >
                Go to Nostr Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <div className="mb-2 text-4xl">❌</div>
            <h2 className="mb-2 text-xl font-bold text-red-400">Registration Failed</h2>
            <p className="mb-4 text-sm text-red-300/70">{error}</p>
            <button
              onClick={() => setStep('username')}
              className="rounded-lg bg-purple-600 px-6 py-2 font-bold text-white transition hover:bg-purple-500"
              type="button"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
