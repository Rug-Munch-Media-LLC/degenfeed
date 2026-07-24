'use client';

/**
 * DegenFeed — The Web3 Social Universe.
 *
 * A stunning, addictive landing page that feels like Twitter/X, Threads,
 * and Bluesky had a web3 baby. Animated hero with orbiting protocol logos,
 * live ticker, featured creators, bento grid, and smooth scroll animations.
 */

import Link from 'next/link';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useProtocolConnections } from '../hooks/useProtocolConnections';
import { ProtocolConnectFlow } from '../components/ProtocolConnectFlow';
import { OrbitingProtocols } from '../components/hero/OrbitingProtocols';
import { LiveTicker } from '../components/hero/LiveTicker';

/* ─── Types ──────────────────────────────────────────────────────── */

interface FeedPreviewItem {
  id: string;
  protocol: string;
  text: string;
  author: string;
  likes: number;
  reposts: number;
  time: string;
}

interface Creator {
  id: string;
  name: string;
  handle: string;
  protocol: string;
  followers: string;
  avatar: string;
  badge?: string;
}

/* ─── Data ───────────────────────────────────────────────────────── */

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: 'var(--color-protocol-nostr)',
  farcaster: 'var(--color-protocol-farcaster)',
  lens: 'var(--color-protocol-lens)',
  bluesky: 'var(--color-protocol-bluesky)',
  mastodon: 'var(--color-protocol-mastodon)',
  reddit: 'var(--color-protocol-reddit)',
  peertube: 'var(--color-protocol-peertube)',
  pixelfed: 'var(--color-protocol-pixelfed)',
  threads: 'var(--color-protocol-threads)',
  youtube: 'var(--color-protocol-youtube)',
};

const FEED_PREVIEW: FeedPreviewItem[] = [
  {
    id: '1',
    protocol: 'farcaster',
    text: 'gm everyone 🌞 just deployed a new creator coin on base. feeling optimistic about on-chain social this cycle.',
    author: 'alice.eth',
    likes: 142,
    reposts: 38,
    time: '12m ago',
  },
  {
    id: '2',
    protocol: 'nostr',
    text: 'nostr relays have been so reliable lately. the decentralized web is real and it works.',
    author: 'npub1...8xk3',
    likes: 89,
    reposts: 22,
    time: '34m ago',
  },
  {
    id: '3',
    protocol: 'bluesky',
    text: "just hit 10k followers on bsky! really loving the community here. thanks for making this place special y'all",
    author: 'builder.bsky.social',
    likes: 234,
    reposts: 67,
    time: '1h ago',
  },
  {
    id: '4',
    protocol: 'mastodon',
    text: 'the fediverse is thriving. migrated my entire blog to activitypub and engagement is up 3x.',
    author: 'chad@hachyderm.io',
    likes: 67,
    reposts: 15,
    time: '2h ago',
  },
  {
    id: '5',
    protocol: 'lens',
    text: 'lens v2 is going to change everything. open action framework + momoka = unbeatable combination',
    author: 'lens/0xdef1',
    likes: 178,
    reposts: 52,
    time: '3h ago',
  },
  {
    id: '6',
    protocol: 'peertube',
    text: 'just uploaded my first 4K video on peertube. the quality is incredible and zero ads.',
    author: 'video.host',
    likes: 95,
    reposts: 28,
    time: '4h ago',
  },
];

const FEATURED_CREATORS: Creator[] = [
  { id: '1', name: 'Alice', handle: 'alice.eth', protocol: 'farcaster', followers: '12.4K', avatar: 'A', badge: '🏆 Top Creator' },
  { id: '2', name: 'Bob', handle: 'bob@hachyderm.io', protocol: 'mastodon', followers: '8.2K', avatar: 'B', badge: '🔥 Trending' },
  { id: '3', name: 'Carol', handle: 'carol.bsky.social', protocol: 'bluesky', followers: '15.7K', avatar: 'C', badge: '✨ Rising Star' },
  { id: '4', name: 'Dave', handle: 'npub1dave', protocol: 'nostr', followers: '6.9K', avatar: 'D', badge: '⚡ Zap King' },
];

const TRENDING_TOPICS = [
  { topic: '#DeFiSummer', posts: '12.4K', protocol: 'farcaster' },
  { topic: 'Solana Ecosystem', posts: '8.2K', protocol: 'reddit' },
  { topic: 'Creator Coins', posts: '5.7K', protocol: 'lens' },
  { topic: 'nostr relays', posts: '4.1K', protocol: 'nostr' },
  { topic: 'AT Protocol', posts: '3.9K', protocol: 'bluesky' },
  { topic: 'ActivityPub', posts: '3.2K', protocol: 'mastodon' },
];

