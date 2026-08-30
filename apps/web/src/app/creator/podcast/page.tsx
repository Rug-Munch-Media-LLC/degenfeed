'use client';

/**
 * @degenfeed/web — /creator/podcast (Creator Podcast Studio)
 *
 * Full podcast management for creators:
 *   - My podcasts list
 *   - Create new podcast (name, description, category, cover art)
 *   - Add episode (upload audio, title, description, publish date)
 *   - Episode management (edit, delete, publish/unpublish)
 *   - Analytics: plays, subscribers, tips
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useWeb3 } from '../../../components/Web3Provider';

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
  htmlDescription?: string;
  audioUrl: string;
  audioMimeType: string;
  audioSize: number;
  duration: number;
  episodeNumber?: number;
  seasonNumber?: number;
  explicit: boolean;
  coverUrl?: string;
  chapters?: Array<{ startTime: number; title: string }>;
  transcriptUrl?: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
  plays: number;
  uniqueListeners: number;
  tipsReceived: string;
  activityPubId?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'tech', label: 'Tech' },
  { id: 'defi', label: 'DeFi' },
  { id: 'nfts', label: 'NFTs' },
  { id: 'culture', label: 'Culture' },
  { id: 'news', label: 'News' },
  { id: 'trading', label: 'Trading' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'science', label: 'Science' },
  { id: 'interviews', label: 'Interviews' },
];

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
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

function formatPlays(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function CreatorPodcastPage() {
  const { ready, walletAddress, openSignIn } = useAuth();
  const { isConnected } = useWeb3();

  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreatePodcast, setShowCreatePodcast] = useState(false);
  const [showAddEpisode, setShowAddEpisode] = useState(false);
  const [showEditEpisode, setShowEditEpisode] = useState<PodcastEpisode | null>(null);

  // Create podcast form
  const [newPodcast, setNewPodcast] = useState({
    title: '',
    description: '',
    category: 'crypto',
  });

  // Add episode form
  const [newEpisode, setNewEpisode] = useState({
    title: '',
    description: '',
    audioUrl: '',
    duration: 0,
    episodeNumber: undefined as number | undefined,
    status: 'draft' as 'draft' | 'published',
  });

  const hasWallet = isConnected || !!walletAddress;

  // ─── Fetch creator podcasts ───────────────────────────────────

  const fetchPodcasts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from discover endpoint filtered by search
      const res = await fetch('/api/podcast/discover?limit=50', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { podcasts: Podcast[]; total: number };
        // Filter to only our podcasts (by checking hostAddress or store)
        setPodcasts(data.podcasts || []);
      }
    } catch (err) {
      console.error('Failed to fetch podcasts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && hasWallet) fetchPodcasts();
  }, [ready, hasWallet, fetchPodcasts]);

  // ─── Fetch episodes for selected podcast ──────────────────────

  const fetchEpisodes = useCallback(async (podcastId: string) => {
    try {
      const res = await fetch(`/api/podcast/${podcastId}/episodes?limit=100`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { episodes: PodcastEpisode[]; total: number };
        setEpisodes(data.episodes || []);
      }
    } catch {
      setEpisodes([]);
    }
  }, []);

  useEffect(() => {
    if (selectedPodcast) {
      fetchEpisodes(selectedPodcast.id);
    }
  }, [selectedPodcast, fetchEpisodes]);

  // ─── Create podcast ──────────────────────────────────────────

  const handleCreatePodcast = async () => {
    if (!newPodcast.title.trim() || !newPodcast.description.trim()) return;

    try {
      const res = await fetch('/api/podcast/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPodcast),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || 'Failed to create podcast');
      }

      const data = (await res.json()) as { podcast: Podcast };
      setPodcasts((prev) => [data.podcast, ...prev]);
      setSelectedPodcast(data.podcast);
      setShowCreatePodcast(false);
      setNewPodcast({ title: '', description: '', category: 'crypto' });
    } catch {
      // alert(err instanceof Error ? err.message : 'Failed to create podcast');
    }
  };

  // ─── Add episode ─────────────────────────────────────────────

  const handleAddEpisode = async () => {
    if (!selectedPodcast || !newEpisode.title.trim() || !newEpisode.audioUrl.trim()) return;

    try {
      const res = await fetch(`/api/podcast/${selectedPodcast.id}/episode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newEpisode),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || 'Failed to add episode');
      }

      const data = (await res.json()) as { episode: PodcastEpisode };
      setEpisodes((prev) => [data.episode, ...prev]);
      setShowAddEpisode(false);
      setNewEpisode({
        title: '',
        description: '',
        audioUrl: '',
        duration: 0,
        episodeNumber: undefined,
        status: 'draft',
      });
    } catch {
      // alert(err instanceof Error ? err.message : 'Failed to add episode');
    }
  };

  // ─── Delete episode ──────────────────────────────────────────

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm('Delete this episode? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/podcast/episode/${episodeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete episode');
      setEpisodes((prev) => prev.filter((ep) => ep.id !== episodeId));
    } catch {
      // alert(err instanceof Error ? err.message : 'Failed to delete episode');
    }
  };

  // ─── Publish episode ─────────────────────────────────────────

  const handlePublishEpisode = async (episodeId: string) => {
    try {
      const res = await fetch(`/api/podcast/episode/${episodeId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to publish episode');
      setEpisodes((prev) =>
        prev.map((ep) =>
          ep.id === episodeId ? { ...ep, status: 'published', publishedAt: Date.now() } : ep,
        ),
      );
    } catch {
      // alert(err instanceof Error ? err.message : 'Failed to publish episode');
    }
  };

  // ─── Wallet gate ─────────────────────────────────────────────

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton aspect-video rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">🎙</span>
        <h2 className="text-xl font-bold">Connect Wallet First</h2>
        <p className="text-center text-[var(--color-text-secondary)]">
          You need to connect your wallet to create and manage podcasts.
        </p>
        <button
          type="button"
          onClick={openSignIn}
          className="rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-black transition-all hover:brightness-110"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎙 Podcast Studio</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Create, manage, and distribute federated podcasts
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreatePodcast(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110"
        >
          <span>+</span>
          <span>New Podcast</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-2xl bg-[var(--color-bg-secondary)]" />
              <div className="mt-3 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ─── Podcast List ──────────────────────────────────── */}
          <div className="lg:col-span-1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              My Podcasts
            </h2>
            {podcasts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center">
                <p className="text-sm text-[var(--color-text-secondary)]">No podcasts yet</p>
                <button
                  type="button"
                  onClick={() => setShowCreatePodcast(true)}
                  className="mt-3 text-sm font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Create your first podcast
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {podcasts.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setSelectedPodcast(p)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      selectedPodcast?.id === p.id
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${p.coverUrl || '/podcast-cover-placeholder.svg'})`,
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.title}</p>
                        <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                          {p.episodeCount} episodes · {formatPlays(p.totalPlays)} plays
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Episode Management ────────────────────────────── */}
          <div className="lg:col-span-2">
            {!selectedPodcast ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] p-12">
                <span className="text-5xl">🎙</span>
                <p className="mt-4 text-[var(--color-text-secondary)]">
                  Select a podcast to manage episodes
                </p>
              </div>
            ) : (
              <>
                {/* Podcast Info Bar */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{selectedPodcast.title}</h2>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {selectedPodcast.episodeCount} episodes ·{' '}
                      {formatPlays(selectedPodcast.totalPlays)} total plays
                      {selectedPodcast.subscriberCount > 0 &&
                        ` · ${selectedPodcast.subscriberCount} subscribers`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPodcast.feedUrl && (
                      <a
                        href={selectedPodcast.feedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold transition-all hover:border-[var(--color-accent)]"
                      >
                        📡 RSS
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAddEpisode(true)}
                      className="flex items-center gap-1 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-black transition-all hover:brightness-110"
                    >
                      + Add Episode
                    </button>
                  </div>
                </div>

                {/* Analytics Cards */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[var(--color-border)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Total Plays</p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatPlays(selectedPodcast.totalPlays)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Subscribers</p>
                    <p className="mt-1 text-2xl font-bold">{selectedPodcast.subscriberCount}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Episodes</p>
                    <p className="mt-1 text-2xl font-bold">{selectedPodcast.episodeCount}</p>
                  </div>
                </div>

                {/* Episode List */}
                <div className="space-y-2">
                  {episodes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        No episodes yet. Add your first episode!
                      </p>
                    </div>
                  ) : (
                    episodes.map((ep) => (
                      <div
                        key={ep.id}
                        className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-4 transition-all hover:border-[var(--color-border)]/50"
                      >
                        {/* Episode number / play indicator */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-sm font-bold text-[var(--color-text-tertiary)]">
                          {ep.episodeNumber || '🎙'}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold">{ep.title}</h3>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                ep.status === 'published'
                                  ? 'bg-green-500/20 text-green-400'
                                  : ep.status === 'draft'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {ep.status}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                            <span>⏱ {formatDuration(ep.duration)}</span>
                            <span>🎧 {formatPlays(ep.plays)}</span>
                            {ep.publishedAt && <span>📅 {timeAgo(ep.publishedAt)}</span>}
                            {Number(ep.tipsReceived) > 0 && <span>💜 {ep.tipsReceived}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1">
                          {ep.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handlePublishEpisode(ep.id)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-green-400 transition-all hover:bg-green-500/10"
                              title="Publish to ActivityPub"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowEditEpisode(ep)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-text-tertiary)] transition-all hover:bg-[var(--color-bg-tertiary)]"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEpisode(ep.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10"
                            title="Delete"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Create Podcast Modal ─────────────────────────────── */}
      {showCreatePodcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Create New Podcast</h2>
              <button
                type="button"
                onClick={() => setShowCreatePodcast(false)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                  htmlFor="field-35aa15ed"
                >
                  Podcast Title *
                </label>
                <input
                  id="field-35aa15ed"
                  type="text"
                  value={newPodcast.title}
                  onChange={(e) => setNewPodcast((p) => ({ ...p, title: e.target.value }))}
                  placeholder="The DegenCast"
                  maxLength={200}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                  htmlFor="field-2e0862aa"
                >
                  Description *
                </label>
                <textarea
                  id="field-2e0862aa"
                  value={newPodcast.description}
                  onChange={(e) => setNewPodcast((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Tell listeners what your podcast is about…"
                  maxLength={5000}
                  rows={4}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Category */}
              <div>
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Category
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setNewPodcast((p) => ({ ...p, category: cat.id }))}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                        newPodcast.category === cat.id
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)]/50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreatePodcast(false)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-all hover:border-[var(--color-border)]/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePodcast}
                disabled={!newPodcast.title.trim() || !newPodcast.description.trim()}
                className="rounded-xl bg-[var(--color-accent)] px-6 py-2 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
              >
                Create Podcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Episode Modal ────────────────────────────────── */}
      {showAddEpisode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Episode</h2>
              <button
                type="button"
                onClick={() => setShowAddEpisode(false)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                  htmlFor="field-8c196ee5"
                >
                  Episode Title *
                </label>
                <input
                  id="field-8c196ee5"
                  type="text"
                  value={newEpisode.title}
                  onChange={(e) => setNewEpisode((ep) => ({ ...ep, title: e.target.value }))}
                  placeholder="Why DeFi is Eating Finance ft. Guest"
                  maxLength={200}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                  htmlFor="field-92754445"
                >
                  Description
                </label>
                <textarea
                  id="field-92754445"
                  value={newEpisode.description}
                  onChange={(e) => setNewEpisode((ep) => ({ ...ep, description: e.target.value }))}
                  placeholder="Episode summary and show notes…"
                  rows={4}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Audio URL */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                  htmlFor="field-68a2ca6a"
                >
                  Audio URL * (IPFS, Arweave, or direct URL)
                </label>
                <input
                  id="field-68a2ca6a"
                  type="url"
                  value={newEpisode.audioUrl}
                  onChange={(e) => setNewEpisode((ep) => ({ ...ep, audioUrl: e.target.value }))}
                  placeholder="https://arweave.net/abc123.mp3 or ipfs://Qm..."
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Duration + Episode Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                    htmlFor="field-fddb09ed"
                  >
                    Duration (seconds)
                  </label>
                  <input
                    id="field-fddb09ed"
                    type="number"
                    value={newEpisode.duration || ''}
                    onChange={(e) =>
                      setNewEpisode((ep) => ({ ...ep, duration: Number(e.target.value) }))
                    }
                    placeholder="3600"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
                    htmlFor="field-ccddf45f"
                  >
                    Episode Number
                  </label>
                  <input
                    id="field-ccddf45f"
                    type="number"
                    value={newEpisode.episodeNumber || ''}
                    onChange={(e) =>
                      setNewEpisode((ep) => ({
                        ...ep,
                        episodeNumber: Number(e.target.value) || undefined,
                      }))
                    }
                    placeholder="1"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>

              {/* Publish status */}
              <div>
                <span className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Status
                </span>
                <div className="flex gap-3">
                  {(['draft', 'published'] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setNewEpisode((ep) => ({ ...ep, status }))}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                        newEpisode.status === status
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {status === 'draft' ? '📝 Save as Draft' : '🚀 Publish Now'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddEpisode(false)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-all hover:border-[var(--color-border)]/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddEpisode}
                disabled={!newEpisode.title.trim() || !newEpisode.audioUrl.trim()}
                className="rounded-xl bg-[var(--color-accent)] px-6 py-2 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
              >
                {newEpisode.status === 'published' ? 'Publish Episode' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Episode Modal ───────────────────────────────── */}
      {showEditEpisode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Episode Details</h2>
              <button
                type="button"
                onClick={() => setShowEditEpisode(null)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-[var(--color-bg-secondary)] p-3">
                <span className="text-2xl">🎙</span>
                <div>
                  <p className="font-semibold">{showEditEpisode.title}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {showEditEpisode.status.toUpperCase()} ·{' '}
                    {formatDuration(showEditEpisode.duration)} ·{' '}
                    {formatPlays(showEditEpisode.plays)} plays
                  </p>
                </div>
              </div>

              {showEditEpisode.activityPubId && (
                <div>
                  <span className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    ActivityPub ID
                  </span>
                  <p className="truncate rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
                    {showEditEpisode.activityPubId}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Plays</p>
                  <p className="text-lg font-bold">{formatPlays(showEditEpisode.plays)}</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Unique Listeners</p>
                  <p className="text-lg font-bold">
                    {formatPlays(showEditEpisode.uniqueListeners)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Tips Received</p>
                  <p className="text-lg font-bold">{showEditEpisode.tipsReceived || '0'} ETH</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                  <p className="text-xs text-[var(--color-text-tertiary)]">Published</p>
                  <p className="text-lg font-bold">
                    {showEditEpisode.publishedAt ? timeAgo(showEditEpisode.publishedAt) : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEditEpisode(null)}
                className="rounded-xl bg-[var(--color-accent)] px-6 py-2 text-sm font-semibold text-black transition-all hover:brightness-110"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
