'use client';

/**
 * /profile/content-library — Cross-Platform Content Library
 *
 * All creator content in one unified place. Filter by protocol, content type,
 * date. Sort by engagement, earnings, date. Per-content analytics.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PROTOCOL_COLORS, PROTOCOL_LABELS } from '../constants';
import type { ContentFilter, ContentLibraryItem, ContentSort } from '../types';

const FILTERS: { id: ContentFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'text', label: 'Text', icon: '📝' },
  { id: 'image', label: 'Image', icon: '🖼️' },
  { id: 'video', label: 'Video', icon: '🎬' },
  { id: 'audio', label: 'Audio', icon: '🎙️' },
  { id: 'link', label: 'Link', icon: '🔗' },
];

const SORTS: { id: ContentSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'engagement', label: 'Most Engaging' },
  { id: 'earnings', label: 'Top Earnings' },
  { id: 'updated', label: 'Recently Updated' },
];

export default function ContentLibraryPage() {
  const [items, setItems] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [sort, setSort] = useState<ContentSort>('newest');
  const [selectedItem, setSelectedItem] = useState<ContentLibraryItem | null>(null);
  const mountedRef = useRef(true);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
      params.set('sort', sort);
      params.set('limit', '50');

      const res = await fetch(`/api/content/library?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = (await res.json()) as { items: ContentLibraryItem[]; total?: number };
        if (mountedRef.current) setItems(json.items ?? []);
      }
    } catch {
      /* silent fail */
    }
    if (mountedRef.current) setLoading(false);
  }, [filter, protocolFilter, sort]);

  useEffect(() => {
    mountedRef.current = true;
    fetchContent();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchContent]);

  const protocols = Array.from(new Set(items.map((i) => i.protocol)));

  const filtered = items.filter((item) => {
    if (filter !== 'all' && item.contentType !== filter) return false;
    if (protocolFilter !== 'all' && item.protocol !== protocolFilter) return false;
    return true;
  });

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-lg">
              📚
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Content Library</h1>
              <p className="text-xs text-[var(--color-muted)]">
                {filtered.length} piece{filtered.length !== 1 ? 's' : ''} of content across your
                protocols
              </p>
            </div>
          </div>
        </div>

        {/* ── Filters Row ───────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  filter === f.id
                    ? 'bg-degen-500/20 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] outline-none"
              aria-label="Filter by protocol"
            >
              <option value="all">All Protocols</option>
              {protocols.map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_LABELS[p] || p}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ContentSort)}
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] outline-none"
              aria-label="Sort by"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Loading State ─────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Content List ──────────────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--color-glass-border)] py-16 text-center">
            <div className="mb-3 text-3xl">📭</div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">No content yet</h3>
            <p className="mx-auto max-w-xs text-xs text-[var(--color-muted)]">
              Publish posts, images, or videos across your protocols and they will appear here.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-left transition-all hover:border-degen-500/20"
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail / Icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-overlay)]">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.textContent =
                            item.contentType === 'image' ? '🖼️' : '📝';
                        }}
                      />
                    ) : (
                      <span className="text-lg">
                        {item.contentType === 'image'
                          ? '🖼️'
                          : item.contentType === 'video'
                            ? '🎬'
                            : item.contentType === 'audio'
                              ? '🎙️'
                              : '📝'}
                      </span>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {item.title || item.body?.slice(0, 120) || 'Untitled'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${PROTOCOL_COLORS[item.protocol] || '#666'}15`,
                          color: PROTOCOL_COLORS[item.protocol] || '#666',
                        }}
                      >
                        {PROTOCOL_LABELS[item.protocol] || item.protocol}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span>♥ {item.engagement.likes}</span>
                      <span>↻ {item.engagement.reposts}</span>
                      {item.engagement.tipsUsd > 0 && (
                        <span className="text-amber-400">
                          ${item.engagement.tipsUsd.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`mt-1 shrink-0 text-[var(--color-muted)] transition-transform ${selectedItem?.id === item.id ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* Expanded Detail */}
                {selectedItem?.id === item.id && (
                  <div className="mt-4 border-t border-[var(--color-glass-border)] pt-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                          {item.engagement.views}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                          {item.engagement.likes}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">Likes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                          {item.engagement.reposts}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">Reposts</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-amber-400">
                          ${item.engagement.tipsUsd.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">Earned</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Repost/recycle
                        }}
                        className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                      >
                        🔄 Repost
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await fetch(`/api/content/library/${item.id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });
                            setItems((prev) => prev.filter((i) => i.id !== item.id));
                            setSelectedItem(null);
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        🗑️ Delete
                      </button>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                        >
                          🔗 Open Original
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
