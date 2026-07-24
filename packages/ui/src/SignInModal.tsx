'use client';

import { memo, useState } from 'react';

export type { ReactNode } from 'react';

import {
  BlueskySignIn,
  EmailSignIn,
  FarcasterSignIn,
  LensSignIn,
  MastodonSignIn,
  NostrSignIn,
  OAuthProvidersSignIn,
  WalletSignIn,
} from './auth';

// ─── Types ────────────────────────────────────────────────────────

export interface ProtocolOption {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  method: 'oauth' | 'key' | 'extension' | 'password' | 'wallet';
  authUrl?: string;
}

export interface WalletOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  detected: boolean;
}

export interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (protocol: string, credentials?: Record<string, string>) => void;
  walletAddress?: string;
  walletSigningIn?: boolean;
  /** List of detected browser wallets. When omitted, falls back to basic Ethereum/Solana buttons. */
  availableWallets?: WalletOption[];
}

// ─── Protocol metadata ────────────────────────────────────────────

const OAUTH_PROTOCOLS: ProtocolOption[] = [
  {
    id: 'google',
    label: 'Google',
    color: '#4285f4',
    icon: 'G',
    description: 'Sign in with your Google account',
    method: 'oauth',
    authUrl: '/api/auth/google/authorize',
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    color: '#1da1f2',
    icon: '𝕏',
    description: 'Sign in with your Twitter account',
    method: 'oauth',
    authUrl: '/api/auth/twitter/authorize',
  },
  {
    id: 'github',
    label: 'GitHub',
    color: '#6cc644',
    icon: '🐙',
    description: 'Sign in with your GitHub account',
    method: 'oauth',
    authUrl: '/api/auth/github/authorize',
  },
  {
    id: 'discord',
    label: 'Discord',
    color: '#5865f2',
    icon: '🎮',
    description: 'Sign in with your Discord account',
    method: 'oauth',
    authUrl: '/api/auth/discord/authorize',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    color: '#8a63d2',
    icon: '◈',
    description: 'Sign in via Warpcast',
    method: 'oauth',
    authUrl: '/api/auth/warpcast/authorize',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#26a5e4',
    icon: '✈',
    description: 'Sign in with Telegram',
    method: 'oauth',
    authUrl: '/api/auth/telegram/authorize',
  },
  {
    id: 'email',
    label: 'Email',
    color: 'var(--color-accent)',
    icon: '✉',
    description: 'Sign in with email and password',
    method: 'password',
  },
];

const PROTOCOLS: ProtocolOption[] = [
  {
    id: 'mastodon',
    label: 'Mastodon / GoToSocial',
    color: '#6364ff',
    icon: '🐘',
    description: 'Any Mastodon or GoToSocial server',
    method: 'oauth',
    authUrl: '/api/auth/gotosocial/authorize',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    color: '#1185fe',
    icon: '☁',
    description: 'Handle + app password',
    method: 'password',
  },
  {
    id: 'nostr',
    label: 'Nostr',
    color: '#8e30eb',
    icon: '☰',
    description: 'npub/nsec key or browser extension',
    method: 'key',
  },
  {
    id: 'lens',
    label: 'Lens',
    color: '#abfe2c',
    icon: '◎',
    description: 'Connect wallet (MetaMask, Rainbow)',
    method: 'extension',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    color: '#ff4500',
    icon: '🔴',
    description: 'Sign in with your Reddit account',
    method: 'oauth',
    authUrl: '/api/auth/reddit/authorize',
  },
  {
    id: 'threads',
    label: 'Threads',
    color: '#000000',
    icon: '🧵',
    description: 'Sign in with your Threads account',
    method: 'oauth',
    authUrl: '/api/auth/threads/authorize',
  },
];

// ─── Protocol form router ─────────────────────────────────────────

