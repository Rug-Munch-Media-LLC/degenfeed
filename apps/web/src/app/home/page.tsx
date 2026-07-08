'use client';

import Image from 'next/image';
import { useAuth } from '../../components/AuthProvider';

const PROTOCOLS = [
  { id: 'nostr', label: 'Nostr', emoji: '⚡', color: '#8e30eb', desc: 'Decentralized notes' },
  {
    id: 'farcaster',
    label: 'Farcaster',
    emoji: '🟣',
    color: '#8a63d2',
    desc: 'Sufficiently decentralized',
  },
  { id: 'lens', label: 'Lens', emoji: '🌿', color: '#abfe2c', desc: 'User-owned graph' },
  { id: 'bluesky', label: 'Bluesky', emoji: '🦋', color: '#1185fe', desc: 'AT Protocol' },
  { id: 'mastodon', label: 'Mastodon', emoji: '🐘', color: '#6364ff', desc: 'Fediverse' },
  { id: 'reddit', label: 'Reddit', emoji: '🔴', color: '#ff4500', desc: 'Reddit feeds' },
  { id: 'rss', label: 'News', emoji: '📰', color: '#ffa500', desc: '150+ RSS sources' },
  { id: 'threads', label: 'Threads', emoji: '🧵', color: '#888', desc: 'Meta threads' },
] as const;

export default function HomePage() {
  const { signedInProtocols, ready, openSignIn, openCompose } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mb-4 flex justify-center">
          <Image
            src="/icon.svg"
            alt="DegenFeed"
            width={80}
            height={80}
            className="h-20 w-20 drop-shadow-[0_0_24px_rgba(34,197,94,0.4)]"
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          The social feed of <span className="gradient-text">web3</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Pick a network. Browse, search, and cross-post everywhere.
        </p>
      </div>

      {/* Protocol grid — single click into any feed */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PROTOCOLS.map((p) => (
          <a
            key={p.id}
            href={`/home/${p.id}`}
            className="card-hover group flex flex-col items-center gap-2 p-4 text-center"
            style={{ borderColor: `${p.color}33` }}
          >
            <span className="text-3xl transition-transform group-hover:scale-110">{p.emoji}</span>
            <span className="text-sm font-semibold text-white" style={{ color: p.color }}>
              {p.label}
            </span>
            <span className="text-[10px] text-gray-600">{p.desc}</span>
          </a>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <a href="/news" className="btn-secondary text-sm">
          📰 News
        </a>
        <a href="/newsletter" className="btn-secondary text-sm">
          📬 Daily Digest
        </a>
        {hasSignedIn ? (
          <button type="button" onClick={openCompose} className="btn-primary text-sm">
            ✏️ Compose
          </button>
        ) : (
          <button type="button" onClick={openSignIn} className="btn-primary text-sm">
            🔑 Sign In
          </button>
        )}
      </div>

      {/* Trending niches — one click into a feed */}
      <div className="card">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
          Browse by Topic
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'crypto', label: 'Crypto', color: '#f59e0b' },
            { id: 'bitcoin', label: 'Bitcoin', color: '#f7931a' },
            { id: 'ethereum', label: 'Ethereum', color: '#627eea' },
            { id: 'solana', label: 'Solana', color: '#14f195' },
            { id: 'defi', label: 'DeFi', color: '#6366f1' },
            { id: 'ai', label: 'AI', color: '#06b6d4' },
            { id: 'nft', label: 'NFTs', color: '#ec4899' },
            { id: 'regulation', label: 'Regulation', color: '#ef4444' },
            { id: 'security', label: 'Security', color: '#dc2626' },
            { id: 'macro', label: 'Macro', color: '#10b981' },
          ].map((n) => (
            <a
              key={n.id}
              href={`/home/${n.id}`}
              className="rounded-full border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-degen-500/50 hover:text-white"
            >
              #{n.label}
            </a>
          ))}
        </div>
      </div>

      {/* Status footer */}
      <div className="mt-8 text-center">
        <p className="text-[10px] text-gray-700">
          No account required to browse · Zero cookies · Zero tracking · MIT licensed
        </p>
      </div>
    </div>
  );
}
