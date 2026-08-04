'use client';

/**
 * @degenfeed/web — <YouTubeFeed />
 *
 * Dedicated video feed for /feed/youtube.
 *
 * Fetches the bridge's YouTube provider (/api/feed/youtube) and renders
 * video cards with:
 *   - 16:9 thumbnail
 *   - video title
 *   - channel name
 *   - view count
 *   - duration (when available)
 *   - embedded YouTube player (click-to-play iframe, privacy-enhanced
 *     youtube-nocookie.com domain)
 *
 * Posts from the YouTube provider carry `protocol: 'youtube'`,
 * `contentType: 'video'`, an image embed (thumbnail) and raw metadata
 * (videoId, channelTitle, views, likes, duration, description).
 */

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ACCENT = '#ff0000';
const YT_COLOR = '#ff0000';

// ─── Helpers ───────────────────────────────────────────────────────────

function formatViews(views?: number): string {
  if (!views || views <= 0 || !Number.isFinite(views)) return '';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function stripHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface VideoMeta {
  videoId?: string;
  thumbnail?: string;
  channelTitle?: string;
  channelHandle?: string;
  views?: number;
  likes?: number;
  duration?: number;
  description?: string;
}

function getVideoMeta(post: UnifiedPost): VideoMeta {
  const raw = (post.raw ?? {}) as Record<string, unknown>;
  const videoEmbed = post.embeds?.find((e) => e.kind === 'video');
  const videoMeta = (videoEmbed?.meta ?? {}) as Record<string, unknown>;
  const imageEmbed = post.embeds?.find((e) => e.kind === 'image');
  return {
    videoId: (raw.videoId as string) || (videoMeta.videoId as string) || extractVideoId(post),
    thumbnail:
      (raw.thumbnail as string) || (videoMeta.thumbnail as string) || imageEmbed?.url || post.image,
    channelTitle:
      (raw.channelTitle as string) || (videoMeta.channel as string) || post.author.displayName,
    channelHandle: raw.channelHandle as string,
    views: (raw.views as number) || (videoMeta.views as number) || post.metrics?.views,
    likes: (raw.likes as number) || post.metrics?.likes,
    duration: (raw.duration as number) || (videoMeta.duration as number),
    description:
      (raw.description as string) || stripHtml(post.html) || post.text.replace(/^▶\s*/, ''),
  };
}

/** Fallback: pull the video id out of the watch URL. */
function extractVideoId(post: UnifiedPost): string | undefined {
  const videoEmbed = post.embeds?.find((e) => e.kind === 'video');
  const m = videoEmbed?.url?.match(/[?&]v=([\w-]{6,})/);
  return m?.[1];
}

/** Privacy-enhanced embed URL (no cookies). */
function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

function channelUrl(handle?: string, title?: string): string | undefined {
  if (handle) return `https://www.youtube.com/@${handle.replace(/^@/, '')}`;
  if (title) return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
  return undefined;
}

// ─── Video Card ────────────────────────────────────────────────────────

function VideoCard({ post }: { post: UnifiedPost }) {
  const meta = getVideoMeta(post);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const description = meta.description || post.text.replace(/^▶\s*/, '');
  const showDescription = expanded || description.length <= 160;
  const channelHref = channelUrl(meta.channelHandle, meta.channelTitle);

  return (
    <article
      className="group overflow-hidden rounded-xl border transition-colors hover:border-[var(--color-border)]"
      style={{ borderColor: `${ACCENT}18`, backgroundColor: 'var(--color-card)' }}
    >
      {/* Thumbnail / player */}
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {playing && meta.videoId ? (
          <iframe
            src={embedUrl(meta.videoId)}
            title={post.text}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                meta.thumbnail ||
                `https://i.ytimg.com/vi/${meta.videoId ?? 'unknown'}/hqdefault.jpg`
              }
              alt={post.text}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => meta.videoId && setPlaying(true)}
              aria-label={playing ? `Play ${post.text}` : `Play ${post.text}`}
              className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
              disabled={!meta.videoId}
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-xl text-black shadow-lg transition-transform group-hover:scale-110"
                style={{ backgroundColor: YT_COLOR }}
              >
                ▶
              </span>
            </button>
            {meta.duration ? (
              <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {formatDuration(meta.duration)}
              </span>
            ) : null}
          </>
        )}
      </div>

      {/* Meta */}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[var(--color-fg)]">
          {post.text.replace(/^▶\s*/, '')}
        </h3>

        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
            style={{ backgroundColor: `${ACCENT}18` }}
            aria-hidden="true"
          >
            ▶
          </span>
          {channelHref ? (
            <a
              href={channelHref}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium transition-colors hover:text-[var(--color-fg)]"
              style={{ color: 'var(--color-muted)' }}
            >
              {meta.channelTitle || 'YouTube'}
            </a>
          ) : (
            <span className="truncate font-medium">{meta.channelTitle || 'YouTube'}</span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--color-muted)]">
          <span title={new Date(post.createdAt).toLocaleString()}>
            📅 {timeAgo(post.createdAt)}
          </span>
          {formatViews(meta.views) ? <span>👁 {formatViews(meta.views)}</span> : null}
          {meta.likes ? (
            <span>👍 {meta.likes >= 1000 ? `${(meta.likes / 1000).toFixed(1)}K` : meta.likes}</span>
          ) : null}
        </div>

        {description && (
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
            {showDescription ? description : `${description.slice(0, 160)}…`}
            {description.length > 160 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="ml-1 font-medium underline"
                style={{ color: ACCENT }}
              >
                {expanded ? 'less' : 'more'}
              </button>
            )}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)] opacity-70">via YouTube</span>
          {meta.videoId && !playing && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: YT_COLOR }}
            >
              ▶ Watch
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Feed ──────────────────────────────────────────────────────────────

