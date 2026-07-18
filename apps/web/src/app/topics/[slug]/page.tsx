'use client';

import { ErrorBoundary, getProtocolColor } from '@degenfeed/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface UnifiedPost {
  id: string;
  protocol: string;
  text: string;
  createdAt: number;
  author: {
    id: string;
    displayName: string;
    handle?: string;
    avatarUrl?: string;
  };
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
  niches: string[];
  image?: string | null;
}

// ─── Topic Metadata ─────────────────────────────────────────────────────────

const TOPIC_META: Record<
  string,
  { emoji: string; color: string; label: string; description: string }
> = {
  bitcoin: {
    emoji: '\u20BF',
    color: '#f7931a',
    label: 'Bitcoin',
    description:
      'Bitcoin: the original cryptocurrency. News, analysis, and discussion about BTC.',
  },
  ethereum: {
    emoji: '\u039E',
    color: '#627eea',
    label: 'Ethereum',
    description:
      'Ethereum ecosystem: L2s, DeFi, NFTs, and smart contracts.',
  },
  solana: {
    emoji: '\u25C9',
    color: '#14f195',
    label: 'Solana',
    description:
      'Solana: high-performance blockchain for scalable dApps.',
  },
  defi: {
    emoji: '\uD83D\uDCCA',
    color: '#6366f1',
    label: 'DeFi',
    description:
      'Decentralized finance: lending, DEXs, yield, and liquidity.',
  },
  nft: {
    emoji: '\uD83D\uDDBC',
    color: '#ec4899',
    label: 'NFT',
    description:
      'Non-fungible tokens: digital art, collectibles, and culture.',
  },
  ai: {
    emoji: '\uD83E\uDD16',
    color: '#06b6d4',
    label: 'AI',
    description:
      'Artificial intelligence: LLMs, agents, and crypto AI.',
  },
  regulation: {
    emoji: '\u2696\uFE0F',
    color: '#ef4444',
    label: 'Regulation',
    description:
      'Crypto regulation: SEC, CFTC, policy, and compliance.',
  },
  security: {
    emoji: '\uD83D\uDD12',
    color: '#dc2626',
    label: 'Security',
    description:
      'Crypto security: audits, hacks, and best practices.',
  },
  memes: {
    emoji: '\uD83D\uDE02',
    color: '#f59e0b',
    label: 'Memes',
    description:
      'Crypto memes, degen culture, and viral content.',
  },
  privacy: {
    emoji: '\uD83D\uDC41\uFE0F',
    color: '#a855f7',
    label: 'Privacy',
    description:
      'Privacy coins, zero-knowledge proofs, and anonymous tech.',
  },
  gaming: {
    emoji: '\uD83C\uDFAE',
    color: '#22d3ee',
    label: 'Gaming',
    description:
      'Web3 gaming, GameFi, and metaverse.',
  },
  layer2: {
    emoji: '\u26D3\uFE0F',
    color: '#8b5cf6',
    label: 'Layer 2',
    description:
      'Layer 2 scaling: rollups, sidechains, and state channels.',
  },
  crypto: {
    emoji: '\u20BF',
    color: '#f59e0b',
    label: 'Crypto',
    description:
      'General cryptocurrency news, analysis, and discussion.',
  },
  macro: {
    emoji: '\uD83D\uDCC8',
    color: '#10b981',
    label: 'Macro',
    description:
      'Macroeconomic trends, Fed policy, and global markets.',
  },
  stablecoin: {
    emoji: '\uD83D\uDCB5',
    color: '#22c55e',
    label: 'Stablecoin',
    description:
      'Stablecoins: USDC, USDT, DAI, and algorithmic stablecoins.',
  },
};

const RELATED_TOPICS: Record<string, string[]> = {
  bitcoin: ['crypto', 'ethereum', 'mining', 'regulation'],
  ethereum: ['defi', 'nft', 'layer2', 'bitcoin'],
  solana: ['defi', 'nft', 'gaming', 'crypto'],
  defi: ['ethereum', 'solana', 'layer2', 'stablecoin'],
  nft: ['ethereum', 'solana', 'gaming', 'ai'],
  ai: ['defi', 'crypto', 'gaming', 'privacy'],
  regulation: ['bitcoin', 'security', 'crypto', 'defi'],
  security: ['privacy', 'crypto', 'defi', 'ethereum'],
  privacy: ['security', 'crypto', 'bitcoin', 'monero'],
  gaming: ['nft', 'solana', 'ai', 'defi'],
  memes: ['crypto', 'bitcoin', 'solana', 'defi'],
  layer2: ['ethereum', 'defi', 'nft', 'solana'],
};

const DEFAULT_RELATED = ['crypto', 'defi', 'ethereum', 'bitcoin'];

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function getDefaultMeta(slug: string): {
  emoji: string;
  color: string;
  label: string;
  description: string;
} {
  return {
    emoji: '#',
    color: '#888',
    label: slug.charAt(0).toUpperCase() + slug.slice(1),
    description: `Posts about ${slug} across all social protocols.`,
  };
}

// ─── Post Row ──────────────────────────────────────────────────────────────

