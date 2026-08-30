'use client';

/**
 * @degenfeed/web — <PodcastFeed />
 *
 * Dedicated podcast episode feed for /feed/podcast.
 *
 * Fetches the bridge's aggregated crypto/web3 podcast feed
 * (/api/feed/podcast) and renders episode cards with:
 *   - podcast title (show)
 *   - episode title
 *   - description
 *   - inline audio player (HTML5 <audio>)
 *   - duration
 *   - publish date
 *
 * Episode posts from the RSS provider carry `contentType: 'podcast'`,
 * an `audio` embed, and raw metadata (audioUrl, duration, podcastTitle).
 */

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const ACCENT = '#7c3aed';

// ─── Helpers ───────────────────────────────────────────────────────────

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

interface EpisodeMeta {
  audioUrl?: string;
  duration?: number;
  podcastTitle?: string;
  description?: string;
  feedLabel?: string;
  image?: string;
}

function getEpisodeMeta(post: UnifiedPost): EpisodeMeta {
  const raw = (post.raw ?? {}) as Record<string, unknown>;
  const audioEmbed = post.embeds?.find((e) => e.kind === 'audio');
  const audioMeta = (audioEmbed?.meta ?? {}) as Record<string, unknown>;
  return {
    audioUrl: (raw.audioUrl as string) || audioEmbed?.url,
    duration: (raw.duration as number) || (audioMeta.duration as number),
    podcastTitle:
      (raw.podcastTitle as string) || (audioMeta.podcast as string) || post.author.displayName,
    description: (raw.description as string) || stripHtml(post.html) || post.text,
    feedLabel: raw.feedLabel as string,
    image:
      (raw.image as string) ||
      (post.image as string) ||
      (post.media ?? []).find((m) => m.type === 'image')?.url,
  };
}

// ─── Episode Card ──────────────────────────────────────────────────────

function EpisodeAudioPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', () => setError(true));
    const onError = () => setError(true);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || error) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play().catch(() => setError(true));
    }
    setPlaying(!playing);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="mt-3 rounded-lg border p-2" style={{ borderColor: `${ACCENT}22` }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition-all hover:brightness-110"
          style={{ backgroundColor: ACCENT }}
        >
          <span className="text-sm">{error ? '⚠' : playing ? '⏸' : '▶'}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="h-1.5 w-full cursor-pointer rounded-full bg-[var(--color-bg-tertiary)]"
            onClick={(e) => {
              const audio = audioRef.current;
              if (!audio || !duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              audio.currentTime = pct * duration;
            }}
            onKeyDown={(e) => {
              const audio = audioRef.current;
              if (!audio) return;
              const step = duration ? duration / 20 : 5;
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                audio.currentTime = Math.min(duration, audio.currentTime + step);
              } else if (e.key === 'ArrowLeft') {
                audio.currentTime = Math.max(0, audio.currentTime - step);
              }
            }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: ACCENT }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>{error ? 'audio unavailable' : formatDuration(current) || '0:00'}</span>
            <span>{error ? '' : formatDuration(duration)}</span>
          </div>
        </div>
      </div>
      {/* Audio element kept in DOM so the player works without extra libs */}
      <audio ref={audioRef} src={src} preload="none" className="hidden">
        <track kind="captions" />
      </audio>
    </div>
  );
}

function EpisodeCard({ post }: { post: UnifiedPost }) {
  const meta = getEpisodeMeta(post);
  const [expanded, setExpanded] = useState(false);
  const description = meta.description || post.text;
  const showDescription = expanded || description.length <= 220;

  return (
    <article
      className="rounded-xl border p-4 transition-colors hover:border-[var(--color-border)]"
      style={{ borderColor: `${ACCENT}18`, backgroundColor: 'var(--color-card)' }}
    >
      <div className="flex items-start gap-3">
        {meta.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.image}
            alt={meta.podcastTitle || 'podcast'}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl"
            style={{ backgroundColor: `${ACCENT}18` }}
          >
            🎙️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold" style={{ color: ACCENT }}>
            {meta.podcastTitle || meta.feedLabel || 'Podcast'}
          </p>
          <h3 className="mt-0.5 text-sm font-bold leading-snug text-[var(--color-fg)]">
            {post.text}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted)]">
            <span title={new Date(post.createdAt).toLocaleString()}>
              📅 {timeAgo(post.createdAt)}
            </span>
            {meta.duration ? <span>⏱ {formatDuration(meta.duration)}</span> : null}
            {post.niches?.slice(0, 2).map((n) => (
              <span key={n} className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5">
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      {description && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">
          {showDescription ? description : `${description.slice(0, 220)}…`}
          {description.length > 220 && (
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

      {meta.audioUrl && <EpisodeAudioPlayer src={meta.audioUrl} title={post.text} />}

      {meta.feedLabel && (
        <p className="mt-2 text-[10px] text-[var(--color-muted)] opacity-70">
          via {meta.feedLabel}
        </p>
      )}
    </article>
  );
}

// ─── Feed ──────────────────────────────────────────────────────────────

export function PodcastFeed({ limit = 25 }: { limit?: number }) {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total?: number; fetchedAt?: number }>({});

  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const url = new URL('/api/feed/podcast', window.location.origin);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);

      const json = (await res.json()) as {
        posts?: UnifiedPost[];
        data?: UnifiedPost[];
        meta?: { total?: number; fetchedAt?: number };
      };
      const feed = json.posts ?? json.data ?? [];
      // Podcasts only — skip any stray non-podcast posts defensively.
      const episodes = feed.filter(
        (p) => p.contentType === 'podcast' || p.embeds?.some((e) => e.kind === 'audio'),
      );
      setPosts(episodes);
      setMeta(json.meta ?? {});
      setState(episodes.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load podcast feed');
      setState('error');
    }
  }, [limit]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

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
            🎙️
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--color-fg)]">Podcasts</h2>
              {state === 'loaded' && (
                <span className="text-[10px] text-[var(--color-muted)]">
                  {meta.total ?? posts.length} episodes
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              Top crypto & web3 shows — Bankless, Unchained, Empire, 0xResearch, Bell Curve,
              Chopping Block, Lightspeed and more.
            </p>
          </div>
          <div className="hidden gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                10
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">shows</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                {posts.length}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">episodes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {state === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm font-medium text-red-400">Couldn&apos;t load the podcast feed</p>
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
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`podcast-skeleton-${i}`}
              className="animate-pulse rounded-xl border p-4"
              style={{ borderColor: `${ACCENT}10`, backgroundColor: 'var(--color-card)' }}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg" style={{ backgroundColor: `${ACCENT}15` }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded" style={{ backgroundColor: `${ACCENT}10` }} />
                  <div className="h-3 w-3/4 rounded" style={{ backgroundColor: `${ACCENT}08` }} />
                </div>
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
            🎙️
          </div>
          <h3 className="mb-1 text-base font-bold" style={{ color: ACCENT }}>
            No episodes right now
          </h3>
          <p className="mx-auto max-w-xs text-sm text-[var(--color-muted)]">
            The podcast aggregator is warming up. Check back soon!
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

      {/* Episodes */}
      {state === 'loaded' && (
        <div className="space-y-3">
          {posts.map((post) => (
            <EpisodeCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
