'use client';

/**
 * DegenFeed — The Web3 Social Universe.
 *
 * We're fighting for data independence, creator content control,
 * and a space where creators can actually own their content and their audience.
 * One app. 44 protocols. Your data, never sold.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LiveTicker } from '../components/hero/LiveTicker';
import { CTASection } from '../components/landing/CTASection';
import { FeatureGrid } from '../components/landing/FeatureGrid';
import { HeroSection } from '../components/landing/HeroSection';
import { ProtocolShowcase } from '../components/landing/ProtocolShowcase';
import { StatsBar } from '../components/landing/StatsBar';
import { ProtocolConnectFlow } from '../components/ProtocolConnectFlow';
import { useProtocolConnections } from '../hooks/useProtocolConnections';

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
  {
    id: '1',
    name: 'Alice',
    handle: 'alice.eth',
    protocol: 'farcaster',
    followers: '12.4K',
    avatar: 'A',
    badge: '🏆 Top Creator',
  },
  {
    id: '2',
    name: 'Bob',
    handle: 'bob@hachyderm.io',
    protocol: 'mastodon',
    followers: '8.2K',
    avatar: 'B',
    badge: '🔥 Trending',
  },
  {
    id: '3',
    name: 'Carol',
    handle: 'carol.bsky.social',
    protocol: 'bluesky',
    followers: '15.7K',
    avatar: 'C',
    badge: '✨ Rising Star',
  },
  {
    id: '4',
    name: 'Dave',
    handle: 'npub1dave',
    protocol: 'nostr',
    followers: '6.9K',
    avatar: 'D',
    badge: '⚡ Zap King',
  },
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
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    reddit: 'Reddit',
    peertube: 'PeerTube',
    pixelfed: 'PixelFed',
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-[var(--color-fg)]">{item.author}</span>
            <span
              className="protocol-badge"
              style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
            >
              {item.protocol}
            </span>
          </div>
        </div>
        <span className="text-xs text-[var(--color-muted)]">{item.time}</span>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-[var(--color-fg)]">{item.text}</p>

      <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <button type="button" className="post-action gap-1.5" aria-label="Like">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          </svg>
          {item.likes}
        </button>
        <button type="button" className="post-action gap-1.5" aria-label="Repost">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {item.reposts}
        </button>
        <button type="button" className="post-action gap-1.5" aria-label="Reply">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
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
          <span className="truncate text-sm font-bold text-[var(--color-fg)]">{creator.name}</span>
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
        className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black"
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
  const { connectedCount, connections } = useProtocolConnections();
  const [connectOpen, setConnectOpen] = useState(false);
  const feedPreview = useMemo(() => FEED_PREVIEW.sort(() => Math.random() - 0.5).slice(0, 4), []);

  return (
    <div className="relative min-h-screen">
      {/* Background glow layers */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="bg-cyber absolute inset-0" />
        <div className="bg-noise" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1100px] px-4">
        {/* ════════════ HERO SECTION (Redesigned) ════════════ */}
        <HeroSection />

        {/* ════════════ LIVE TICKER ════════════ */}
        <section className="mb-8">
          <div
            className="w-full rounded-xl border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
          >
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <span className="live-badge text-[10px]">Live</span>
              <span className="text-xs font-semibold text-[var(--color-fg)]">
                What&apos;s Hot Right Now
              </span>
            </div>
            <LiveTicker />
          </div>
        </section>

        {/* ════════════ FEATURE GRID ════════════ */}
        <FeatureGrid />

        {/* ════════════ PROTOCOL SHOWCASE ════════════ */}
        <ProtocolShowcase />

        {/* ════════════ STATS BAR ════════════ */}
        <StatsBar />

        {/* ════════════ TRENDING + STATS BENTO ════════════ */}
        <section className="mb-12 mt-8">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Your Networks */}
            <div
              className="hover-lift rounded-2xl border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-fg)]">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                >
                  ⚡
                </span>
                Your Networks
              </h3>
              <div className="space-y-2.5">
                {Object.entries(connections)
                  .slice(0, 6)
                  .map(([id, conn]) => (
                    <div key={id} className="flex items-center gap-2.5">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{
                          background: `${conn.color}18`,
                          color: conn.color,
                          opacity: conn.connected ? 1 : 0.4,
                        }}
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
              className="hover-lift rounded-2xl border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-fg)]">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                  style={{ background: 'rgba(249,24,128,0.12)', color: '#f91880' }}
                >
                  🔥
                </span>
                Trending
              </h3>
              <div className="space-y-2">
                {TRENDING_TOPICS.map((t) => (
                  <div
                    key={t.topic}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-fg)]">
                          {t.topic}
                        </span>
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
              className="hover-lift rounded-2xl border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-fg)]">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                  style={{ background: 'rgba(0,186,124,0.12)', color: '#00ba7c' }}
                >
                  📊
                </span>
                Platform Stats
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Protocols Supported', value: '44+' },
                  { label: 'Active Sources', value: '468' },
                  { label: 'Daily Active Users', value: '2,847' },
                  { label: 'Posts Indexed', value: '10,427' },
                  { label: 'Your Protocols', value: `${connectedCount}` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
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
            <h2
              className="text-xl font-bold text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
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
            <h2
              className="text-xl font-bold text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
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

        {/* ════════════ CTA SECTION (Redesigned) ════════════ */}
        <CTASection />

        {/* ════════════ MISSION STATEMENT ════════════ */}
        <div
          className="mb-8 rounded-2xl border p-6 text-center"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        >
          <p
            className="text-base italic leading-relaxed md:text-lg"
            style={{ color: 'var(--color-fg-secondary)' }}
          >
            &ldquo;DegenFeed exists to unify the fragmented decentralized social web. We don&apos;t
            own your content &mdash; we give you the tools to own it yourself.&rdquo;
          </p>
        </div>

        {/* ════════════ FOOTER ════════════ */}
        <footer
          className="border-t pb-12 pt-8 text-center text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          <nav className="mb-3 flex flex-wrap justify-center gap-4">
            <Link href="/about" className="hover:underline">
              About
            </Link>
            <Link href="/features" className="hover:underline">
              Features
            </Link>
            <Link href="/docs" className="hover:underline">
              Docs
            </Link>
            <Link href="/faq" className="hover:underline">
              FAQ
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <a
              href="https://github.com/rugmunchmedia/degenfeed"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
          </nav>
          <p>
            &copy; {new Date().getFullYear()} DegenFeed &mdash; a Rug Munch Media LLC product. Open
            source. Free forever. Your data, never sold.{' '}
            <span className="hidden sm:inline">No account required to browse.</span>
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