function PostRow({
  post,
  onClick,
}: {
  post: UnifiedPost;
  onClick: (id: string) => void;
}) {
  const protocolColor = getProtocolColor(post.protocol);
  return (
    <button
      type="button"
      onClick={() => onClick(post.id)}
      className="card-hover flex w-full items-start gap-3 p-4 text-left transition-colors"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
        style={{ backgroundColor: `${protocolColor}22` }}
      >
        {post.author.avatarUrl ? (
          <Image
            src={post.author.avatarUrl}
            alt={post.author.displayName}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          post.author.displayName[0]?.toUpperCase() || '?'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="truncate font-semibold text-[var(--color-fg)]">
            {post.author.displayName}
          </span>
          {post.author.handle && (
            <span className="truncate text-[var(--color-muted)]">
              @{post.author.handle}
            </span>
          )}
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              backgroundColor: `${protocolColor}18`,
              color: protocolColor,
            }}
          >
            {post.protocol}
          </span>
          <span className="ml-auto text-[var(--color-muted)]">
            {formatTime(post.createdAt)}
          </span>
        </div>
        <p className="mt-1 line-clamp-3 text-sm text-[var(--color-muted)]">
          {stripHtml(post.text)}
        </p>
        {post.image && (
          <Image
            src={post.image}
            alt={`Post image for topic ${params?.slug || 'crypto'}`}
            width={320}
            height={180}
            className="mt-2 max-h-32 w-full rounded-lg object-cover"
          />
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
          <span>&#9829; {post.metrics.likes}</span>
          <span>&#8631; {post.metrics.reposts}</span>
          <span>&#9998; {post.metrics.replies}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function TopicPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug.toLowerCase() : '';

  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [followed, setFollowed] = useState(false);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();

  const meta = TOPIC_META[slug] ?? getDefaultMeta(slug);
  const relatedTopics = RELATED_TOPICS[slug] ?? DEFAULT_RELATED;

  const fetchPosts = useCallback(async () => {
    setState('loading');
    setError(undefined);
    try {
      const res = await fetch(`/api/feed/category/${encodeURIComponent(slug)}?limit=50`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = (await res.json()) as { data?: UnifiedPost[]; meta?: { total?: number } };
      const items = data.data ?? [];
      setPosts(items);
      setState(items.length > 0 ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
      setState('error');
    }
  }, [slug]);

  useEffect(() => {
    if (slug) fetchPosts();
  }, [slug, fetchPosts]);

  const handlePostClick = useCallback((id: string) => {
    window.location.href = `/post/${encodeURIComponent(id)}`;
  }, []);

  const toggleFollow = useCallback(() => {
    setFollowed((prev) => !prev);
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-[var(--color-muted)]">
          <Link href="/discover" className="hover:text-[var(--color-fg)] transition-colors">
            Discover
          </Link>
          <span className="mx-1">/</span>
          <span style={{ color: meta.color }}>{meta.label}</span>
        </nav>

        {/* Hero */}
        <div
          className="relative mb-8 overflow-hidden rounded-2xl border p-6 backdrop-blur-xl"
          style={{
            borderColor: `${meta.color}20`,
            backgroundColor: `${meta.color}05`,
          }}
        >
          {/* Accent glow */}
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: meta.color }}
          />

          <div className="relative flex items-start gap-4">
            {/* Icon */}
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ backgroundColor: `${meta.color}18` }}
              aria-hidden="true"
            >
              {meta.emoji}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">{meta.label}</h1>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{meta.description}</p>
              <div className="mt-3 flex items-center gap-4">
                {posts.length > 0 && (
                  <span className="text-xs text-[var(--color-muted)]">
                    {formatCount(posts.length)} posts
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleFollow}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    followed
                      ? 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                      : 'text-white'
                  }`}
                  style={{
                    backgroundColor: followed ? undefined : meta.color,
                  }}
                >
                  {followed ? 'Following' : 'Follow topic'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Related Topics */}
        {relatedTopics.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Related Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedTopics.map((related) => {
                const relatedMeta = TOPIC_META[related] ?? getDefaultMeta(related);
                return (
                  <Link
                    key={related}
                    href={`/t/${related}`}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-105"
                    style={{
                      backgroundColor: `${relatedMeta.color}15`,
                      color: relatedMeta.color,
                    }}
                  >
                    <span>{relatedMeta.emoji}</span>
                    <span>{relatedMeta.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Posts Feed */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Posts about {meta.label}
          </h2>

          {state === 'loading' && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card flex animate-pulse items-start gap-3 p-4">
                  <div className="h-10 w-10 rounded-full bg-[var(--color-overlay)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-[var(--color-overlay)]" />
                    <div className="h-3 w-full rounded bg-[var(--color-overlay)]" />
                    <div className="h-3 w-3/4 rounded bg-[var(--color-overlay)]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
              <p className="mb-2 text-sm text-red-400">{error || 'Failed to load posts'}</p>
              <button
                type="button"
                onClick={fetchPosts}
                className="btn-primary text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {state === 'empty' && (
            <div className="card py-12 text-center">
              <span className="mb-3 block text-3xl">{meta.emoji}</span>
              <p className="text-sm text-[var(--color-muted)]">
                No posts about {meta.label} yet.
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Be the first to post about {meta.label} across the open social graph.
              </p>
            </div>
          )}

          {state === 'loaded' && posts.length > 0 && (
            <div className="space-y-2">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} onClick={handlePostClick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
