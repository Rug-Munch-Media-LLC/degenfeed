'use client';

import type { CustomFeed } from '@degenfeed/types';
import { FeedBuilderModal } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

const FeedBuilderModalDynamic = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.FeedBuilderModal })),
  { ssr: false, loading: () => null },
);

// ─── Constants ────────────────────────────────────────────────

const SOURCE_EMOJIS: Record<string, string> = {
  nostr: '⚡', farcaster: '🟣', lens: '🌿', bluesky: '🦋',
  mastodon: '🐘', threads: '🧵', reddit: '🔴', rss: '📰',
  lemmy: '🌲', peertube: '📺', youtube: '▶️',
};

const SOURCE_LABELS: Record<string, string> = {
  nostr: 'Nostr', farcaster: 'Farcaster', lens: 'Lens', bluesky: 'Bluesky',
  mastodon: 'Mastodon', threads: 'Threads', reddit: 'Reddit', rss: 'RSS',
  lemmy: 'Lemmy', peertube: 'PeerTube', youtube: 'YouTube',
};

type Tab = 'my-feeds' | 'public';

function toast(kind: 'success' | 'error' | 'info', message: string) {
  window.dispatchEvent(new CustomEvent('df-toast', { detail: { kind, message } }));
}

// ─── Feed Card ────────────────────────────────────────────────

