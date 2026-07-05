/**
 * @degenfeed/ui — SignInModal
 *
 * Protocol picker sign-in/sign-up modal.
 *
 * Three tiers:
 *   BROWSE  → No account needed, visible immediately
 *   SIGN IN → Connect an existing protocol account (Nostr, Farcaster, Lens, Bluesky, Threads, Mastodon)
 *   JOIN    → Create a free @degenfeed.xyz account (GotoSocial-powered)
 *
 * Once signed in with any protocol, users can:
 *   - Like, reply, repost on that network
 *   - Link additional accounts for cross-posting
 *
 * Design:
 *   Dark overlay + centered card. Protocol buttons with brand colors.
 *   Clean, minimal. No unnecessary text. Keyboard-navigable.
 */

import type { ReactNode } from 'react';

export type { ReactNode };

export interface ProtocolOption {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  /** Sign-in method: redirect URL for OAuth, or keyboard input for private key */
  method: 'oauth' | 'key' | 'extension' | 'password';
  /** If method is 'oauth', the authorize endpoint */
  authUrl?: string;
}

export interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (protocol: string, token?: string) => void;
}

const PROTOCOLS: ProtocolOption[] = [
  {
    id: 'nostr',
    label: 'Nostr',
    color: '#8e30eb',
    icon: '☰',
    description: 'npub/nsec key or browser extension',
    method: 'key',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    color: '#8a63d2',
    icon: '◈',
    description: 'Warpcast or self-hosted signer',
    method: 'oauth',
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
    id: 'bluesky',
    label: 'Bluesky',
    color: '#1185fe',
    icon: '☁',
    description: 'App password',
    method: 'password',
  },
  {
    id: 'threads',
    label: 'Threads',
    color: '#888888',
    icon: '⊞',
    description: 'AT Protocol app password',
    method: 'password',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    color: '#6364ff',
    icon: '🐘',
    description: 'Any Mastodon/GotoSocial server',
    method: 'oauth',
    authUrl: '/api/auth/gotosocial/authorize',
  },
];

/**
 * Sign-in & sign-up modal.
 * Renders protocol buttons + "Create free account" section.
 */
export function SignInModal({ open, onClose, onSignIn }: SignInModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to DegenFeed"
    >
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Sign In</h2>
            <p className="text-sm text-gray-500">
              Connect an account to like, reply, and post. Link multiple to cross-post.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Close"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Protocol buttons */}
        <div className="mb-6 space-y-2">
          {PROTOCOLS.map((proto) => (
            <button
              key={proto.id}
              onClick={() => onSignIn(proto.id)}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-left transition-all hover:border-gray-600 hover:bg-gray-800/50 group"
              type="button"
            >
              <span className="text-2xl" style={{ color: proto.color }}>
                {proto.icon}
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white group-hover:text-degen-400 transition-colors">
                  {proto.label}
                </div>
                <div className="text-xs text-gray-500">{proto.description}</div>
              </div>
              <span className="text-xs text-gray-600">→</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-950 px-3 text-xs text-gray-600">or</span>
          </div>
        </div>

        {/* Create free account */}
        <a
          href="/api/auth/gotosocial/register"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/20 hover:border-degen-500/50"
        >
          <span>✦</span>
          Create free @degenfeed.xyz account
          <span className="text-xs text-degen-600">(30 seconds)</span>
        </a>
        <p className="mt-2 text-center text-xs text-gray-600">
          Powered by GotoSocial. No email required. Username + password only.
        </p>

        {/* Browse note */}
        <p className="mt-6 text-center text-xs text-gray-600">
          No account needed to browse.{' '}
          <a href="/home" className="text-degen-500 hover:underline">
            Start reading now
          </a>
        </p>
      </div>
    </div>
  );
}
