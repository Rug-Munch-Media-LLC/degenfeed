'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { CrossPostComposer } from '../../../components/CrossPostComposer';

// ─── Types ────────────────────────────────────────────────────────────────

interface CrossPostRecord {
  batchId: string;
  textHash: string;
  copies: Array<{
    protocol: string;
    nativeId?: string;
    url?: string;
    status: 'published' | 'failed' | 'scheduled';
    publishedAt?: number;
  }>;
  createdAt: number;
  author: string;
}

interface PerProtocolMetrics {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

interface ContentLibraryItem {
  id: string;
  type: string;
  title?: string;
  body: string;
  protocols: Record<
    string,
    {
      status: string;
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
  >;
  tags: string[];
  license: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Platform Colors ──────────────────────────────────────────────────────

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

// ─── Formatting Helpers ───────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// ─── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    published: { bg: 'bg-degen-500/15', text: 'text-degen-400', label: 'Published' },
    failed: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' },
    scheduled: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Scheduled' },
    pending: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Pending' },
  };

  const s = styles[status] ?? { bg: 'bg-gray-500/15', text: 'text-gray-400', label: status };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}
    >
      <span
        className={`mr-1 h-1.5 w-1.5 rounded-full ${status === 'published' ? 'bg-degen-400' : status === 'failed' ? 'bg-red-400' : 'bg-blue-400'}`}
      />
      {s.label}
    </span>
  );
}

// ─── Cross-Platform Comparison Badge ─────────────────────────────────────

function ComparisonBadge({ copies }: { copies: CrossPostRecord['copies'] }) {
  const published = copies.filter((c) => c.status === 'published' && c.nativeId);

  if (published.length < 2) return null;

  // Sort by likes to find best performer
  // We need metrics to compare — fetch from content library if available
  // For now, just show a generic comparison indicator
  return (
    <div className="mt-2 rounded-lg bg-degen-500/5 px-2 py-1.5">
      <p className="text-[9px] leading-tight text-degen-400">
        Published to {published.length} platforms — compare engagement below
      </p>
    </div>
  );
}

// ─── Engagement Side-by-Side Comparison ──────────────────────────────────

