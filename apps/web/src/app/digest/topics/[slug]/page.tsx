'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// === Types =================================================================

interface TopicPost {
  id: string;
  protocol: string;
  text: string;
  createdAt: number;
  author: { displayName: string; avatarUrl?: string };
  metrics: { likes: number; reposts: number; replies: number };
  niches: string[];
}

interface TopicDigest {
  topic: string;
  posts: TopicPost[];
  videoCount: number;
  communityCount: number;
  newsletterCount: number;
}

// === Topic Metadata =========================================================

const TOPIC_META: Record<
  string,
  { label: string; emoji: string; color: string; description: string }
> = {
  bitcoin: {
    label: 'Bitcoin',
    emoji: '₿',
    color: '#f7931a',
    description: 'Bitcoin, BTC, mining, layer 2s, and the broader Bitcoin ecosystem.',
  },
  ethereum: {
    label: 'Ethereum',
    emoji: '⟠',
    color: '#627eea',
    description: 'Ethereum, L2s, rollups, staking, and the EVM ecosystem.',
  },
  solana: {
    label: 'Solana',
    emoji: '◎',
    color: '#9945ff',
    description: 'Solana, validator ecosystem, DePIN, and high-performance blockchain.',
  },
  defi: {
    label: 'DeFi',
    emoji: '🏦',
    color: '#10b981',
    description: 'Lending, borrowing, DEXs, yield farming, and decentralized finance protocols.',
  },
  nft: {
    label: 'NFTs',
    emoji: '🖼️',
    color: '#ec4899',
    description: 'Digital collectibles, art, music, and NFT marketplace trends.',
  },
  ai: {
    label: 'AI',
    emoji: '🤖',
    color: '#8b5cf6',
    description: 'Artificial intelligence, machine learning, LLMs, AI agents, and crypto AI.',
  },
  memecoin: {
    label: 'Memes',
    emoji: '🐸',
    color: '#22c55e',
    description: 'Meme coins, community tokens, and viral crypto culture.',
  },
  regulation: {
    label: 'Regulation',
    emoji: '⚖️',
    color: '#f59e0b',
    description: 'Crypto regulation, SEC, MiCA, policy developments, and compliance.',
  },
  macro: {
    label: 'Macro',
    emoji: '📊',
    color: '#3b82f6',
    description: 'Macroeconomic trends, Fed policy, inflation, and global markets.',
  },
  security: {
    label: 'Security',
    emoji: '🛡️',
    color: '#ef4444',
    description: 'Smart contract security, audits, hacks, and exploit analysis.',
  },
  layer2: {
    label: 'Layer 2',
    emoji: '⚡',
    color: '#a855f7',
    description: 'Layer 2 scaling, rollups, sidechains, and interoperability.',
  },
  trading: {
    label: 'Trading',
    emoji: '📈',
    color: '#06b6d4',
    description: 'Trading strategies, TA, market analysis, and trading bots.',
  },
};

const TOPIC_NICHES = Object.keys(TOPIC_META);

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// === Topic Page ============================================================

export default function TopicDigestPage() {
  const params = useParams();
  const _router = useRouter();
  const slug = (params?.slug as string)?.toLowerCase() ?? '';
  const meta = TOPIC_META[slug];

  const [digest, setDigest] = useState<TopicDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  const fetchTopic = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feed/news?category=${slug}&limit=20`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = (await res.json()) as { data?: TopicPost[] };
      const posts = (data.data ?? []).slice(0, 20);

      setDigest({
        topic: slug,
        posts,
        videoCount: posts.filter((p) => p.protocol === 'youtube' || p.protocol === 'peertube')
          .length,
        communityCount: Math.min(posts.length, 5),
        newsletterCount: Math.min(posts.length, 3),
      });
    } catch {
      setDigest(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug && TOPIC_NICHES.includes(slug)) fetchTopic();
    else setLoading(false);
  }, [slug, fetchTopic]);

  // Follow topic
  const toggleFollow = useCallback(async () => {
    setFollowing((f) => !f);
    try {
      // Persist to preferences
      await fetch('/api/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          preferredNiches: following ? { [slug]: false } : { [slug]: true },
        }),
      });
    } catch {
      // Rollback on error
      setFollowing((f) => !f);
    }
  }, [slug, following]);

  if (!slug || !meta) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-2">Topic not found</h2>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          {slug ? `"${slug}" is not a tracked topic.` : 'No topic specified.'}
        </p>
        <Link href="/digest" className="text-degen-400 hover:text-degen-300 text-sm">
          ← Back to Digest
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/digest"
          className="text-xs text-[var(--color-muted)] hover:text-degen-400 transition-colors"
        >
          ← Digest
        </Link>
      </div>

      {/* Topic Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">{meta.label}</h1>
              <p className="text-sm text-[var(--color-muted)] mt-1">{meta.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleFollow}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              following
                ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
                : 'bg-[var(--color-muted-bg)] text-[var(--color-muted)] border border-[var(--color-border)] hover:border-degen-400/40'
            }`}
          >
            {following ? '✓ Following' : '+ Follow topic'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg font-bold text-[var(--color-fg)]">
            {digest?.posts.length ?? 0}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">Posts today</div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg font-bold text-[var(--color-fg)]">{digest?.videoCount ?? 0}</div>
          <div className="text-[10px] text-[var(--color-muted)]">Videos</div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg font-bold text-[var(--color-fg)]">
            {digest?.communityCount ?? 0}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">Discussions</div>
        </div>
      </div>

      {/* Posts */}
      <h2 className="text-lg font-bold text-[var(--color-fg)] mb-3">📰 Top Posts</h2>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-[var(--color-muted-bg)] rounded-xl" />
          ))}
        </div>
      ) : digest && digest.posts.length > 0 ? (
        <div className="space-y-2">
          {digest.posts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${encodeURIComponent(post.id)}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 hover:border-degen-400/40 transition-all"
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-[10px] text-[var(--color-muted)] uppercase">
                  {post.protocol}
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">·</span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  {post.author.displayName}
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">·</span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  {formatTime(post.createdAt)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-fg)] line-clamp-2">{post.text}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-muted)]">
                <span>❤️ {post.metrics.likes}</span>
                <span>🔄 {post.metrics.reposts}</span>
                <span>💬 {post.metrics.replies}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-[var(--color-muted)]">
          No posts found for this topic today.
        </div>
      )}

      {/* More actions */}
      <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link href={`/search?q=${slug}`} className="text-degen-400 hover:text-degen-300">
            🔍 Search &quot;{meta.label}&quot;
          </Link>
          <Link href="/digest" className="text-degen-400 hover:text-degen-300">
            ← Back to Digest
          </Link>
        </div>
      </div>
    </div>
  );
}
