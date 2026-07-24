'use client';

/**
 * DegenFeed Home — Warm welcome landing page.
 *
 * Design: Bento-grid layout with time-based greeting, trending content preview,
 * protocol connection cards, and live feed preview. Warm and inviting.
 */

import { getProtocolColor, getProtocolLabel } from '@degenfeed/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ProtocolConnectFlow } from '../components/ProtocolConnectFlow';
import { WelcomeGreeting } from '../components/WelcomeGreeting';
import { useProtocolConnections } from '../hooks/useProtocolConnections';

/* ─── "What's Happening" feed preview data ─────────────────── */

interface FeedPreviewItem {
  id: string;
  protocol: string;
  text: string;
  author: string;
  likes: number;
  time: string;
}

const FEED_PREVIEW: FeedPreviewItem[] = [
  {
    id: '1',
    protocol: 'farcaster',
    text: 'gm everyone 🌞 just deployed a new creator coin on base. feeling optimistic about on-chain social this cycle.',
    author: 'alice.eth',
    likes: 142,
    time: '12m ago',
  },
  {
    id: '2',
    protocol: 'nostr',
    text: 'nostr relays have been so reliable lately. the decentralized web is real and it works.',
    author: 'npub1...8xk3',
    likes: 89,
    time: '34m ago',
  },
  {
    id: '3',
    protocol: 'bluesky',
    text: "just hit 10k followers on bsky! really loving the community here. thanks for making this place special y'all",
    author: 'builder.bsky.social',
    likes: 234,
    time: '1h ago',
  },
  {
    id: '4',
    protocol: 'mastodon',
    text: 'the fediverse is thriving. migrated my entire blog to activitypub and engagement is up 3x.',
    author: 'chad@hachyderm.io',
    likes: 67,
    time: '2h ago',
  },
  {
    id: '5',
    protocol: 'lens',
    text: 'lens v2 is going to change everything. open action framework + momoka = unbeatable combination',
    author: 'lens/0xdef1',
    likes: 178,
    time: '3h ago',
  },
];

/* ─── Trending topics ──────────────────────────────────────── */

const TRENDING_TOPICS = [
  { topic: '#DeFiSummer', posts: '12.4K', protocol: 'farcaster' },
  { topic: 'Solana Ecosystem', posts: '8.2K', protocol: 'reddit' },
  { topic: 'Creator Coins', posts: '5.7K', protocol: 'lens' },
  { topic: 'nostr', posts: '4.1K', protocol: 'nostr' },
  { topic: 'AT Protocol', posts: '3.9K', protocol: 'bluesky' },
];

/* ─── Trending Card ─────────────────────────────────────────── */