function EngagementComparison({ copies }: { copies: CrossPostRecord['copies'] }) {
  const [metrics, setMetrics] = useState<Record<string, PerProtocolMetrics>>({});
  const published = copies.filter((c) => c.status === 'published' && c.nativeId);

  useEffect(() => {
    const fetchAll = async () => {
      const results: Record<string, PerProtocolMetrics> = {};
      for (const copy of published) {
        if (copy.nativeId && copy.nativeId !== 'undefined') {
          try {
            const res = await fetch(`/api/feed/post/${copy.nativeId}`, { credentials: 'include' });
            if (res.ok) {
              const data = (await res.json()) as { metrics?: PerProtocolMetrics };
              if (data.metrics) {
                results[copy.protocol] = data.metrics;
              }
            }
          } catch {
            // silently ignore
          }
        }
      }
      if (Object.keys(results).length > 0) {
        setMetrics(results);
      }
    };
    fetchAll();
  }, [published]);

  if (published.length < 2 || Object.keys(metrics).length === 0) return null;

  // Find best performer
  const sorted = published
    .filter((c) => metrics[c.protocol])
    .sort((a, b) => (metrics[b.protocol]?.likes ?? 0) - (metrics[a.protocol]?.likes ?? 0));

  if (sorted.length < 2) return null;

  const best = sorted[0]!;
  const second = sorted[1]!;
  const bestMetrics = metrics[best.protocol];
  const secondMetrics = metrics[second.protocol];

  if (!bestMetrics || !secondMetrics || bestMetrics.likes === 0) return null;

  const ratio =
    secondMetrics.likes > 0 ? (bestMetrics.likes / secondMetrics.likes).toFixed(1) : '∞';
  const bestMeta = PLATFORM_META[best.protocol] ?? {
    label: best.protocol,
    icon: '📄',
    color: '#666',
  };
  const secondMeta = PLATFORM_META[second.protocol] ?? {
    label: second.protocol,
    icon: '📄',
    color: '#666',
  };

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3">
      <p className="mb-2 text-[10px] font-semibold text-[var(--color-fg)]">
        📊 Engagement Comparison
      </p>
      <p className="mb-2 text-[9px] text-degen-400">
        Performed {ratio}x better on {bestMeta.label} than {secondMeta.label}
      </p>
      <div className="space-y-1.5">
        {sorted.map((copy) => {
          const m = metrics[copy.protocol];
          if (!m) return null;
          const meta = PLATFORM_META[copy.protocol] ?? {
            label: copy.protocol,
            icon: '📄',
            color: '#666',
          };
          const maxLikes = sorted.length > 0 ? (metrics[sorted[0]?.protocol]?.likes ?? 1) : 1;
          const barWidth = Math.max(5, (m.likes / maxLikes) * 100);

          return (
            <div key={copy.protocol} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[9px]" style={{ color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
              <div className="flex-1">
                <div className="h-3 rounded-full bg-[var(--color-card)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: meta.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
              <span className="w-12 text-right text-[9px] text-[var(--color-muted)]">
                ❤️ {formatNumber(m.likes)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Best Time to Post Suggestion ────────────────────────────────────────

function BestTimeSuggestion({ copies }: { copies: CrossPostRecord['copies'] }) {
  const published = copies.filter((c) => c.status === 'published' && c.publishedAt);

  if (published.length === 0) return null;

  // Find the most common hour (UTC)
  const hourCounts: Record<number, number> = {};
  for (const copy of published) {
    if (copy.publishedAt) {
      const hour = new Date(copy.publishedAt).getUTCHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  }

  const bestHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 1)
    .map(([hour]) => parseInt(hour, 10))[0];

  if (bestHour === undefined) return null;

  // Best hour range
  const hourStr = `${bestHour.toString().padStart(2, '0')}:00 UTC`;

  return (
    <div className="mt-2 rounded-lg bg-blue-500/5 px-2 py-1.5">
      <p className="text-[9px] leading-tight text-blue-400">
        🕐 Best posting time: around {hourStr}
      </p>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────

function PostCard({
  record,
  onDelete,
}: {
  record: CrossPostRecord;
  onDelete: (batchId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const successCount = record.copies.filter(
    (c) => c.status === 'published' || c.status === 'scheduled',
  ).length;
  const failCount = record.copies.filter((c) => c.status === 'failed').length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:border-degen-500/20">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-xs text-degen-400">
          📤
        </div>
        <div className="min-w-0 flex-1">
          {/* Batch info */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-fg)]">Cross-Post Batch</span>
            <StatusBadge status={failCount > 0 && successCount === 0 ? 'failed' : 'published'} />
            <span className="text-[10px] text-[var(--color-muted)]">
              {timeAgo(record.createdAt)}
            </span>
          </div>

          {/* Protocol indicators */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {record.copies.map((copy) => {
              const meta = PLATFORM_META[copy.protocol] ?? {
                label: copy.protocol,
                icon: '📄',
                color: '#666',
              };

              return (
                <span
                  key={`${copy.protocol}-${copy.nativeId}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    copy.status === 'failed' ? 'opacity-50' : ''
                  }`}
                  style={{
                    backgroundColor: `${meta.color}15`,
                    color: copy.status === 'failed' ? '#ff4444' : meta.color,
                  }}
                  title={copy.status === 'failed' ? 'Failed to publish' : (copy.url ?? '')}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  {copy.status === 'failed' && <span className="text-red-400">✕</span>}
                  {copy.status === 'published' && <span className="opacity-60">✓</span>}
                </span>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
            <span>
              {successCount}/{record.copies.length} published
            </span>
            {failCount > 0 && <span className="text-red-400">{failCount} failed</span>}
            <span>{formatDate(record.createdAt)}</span>
          </div>

          {/* Cross-platform comparison badge */}
          <ComparisonBadge copies={record.copies} />
          <BestTimeSuggestion copies={record.copies} />
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg px-2 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          >
            {expanded ? '▲ Less' : '▼ More'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(record.batchId)}
            className="rounded-lg px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
            title="Remove from list"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] p-4">
          {/* Per-protocol details */}
          <div className="space-y-2">
            {record.copies.map((copy) => {
              const meta = PLATFORM_META[copy.protocol] ?? {
                label: copy.protocol,
                icon: '📄',
                color: '#666',
              };

              return (
                <div
                  key={`${copy.protocol}-${copy.nativeId}`}
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
                          className="ml-2 text-[10px] text-degen-400 hover:underline"
                        >
                          Open ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={copy.status} />

                    {/* Repost/boost buttons */}
                    {copy.status === 'published' && copy.nativeId && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await fetch(`/api/engage`, {
                                method: 'POST',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'repost',
                                  protocol: copy.protocol,
                                  nativeId: copy.nativeId,
                                }),
                              });
                            } catch {
                              // ignore
                            }
                          }}
                          className="rounded px-1.5 py-0.5 text-[9px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-fg)]"
                          title="Boost/Repost"
                        >
                          🔄
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Engagement Comparison */}
          <EngagementComparison copies={record.copies} />
        </div>
      )}
    </div>
  );
}

// ─── Bulk Action Bar ─────────────────────────────────────────────────────

function BulkActionBar({
  selectedIds,
  onClear,
  onRepublish,
  onDelete,
}: {
  selectedIds: string[];
  onClear: () => void;
  onRepublish: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
      <span className="text-[11px] font-medium text-[var(--color-fg)]">
        {selectedIds.length} selected
      </span>
      <button
        type="button"
        onClick={() => onRepublish(selectedIds)}
        className="rounded-lg bg-degen-500/10 px-3 py-1.5 text-[10px] font-medium text-degen-400 hover:bg-degen-500/20"
      >
        Re-Publish
      </button>
      <button
        type="button"
        onClick={() => onDelete(selectedIds)}
        className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-medium text-red-400 hover:bg-red-500/20"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        Clear
      </button>
    </div>
  );
}

// ─── Content Library Section ─────────────────────────────────────────────

function ContentLibrarySection({
  items,
  onSync,
}: {
  items: ContentLibraryItem[];
  onSync: () => void;
}) {
  // Compute "best hours" across all content — must be before early return (React hooks rule)
  const bestHours = useMemo(() => {
    if (items.length === 0) return [];
    const hourEngagement: Record<number, { count: number; totalLikes: number }> = {};
    for (const item of items) {
      const hour = new Date(item.createdAt).getUTCHours();
      if (!hourEngagement[hour]) hourEngagement[hour] = { count: 0, totalLikes: 0 };
      hourEngagement[hour].count++;
      const totalLikes = Object.values(item.protocols).reduce((s, c) => s + c.engagement.likes, 0);
      hourEngagement[hour].totalLikes += totalLikes;
    }
    return Object.entries(hourEngagement)
      .map(([hour, data]) => ({ hour: parseInt(hour, 10), ...data }))
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, 3);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">📊 Content Analytics</h2>
        <button
          type="button"
          onClick={onSync}
          className="rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Sync Engagement
        </button>
      </div>

      {/* Best times & suggestions */}
      {bestHours.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-[10px] text-[var(--color-muted)]">Best Posting Time</div>
            <div className="text-sm font-bold text-degen-400">
              {bestHours[0]?.hour.toString().padStart(2, '0')}:00 UTC
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-[10px] text-[var(--color-muted)]">2nd Best</div>
            <div className="text-sm font-bold text-blue-400">
              {bestHours[1]?.hour.toString().padStart(2, '0')}:00 UTC
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="text-[10px] text-[var(--color-muted)]">3rd Best</div>
            <div className="text-sm font-bold text-purple-400">
              {bestHours[2]?.hour.toString().padStart(2, '0')}:00 UTC
            </div>
          </div>
        </div>
      )}

      {/* Top performing content */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Top Performing</h3>
        <div className="space-y-2">
          {items
            .sort((a, b) => {
              const aEng = Object.values(a.protocols).reduce((s, c) => s + c.engagement.likes, 0);
              const bEng = Object.values(b.protocols).reduce((s, c) => s + c.engagement.likes, 0);
              return bEng - aEng;
            })
            .slice(0, 5)
            .map((item) => {
              const totalEng = Object.values(item.protocols).reduce(
                (s, c) => s + c.engagement.likes + c.engagement.reposts + c.engagement.replies,
                0,
              );
              return (
                <div key={item.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] text-[var(--color-muted)]">
                      {item.type === 'post' ? '📝' : item.type === 'video' ? '🎬' : '📄'}
                    </span>
                    <span className="truncate text-[11px] text-[var(--color-fg)]">
                      {item.title || item.body.slice(0, 60)}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-[10px] text-[var(--color-muted)]">
                    {formatNumber(totalEng)} engagements
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function CreatorPostsPage() {
  const { ready, walletAddress } = useAuth();
  const [posts, setPosts] = useState<CrossPostRecord[]>([]);
  const [libraryItems, setLibraryItems] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [filter, setFilter] = useState<'all' | 'published' | 'failed'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadPosts = useCallback(async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/crosspost/author/${walletAddress}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { batches: CrossPostRecord[] };
        setPosts(data.batches ?? []);
      }
    } catch {
      // If the endpoint doesn't exist yet, we load from the batch list
    }

    // Also load content library items for analytics
    try {
      const libRes = await fetch(`/api/content/library?sort=engagement&limit=50`, {
        credentials: 'include',
      });
      if (libRes.ok) {
        const libData = (await libRes.json()) as { items: ContentLibraryItem[] };
        setLibraryItems(libData.items ?? []);
      }
    } catch {
      // content library may not be available yet
    }

    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    if (ready && walletAddress) {
      loadPosts();
    } else if (ready && !walletAddress) {
      setLoading(false);
    }
  }, [ready, walletAddress, loadPosts]);

  const handleDelete = useCallback((batchId: string) => {
    setPosts((prev) => prev.filter((p) => p.batchId !== batchId));
  }, []);

  const handleBulkDelete = useCallback((ids: string[]) => {
    setPosts((prev) => prev.filter((p) => !ids.includes(p.batchId)));
    setSelectedIds([]);
  }, []);

  const handleBulkRepublish = useCallback((ids: string[]) => {
    // In a full implementation, this would trigger re-publish
    console.log('Re-publish:', ids);
    setSelectedIds([]);
  }, []);

  const handlePublishComplete = useCallback(() => {
    setShowComposer(false);
    loadPosts();
  }, [loadPosts]);

  const handleSyncEngagement = useCallback(async () => {
    try {
      await fetch(`/api/content/library/sync-all`, {
        method: 'POST',
        credentials: 'include',
      });
      loadPosts();
    } catch {
      // ignore
    }
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    if (filter === 'all') return posts;
    if (filter === 'published')
      return posts.filter((p) => p.copies.some((c) => c.status === 'published'));
    if (filter === 'failed')
      return posts.filter((p) => p.copies.some((c) => c.status === 'failed'));
    return posts;
  }, [posts, filter]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  // Auth gate
  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
          <span className="text-3xl text-degen-400">📤</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Your Posts</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Connect your wallet to view and manage your cross-platform posts.
        </p>
        <div className="mt-8">
          <Link href="/creator" className="btn-primary text-sm">
            Go to Creator Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">Your Posts</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            All your published posts across every protocol
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/creator" className="btn-secondary text-sm">
            ← Creator Studio
          </Link>
          <Link href="/creator/content" className="btn-secondary text-sm">
            📚 Library
          </Link>
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="btn-primary text-sm"
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-lg bg-[var(--color-overlay)] p-1">
        {(['all', 'published', 'failed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-md px-4 py-2 text-xs font-medium transition-all ${
              filter === f
                ? 'bg-[var(--color-card)] text-[var(--color-fg)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {f === 'all' && 'All Posts'}
            {f === 'published' && '✅ Published'}
            {f === 'failed' && '❌ Failed'}
          </button>
        ))}
      </div>

      {/* View mode toggle */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setViewMode('card')}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
            viewMode === 'card'
              ? 'bg-degen-500/10 text-degen-400'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
          }`}
        >
          ⊞ Card
        </button>
        <button
          type="button"
          onClick={() => setViewMode('compact')}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
            viewMode === 'compact'
              ? 'bg-degen-500/10 text-degen-400'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
          }`}
        >
          ≡ Compact
        </button>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClear={() => setSelectedIds([])}
        onRepublish={handleBulkRepublish}
        onDelete={handleBulkDelete}
      />

      {/* Posts list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className={`${viewMode === 'compact' ? 'space-y-1' : 'space-y-3'}`}>
          {filteredPosts.map((record) =>
            viewMode === 'compact' ? (
              <div
                key={record.batchId}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 transition-colors hover:border-degen-500/20"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(record.batchId)}
                  onChange={() => toggleSelect(record.batchId)}
                  className="accent-degen-400"
                />
                <div className="flex flex-1 items-center gap-2 text-[11px]">
                  <span className="text-[var(--color-muted)]">{timeAgo(record.createdAt)}</span>
                  <span className="text-[var(--color-fg)]">
                    {record.copies.filter((c) => c.status === 'published').length}/
                    {record.copies.length}
                  </span>
                  <div className="flex gap-1">
                    {record.copies.map((c) => {
                      const meta = PLATFORM_META[c.protocol] ?? { icon: '📄', color: '#666' };
                      return (
                        <span
                          key={c.protocol}
                          className="text-[10px]"
                          style={{ color: c.status === 'failed' ? '#ff4444' : meta.color }}
                        >
                          {meta.icon}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComposer(true)}
                  className="text-[9px] text-degen-400 hover:underline"
                >
                  Re-post
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(record.batchId)}
                  className="text-[9px] text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <PostCard key={record.batchId} record={record} onDelete={handleDelete} />
            ),
          )}
        </div>
      ) : (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
            <span className="text-2xl text-[var(--color-muted)]">📝</span>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">No posts yet</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {filter === 'all'
              ? 'Publish your first cross-platform post to see it here.'
              : `No ${filter} posts found.`}
          </p>
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="btn-primary mt-6 text-sm"
          >
            Create Your First Post
          </button>
        </div>
      )}

      {/* Stats summary */}
      {posts.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Batches', value: posts.length, color: 'text-[var(--color-fg)]' },
            {
              label: 'Published',
              value: posts.reduce(
                (s, p) => s + p.copies.filter((c) => c.status === 'published').length,
                0,
              ),
              color: 'text-degen-400',
            },
            {
              label: 'Failed',
              value: posts.reduce(
                (s, p) => s + p.copies.filter((c) => c.status === 'failed').length,
                0,
              ),
              color: 'text-red-400',
            },
            {
              label: 'Platforms Used',
              value: new Set(posts.flatMap((p) => p.copies.map((c) => c.protocol))).size,
              color: 'text-blue-400',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center"
            >
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="mt-1 text-[11px] text-[var(--color-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content Library Analytics Section */}
      <ContentLibrarySection items={libraryItems} onSync={handleSyncEngagement} />

      {/* Composer Modal */}
      {showComposer && (
        <CrossPostComposer
          onPublishComplete={handlePublishComplete}
          mode="modal"
          onClose={() => setShowComposer(false)}
        />
      )}
    </div>
  );
}