/* ─── Protocol-Color Badge ──────────────────────────────────────── */

function ProtocolBadge({ pid, connected }: { pid: string; connected?: boolean }) {
  const labels: Record<string, string> = {
    nostr: 'Nostr', farcaster: 'Farcaster', lens: 'Lens', bluesky: 'Bluesky',
    mastodon: 'Mastodon', reddit: 'Reddit', peertube: 'PeerTube', pixelfed: 'PixelFed',
  };
  const color = PROTOCOL_COLORS[pid] || 'var(--color-muted)';

  return (
    <span
      className="protocol-badge"
      style={{
        background: connected ? `${color}20` : `${color}10`,
        color: connected ? color : 'var(--color-muted)',
        border: `1px solid ${connected ? `${color}40` : 'var(--color-border)'}`,
        opacity: connected ? 1 : 0.5,
      }}
    >
      {connected && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {labels[pid] || pid}
    </span>
  );
}

/* ─── Feed Preview Card ─────────────────────────────────────────── */

function FeedPreviewCard({ item, index }: { item: FeedPreviewItem; index: number }) {
  const color = PROTOCOL_COLORS[item.protocol] || 'var(--color-accent)';

  return (
    <article
      className="feed-enter group rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.02]"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-card)',
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: `${color}18`, color }}
        >
          {item.protocol.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--color-fg)] truncate">{item.author}</span>
            <span className="protocol-badge" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {item.protocol}
            </span>
          </div>
        </div>
        <span className="text-xs text-[var(--color-muted)]">{item.time}</span>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-[var(--color-fg)]">
        {item.text}
      </p>

      <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <button type="button" className="post-action gap-1.5" aria-label="Like">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          </svg>
          {item.likes}
        </button>
        <button type="button" className="post-action gap-1.5" aria-label="Repost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {item.reposts}
        </button>
        <button type="button" className="post-action gap-1.5" aria-label="Reply">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
        <button type="button" className="post-action gap-1.5" aria-label="Tip">
          ⚡
        </button>
      </div>
    </article>
  );
}

/* ─── Creator Card ──────────────────────────────────────────────── */

