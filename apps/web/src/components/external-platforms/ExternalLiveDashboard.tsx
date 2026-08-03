'use client';

/**
 * ExternalLiveDashboard — View which external platforms are connected
 * for live streaming and manage go-live operations.
 *
 * Shows real-time status of YouTube, Twitch, Kick, TikTok live connections.
 */

import { useCallback, useEffect, useState } from 'react';
import { PremiumGate } from '../PremiumGate';

// ─── Types ────────────────────────────────────────────────────────────────

interface LivePlatformInfo {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  displayName?: string;
  liveCapable: boolean; // Can this platform go live?
}

interface ExternalLiveDashboardProps {
  /** Compact mode for embedding in sidebar */
  compact?: boolean;
}

// ─── Platform Live Data ───────────────────────────────────────────────────

const LIVE_PLATFORMS: Array<{
  id: string;
  name: string;
  icon: string;
  liveCapable: boolean;
  color: string;
}> = [
  { id: 'youtube', name: 'YouTube', icon: '▶️', liveCapable: true, color: '#FF0000' },
  { id: 'twitch', name: 'Twitch', icon: '📺', liveCapable: true, color: '#9146FF' },
  { id: 'kick', name: 'Kick', icon: '🔴', liveCapable: true, color: '#53FC18' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', liveCapable: true, color: '#000000' },
  { id: 'instagram', name: 'Instagram', icon: '📸', liveCapable: false, color: '#E4405F' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', liveCapable: false, color: '#0A66C2' },
];

// ─── Go-Live Modal ────────────────────────────────────────────────────────

function GoLiveForm({ platform, onClose }: { platform: LivePlatformInfo; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoLive = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;

      setSending(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch('/api/external/go-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: platform.id,
            title: title.trim(),
            description: description.trim() || undefined,
            category: category.trim() || undefined,
          }),
        });

        const data = (await res.json()) as {
          data?: { streamUrl?: string };
          error?: string;
        };

        if (res.ok) {
          setResult(
            data.data?.streamUrl
              ? `Live! Stream URL: ${data.data.streamUrl}`
              : 'Go-live notification sent!',
          );
        } else {
          setError(data.error ?? 'Failed to go live');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to go live');
      } finally {
        setSending(false);
      }
    },
    [platform.id, title, description, category],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--color-fg)]">
            {platform.icon} Go Live on {platform.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleGoLive} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">
              Stream Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the stream about?"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell viewers what to expect..."
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">
              Category / Game
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Just Chatting, Music, Software & Game Dev"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-400">
              {result}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-muted)] hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !title.trim()}
              className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Going Live...' : `🎥 Go Live on ${platform.name}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────

export function ExternalLiveDashboard({ compact = false }: ExternalLiveDashboardProps) {
  const [platforms, setPlatforms] = useState<LivePlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [goLivePlatform, setGoLivePlatform] = useState<LivePlatformInfo | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/external/accounts');
        const data = (await res.json()) as {
          data?: { accounts?: Array<{ platform: string; displayName: string }> };
        };
        const accounts = data.data?.accounts ?? [];
        const connectedMap = new Map(accounts.map((a) => [a.platform, a.displayName]));

        setPlatforms(
          LIVE_PLATFORMS.map((p) => ({
            ...p,
            connected: connectedMap.has(p.id),
            displayName: connectedMap.get(p.id),
          })),
        );
      } catch {
        // Silently fail — show offline state
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const connectedCount = platforms.filter((p) => p.connected).length;

  return (
    <div
      className={
        compact ? '' : 'rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4'
      }
    >
      {/* Header */}
      {!compact && (
        <div className="mb-4">
          <h3 className="font-semibold text-[var(--color-fg)]">📡 Live Streaming</h3>
          <p className="text-xs text-[var(--color-muted)]">
            {connectedCount} of {platforms.length} platforms connected
          </p>
        </div>
      )}

      {/* Platform list */}
      <div className={`space-y-2 ${compact ? '' : ''}`}>
        {platforms.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              compact ? 'text-sm' : ''
            } ${p.connected ? 'bg-white/[0.03]' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg" role="img" aria-label={p.name}>
                {p.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--color-fg)]">{p.name}</p>
                {p.connected && p.displayName && (
                  <p className="text-xs text-[var(--color-muted)]">{p.displayName}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Connection indicator */}
              <span
                className={`h-2 w-2 rounded-full ${p.connected ? 'bg-green-400' : 'bg-gray-600'}`}
                title={p.connected ? 'Connected' : 'Not connected'}
              />

              {/* Go Live button */}
              {p.liveCapable && (
                <button
                  type="button"
                  disabled={!p.connected}
                  onClick={() => setGoLivePlatform(p)}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Go Live
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Go Live modal */}
      {goLivePlatform && (
        <GoLiveForm platform={goLivePlatform} onClose={() => setGoLivePlatform(null)} />
      )}
    </div>
  );
}

// ─── Premium-Gated Export ─────────────────────────────────────────────────

export function GatedExternalLiveDashboard({ compact }: ExternalLiveDashboardProps) {
  return (
    <PremiumGate requiredTier="enterprise" feature="External Platform Live Streaming">
      <ExternalLiveDashboard compact={compact} />
    </PremiumGate>
  );
}
