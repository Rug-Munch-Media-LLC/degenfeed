'use client';

/**
 * PodcastTabContent — Podcast episodes display for creator profiles
 *
 * Shows the creator's podcast episodes with inline audio player,
 * subscribe button, tip support, and cross-platform share.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { timeAgo } from './constants';
import type { ProfilePodcast, ProfilePodcastEpisode } from './types';

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatPlays(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Props ─────────────────────────────────────────────────────────────

interface PodcastTabContentProps {
  /** Creator's wallet address or handle */
  creatorId: string;
  /** Optional pre-fetched podcasts */
  initialPodcasts?: ProfilePodcast[];
}

// ─── Component ─────────────────────────────────────────────────────────

export default function PodcastTabContent({ creatorId, initialPodcasts }: PodcastTabContentProps) {
  const [podcasts, setPodcasts] = useState<ProfilePodcast[]>(initialPodcasts || []);
  const [loading, setLoading] = useState(!initialPodcasts);
  const [playingEpisode, setPlayingEpisode] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Fetch podcasts ─────────────────────────────────────────
  const fetchPodcasts = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/podcast/discover?limit=10&source=creator`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { podcasts: ProfilePodcast[] };
        setPodcasts(data.podcasts || []);
      }
    } catch (err) {
      console.error('[PodcastTabContent] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    if (!initialPodcasts) fetchPodcasts();
  }, [fetchPodcasts, initialPodcasts]);

  // ─── Audio play ─────────────────────────────────────────────
  const playEpisode = (episode: ProfilePodcastEpisode) => {
    if (playingEpisode === episode.id) {
      audioRef.current?.pause();
      setPlayingEpisode(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(episode.audioUrl);
    audioRef.current = audio;
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) setAudioProgress((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener('ended', () => setPlayingEpisode(null));
    audio.play().catch(() => {});
    setPlayingEpisode(episode.id);
    setAudioProgress(0);
  };

  // ─── Subscribe to creator ─────────────────────────────────────
  const handleSubscribe = (podcast: ProfilePodcast) => {
    if (podcast.feedUrl) {
      window.open(podcast.feedUrl, '_blank');
    }
    if (podcast.activityPubId) {
      window.open(podcast.activityPubId, '_blank');
    }
  };

  // ─── Tip episode ─────────────────────────────────────────────
  const handleTip = (episode: ProfilePodcastEpisode) => {
    // Navigate to tip page
    window.location.href = `/tip?to=${creatorId}&ref=episode:${episode.id}`;
  };

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-[var(--color-glass-border)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 skeleton rounded" />
                <div className="h-3 w-1/2 skeleton rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────
  if (podcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
          <span className="text-2xl">🎙</span>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">No Podcasts Yet</h3>
        <p className="max-w-xs text-xs text-[var(--color-muted)]">
          When this creator publishes podcast episodes, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Latest Episodes Widget */}
      {podcasts.slice(0, 1).map((podcast) => {
        const latestEpisodes = podcasts
          .flatMap((p) => (p.latestEpisode ? [{ ...p.latestEpisode, podcast: p }] : []))
          .slice(0, 5);

        return (
          <div key={podcast.id}>
            {latestEpisodes.length > 0 && (
              <div className="mb-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
                <div className="border-b border-[var(--color-glass-border)] px-4 py-3">
                  <h4 className="text-sm font-semibold text-[var(--color-fg)]">
                    🎙 Latest Episodes
                  </h4>
                </div>
                <div className="divide-y divide-[var(--color-glass-border)]">
                  {latestEpisodes.map((ep) => {
                    const _epData =
                      'podcast' in ep
                        ? (ep as ProfilePodcastEpisode & { podcast: ProfilePodcast })
                        : null;
                    const epObj = 'podcast' in ep ? ep : (ep as ProfilePodcastEpisode);

                    return (
                      <div
                        key={epObj.id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-card)]/50"
                      >
                        {/* Play Button */}
                        <button
                          onClick={() => playEpisode(epObj)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-black transition-all hover:brightness-110"
                          aria-label={playingEpisode === epObj.id ? 'Pause' : 'Play'}
                        >
                          <span className="text-sm">{playingEpisode === epObj.id ? '⏸' : '▶'}</span>
                        </button>

                        {/* Episode Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {epObj.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                            <span>⏱ {formatDuration(epObj.duration)}</span>
                            <span>•</span>
                            <span>🎧 {formatPlays(epObj.plays)}</span>
                            {epObj.publishedAt && (
                              <>
                                <span>•</span>
                                <span>{timeAgo(epObj.publishedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleTip(epObj)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                            title="Tip this episode"
                          >
                            💜
                          </button>
                          <a
                            href={epObj.audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                            title="Download audio"
                          >
                            ⬇
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Podcast Card */}
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-4">
                {/* Cover */}
                <div
                  className="h-16 w-16 shrink-0 rounded-xl bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${podcast.coverUrl || '/podcast-cover-placeholder.svg'})`,
                  }}
                />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-base font-bold text-[var(--color-fg)]">
                    {podcast.title}
                  </h4>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">
                    {podcast.description}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                    <span>{podcast.episodeCount} episodes</span>
                    <span>•</span>
                    <span>{formatPlays(podcast.totalPlays)} plays</span>
                  </div>
                </div>

                {/* Subscribe */}
                <button
                  onClick={() => handleSubscribe(podcast)}
                  className="shrink-0 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-black transition-all hover:brightness-110"
                >
                  🔔 Subscribe
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Progress bar for playing episode */}
      {playingEpisode && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${audioProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