function TrendingCard({
  topic,
  posts,
  protocol,
}: {
  topic: string;
  posts: string;
  protocol: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 transition-all hover:border-degen-500/20 hover:bg-[var(--color-card-hover)]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
            {topic}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
            style={{
              backgroundColor: `${getProtocolColor(protocol)}15`,
              color: getProtocolColor(protocol),
            }}
          >
            {protocol}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {posts} posts
        </span>
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--color-muted)' }}
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

/* ─── Feed Preview Card ─────────────────────────────────────── */

function FeedPreviewCard({ item }: { item: FeedPreviewItem }) {
  return (
    <div className="group rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-md">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
          style={{
            backgroundColor: `${getProtocolColor(item.protocol)}18`,
            color: getProtocolColor(item.protocol),
          }}
        >
          {item.protocol.charAt(0).toUpperCase()}
        </span>
        <span className="text-xs font-medium" style={{ color: getProtocolColor(item.protocol) }}>
          {getProtocolLabel(item.protocol)}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {item.time}
        </span>
      </div>
      <p className="mb-2 text-sm leading-relaxed" style={{ color: 'var(--color-fg)' }}>
        {item.text}
      </p>
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted)' }}>
        <span className="font-medium truncate" style={{ color: 'var(--color-fg)' }}>
          {item.author}
        </span>
        <span className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          </svg>
          {item.likes}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const { connectedCount, totalCount, connections } = useProtocolConnections();
  const [connectOpen, setConnectOpen] = useState(false);

  const hasConnections = connectedCount > 0;

  // Randomize feed preview
  const feedPreview = useMemo(() => FEED_PREVIEW.sort(() => Math.random() - 0.5).slice(0, 3), []);

  return (
    <div className="landing-page">
      {/* Background glow */}
      <div className="home-bg-glow" aria-hidden="true" />

      <div className="mx-auto max-w-[1000px] px-4 py-8 md:py-16">
        {/* ══════════════ WELCOME ══════════════ */}
        <section className="mb-12">
          <WelcomeGreeting connectedProtocols={connectedCount} totalProtocols={totalCount} />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/feed"
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-bold text-black transition-all hover:bg-[var(--color-accent)]/90 hover:shadow-lg hover:shadow-[var(--color-accent)]/20"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Browse Your Feed
            </Link>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-3 text-sm font-semibold transition-all hover:border-degen-500/30 hover:bg-[var(--color-card-hover)]"
              style={{ color: 'var(--color-fg)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {hasConnections ? 'Manage Protocols' : 'Connect Protocols'}
            </button>
          </div>
        </section>

        {/* ══════════════ VALUE PROPOSITION ══════════════ */}
        <section className="mb-12">
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 md:p-8">
            <h2
              className="mb-2 text-2xl font-bold"
              style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
            >
              All your decentralized social networks in one place.
            </h2>
            <p
              className="max-w-2xl text-sm leading-relaxed"
              style={{ color: 'var(--color-muted)' }}
            >
              DegenFeed brings together Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, and RSS
              into one unified timeline. Post once, reach everywhere. No platform fees. No one can
              deplatform you.
            </p>
          </div>
        </section>

        {/* ══════════════ BENTO GRID ══════════════ */}
        <div className="mb-12 grid gap-4 md:grid-cols-3">
          {/* Protocol connection status (span 1) */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3
              className="mb-3 flex items-center gap-2 text-sm font-bold"
              style={{ color: 'var(--color-fg)' }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-degen-500/15 text-xs text-degen-400">
                &#9889;
              </span>
              Your Networks
            </h3>
            <div className="space-y-2">
              {Object.entries(connections)
                .slice(0, 5)
                .map(([id, conn]) => (
                  <div key={id} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${conn.connected ? '' : 'opacity-40'}`}
                      style={{ backgroundColor: `${conn.color}18`, color: conn.color }}
                    >
                      {conn.icon}
                    </span>
                    <span className="flex-1 text-xs" style={{ color: 'var(--color-fg)' }}>
                      {conn.name}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${conn.connected ? 'bg-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.5)]' : 'bg-[var(--color-muted)]'}`}
                    />
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="mt-3 w-full rounded-xl border border-dashed border-[var(--color-glass-border)] py-2 text-[11px] font-semibold transition-colors hover:border-degen-500/30 hover:bg-degen-500/5"
              style={{ color: 'var(--color-muted)' }}
            >
              + Connect a protocol
            </button>
          </div>

          {/* Trending (span 1) */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3
              className="mb-3 flex items-center gap-2 text-sm font-bold"
              style={{ color: 'var(--color-fg)' }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/15 text-xs text-orange-400">
                &#128293;
              </span>
              Trending
            </h3>
            <div className="space-y-2">
              {TRENDING_TOPICS.map((t) => (
                <TrendingCard key={t.topic} {...t} />
              ))}
            </div>
          </div>

          {/* Stats (span 1) */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3
              className="mb-3 flex items-center gap-2 text-sm font-bold"
              style={{ color: 'var(--color-fg)' }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-xs text-blue-400">
                &#9776;
              </span>
              Platform Stats
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Protocols Supported', value: '10+' },
                { label: 'Active Sources', value: '468' },
                { label: 'Creators Waiting', value: '1,247' },
                { label: 'Your Protocols', value: `${connectedCount}` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between border-b border-[var(--color-glass-border)] pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {stat.label}
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════ "WHAT'S HAPPENING" FEED ══════════════ */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="text-lg font-bold"
              style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
            >
              What&apos;s happening
            </h2>
            <Link
              href="/feed"
              className="text-xs font-semibold transition-colors hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              View full feed &rarr;
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {feedPreview.map((item) => (
              <FeedPreviewCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* ══════════════ PROTOCOL ONBOARDING ══════════════ */}
        <section className="mb-12 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 md:p-8">
          <div className="flex flex-col items-center text-center md:flex-row md:text-left md:gap-8">
            <div className="mb-4 md:mb-0 md:flex-1">
              <h2
                className="mb-2 text-xl font-bold"
                style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
              >
                Connect your protocols
              </h2>
              <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                Link your accounts across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. See
                everything in one unified feed.
              </p>
              <div className="flex flex-wrap gap-2">
                {['mastodon', 'bluesky', 'nostr', 'farcaster'].map((pid) => {
                  const conn = connections[pid];
                  if (!conn) return null;
                  const isConnected = conn.connected;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setConnectOpen(true)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${isConnected ? 'bg-degen-500/10 text-degen-400' : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/30'}`}
                    >
                      <span className="h-2 w-2 rounded-full ${isConnected ? 'bg-degen-500' : 'bg-[var(--color-muted)]'}" />
                      {conn.name}
                      {isConnected && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-bold text-black transition-all hover:bg-[var(--color-accent)]/90 hover:shadow-lg"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Get Started
            </button>
          </div>
        </section>

        {/* ══════════════ FOOTER ══════════════ */}
        <footer
          className="border-t border-[var(--color-glass-border)] pt-8 text-center text-xs"
          style={{ color: 'var(--color-muted)' }}
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
            source. Free forever.
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