function FeedCard({
  feed,
  isOwner,
  onEdit,
  onDelete,
  onSubscribe,
  subscribed,
}: {
  feed: CustomFeed;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onSubscribe?: () => void;
  subscribed?: boolean;
}) {
  return (
    <Link
      href={`/feeds/${feed.id}`}
      className="group block rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl transition-all hover:border-degen-500/30 hover:shadow-[0_0_20px_rgba(0,255,65,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[var(--color-fg)] truncate group-hover:text-degen-400 transition-colors">
            {feed.name}
          </h3>
          {feed.description && (
            <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{feed.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isOwner && onEdit && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onEdit(); }}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Edit feed"
              title="Edit"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {isOwner && onDelete && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onDelete(); }}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              aria-label="Delete feed"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M12 4v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Source badges */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {feed.config.sources.slice(0, 5).map((src) => (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400"
          >
            {SOURCE_EMOJIS[src] || '🌐'} {SOURCE_LABELS[src] || src}
          </span>
        ))}
        {feed.config.sources.length > 5 && (
          <span className="text-[10px] text-gray-500 self-center">+{feed.config.sources.length - 5}</span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M1 8s2-4 7-4 7 4 7 4-2 4-7 4-7-4-7-4z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          {feed.subscribers} subscriber{feed.subscribers !== 1 ? 's' : ''}
        </span>
        {!isOwner && onSubscribe && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSubscribe(); }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              subscribed
                ? 'bg-degen-500/15 text-degen-400'
                : 'bg-degen-500/10 text-degen-400 hover:bg-degen-500/20'
            }`}
          >
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function FeedsPage() {
  const { walletAddress, ready, openSignIn } = useAuth();
  const [tab, setTab] = useState<Tab>('my-feeds');
  const [myFeeds, setMyFeeds] = useState<CustomFeed[]>([]);
  const [publicFeeds, setPublicFeeds] = useState<CustomFeed[]>([]);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFeed | null>(null);
  const deleteConfirmRef = useRef<string | null>(null);

  const hasSignedIn = ready && !!walletAddress;

  const fetchMyFeeds = useCallback(async () => {
    if (!hasSignedIn) { setMyFeeds([]); setLoading(false); return; }
    try {
      const res = await fetch('/api/custom-feeds', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as { feeds?: CustomFeed[] };
      setMyFeeds(data.feeds || []);
    } catch {
      toast('error', 'Failed to load your feeds');
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  const fetchPublicFeeds = useCallback(async () => {
    setPublicLoading(true);
    try {
      const res = await fetch('/api/custom-feeds/public', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as { feeds?: CustomFeed[] };
      setPublicFeeds(data.feeds || []);
    } catch {
      // silently fail
    } finally {
      setPublicLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'my-feeds') void fetchMyFeeds();
    if (tab === 'public') void fetchPublicFeeds();
  }, [tab, fetchMyFeeds, fetchPublicFeeds]);

  const handleSave = useCallback(
    async (feed: { name: string; description: string; isPublic: boolean; config: CustomFeed['config'] }) => {
      if (editing) {
        const res = await fetch(`/api/custom-feeds/${editing.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(feed),
        });
        const data = await res.json() as { ok?: boolean; error?: string };
        if (data.ok) {
          toast('success', 'Feed updated');
          void fetchMyFeeds();
          return { ok: true };
        }
        return { ok: false, error: data.error };
      }
      const res = await fetch('/api/custom-feeds', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(feed),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        toast('success', 'Feed created');
        void fetchMyFeeds();
        return { ok: true };
      }
      return { ok: false, error: data.error };
    },
    [editing, fetchMyFeeds],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (deleteConfirmRef.current !== id) {
        deleteConfirmRef.current = id;
        toast('info', 'Click delete again to confirm');
        setTimeout(() => { deleteConfirmRef.current = null; }, 3000);
        return;
      }
      try {
        const res = await fetch(`/api/custom-feeds/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed');
        toast('success', 'Feed deleted');
        deleteConfirmRef.current = null;
        void fetchMyFeeds();
      } catch {
        toast('error', 'Failed to delete feed');
      }
    },
    [fetchMyFeeds],
  );

  const handleSubscribe = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/custom-feeds/${id}/subscribe`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          if (res.status === 409) {
            toast('info', 'Already subscribed');
          } else {
            toast('error', data.error || 'Failed to subscribe');
          }
          return;
        }
        toast('success', 'Subscribed!');
        setSubscribedIds((prev) => new Set(prev).add(id));
        void fetchPublicFeeds();
      } catch {
        toast('error', 'Failed to subscribe');
      }
    },
    [fetchPublicFeeds],
  );

  const openEdit = useCallback((feed: CustomFeed) => {
    setEditing(feed);
    setModalOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  return (
    <div className="mx-auto max-w-[960px] px-3 py-6 sm:px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Custom Feeds</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Build your own feed recipes — like Bluesky custom feeds, for every protocol
          </p>
        </div>
        {hasSignedIn && (
          <button type="button" onClick={openCreate} className="btn-primary text-sm">
            + Create Feed
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-6">
        <button
          type="button"
          onClick={() => setTab('my-feeds')}
          className={`relative px-4 py-3 text-sm font-medium transition-colors ${
            tab === 'my-feeds' ? 'text-[var(--color-fg)]' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          My Feeds
          {tab === 'my-feeds' && (
            <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-degen-500" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('public')}
          className={`relative px-4 py-3 text-sm font-medium transition-colors ${
            tab === 'public' ? 'text-[var(--color-fg)]' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Public Feeds
          {tab === 'public' && (
            <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-degen-500" />
          )}
        </button>
      </div>

      {/* My Feeds */}
      {tab === 'my-feeds' && (
        <div>
          {!hasSignedIn ? (
            <div className="rounded-2xl border border-degen-500/20 bg-degen-500/5 p-8 text-center">
              <p className="text-sm font-semibold text-[var(--color-fg)] mb-2">Sign in to create custom feeds</p>
              <p className="text-xs text-gray-400 mb-4">Connect your wallet to build and save feed recipes</p>
              <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                Connect Wallet
              </button>
            </div>
          ) : loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : myFeeds.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-8 text-center backdrop-blur-xl">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm text-[var(--color-fg)] font-medium mb-1">No feeds yet</p>
              <p className="text-xs text-gray-400 mb-4">Create your first custom feed to curate your perfect timeline</p>
              <button type="button" onClick={openCreate} className="btn-primary text-sm">
                Create Your First Feed
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {myFeeds.map((feed) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  isOwner
                  onEdit={() => openEdit(feed)}
                  onDelete={() => handleDelete(feed.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Public Feeds */}
      {tab === 'public' && (
        <div>
          {publicLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : publicFeeds.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-8 text-center backdrop-blur-xl">
              <p className="text-2xl mb-2">🌐</p>
              <p className="text-sm text-[var(--color-fg)] font-medium mb-1">No public feeds yet</p>
              <p className="text-xs text-gray-400">Be the first to create and share a custom feed with the community</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publicFeeds.map((feed) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  isOwner={hasSignedIn && feed.creator.toLowerCase() === walletAddress?.toLowerCase()}
                  onSubscribe={hasSignedIn ? () => handleSubscribe(feed.id) : undefined}
                  subscribed={subscribedIds.has(feed.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <FeedBuilderModalDynamic
          open={modalOpen}
          onClose={closeModal}
          onSave={handleSave}
          initial={editing ? { name: editing.name, description: editing.description, isPublic: editing.isPublic, config: editing.config } : undefined}
        />
      )}
    </div>
  );
}
