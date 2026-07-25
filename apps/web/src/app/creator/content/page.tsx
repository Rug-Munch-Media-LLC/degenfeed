'use client';

/**
 * Creator Content Studio — Unified Content Command Center
 *
 * Layout:
 *   Left sidebar: Content types, protocols, collections
 *   Center: Content grid with cards
 *   Right sidebar: Quick actions, analytics snapshot
 *
 * Features:
 *   - Content library view (grid/list toggle)
 *   - Filter by type, protocol, date, engagement
 *   - Sort by newest, most engagement, recently updated
 *   - Per-content analytics with cross-protocol comparison
 *   - Quick actions: New Post, Upload Video, Go Live, Import
 *   - Draft management and content collections
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Types ──────────────────────────────────────────────────────────────────

type ContentType = 'post' | 'video' | 'short' | 'article' | 'stream';
type ViewMode = 'grid' | 'list';
type SortMode = 'newest' | 'engagement' | 'updated';
type FilterTab = 'all' | 'post' | 'video' | 'short' | 'article' | 'stream';

interface ProtocolCopy {
  status: 'published' | 'failed' | 'pending' | 'scheduled';
  postId: string;
  url: string;
  publishedAt: number;
  engagement: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views: number;
  };
}

interface ContentRecord {
  id: string;
  creatorWallet: string;
  type: ContentType;
  title?: string;
  body: string;
  media: Array<{ url: string; mimeType: string; alt?: string }>;
  protocols: Record<string, ProtocolCopy>;
  tags: string[];
  license: string;
  deleted?: boolean;
  monetization?: {
    type: string;
    enabled: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

// ─── Platform Display Config ────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; icon: string; color: string }> = {
  nostr: { label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  farcaster: { label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#1185fe' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  lens: { label: 'Lens', icon: '🌿', color: '#abfe2c' },
  reddit: { label: 'Reddit', icon: '🤖', color: '#ff4500' },
  telegram: { label: 'Telegram', icon: '✈️', color: '#0088cc' },
  discord: { label: 'Discord', icon: '💬', color: '#5865f2' },
  threads: { label: 'Threads', icon: '⊞', color: '#101010' },
  lemmy: { label: 'Lemmy', icon: '🔮', color: '#4a8c6f' },
  peertube: { label: 'PeerTube', icon: '▶️', color: '#f2691d' },
  pixelfed: { label: 'Pixelfed', icon: '📷', color: '#005cff' },
};

const CONTENT_TYPE_META: Record<ContentType, { icon: string; label: string }> = {
  post: { icon: '📝', label: 'Post' },
  video: { icon: '🎬', label: 'Video' },
  short: { icon: '🎥', label: 'Short' },
  article: { icon: '📄', label: 'Article' },
  stream: { icon: '🔴', label: 'Stream' },
};

// ─── Formatting ─────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Analytics Snapshot ─────────────────────────────────────────────────────

function AnalyticsSnapshot({ records }: { records: ContentRecord[] }) {
  const totalEngagement = records.reduce(
    (sum, r) =>
      sum +
      Object.values(r.protocols).reduce(
        (s, c) => s + c.engagement.likes + c.engagement.reposts + c.engagement.replies,
        0,
      ),
    0,
  );

  const topProtocols = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      for (const [p, c] of Object.entries(r.protocols)) {
        if (c.status === 'published') {
          counts[p] = (counts[p] || 0) + c.engagement.likes;
        }
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [records]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Analytics Snapshot</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)]">Total Content</span>
          <span className="text-sm font-bold text-[var(--color-fg)]">{records.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)]">Total Engagement</span>
          <span className="text-sm font-bold text-degen-400">{formatNumber(totalEngagement)}</span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-2">
          <div className="mb-1 text-[10px] text-[var(--color-muted)]">Top Platforms</div>
          {topProtocols.length > 0 ? (
            topProtocols.map(([protocol, likes]) => {
              const meta = PLATFORM_META[protocol] ?? {
                label: protocol,
                icon: '📄',
                color: '#666',
              };
              return (
                <div key={protocol} className="flex items-center justify-between py-0.5">
                  <span className="flex items-center gap-1 text-[10px]">
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="text-[var(--color-muted)]">{meta.label}</span>
                  </span>
                  <span className="text-[10px] font-medium text-[var(--color-fg)]">
                    {formatNumber(likes)} likes
                  </span>
                </div>
              );
            })
          ) : (
            <span className="text-[9px] text-[var(--color-muted)]">No data yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Content Card ───────────────────────────────────────────────────────────

function ContentCard({
  record,
  viewMode,
  onDelete,
}: {
  record: ContentRecord;
  viewMode: ViewMode;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeMeta = CONTENT_TYPE_META[record.type] ?? { icon: '📄', label: record.type };

  const publishedCount = Object.values(record.protocols).filter(
    (c) => c.status === 'published',
  ).length;
  const totalEngagement = Object.values(record.protocols).reduce(
    (s, c) => s + c.engagement.likes + c.engagement.reposts + c.engagement.replies,
    0,
  );

  // Cross-protocol comparison text
  const comparisonText = useMemo(() => {
    const protocols = Object.entries(record.protocols).filter(([, c]) => c.status === 'published');
    if (protocols.length < 2) return null;

    // Find best and second best
    const sorted = protocols.sort(([, a], [, b]) => b.engagement.likes - a.engagement.likes);
    const best = sorted[0];
    const second = sorted[1];

    if (best[1].engagement.likes > 0 && second[1].engagement.likes > 0) {
      const ratio = (best[1].engagement.likes / second[1].engagement.likes).toFixed(1);
      const bestMeta = PLATFORM_META[best[0]];
      const secondMeta = PLATFORM_META[second[0]];
      return `Performed ${ratio}x better on ${bestMeta?.label ?? best[0]} than ${secondMeta?.label ?? second[0]}`;
    }
    return null;
  }, [record.protocols]);

  if (viewMode === 'list') {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:border-degen-500/20">
        <div className="flex items-center gap-3 p-3">
          <span className="text-lg">{typeMeta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-fg)] truncate">
                {record.title || record.body.slice(0, 60)}
              </span>
              <span className="text-[9px] text-[var(--color-muted)]">{typeMeta.label}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
              <span>{publishedCount} protocols</span>
              <span>•</span>
              <span>{formatNumber(totalEngagement)} engagement</span>
              <span>•</span>
              <span>{timeAgo(record.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]"
            >
              {expanded ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(record.id)}
              className="rounded-lg px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10"
            >
              ✕
            </button>
          </div>
        </div>
        {expanded && (
          <div className="border-t border-[var(--color-border)] p-3">
            <ProtocolBreakdown record={record} />
          </div>
        )}
      </div>
    );
  }

  // Grid card
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:border-degen-500/20">
      {/* Preview */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>{typeMeta.icon}</span>
            <span className="text-[10px] font-medium text-[var(--color-muted)]">
              {typeMeta.label}
            </span>
          </div>
          <div className="flex gap-2">
            {Object.keys(record.protocols).length > 0 && (
              <div className="flex -space-x-1">
                {Object.keys(record.protocols)
                  .slice(0, 4)
                  .map((p) => {
                    const meta = PLATFORM_META[p] ?? { icon: '📄', color: '#666' };
                    return (
                      <span
                        key={p}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-card)] text-[8px]"
                        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                        title={meta.label}
                      >
                        {meta.icon}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)] line-clamp-2">
          {record.title || record.body.slice(0, 100)}
        </h3>

        <p className="mb-3 text-[10px] text-[var(--color-muted)] line-clamp-2">
          {record.body.slice(0, 150)}
        </p>

        {/* Tags */}
        {record.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {record.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[8px] text-[var(--color-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span>❤️ {formatNumber(totalEngagement)}</span>
            <span>📡 {publishedCount}</span>
          </div>
          <span className="text-[9px] text-[var(--color-muted)]">{timeAgo(record.createdAt)}</span>
        </div>

        {/* Cross-platform comparison */}
        {comparisonText && (
          <div className="mt-2 rounded-lg bg-degen-500/5 px-2 py-1.5">
            <p className="text-[9px] leading-tight text-degen-400">{comparisonText}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 py-2 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)]"
        >
          {expanded ? '▲ Less' : '▼ Details'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(record.id)}
          className="px-3 py-2 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
        >
          ✕
        </button>
      </div>

      {/* Expanded protocol details */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] p-3">
          <ProtocolBreakdown record={record} />
        </div>
      )}
    </div>
  );
}

// ─── Protocol Breakdown ─────────────────────────────────────────────────────

function ProtocolBreakdown({ record }: { record: ContentRecord }) {
  const publishedEntries = Object.entries(record.protocols).filter(
    ([, c]) => c.status === 'published',
  );

  return (
    <div className="space-y-2">
      {publishedEntries.length > 0 ? (
        publishedEntries.map(([protocol, copy]) => {
          const meta = PLATFORM_META[protocol] ?? { label: protocol, icon: '📄', color: '#666' };
          return (
            <div
              key={protocol}
              className="flex items-center justify-between rounded-lg bg-[var(--color-overlay)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span style={{ color: meta.color }}>{meta.icon}</span>
                <div>
                  <span
                    className="text-xs font-medium text-[var(--color-fg)]"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {copy.url && (
                    <a
                      href={copy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-[9px] text-degen-400 hover:underline"
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                <span title="Likes">❤️ {copy.engagement.likes}</span>
                <span title="Reposts">🔄 {copy.engagement.reposts}</span>
                <span title="Replies">💬 {copy.engagement.replies}</span>
                <span title="Views">👁️ {copy.engagement.views}</span>
              </div>
            </div>
          );
        })
      ) : (
        <p className="py-4 text-center text-[10px] text-[var(--color-muted)]">
          Not published to any protocols yet
        </p>
      )}
    </div>
  );
}

// ─── Quick Actions ──────────────────────────────────────────────────────────

function QuickActions() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Quick Actions</h3>
      <div className="space-y-2">
        <Link
          href="/creator/cross-post"
          className="flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-2 text-[11px] font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
        >
          <span>✏️</span>
          <span>New Post</span>
        </Link>
        <Link
          href="/creator/videos/upload"
          className="flex items-center gap-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-[11px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-border)]"
        >
          <span>🎬</span>
          <span>Upload Video</span>
        </Link>
        <Link
          href="/creator/stream"
          className="flex items-center gap-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-[11px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-border)]"
        >
          <span>🔴</span>
          <span>Go Live</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/api/content/export';
          }}
          className="flex w-full items-center gap-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-[11px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-border)]"
        >
          <span>📦</span>
          <span>Export Content</span>
        </button>
      </div>
    </div>
  );
}

// ─── Content Type Filter ────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'post', label: 'Posts', icon: '📝' },
  { key: 'video', label: 'Videos', icon: '🎬' },
  { key: 'short', label: 'Shorts', icon: '🎥' },
  { key: 'article', label: 'Articles', icon: '📄' },
  { key: 'stream', label: 'Streams', icon: '🔴' },
];

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function CreatorContentPage() {
  const { ready, walletAddress } = useAuth();
  const [records, setRecords] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Load content library ──
  const loadContent = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortMode, limit: '100' });
      const res = await fetch(`/api/content/library?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { items: ContentRecord[] };
        setRecords(data.items ?? []);
      }
    } catch {
      // Endpoint may not be available yet
    } finally {
      setLoading(false);
    }
  }, [walletAddress, sortMode]);

  useEffect(() => {
    if (ready && walletAddress) loadContent();
    else if (ready && !walletAddress) setLoading(false);
  }, [ready, walletAddress, loadContent]);

  // ── Filter and sort ──
  const filteredRecords = useMemo(() => {
    let items = [...records];

    // Type filter
    if (filterTab !== 'all') {
      items = items.filter((r) => r.type === filterTab);
    }

    // Protocol filter
    if (protocolFilter !== 'all') {
      items = items.filter((r) => r.protocols[protocolFilter]);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (r) =>
          (r.title ?? '').toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    if (sortMode === 'engagement') {
      items.sort((a, b) => {
        const aEng = Object.values(a.protocols).reduce((s, c) => s + c.engagement.likes, 0);
        const bEng = Object.values(b.protocols).reduce((s, c) => s + c.engagement.likes, 0);
        return bEng - aEng;
      });
    } else if (sortMode === 'updated') {
      items.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      items.sort((a, b) => b.createdAt - a.createdAt);
    }

    return items;
  }, [records, filterTab, protocolFilter, searchQuery, sortMode]);

  // ── Delete ──
  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/content/library/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Aggregate protocol list for filter ──
  const availableProtocols = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      for (const p of Object.keys(r.protocols)) {
        set.add(p);
      }
    }
    return Array.from(set).sort();
  }, [records]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = records.length;
    const published = records.filter((r) =>
      Object.values(r.protocols).some((c) => c.status === 'published'),
    ).length;
    const totalEngagement = records.reduce(
      (s, r) =>
        s +
        Object.values(r.protocols).reduce(
          (s2, c) => s2 + c.engagement.likes + c.engagement.reposts + c.engagement.replies,
          0,
        ),
      0,
    );
    const platformsUsed = new Set(records.flatMap((r) => Object.keys(r.protocols))).size;
    return { total, published, totalEngagement, platformsUsed };
  }, [records]);

  // ── Auth gate ──
  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
          <span className="text-3xl text-degen-400">🎨</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Content Studio</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Connect your wallet to manage all your content across every protocol.
        </p>
        <div className="mt-8">
          <Link href="/creator" className="btn-primary text-sm">
            Go to Creator Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Content Studio
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Manage all your content across every protocol — from one dashboard
            </p>
          </div>
          <Link href="/creator/cross-post" className="btn-primary text-sm">
            + New Post
          </Link>
        </div>

        {/* Stats bar */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-lg font-bold text-[var(--color-fg)]">{stats.total}</div>
            <div className="text-[10px] text-[var(--color-muted)]">Total Content</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-lg font-bold text-degen-400">{stats.published}</div>
            <div className="text-[10px] text-[var(--color-muted)]">Published</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-lg font-bold text-blue-400">
              {formatNumber(stats.totalEngagement)}
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">Total Engagement</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-lg font-bold text-purple-400">{stats.platformsUsed}</div>
            <div className="text-[10px] text-[var(--color-muted)]">Platforms Used</div>
          </div>
        </div>
      </div>

      {/* ── Left Sidebar + Center + Right Sidebar ── */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <div className="w-48 shrink-0 space-y-4">
          {/* Content Type Filter */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <h3 className="mb-2 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
              Content Type
            </h3>
            <div className="space-y-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                    filterTab === tab.key
                      ? 'bg-degen-500/10 text-degen-400'
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.key !== 'all' && (
                    <span className="ml-auto text-[9px] opacity-50">
                      {records.filter((r) => r.type === tab.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Protocol Filter */}
          {availableProtocols.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <h3 className="mb-2 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                Protocol
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setProtocolFilter('all')}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                    protocolFilter === 'all'
                      ? 'bg-degen-500/10 text-degen-400'
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
                  }`}
                >
                  <span>🌐</span>
                  <span>All Protocols</span>
                </button>
                {availableProtocols.map((p) => {
                  const meta = PLATFORM_META[p] ?? { label: p, icon: '📄', color: '#666' };
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProtocolFilter(p)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                        protocolFilter === p
                          ? 'bg-degen-500/10 text-degen-400'
                          : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
                      }`}
                    >
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Center: Content Grid */}
        <div className="flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 pl-8 text-[11px] text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--color-muted)]">
                🔍
              </span>
            </div>

            {/* Sort */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="input rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[11px] text-[var(--color-fg)]"
            >
              <option value="newest">Newest</option>
              <option value="engagement">Most Engagement</option>
              <option value="updated">Recently Updated</option>
            </select>

            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-[11px] transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-degen-500/10 text-degen-400'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
                }`}
              >
                ⊞ Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-[11px] transition-colors ${
                  viewMode === 'list'
                    ? 'bg-degen-500/10 text-degen-400'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
                }`}
              >
                ≡ List
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
          ) : filteredRecords.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredRecords.map((record) => (
                  <ContentCard
                    key={record.id}
                    record={record}
                    viewMode={viewMode}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRecords.map((record) => (
                  <ContentCard
                    key={record.id}
                    record={record}
                    viewMode={viewMode}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
                <span className="text-2xl text-[var(--color-muted)]">📝</span>
              </div>
              <h2 className="text-lg font-semibold text-[var(--color-fg)]">No content yet</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Publish your first post or import content to see it here.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link href="/creator/cross-post" className="btn-primary text-sm">
                  Create Your First Post
                </Link>
                <Link href="/creator/content/import" className="btn-secondary text-sm">
                  Import Content
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-56 shrink-0 space-y-4">
          <QuickActions />
          <AnalyticsSnapshot records={records} />

          {/* Quick Links */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Manage</h3>
            <div className="space-y-2">
              <Link
                href="/creator/posts"
                className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <span>📤</span>
                <span>Cross-Post History</span>
              </Link>
              <Link
                href="/creator/settings"
                className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <span>⚙️</span>
                <span>Syndication Settings</span>
              </Link>
              <Link
                href="/api/content/export"
                className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <span>📦</span>
                <span>Export All Content</span>
              </Link>
              <Link
                href="/api/content/export/markdown"
                className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <span>📝</span>
                <span>Export as Markdown</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
