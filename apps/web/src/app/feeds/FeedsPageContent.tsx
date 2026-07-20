'use client';

import type { CustomFeed } from '@degenfeed/types';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

const FeedBuilderModalDynamic = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.FeedBuilderModal })),
  { ssr: false, loading: () => null },
);

// === Constants ================================================

const SOURCE_EMOJIS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  mastodon: '🐘',
  threads: '🧵',
  reddit: '🔴',
  rss: '📰',
  lemmy: '🌲',
  peertube: '📺',
  youtube: '▶️',
};

const SOURCE_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  reddit: 'Reddit',
  rss: 'RSS',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  youtube: 'YouTube',
};

type Tab = 'my-feeds' | 'public';

function toast(kind: 'success' | 'error' | 'info', message: string) {
  window.dispatchEvent(new CustomEvent('df-toast', { detail: { kind, message } }));
}

// === Feed Card ================================================

function FeedCard({
  feed,
  onTogglePin,
  onDelete,
}: {
  feed: CustomFeed;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 backdrop-blur-xl transition-all hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{feed.title}</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{feed.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {feed.sources?.map((src) => (
              <span
                key={src}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
              >
                {SOURCE_EMOJIS[src] || '📡'} {SOURCE_LABELS[src] || src}
              </span>
            ))}
            {feed.isPinned && (
              <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                Pinned
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePin(feed.id)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            {feed.isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(feed.id)}
            className="rounded-lg border border-red-900/50 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-950/30 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// === Public Feed Card =========================================

function PublicFeedCard({ feed }: { feed: CustomFeed }) {
  return (
    <Link
      href={`/feeds/${feed.id}`}
      className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 backdrop-blur-xl transition-all hover:border-degen-500/30 hover:shadow-[0_0_20px_-8px_rgba(34,197,94,0.1)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{feed.title}</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{feed.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {feed.sources?.map((src) => (
              <span
                key={src}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
              >
                {SOURCE_EMOJIS[src] || '📡'} {SOURCE_LABELS[src] || src}
              </span>
            ))}
            <span className="text-[10px] text-[var(--color-muted)]">
              by {feed.authorId?.slice(0, 8)}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-1">
          →
        </span>
      </div>
    </Link>
  );
}

// === Main Page ================================================

export default function FeedsPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [tab, setTab] = useState<Tab>('my-feeds');
  const [feeds, setFeeds] = useState<CustomFeed[]>([]);
  const [publicFeeds, setPublicFeeds] = useState<CustomFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      const [myRes, publicRes] = await Promise.all([
        fetch('/api/feeds', { credentials: 'include' }),
        fetch('/api/feeds/public'),
      ]);
      if (myRes.ok) setFeeds((await myRes.json()).feeds ?? []);
      if (publicRes.ok) setPublicFeeds((await publicRes.json()).feeds ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
    pollRef.current = setInterval(fetchFeeds, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchFeeds]);

  const handleTogglePin = useCallback(
    async (id: string) => {
      const feed = feeds.find((f) => f.id === id);
      if (!feed) return;
      try {
        const res = await fetch(`/api/feeds/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isPinned: !feed.isPinned }),
        });
        if (res.ok) toast('success', feed.isPinned ? 'Unpinned' : 'Pinned');
        fetchFeeds();
      } catch {
        toast('error', 'Failed to update feed');
      }
    },
    [feeds, fetchFeeds],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast('success', 'Feed deleted');
          fetchFeeds();
        } else toast('error', 'Failed to delete');
      } catch {
        toast('error', 'Failed to delete');
      }
    },
    [fetchFeeds],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-fg)]">Custom Feeds</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Build and manage your own curated feeds
          </p>
        </div>
        <button
          type="button"
          onClick={() => (hasSignedIn ? setShowBuilder(true) : openSignIn())}
          className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-degen-400 transition-colors"
        >
          + New Feed
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(['my-feeds', 'public'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t
                ? 'bg-degen-500/15 text-degen-400 shadow-[0_0_12px_-4px_rgba(34,197,94,0.3)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
            }`}
          >
            {t === 'my-feeds' ? 'My Feeds' : 'Public Feeds'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : tab === 'my-feeds' ? (
        feeds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
            <p className="text-sm text-[var(--color-muted)]">No custom feeds yet.</p>
            <button
              type="button"
              onClick={() => setShowBuilder(true)}
              className="mt-3 text-sm font-medium text-degen-400 hover:text-degen-300"
            >
              Create your first feed →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {feeds
              .filter((f) => f.isPinned)
              .map((feed) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDelete}
                />
              ))}
            {feeds
              .filter((f) => !f.isPinned)
              .map((feed) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDelete}
                />
              ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {publicFeeds.map((feed) => (
            <PublicFeedCard key={feed.id} feed={feed} />
          ))}
          {publicFeeds.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
              <p className="text-sm text-[var(--color-muted)]">No public feeds yet.</p>
            </div>
          )}
        </div>
      )}

      {showBuilder && (
        <FeedBuilderModalDynamic
          open={showBuilder}
          onClose={() => setShowBuilder(false)}
          onCreated={() => {
            setShowBuilder(false);
            fetchFeeds();
          }}
        />
      )}
    </div>
  );
}
