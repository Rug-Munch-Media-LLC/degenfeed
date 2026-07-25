'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CreatorVideoMeta } from '../../../components/creator/useCreatorVideos';
import type { VideoAnalyticsData } from './types';
import { formatCompact, timeAgo } from './types';

export default function ContentTab() {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'short' | 'stream'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'revenue'>('newest');
  const [videos, setVideos] = useState<CreatorVideoMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/creator/videos?limit=50', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setVideos(data.videos ?? []);
        }
      } catch { /* API not ready */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let items = [...videos];
    if (filterType === 'video') items = items.filter((v) => v.type === 'video' || !v.type);
    if (filterType === 'short') items = items.filter((v) => v.type === 'short');
    if (filterType === 'stream') items = items.filter((v) => v.type === 'stream');
    if (sortBy === 'views') items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    else if (sortBy === 'revenue') items.sort((a, b) => (b.tipRevenue ?? 0) - (a.tipRevenue ?? 0));
    else items.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return items;
  }, [videos, filterType, sortBy]);

  const analytics = useMemo<VideoAnalyticsData>(() => {
    const totalViews = videos.reduce((s, v) => s + (v.views ?? 0), 0);
    const totalWatchTime = videos.reduce((s, v) => s + (v.watchTime ?? 0), 0);
    const tipRevenue = videos.reduce((s, v) => s + (v.tipRevenue ?? 0), 0);
    const newFollowers = videos.reduce((s, v) => s + (v.newFollowers ?? 0), 0);
    const avgViewDuration = totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0;
    const topContent = [...videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5)
      .map((v) => ({ title: v.title || 'Untitled', views: v.views ?? 0, revenue: v.tipRevenue ?? 0 }));
    const bestTimes: VideoAnalyticsData['bestTimes'] = [
      { day: 'Monday', hour: 18, engagement: 89 }, { day: 'Wednesday', hour: 12, engagement: 76 },
      { day: 'Friday', hour: 20, engagement: 94 }, { day: 'Saturday', hour: 14, engagement: 82 },
    ];
    return { totalViews, totalWatchTime, avgViewDuration, tipRevenue, newFollowers, topContent, bestTimes };
  }, [videos]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton h-48 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Views', value: formatCompact(analytics.totalViews), icon: '👁️' },
          { label: 'Watch Time', value: `${Math.floor(analytics.totalWatchTime / 3600)}h`, icon: '⏱️' },
          { label: 'Tip Revenue', value: `$${analytics.tipRevenue.toFixed(2)}`, icon: '💰' },
          { label: 'New Followers', value: formatCompact(analytics.newFollowers), icon: '👥' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <p className="text-[10px] text-[var(--color-muted)] flex items-center gap-1"><span>{card.icon}</span>{card.label}</p>
            <p className="mt-1 text-lg font-bold text-degen-400">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'video', 'short', 'stream'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setFilterType(t)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${filterType === t ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'}`}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="ml-auto">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2 py-1.5 text-[10px] text-[var(--color-fg)]">
            <option value="newest">Newest</option>
            <option value="views">Most Views</option>
            <option value="revenue">Top Revenue</option>
          </select>
        </div>
      </div>

      {/* Content Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] p-12 text-center">
          <span className="mb-2 text-3xl block">📹</span>
          <p className="text-sm text-[var(--color-muted)]">No content yet. Create your first short or upload a video!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
            <div key={video.id} className="group relative rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden hover:border-degen-500/30 transition-all">
              <div className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                <span className="text-2xl">{video.type === 'short' ? '🎬' : video.type === 'stream' ? '📡' : '📹'}</span>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-[var(--color-fg)] truncate">{video.title || 'Untitled'}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                  <span>{formatCompact(video.views ?? 0)} views</span>
                  <span>&middot;</span>
                  <span>{timeAgo(new Date(video.createdAt ?? Date.now()).getTime())}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
