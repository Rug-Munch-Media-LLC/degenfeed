'use client';

/**
 * @degenfeed/web — /podcasts/[id] (Podcast Detail)
 *
 * Full podcast detail page with:
 *   - Cover art + description + host info
 *   - Episode list with play buttons
 *   - Persistent mini-audio player at bottom
 *   - Subscribe (RSS + ActivityPub follow)
 *   - Tip host button
 *   - Share button
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────

interface Podcast {
  id: string;
  title: string;
  description: string;
  category: string;
  coverUrl?: string;
  hostName: string;
  hostAddress: string;
  hostAvatarUrl?: string;
  language: string;
  explicit: boolean;
  website?: string;
  email?: string;
  fundingUrl?: string;
  keywords: string[];
  createdAt: number;
  updatedAt: number;
  episodeCount: number;
  totalPlays: number;
  subscriberCount: number;
  activityPubId?: string;
  feedUrl?: string;
}

interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  audioUrl: string;
  audioMimeType: string;
  duration: number;
  episodeNumber?: number;
  seasonNumber?: number;
  explicit: boolean;
  coverUrl?: string;
  status: string;
  publishedAt?: number;
  createdAt: number;
  plays: number;
  uniqueListeners: number;
  tipsReceived: string;
}

interface TipStatus {
  sending: boolean;
  success?: boolean;
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatPlays(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Mini Audio Player Component ──────────────────────────────────────

function MiniAudioPlayer({
  episode,
  onClose,
}: {
  episode: PodcastEpisode | null;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!episode) return;
    const audio = new Audio(episode.audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setPlaying(false));

    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [episode?.id, episode.audioUrl, episode]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  if (!episode) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        {/* Cover */}
        <div
          className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
          style={{
            backgroundImage: `url(${episode.coverUrl || '/podcast-cover-placeholder.svg'})`,
          }}
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{episode.title}</p>
          <p className="truncate text-xs text-[var(--color-text-tertiary)]">
            {formatDuration(Math.floor(currentTime))} /{' '}
            {formatDuration(Math.floor(duration || episode.duration))}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="hidden h-1.5 w-40 cursor-pointer rounded-full bg-[var(--color-bg-tertiary)] sm:block"
          onClick={seek}
        >
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-black transition-all hover:brightness-110"
        >
          <span className="text-lg">{playing ? '⏸' : '▶'}</span>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function PodcastDetailPage() {
  const params = useParams();
  const podcastId = params.id as string;

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [playingEpisode, setPlayingEpisode] = useState<PodcastEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [tipStatus, setTipStatus] = useState<TipStatus>({ sending: false });
  const [tipAmount, setTipAmount] = useState('0.01');
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipChain, setTipChain] = useState<'ethereum' | 'solana'>('ethereum');

  // ─── Fetch podcast ──────────────────────────────────────────────

  const fetchPodcast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/podcast/${podcastId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load podcast (${res.status})`);
      const data = (await res.json()) as { podcast: Podcast };
      setPodcast(data.podcast);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load podcast');
    } finally {
      setLoading(false);
    }
  }, [podcastId]);

  // ─── Fetch episodes ─────────────────────────────────────────────

  const fetchEpisodes = useCallback(async () => {
    try {
      const res = await fetch(`/api/podcast/${podcastId}/episodes?status=published`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { episodes: PodcastEpisode[]; total: number };
        setEpisodes(data.episodes || []);
      }
    } catch {
      /* non-critical */
    }
  }, [podcastId]);

  useEffect(() => {
    fetchPodcast();
    fetchEpisodes();
  }, [fetchPodcast, fetchEpisodes]);

  // ─── Subscribe ─────────────────────────────────────────────────

  const handleSubscribe = () => {
    if (podcast?.feedUrl) {
      // RSS subscription
      window.open(podcast.feedUrl, '_blank');
    }
    setSubscribed(true);
  };

  // ─── Tip ───────────────────────────────────────────────────────

  const handleTip = async () => {
    if (!playingEpisode) return;
    setTipStatus({ sending: true });
    try {
      const res = await fetch(`/api/podcast/episode/${playingEpisode.id}/tip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chain: tipChain,
          amount: tipAmount,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || 'Tip failed');
      }
      setTipStatus({ sending: false, success: true });
      setShowTipModal(false);
    } catch (err) {
      setTipStatus({
        sending: false,
        success: false,
        error: err instanceof Error ? err.message : 'Tip failed',
      });
    }
  };

  // ─── Share ─────────────────────────────────────────────────────

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: podcast?.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  // ─── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] p-4">
        <div className="mx-auto max-w-4xl animate-pulse">
          <div className="flex gap-6">
            <div className="h-48 w-48 shrink-0 rounded-2xl bg-[var(--color-bg-secondary)]" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-8 w-64 rounded" />
              <div className="skeleton h-4 w-96 rounded" />
              <div className="skeleton h-4 w-48 rounded" />
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl bg-[var(--color-bg-secondary)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────

  if (error || !podcast) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg-primary)]">
        <span className="text-5xl">⚠️</span>
        <p className="text-lg font-semibold">{error || 'Podcast not found'}</p>
        <Link
          href="/podcasts"
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black"
        >
          ← Back to Podcasts
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* ─── Hero Section ───────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link
            href="/podcasts"
            className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            ← Back to Podcasts
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Cover Art */}
            <div
              className="relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl bg-cover bg-center shadow-xl"
              style={{
                backgroundImage: `url(${podcast.coverUrl || '/podcast-cover-placeholder.svg'})`,
              }}
            >
              <span
                className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white shadow"
                style={{
                  backgroundColor:
                    (
                      {
                        crypto: '#F7931A',
                        tech: '#00FF41',
                        defi: '#627EEA',
                        nfts: '#FF6B35',
                        culture: '#E1306C',
                        news: '#1DA1F2',
                        trading: '#00C853',
                        gaming: '#9146FF',
                        science: '#00BCD4',
                        interviews: '#FF5722',
                      } as Record<string, string>
                    )[podcast.category] || '#888',
                }}
              >
                {podcast.category}
              </span>
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col justify-center">
              <h1 className="text-3xl font-bold">{podcast.title}</h1>
              <p className="mt-2 line-clamp-3 text-[var(--color-text-secondary)]">
                {podcast.description}
              </p>

              {/* Host */}
              <div className="mt-4 flex items-center gap-3">
                {podcast.hostAvatarUrl ? (
                  <img
                    src={podcast.hostAvatarUrl}
                    alt={podcast.hostName}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-lg">
                    🎙
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold">{podcast.hostName}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {podcast.episodeCount} episodes · {formatPlays(podcast.totalPlays)} total plays
                    {podcast.subscriberCount > 0 &&
                      ` · ${formatPlays(podcast.subscriberCount)} subscribers`}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleSubscribe}
                  className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-all hover:brightness-110"
                >
                  <span>{subscribed ? '✅' : '🔔'}</span>
                  <span>{subscribed ? 'Subscribed' : 'Subscribe'}</span>
                </button>
                <button
                  onClick={() => setShowTipModal(true)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-all hover:border-[var(--color-accent)]"
                >
                  <span>💜</span>
                  <span>Tip Host</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-all hover:border-[var(--color-accent)]"
                >
                  <span>🔗</span>
                  <span>Share</span>
                </button>
                {podcast.feedUrl && (
                  <a
                    href={podcast.feedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-all hover:border-[var(--color-accent)]"
                  >
                    <span>📡</span>
                    <span>RSS Feed</span>
                  </a>
                )}
                {podcast.activityPubId && (
                  <a
                    href={podcast.activityPubId}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-all hover:border-[var(--color-accent)]"
                  >
                    <span>🐘</span>
                    <span>Fediverse</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Episodes Section ──────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h2 className="mb-4 text-lg font-bold">
          Episodes
          <span className="ml-2 text-sm font-normal text-[var(--color-text-tertiary)]">
            ({episodes.length})
          </span>
        </h2>

        {episodes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-[var(--color-text-secondary)]">
            <span className="text-4xl">🎙</span>
            <p>No episodes published yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                className={`group flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-4 transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] ${
                  playingEpisode?.id === ep.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg-secondary)]'
                    : ''
                }`}
              >
                {/* Play Button */}
                <button
                  onClick={() => setPlayingEpisode(playingEpisode?.id === ep.id ? null : ep)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-black transition-all hover:brightness-110"
                >
                  <span className="text-xl">{playingEpisode?.id === ep.id ? '⏸' : '▶'}</span>
                </button>

                {/* Episode Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {ep.episodeNumber && (
                      <span className="shrink-0 text-xs font-semibold text-[var(--color-text-tertiary)]">
                        EP {ep.episodeNumber}
                      </span>
                    )}
                    <h3 className="truncate font-semibold">{ep.title}</h3>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-text-secondary)]">
                    {ep.description}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                    <span>🎧 {formatPlays(ep.plays)}</span>
                    <span>⏱ {formatDuration(ep.duration)}</span>
                    {ep.publishedAt && <span>📅 {timeAgo(ep.publishedAt)}</span>}
                    {Number(ep.tipsReceived) > 0 && <span>💜 {ep.tipsReceived} tipped</span>}
                  </div>
                </div>

                {/* Progress indicator if currently playing */}
                {playingEpisode?.id === ep.id && (
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <div className="flex h-2 w-16 items-center gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]"
                          style={{
                            height: `${Math.random() * 16 + 4}px`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Mini Audio Player ─────────────────────────────────── */}
      <MiniAudioPlayer episode={playingEpisode} onClose={() => setPlayingEpisode(null)} />

      {/* ─── Tip Modal ─────────────────────────────────────────── */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">💜 Tip the Host</h3>
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipStatus({ sending: false });
                }}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            </div>

            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              Support {podcast.hostName} for creating great content.
            </p>

            {/* Chain selector */}
            <div className="mb-4 flex gap-2">
              {(['ethereum', 'solana'] as const).map((chain) => (
                <button
                  key={chain}
                  onClick={() => setTipChain(chain)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    tipChain === chain
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {chain === 'ethereum' ? '🔷 Ethereum' : '🟣 Solana'}
                </button>
              ))}
            </div>

            {/* Amount */}
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Amount ({tipChain === 'ethereum' ? 'ETH' : 'SOL'})
            </label>
            <input
              type="number"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              min="0.001"
              step="0.001"
              className="mb-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
            />

            {tipStatus.error && <p className="mb-3 text-sm text-red-400">{tipStatus.error}</p>}

            <button
              onClick={handleTip}
              disabled={tipStatus.sending}
              className="w-full rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
            >
              {tipStatus.sending
                ? 'Sending…'
                : `Send ${tipAmount} ${tipChain === 'ethereum' ? 'ETH' : 'SOL'}`}
            </button>

            {tipStatus.success && (
              <p className="mt-3 text-center text-sm text-green-400">
                ✅ Tip sent! Thank you for supporting creators.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom padding for mini player */}
      <div className="h-20" />
    </div>
  );
}