function ProtocolForm({
  protocol,
  onSignIn,
  onBack,
}: {
  protocol: ProtocolOption;
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const props = { onSignIn, onBack };
  switch (protocol.id) {
    case 'nostr':
      return <NostrSignIn {...props} />;
    case 'farcaster':
      return <FarcasterSignIn {...props} />;
    case 'lens':
      return <LensSignIn {...props} />;
    case 'bluesky':
      return <BlueskySignIn {...props} />;
    case 'mastodon':
      return <MastodonSignIn {...props} />;
    case 'email':
      return <EmailSignIn {...props} />;
    case 'google':
    case 'github':
    case 'discord':
    case 'twitter':
    case 'telegram':
    case 'reddit':
    case 'threads':
      return <OAuthProvidersSignIn protocol={protocol} onBack={onBack} />;
    default:
      return <p className="text-sm text-[var(--color-muted)]">Unknown protocol</p>;
  }
}

// ─── SignInModal — MAIN COMPONENT ──────────────────────────────────

export const SignInModal = memo(function SignInModal({
  open,
  onClose,
  onSignIn,
  walletAddress,
  walletSigningIn,
  availableWallets,
}: SignInModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolOption | null>(null);

  if (!open) return null;

  const handleProtocolClick = (protocol: ProtocolOption) => {
    if (protocol.method === 'wallet') {
      onSignIn(protocol.id);
      return;
    }
    setSelectedProtocol(protocol);
  };

  const handleBack = () => setSelectedProtocol(null);

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => {
        setSelectedProtocol(null);
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setSelectedProtocol(null);
          onClose();
        }
      }}
      aria-modal="true"
      aria-label="Sign in to DegenFeed"
      role="dialog"
    >
      <div
        className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="none"
      >
        {/* ---- Header ---- */}
        <div className="mb-6 flex items-start justify-between">
          <div className="pr-4">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">
              {selectedProtocol ? `Sign in with ${selectedProtocol.label}` : 'Sign in to DegenFeed'}
            </h2>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              {selectedProtocol
                ? selectedProtocol.description
                : 'Choose how you want to connect. Browse freely — no account needed to read.'}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedProtocol(null);
              onClose();
            }}
            className="shrink-0 rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
            type="button"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              role="img"
              aria-label="Close icon"
            >
              <title>Close</title>
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {selectedProtocol ? (
          /* ---- Protocol-specific form ---- */
          <ProtocolForm
            protocol={selectedProtocol}
            onSignIn={(creds) => onSignIn(selectedProtocol.id, creds)}
            onBack={handleBack}
          />
        ) : (
          <>
            {/* ================================================================ */}
            {/* SECTION 1: Popular OAuth providers (TOP — first class citizens) */}
            {/* ================================================================ */}
            <div className="mb-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                Continue with
              </h3>
              <div className="space-y-2">
                {OAUTH_PROTOCOLS.map((proto) => {
                  if (proto.id === 'email') {
                    return (
                      <button
                        key={proto.id}
                        onClick={() => handleProtocolClick(proto)}
                        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-left transition-all hover:border-gray-500 group"
                        type="button"
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                          style={{ backgroundColor: `${proto.color}18`, color: proto.color }}
                        >
                          {proto.icon}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
                            {proto.label}
                          </div>
                          <div className="text-xs text-[var(--color-muted)]">
                            {proto.description}
                          </div>
                        </div>
                        <span className="text-xs text-gray-600">→</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={proto.id}
                      onClick={() => handleProtocolClick(proto)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-left transition-all hover:border-gray-600 group"
                      type="button"
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                        style={{ backgroundColor: `${proto.color}18`, color: proto.color }}
                      >
                        {proto.icon}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
                          {proto.label}
                        </div>
                        <div className="text-xs text-[var(--color-muted)]">{proto.description}</div>
                      </div>
                      <span className="text-xs text-gray-600">→</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ---- Separator: more options ---- */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--color-card)] px-3 text-xs text-gray-600">
                  More options
                </span>
              </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 2: Social / federated protocols */}
            {/* ================================================================ */}
            <div className="mb-5 space-y-2">
              {PROTOCOLS.map((proto) => (
                <button
                  key={proto.id}
                  onClick={() => handleProtocolClick(proto)}
                  className="flex w-full items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-left transition-all hover:border-gray-600 hover:bg-[var(--color-muted)] group"
                  type="button"
                >
                  <span className="text-xl" style={{ color: proto.color }}>
                    {proto.icon}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
                      {proto.label}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">{proto.description}</div>
                  </div>
                  <span className="text-xs text-gray-600">→</span>
                </button>
              ))}
            </div>

            {/* ---- Separator: wallet ---- */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--color-card)] px-3 text-xs text-gray-600">
                  Connect a wallet
                </span>
              </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 3: Wallet (BOTTOM — least intrusive) */}
            {/* ================================================================ */}
            <div className="mb-5">
              <WalletSignIn
                onSignIn={(p) => onSignIn(p)}
                walletAddress={walletAddress}
                walletSigningIn={walletSigningIn}
                availableWallets={availableWallets}
              />
            </div>

            {/* ---- Browse Anonymously ---- */}
            <button
              type="button"
              onClick={() => onClose()}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm font-semibold text-[var(--color-fg)] transition-all hover:border-degen-500/50 hover:text-degen-400 hover:bg-degen-500/5"
            >
              <span className="text-lg">👀</span>
              Browse Anonymously — No Sign-In Needed
            </button>

            {/* ---- Footer ---- */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a
                href="/api/auth/gotosocial/register"
                className="text-xs text-degen-500 hover:underline"
              >
                Create free @degenfeed.xyz account
              </a>
              <span className="text-xs text-gray-600">·</span>
              <a href="/terms" className="text-xs text-gray-600 hover:underline">
                Terms
              </a>
              <span className="text-xs text-gray-600">·</span>
              <a href="/privacy" className="text-xs text-gray-600 hover:underline">
                Privacy
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
});