export function YouTubeFeed({ limit = 24 }: { limit?: number }) {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total?: number; fetchedAt?: number }>({});
  const [channelCount, setChannelCount] = useState<number>(15);

  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const url = new URL('/api/feed/youtube', window.location.origin);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);

      const json = (await res.json()) as {
        posts?: UnifiedPost[];
        data?: UnifiedPost[];
        meta?: { total?: number; fetchedAt?: number };
      };
      const feed = json.posts ?? json.data ?? [];
      // Videos only — skip any stray non-video posts defensively.
      const videos = feed.filter(
        (p) => p.contentType === 'video' || p.embeds?.some((e) => e.kind === 'video'),
      );
      setPosts(videos);
      setMeta(json.meta ?? {});
      setState(videos.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YouTube feed');
      setState('error');
    }
  }, [limit]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/feed/youtube/channels', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { channels?: unknown[]; meta?: { total?: number } };
      if (json.meta?.total) setChannelCount(json.meta.total);
    } catch {
      // non-critical — default channel count is fine
    }
  }, []);

  useEffect(() => {
    void fetchFeed();
    void fetchChannels();
  }, [fetchFeed, fetchChannels]);

  const totalViews = useMemo(
    () => posts.reduce((sum, p) => sum + ((p.metrics?.views ?? 0) || 0), 0),
    [posts],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          borderColor: `${ACCENT}33`,
          background: `linear-gradient(135deg, ${ACCENT}15 0%, ${ACCENT}05 100%)`,
        }}
      >
        <div className="flex items-center gap-4 p-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${ACCENT}20` }}
          >
            ▶
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--color-fg)]">YouTube</h2>
              {state === 'loaded' && (
                <span className="text-[10px] text-[var(--color-muted)]">
                  {meta.total ?? posts.length} videos
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              Top crypto, tech &amp; AI channels — Coin Bureau, Bankless, Finematics, Fireship, Two
              Minute Papers, AI Explained and more.
            </p>
          </div>
          <div className="hidden gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                {channelCount}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">channels</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                {posts.length}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">videos</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                {totalViews >= 1_000_000 ? `${(totalViews / 1_000_000).toFixed(1)}M` : totalViews}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">views</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {state === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm font-medium text-red-400">Couldn&apos;t load the YouTube feed</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{error}</p>
          <button
            type="button"
            onClick={() => void fetchFeed()}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && posts.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={`yt-skeleton-${i}`}
              className="animate-pulse overflow-hidden rounded-xl border"
              style={{ borderColor: `${ACCENT}10`, backgroundColor: 'var(--color-card)' }}
            >
              <div className="aspect-video w-full" style={{ backgroundColor: `${ACCENT}12` }} />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 rounded" style={{ backgroundColor: `${ACCENT}08` }} />
                <div className="h-3 w-1/2 rounded" style={{ backgroundColor: `${ACCENT}06` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {state === 'empty' && (
        <div
          className="rounded-xl border py-10 text-center"
          style={{ borderColor: `${ACCENT}22`, backgroundColor: `${ACCENT}05` }}
        >
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: `${ACCENT}18` }}
          >
            ▶
          </div>
          <h3 className="mb-1 text-base font-bold" style={{ color: ACCENT }}>
            No videos right now
          </h3>
          <p className="mx-auto max-w-xs text-sm text-[var(--color-muted)]">
            The YouTube aggregator is warming up. Check back soon!
          </p>
          <button
            type="button"
            onClick={() => void fetchFeed()}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Videos */}
      {state === 'loaded' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <VideoCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
