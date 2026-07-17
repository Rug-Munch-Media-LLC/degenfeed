'use client';

import type { StoredBookmark } from '@degenfeed/storage';
import {
  getBookmarks,
  removeBookmark,
  removeBookmarkFromServer,
  syncAllBookmarks,
  updateBookmarkTags,
} from '@degenfeed/storage';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Protocol display helpers ────────────────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  threads: '#888888',
  mastodon: '#6364ff',
  rss: '#ff6600',
  reddit: '#ff4500',
  lemmy: '#7c3aed',
  ethereum: '#627eea',
  solana: '#9945ff',
  ponder: '#00bcd4',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads',
  mastodon: 'Mastodon',
  rss: 'RSS',
  reddit: 'Reddit',
  lemmy: 'Lemmy',
  ethereum: 'Ethereum',
  solana: 'Solana',
  ponder: 'Ponder',
};

type SortMode = 'newest' | 'oldest' | 'protocol';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sort, setSort] = useState<SortMode>('newest');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // ─── Load bookmarks with server sync ─────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try to sync with server first
      const merged = await syncAllBookmarks();
      setBookmarks(merged);
    } catch {
      // Fall back to local
      try {
        const items = await getBookmarks();
        setBookmarks(items);
      } catch {
        // No bookmarks at all
      }
    }
    setLoading(false);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const merged = await syncAllBookmarks();
      setBookmarks(merged);
    } catch {
      // ignore
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Remove ───────────────────────────────────────────────

  const handleRemove = useCallback(async (postId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.postId !== postId));
    try {
      await removeBookmark(postId, true);
    } catch {
      // Fallback: at least remove from server
      await removeBookmarkFromServer(postId);
    }
  }, []);

  // ─── Tag editing ──────────────────────────────────────────

  const startTagEdit = useCallback((postId: string, currentTags?: string[]) => {
    setEditingTags(postId);
    setTagInput((currentTags ?? []).join(', '));
  }, []);

  const saveTagEdit = useCallback(
    async (postId: string) => {
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      setBookmarks((prev) =>
        prev.map((b) => (b.postId === postId ? { ...b, tags: tags.length ? tags : undefined } : b)),
      );
      setEditingTags(null);
      setTagInput('');
      try {
        await updateBookmarkTags(postId, tags);
      } catch {
        // offline
      }
    },
    [tagInput],
  );

  const cancelTagEdit = useCallback(() => {
    setEditingTags(null);
    setTagInput('');
  }, []);

  // ─── Derived data ─────────────────────────────────────────

  // All unique tags across bookmarks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const bm of bookmarks) {
      for (const tag of bm.tags ?? []) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [bookmarks]);

  // Filtered + sorted bookmarks
  const displayed = useMemo(() => {
    let filtered = [...bookmarks];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authorName.toLowerCase().includes(q) ||
          b.postId.toLowerCase().includes(q) ||
          (b.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Tag filter
    if (tagFilter) {
      filtered = filtered.filter((b) => (b.tags ?? []).includes(tagFilter));
    }

    // Sort
    if (sort === 'oldest') {
      filtered.sort((a, b) => a.savedAt - b.savedAt);
    } else if (sort === 'protocol') {
      filtered.sort((a, b) => a.protocol.localeCompare(b.protocol) || b.savedAt - a.savedAt);
    } else {
      filtered.sort((a, b) => b.savedAt - a.savedAt);
    }

    return filtered;
  }, [bookmarks, sort, search, tagFilter]);

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">
            Saved Across All Protocols
          </p>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Bookmarks</h1>
          {!loading && (
            <p className="mt-0.5 text-xs text-gray-500">
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-[var(--color-muted)] px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-[var(--color-fg)] transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <Link href="/home" className="text-sm text-gray-500 hover:text-[var(--color-fg)] transition-colors">
            &larr; Feed
          </Link>
        </div>
      </div>

      {/* Search + sort controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full rounded-lg bg-[var(--color-muted)] border border-white/10 px-3 py-2 pl-8 text-sm text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500/50 focus:outline-none"
          />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-600">
            🔍
          </span>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-lg bg-[var(--color-muted)] border border-white/10 px-3 py-2 text-sm text-gray-300 focus:border-degen-500/50 focus:outline-none"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="protocol">By Protocol</option>
        </select>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              tagFilter === null
                ? 'bg-degen-500/20 text-degen-400'
                : 'bg-[var(--color-muted)] text-gray-500 hover:bg-gray-700 hover:text-gray-300'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                tagFilter === tag
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'bg-[var(--color-muted)] text-gray-500 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="mb-2 h-4 w-48 rounded bg-[var(--color-muted)]" />
              <div className="mb-2 h-3 w-32 rounded bg-[var(--color-muted)]" />
              <div className="h-3 w-24 rounded bg-[var(--color-muted)]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayed.length === 0 && (
        <div className="card py-16 text-center">
          <div className="mb-3 text-3xl">📑</div>
          <p className="text-gray-500">
            {search || tagFilter ? 'No bookmarks match your filters.' : 'No bookmarks yet.'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {search || tagFilter
              ? 'Try different search terms or clear filters.'
              : 'Bookmark posts from any protocol to save them here.'}
          </p>
          <Link href="/home" className="btn-primary mt-4 inline-block text-sm">
            Browse the feed
          </Link>
        </div>
      )}

      {/* Bookmark list */}
      {!loading && displayed.length > 0 && (
        <div className="space-y-2">
          {displayed.map((b) => (
            <div key={b.postId} className="card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                {/* Protocol badge */}
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${PROTOCOL_COLORS[b.protocol] ?? '#666'}1a`,
                      color: PROTOCOL_COLORS[b.protocol] ?? '#666',
                    }}
                  >
                    {PROTOCOL_LABELS[b.protocol] ?? b.protocol}
                  </span>
                  {b.tags && b.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {b.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                          className="rounded-full bg-[var(--color-muted)] px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </span>
                  )}
                </div>

                {/* Title */}
                <Link
                  href={`/post/${encodeURIComponent(b.postId)}`}
                  className="font-medium text-sm text-[var(--color-fg)] hover:text-degen-400 transition-colors truncate block"
                >
                  {b.title || b.postId}
                </Link>

                {/* Author + date */}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                  <span className="truncate">{b.authorName}</span>
                  <span>&middot;</span>
                  <span>
                    {new Date(b.savedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {/* Inline tag editor */}
                {editingTags === b.postId ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                      className="flex-1 rounded bg-[var(--color-muted)] border border-white/10 px-2 py-1 text-xs text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500/50 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTagEdit(b.postId);
                        if (e.key === 'Escape') cancelTagEdit();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveTagEdit(b.postId)}
                      className="rounded bg-degen-500/20 px-2 py-1 text-[10px] text-degen-400 hover:bg-degen-500/30 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelTagEdit}
                      className="rounded bg-[var(--color-muted)] px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startTagEdit(b.postId, b.tags)}
                    className="mt-1 rounded bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {b.tags?.length ? 'Edit tags' : '+ Add tags'}
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRemove(b.postId)}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
                  title="Remove bookmark"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info footer */}
      {!loading && bookmarks.length > 0 && (
        <div className="mt-6 text-center text-[10px] text-gray-700">
          Bookmarks are synced to the server when signed in.
        </div>
      )}
    </div>
  );
}
