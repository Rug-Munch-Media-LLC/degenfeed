'use client';

import type { CreatorVideoMeta } from './useCreatorVideos';
import { useCreatorVideo } from './useCreatorVideos';

// === Helpers =============================================================

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// === Mini bar chart ======================================================

function MiniBarChart({
  data,
  height = 80,
}: {
  data: Array<{ date: string; count: number }>;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((point, i) => {
        const pct = (point.count / max) * 100;
        return (
          <div
            key={point.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
          >
            <div
              className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(180deg, #00ff41, #00ff4122)`,
                minHeight: pct > 0 ? 2 : 0,
              }}
            />
            {i % 5 === 0 && (
              <span className="mt-1 text-[8px] text-[var(--color-muted)]">
                {point.date.slice(5)}
              </span>
            )}
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-fg)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {point.date}: {formatCompact(point.count)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === Stat card ===========================================================

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
      {accent && <div className="mb-3 h-0.5 w-8 rounded-full" style={{ background: accent }} />}
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-fg)]">{value}</div>
      {sub && <span className="text-[10px] text-[var(--color-muted)]">{sub}</span>}
    </div>
  );
}

// === Protocol breakdown ==================================================

function ProtocolBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-24 shrink-0 text-xs text-[var(--color-muted)] truncate">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-overlay)]">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
        {formatCompact(value)}
      </span>
    </div>
  );
}

// === Main Analytics Panel ================================================

interface VideoAnalyticsProps {
  video: CreatorVideoMeta;
  onClose: () => void;
}

export default function VideoAnalytics({ video, onClose }: VideoAnalyticsProps) {
  const { analytics, loading, error } = useCreatorVideo(video.uuid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">Video Analytics</h2>
            <p className="mt-1 truncate text-sm text-[var(--color-muted)]">{video.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
            <div className="skeleton h-48 rounded-xl" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {analytics && !loading && (
          <div className="space-y-8">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Total Views"
                value={formatCompact(analytics.totalViews)}
                sub="All time"
                accent="#00ff41"
              />
              <StatCard
                label="Likes"
                value={formatCompact(analytics.totalLikes)}
                accent="#8a63d2"
              />
              <StatCard
                label="Tips Earned"
                value={`$${(analytics.totalTipsUsdCents / 100).toFixed(2)}`}
                sub={`${analytics.totalTips} tip${analytics.totalTips !== 1 ? 's' : ''}`}
                accent="#f7931a"
              />
              <StatCard
                label="Avg Watch Time"
                value={formatDuration(analytics.avgWatchTimeS)}
                sub={`${formatPercent(analytics.completionRate)} completion`}
                accent="#1185fe"
              />
            </div>

            {/* Views over time */}
            {analytics.viewsOverTime.length > 0 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Views Over Time
                </h3>
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[300px]">
                    <MiniBarChart data={analytics.viewsOverTime} height={100} />
                  </div>
                </div>
              </div>
            )}

            {analytics.tipsOverTime.length > 0 && analytics.totalTipsUsdCents > 0 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Tips Over Time
                </h3>
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[300px]">
                    <MiniBarChart data={analytics.tipsOverTime} height={80} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Source breakdown */}
              {Object.keys(analytics.sourceBreakdown).length > 0 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                    Traffic Sources
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(analytics.sourceBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([source, count]) => {
                        const maxVal = Math.max(...Object.values(analytics.sourceBreakdown));
                        return (
                          <ProtocolBar
                            key={source}
                            label={source}
                            value={count}
                            max={maxVal}
                            color="#00ff41"
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Protocol breakdown */}
              {Object.keys(analytics.protocolBreakdown).length > 0 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                    Views by Protocol
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(analytics.protocolBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([protocol, count]) => {
                        const colors: Record<string, string> = {
                          DegenFeed: '#00ff41',
                          ActivityPub: '#6364ff',
                          Nostr: '#8e30eb',
                          'AT Protocol': '#1185fe',
                          Farcaster: '#8a63d2',
                          Lens: '#abfe2c',
                        };
                        const maxVal = Math.max(...Object.values(analytics.protocolBreakdown));
                        return (
                          <ProtocolBar
                            key={protocol}
                            label={protocol}
                            value={count}
                            max={maxVal}
                            color={colors[protocol] ?? '#666'}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Video info footer */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <h3 className="mb-2 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                Video Info
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[var(--color-muted)]">UUID: </span>
                  <span className="font-mono text-[var(--color-fg)]">
                    {video.uuid.slice(0, 12)}...
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Category: </span>
                  <span className="text-[var(--color-fg)]">{video.category}</span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Privacy: </span>
                  <span className="text-[var(--color-fg)]">
                    {video.privacy === 1 ? 'Public' : video.privacy === 2 ? 'Unlisted' : 'Private'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Type: </span>
                  <span className="text-[var(--color-fg)]">
                    {video.isShort ? 'Short' : 'Standard'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--color-muted)]">Tags: </span>
                  <span className="text-[var(--color-fg)]">
                    {video.tags.map((t) => `#${t}`).join(', ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
