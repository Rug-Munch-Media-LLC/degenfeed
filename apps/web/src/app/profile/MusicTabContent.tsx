'use client';

/**
 * MusicTabContent — Funkwhale music tracks display for creator profiles
 *
 * Shows the creator's music tracks/albums from Funkwhale with
 * inline play button, tip per track, and playlist support.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCount } from './constants';
import type { ProfileMusicAlbum, ProfileMusicTrack } from './types';

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Props ─────────────────────────────────────────────────────────────

interface MusicTabContentProps {
  /** Creator's wallet address or handle */
  creatorId: string;
  /** Creator's Funkwhale artist name (if known) */
  artistName?: string;
}

// ─── Component ─────────────────────────────────────────────────────────

export default function MusicTabContent({ creatorId, artistName }: MusicTabContentProps) {
  const [tracks, setTracks] = useState<ProfileMusicTrack[]>([]);
  const [albums, _setAlbums] = useState<ProfileMusicAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'tracks' | 'albums'>('tracks');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Fetch tracks from Funkwhale ─────────────────────────────
  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      // Try fetching from our bridge which aggregates Funkwhale
      const params = new URLSearchParams();
      if (artistName) params.set('artist', artistName);
      params.set('limit', '50');

      const res = await fetch(`/api/feed/funkwhale?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { posts?: Array<Record<string, unknown>> };
        if (data.posts) {
          const mapped: ProfileMusicTrack[] = data.posts.map((post) => {
            const raw = post.raw as Record<string, unknown> | undefined;
            const uploads = (raw?.uploads as Array<Record<string, unknown>>) || [];
            const upload = uploads[0];
            const epAuthor = post.author as Record<string, unknown> | undefined;
            const epArtist = raw?.artist as Record<string, unknown> | undefined;

            return {
              id: String(post.id || ''),
              title: String(post.text || '').split('\n')[0] || 'Untitled',
              artistName: String(
                epArtist?.name || epAuthor?.displayName || artistName || 'Unknown Artist',
              ),
              albumTitle: raw?.album
                ? String((raw.album as Record<string, unknown>).title || '')
                : undefined,
              audioUrl: upload ? String(upload.audio_file || '') : '',
              coverUrl: (epArtist?.cover as Record<string, unknown>)?.urls
                ? String(
                    ((epArtist.cover as Record<string, unknown>).urls as Record<string, unknown>)
                      .original || '',
                  )
                : undefined,
              duration: upload ? Number(upload.duration || 0) : 0,
              listens: Number(
                post.metrics?.likes || (post.metrics as Record<string, unknown>)?.likes || 0,
              ),
              tipsReceived: '0',
              publishedAt: post.createdAt as number,
            } as ProfileMusicTrack;
          });
          setTracks(mapped.filter((t) => t.audioUrl));
        }
      }
    } catch (err) {
      console.error('[MusicTabContent] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [artistName]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // ─── Audio play ─────────────────────────────────────────────
  const playTrack = (track: ProfileMusicTrack) => {
    if (playingTrack === track.id) {
      audioRef.current?.pause();
      setPlayingTrack(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(track.audioUrl);
    audioRef.current = audio;
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener('ended', () => setPlayingTrack(null));
    audio.play().catch(() => {});
    setPlayingTrack(track.id);
    setProgress(0);
  };

  // ─── Tip track ──────────────────────────────────────────────
  const handleTip = (track: ProfileMusicTrack) => {
    window.location.href = `/tip?to=${creatorId}&ref=track:${track.id}`;
  };

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] p-3"
          >
            <div className="h-10 w-10 rounded-lg skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 skeleton rounded" />
              <div className="h-2 w-1/3 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
          <span className="text-2xl">🎵</span>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">No Music Yet</h3>
        <p className="max-w-xs text-xs text-[var(--color-muted)]">
          When this creator uploads music tracks on Funkwhale, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('tracks')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            viewMode === 'tracks'
              ? 'bg-[var(--color-accent)] text-black'
              : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'
          }`}
        >
          🎵 Tracks
        </button>
        <button
          onClick={() => setViewMode('albums')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            viewMode === 'albums'
              ? 'bg-[var(--color-accent)] text-black'
              : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'
          }`}
        >
          💿 Albums
        </button>
      </div>

      {/* Track List */}
      {viewMode === 'tracks' && (
        <div className="divide-y divide-[var(--color-glass-border)] rounded-xl border border-[var(--color-glass-border)] overflow-hidden">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-card)]/50 ${
                playingTrack === track.id ? 'bg-[var(--color-accent)]/5' : ''
              }`}
            >
              {/* Track Number / Play */}
              <button
                onClick={() => playTrack(track)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-black transition-all hover:brightness-110"
                aria-label={playingTrack === track.id ? 'Pause' : 'Play'}
              >
                <span className="text-xs">{playingTrack === track.id ? '⏸' : '▶'}</span>
              </button>

              {/* Cover */}
              <div
                className="h-9 w-9 shrink-0 rounded-lg bg-cover bg-center"
                style={{
                  backgroundImage: `url(${track.coverUrl || '/music-placeholder.svg'})`,
                }}
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold ${playingTrack === track.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]'}`}
                >
                  {track.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span>{track.artistName}</span>
                  {track.albumTitle && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">{track.albumTitle}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>⏱ {formatDuration(track.duration)}</span>
                  <span>•</span>
                  <span>🎧 {formatCount(track.listens)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleTip(track)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  title="Tip this track"
                >
                  💜
                </button>
                <a
                  href={track.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  title="Download"
                >
                  ⬇
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Album View */}
      {viewMode === 'albums' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {albums.length === 0
            ? tracks.length > 0 &&
              // Show grouped by album title
              [...new Set(tracks.filter((t) => t.albumTitle).map((t) => t.albumTitle))].map(
                (albumTitle) => {
                  const albumTracks = tracks.filter((t) => t.albumTitle === albumTitle);
                  return (
                    <div
                      key={albumTitle}
                      className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3"
                    >
                      <div
                        className="mb-2 aspect-square w-full rounded-lg bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${albumTracks[0]?.coverUrl || '/music-placeholder.svg'})`,
                        }}
                      />
                      <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                        {albumTitle}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {albumTracks.length} tracks
                      </p>
                    </div>
                  );
                },
              )
            : albums.map((album) => (
                <div
                  key={album.id}
                  className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3"
                >
                  <div
                    className="mb-2 aspect-square w-full rounded-lg bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${album.coverUrl || '/music-placeholder.svg'})`,
                    }}
                  />
                  <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                    {album.title}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {album.trackCount} tracks · {formatCount(album.totalListens)} plays
                  </p>
                </div>
              ))}
        </div>
      )}

      {/* Progress bar */}
      {playingTrack && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