function CreatorCard({ creator, index }: { creator: Creator; index: number }) {
  const color = PROTOCOL_COLORS[creator.protocol] || 'var(--color-accent)';

  return (
    <div
      className="feed-enter flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 hover:border-[var(--color-accent)]/30"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-card)',
        animationDelay: `${index * 100}ms`,
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: `${color}20`, color }}
      >
        {creator.avatar}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--color-fg)] truncate">{creator.name}</span>
          {creator.badge && (
            <span className="whitespace-nowrap rounded-full bg-[var(--color-accent-secondary)]/15 px-2 py-0.5 text-[9px] font-semibold text-[var(--color-accent-secondary)]">
              {creator.badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="truncate">{creator.handle}</span>
          <span className="h-1 w-1 rounded-full bg-[var(--color-muted)]" />
          <span>{creator.followers} followers</span>
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all hover:bg-[var(--color-accent)] hover:text-black hover:border-[var(--color-accent)]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}
      >
        Follow
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const { connectedCount, totalCount, connections } = useProtocolConnections();
  const [connectOpen, setConnectOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [liveStats, setLiveStats] = useState({ protocols: 12, posts: 10427, uptime: 99.9 });

  const hasConnections = connectedCount > 0;
  const feedPreview = useMemo(() => FEED_PREVIEW.sort(() => Math.random() - 0.5).slice(0, 4), []);

  // Live-updating stats
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats((s) => ({
        ...s,
        posts: s.posts + Math.floor(Math.random() * 3),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Scroll-based parallax
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Background glow layers */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="bg-cyber absolute inset-0" />
        <div className="bg-noise" />
        {/* Animated ambient glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,255,65,0.08) 0%, transparent 70%)',
            transform: `translateY(${scrollY * 0.15}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1100px] px-4">
        {/* ════════════ HERO SECTION ════════════════ */}
        <section className="relative flex flex-col items-center pt-8 md:pt-16 pb-8 text-center">
          {/* Animated protocol orbit */}
          <div
            className="mb-6 md:mb-8"
            style={{
              transform: `translateY(${scrollY * -0.05}px)`,
              opacity: Math.max(1 - scrollY / 600, 0.4),
            }}
          >
            <OrbitingProtocols />
          </div>

          {/* Tagline */}
          <div className="mb-3 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold mb-4"
              style={{
                borderColor: 'var(--color-accent)',
                background: 'var(--color-accent-soft)',
                color: 'var(--color-accent)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              Live — 12 Protocols Connected
            </span>
            <h1
              className="text-display sm:text-[5rem] md:text-[6rem] font-black leading-[1] tracking-[-0.05em] mb-3"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              <span className="gradient-text">The Web3</span>
              <br />
              Social Universe
            </h1>
            <p
              className="mx-auto max-w-2xl text-lg md:text-xl leading-relaxed"
              style={{ color: 'var(--color-fg-secondary)' }}
            >
              One feed to rule them all. Nostr. Farcaster. Lens. Bluesky. Mastodon.
              <br />
              Cross-post. Tip in crypto. Own your content.
            </p>
          </div>

          {/* Live stats counter */}
          <div
            className="mb-8 flex flex-wrap justify-center gap-6 md:gap-10"
            style={{ color: 'var(--color-muted)' }}
          >
            <div className="text-center">
              <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-accent)' }}>
                {liveStats.protocols}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider">Protocols</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-accent)' }}>
                {liveStats.posts.toLocaleString()}+
              </div>
              <div className="text-xs font-medium uppercase tracking-wider">Posts & Counting</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-accent)' }}>
                {liveStats.uptime}%
              </div>
              <div className="text-xs font-medium uppercase tracking-wider">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-accent)' }}>
                100%
              </div>
              <div className="text-xs font-medium uppercase tracking-wider">Decentralized</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <Link
              href="/feed"
              className="btn-primary text-base px-8 py-3 gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Browse Your Feed
            </Link>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="btn-secondary text-base px-8 py-3 gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {hasConnections ? 'Manage Protocols' : 'Connect Your Protocols'}
            </button>
          </div>

          {/* Protocol connection indicators */}
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {Object.entries(connections).slice(0, 7).map(([id, conn]) => (
              <ProtocolBadge key={id} pid={id} connected={conn.connected} />
            ))}
          </div>

          {/* Live Ticker */}
          <div className="w-full max-w-4xl mt-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <span className="live-badge text-[10px]">Live</span>
              <span className="text-xs font-semibold text-[var(--color-fg)]">What&apos;s Hot Right Now</span>
            </div>
            <LiveTicker />
          </div>
        </section>

        {/* ════════════ TRENDING + STATS BENTO ════════════ */}
        <section className="mb-12">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Your Networks */}
            <div
              className="rounded-2xl border p-5 hover-lift"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-fg)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                  ⚡
                </span>
                Your Networks
              </h3>
              <div className="space-y-2.5">
                {Object.entries(connections).slice(0, 6).map(([id, conn]) => (
                  <div key={id} className="flex items-center gap-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{ background: `${conn.color}18`, color: conn.color, opacity: conn.connected ? 1 : 0.4 }}
                    >
                      {conn.icon}
                    </span>
                    <span className="flex-1 text-xs text-[var(--color-fg)]">{conn.name}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${conn.connected ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-muted)]'}`}
                      style={conn.connected ? { boxShadow: '0 0 6px var(--color-accent)' } : {}}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="mt-4 w-full rounded-xl border border-dashed py-2.5 text-[11px] font-semibold transition-colors hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent-soft)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                + Connect a protocol
              </button>
            </div>

            {/* Trending */}
            <div
              className="rounded-2xl border p-5 hover-lift"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-fg)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs" style={{ background: 'rgba(249,24,128,0.12)', color: '#f91880' }}>
                  🔥
                </span>
                Trending
              </h3>
              <div className="space-y-2">
                {TRENDING_TOPICS.map((t) => (
                  <div key={t.topic}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-fg)]">{t.topic}</span>
                      </div>
                      <span className="text-xs text-[var(--color-muted)]">{t.posts} posts</span>
                    </div>
                    <ProtocolBadge pid={t.protocol} />
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Stats */}
            <div
              className="rounded-2xl border p-5 hover-lift"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-fg)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs" style={{ background: 'rgba(0,186,124,0.12)', color: '#00ba7c' }}>
                  📊
                </span>
                Platform Stats
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Protocols Supported', value: '15+' },
                  { label: 'Active Sources', value: '468' },
                  { label: 'Daily Active Users', value: '2,847' },
                  { label: 'Posts Indexed', value: '10,427' },
                  { label: 'Your Protocols', value: `${connectedCount}` },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <span className="text-xs text-[var(--color-muted)]">{stat.label}</span>
                    <span className="text-sm font-bold text-[var(--color-fg)]">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ WHAT'S HAPPENING ════════════ */}
        <section className="mb-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--color-fg)]" style={{ fontFamily: 'var(--font-heading)' }}>
              What&apos;s happening
            </h2>
            <Link
              href="/feed"
              className="text-sm font-semibold transition-colors hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              View full feed &rarr;
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {feedPreview.map((item, i) => (
              <FeedPreviewCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </section>

        {/* ════════════ FEATURED CREATORS ════════════ */}
        <section className="mb-12">
          <div className="mb-5 flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-fg)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Featured Creators
            </h2>
            <span className="live-badge text-[10px]">Trending</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED_CREATORS.map((creator, i) => (
              <CreatorCard key={creator.id} creator={creator} index={i} />
            ))}
          </div>
        </section>

        {/* ════════════ CONNECT PROTOCOLS BANNER ════════════ */}
        <section
          className="relative mb-12 overflow-hidden rounded-3xl border p-8 md:p-12 text-center"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        >
          {/* Decorative gradient */}
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: 'radial-gradient(ellipse at 30% 50%, var(--color-accent-glow) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, var(--color-accent-secondary-glow) 0%, transparent 60%)',
            }}
          />

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
              <span className="gradient-text">Connect your protocols.</span>
              <br />
              See the universe.
            </h2>
            <p className="mx-auto mb-6 max-w-lg text-sm leading-relaxed" style={{ color: 'var(--color-fg-secondary)' }}>
              Link your accounts across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.
              See everything in one unified feed. Post once, reach everywhere.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {['mastodon', 'bluesky', 'nostr', 'farcaster', 'lens', 'reddit'].map((pid) => (
                <ProtocolBadge key={pid} pid={pid} connected={connections[pid]?.connected} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="btn-primary text-base px-10 py-3.5 gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Get Started
            </button>
          </div>
        </section>

        {/* ════════════ FEATURES GRID ════════════ */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: '✦',
              title: 'Cross-Protocol Posting',
              desc: 'Write once, publish to 15+ protocols. Replies from any network appear in one thread.',
              colour: 'var(--color-accent-glow)',
            },
            {
              icon: '○',
              title: 'Creator Coins',
              desc: 'Deploy your own token on Base and Solana. Anti-bot, anti-whale, anti-rug.',
              colour: 'var(--color-accent-secondary-glow)',
            },
            {
              icon: '▶',
              title: 'Stream Everywhere',
              desc: 'Broadcast to 7 protocols at once. Solo streams, Spaces audio, and live minting.',
              colour: 'var(--color-accent-glow)',
            },
            {
              icon: '⚡',
              title: 'Cross-Chain Tipping',
              desc: 'Tip in ETH, SOL, USDC, or Lightning. 0% platform fees. Unified leaderboard.',
              colour: 'rgba(249,24,128,0.12)',
            },
            {
              icon: '◈',
              title: 'Self-Hosted',
              desc: 'Run your own relays, indexers, and frontend. No one can deplatform you — ever.',
              colour: 'var(--color-accent-glow)',
            },
            {
              icon: '⊞',
              title: '25+ Sources',
              desc: 'Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube, PeerTube, and more.',
              colour: 'var(--color-accent-secondary-glow)',
            },
          ].map((feature, i) => (
            <article
              key={feature.title}
              className="feed-enter rounded-2xl border p-5 transition-all duration-300 hover:border-[var(--color-accent)]/20 hover:scale-[1.02]"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-card)',
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold"
                style={{ background: feature.colour, color: 'var(--color-accent)' }}
              >
                {feature.icon}
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-[var(--color-muted)]">{feature.desc}</p>
            </article>
          ))}
        </section>

        {/* ════════════ FOOTER ════════════ */}
        <footer
          className="border-t pt-8 pb-12 text-center text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          <nav className="mb-3 flex flex-wrap justify-center gap-4">
            <Link href="/about" className="hover:underline">About</Link>
            <Link href="/features" className="hover:underline">Features</Link>
            <Link href="/docs" className="hover:underline">Docs</Link>
            <Link href="/faq" className="hover:underline">FAQ</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <a href="https://github.com/rugmunchmedia/degenfeed" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
          </nav>
          <p>
            &copy; {new Date().getFullYear()} DegenFeed &mdash; a Rug Munch Media LLC product.
            Open source. Free forever. <span className="hidden sm:inline">No account required.</span>
          </p>
        </footer>
      </div>

      {/* Protocol Connect Flow */}
      <ProtocolConnectFlow
        open={connectOpen}
        protocolId={null}
        onClose={() => setConnectOpen(false)}
      />
    </div>
  );
}
