import type { ReactNode } from 'react';

export type { ReactNode };

export interface ProtocolOption {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  method: 'oauth' | 'key' | 'extension' | 'password' | 'wallet';
  authUrl?: string;
}

export interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (protocol: string, token?: string) => void;
  walletAddress?: string;
  walletSigningIn?: boolean;
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
  {
    id: 'ethereum',
    label: 'Ethereum',
    color: '#627eea',
    icon: '◆',
    description: 'Sign in with Ethereum wallet',
    method: 'wallet',
  },
  {
    id: 'solana',
    label: 'Solana',
    color: '#9945ff',
    icon: '◎',
    description: 'Sign in with Solana wallet',
    method: 'wallet',
  },
];

function WalletSection({ onSignIn, walletAddress, walletSigningIn }: {
  onSignIn: (protocol: string) => void;
  walletAddress?: string;
  walletSigningIn?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-widest text-gray-500">Web3 Wallets</h3>
      {walletAddress ? (
        <div className="rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Connected Wallet</div>
          <div className="text-sm font-mono text-degen-400 break-all">{walletAddress}</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onSignIn('ethereum')}
              disabled={walletSigningIn}
              className="rounded-lg bg-[#627eea]/20 px-3 py-1.5 text-xs font-medium text-[#627eea] hover:bg-[#627eea]/30 transition-colors disabled:opacity-50"
              type="button"
            >
              {walletSigningIn ? 'Signing...' : 'Sign in with ETH'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onSignIn('ethereum')}
          className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-left transition-all hover:border-gray-600 hover:bg-gray-800/50 group"
          type="button"
        >
          <span className="text-2xl text-[#627eea]">◆</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white group-hover:text-degen-400 transition-colors">
              Connect Wallet
            </div>
            <div className="text-xs text-gray-500">MetaMask, WalletConnect, or any EVM wallet</div>
          </div>
          <span className="text-xs text-gray-600">→</span>
        </button>
      )}
    </div>
  );
}

export function SignInModal({ open, onClose, onSignIn, walletAddress, walletSigningIn }: SignInModalProps) {
  if (!open) return null;

  const handleProtocolClick = (protocol: string) => {
    if (protocol === 'ethereum' || protocol === 'solana') {
      onSignIn(protocol);
      return;
    }
    onSignIn(protocol);
  };

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
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mb-6 space-y-2">
          {/* Social protocols */}
          <h3 className="text-xs font-medium uppercase tracking-widest text-gray-500">Social Protocols</h3>
          {PROTOCOLS.filter(p => p.method !== 'wallet').map((proto) => (
            <button
              key={proto.id}
              onClick={() => handleProtocolClick(proto.id)}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-left transition-all hover:border-gray-600 hover:bg-gray-800/50 group"
              type="button"
            >
              <span className="text-2xl" style={{ color: proto.color }}>{proto.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white group-hover:text-degen-400 transition-colors">{proto.label}</div>
                <div className="text-xs text-gray-500">{proto.description}</div>
              </div>
              <span className="text-xs text-gray-600">→</span>
            </button>
          ))}
        </div>

        {/* Wallet section */}
        <div className="mb-6">
          <WalletSection onSignIn={(p) => onSignIn(p)} walletAddress={walletAddress} walletSigningIn={walletSigningIn} />
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-950 px-3 text-xs text-gray-600">or</span>
          </div>
        </div>

        <a
          href="/api/auth/gotosocial/register"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/20 hover:border-degen-500/50"
        >
          <span>✦</span>
          Create free @degenfeed.xyz account
          <span className="text-xs text-degen-600">(30 seconds)</span>
        </a>
        <p className="mt-2 text-center text-xs text-gray-600">
          Powered by GotoSocial. No email required.
        </p>

        <p className="mt-6 text-center text-xs text-gray-600">
          No account needed to browse.{' '}
          <a href="/home" className="text-degen-500 hover:underline">Start reading now</a>
        </p>
      </div>
    </div>
  );
}
