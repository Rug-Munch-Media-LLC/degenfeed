'use client';

/**
 * ExternalPostComposer — Compose and publish/schedule posts to external
 * platforms (YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn).
 *
 * Features:
 * - Multi-platform selection (pick which connected platforms to post to)
 * - Rich text + media + hashtags
 * - Immediate post or schedule for later
 * - Per-platform results display
 */

import { useCallback, useEffect, useState } from 'react';
import { PremiumGate } from '../PremiumGate';
import type { PlatformInfo } from './ConnectPlatformModal';

// ─── Types ────────────────────────────────────────────────────────────────

interface PostResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface ExternalPostComposerProps {
  /** Pre-selected platforms */
  initialPlatforms?: string[];
  /** Called after successful post */
  onPosted?: (results: Record<string, PostResult>) => void;
}

// ─── Schedule Presets ─────────────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { label: 'Now', value: null },
  { label: '+1h', value: 60 },
  { label: '+3h', value: 180 },
  { label: '+6h', value: 360 },
  { label: '+12h', value: 720 },
  { label: '+24h', value: 1440 },
  { label: 'Custom', value: -1 },
];

// ─── Platform Toggle ──────────────────────────────────────────────────────

function PlatformToggle({
  platform,
  selected,
  onToggle,
}: {
  platform: PlatformInfo;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(platform.id)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
        selected
          ? 'border-green-500/40 bg-green-500/10 text-green-400'
          : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-white/20'
      } ${!platform.connected ? 'cursor-not-allowed opacity-40' : ''}`}
      disabled={!platform.connected}
      title={
        !platform.connected
          ? `Connect ${platform.name} first in DegenFeed Connect settings`
          : undefined
      }
    >
      <span>{platform.icon}</span>
      <span>{platform.name}</span>
      {!platform.connected && <span className="ml-auto text-xs text-red-400">⚠️</span>}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function ExternalPostComposer({
  initialPlatforms = [],
  onPosted,
}: ExternalPostComposerProps) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialPlatforms);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [mediaUrls, setMediaUrls] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'preset' | 'custom'>('now');
  const [scheduleMinutes, setScheduleMinutes] = useState(60);
  const [customDate, setCustomDate] = useState('');
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<Record<string, PostResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platformsLoading, setPlatformsLoading] = useState(true);

  // Fetch connected platforms
  useEffect(() => {
    async function load() {
      setPlatformsLoading(true);
      try {
        const res = await fetch('/api/external/accounts');
        const data = (await res.json()) as {
          data?: { accounts?: PlatformInfo[] };
        };
        const accounts = data.data?.accounts ?? [];

        // Merge with platform definitions
        const platformDefsRes = await fetch('/api/external/platforms');
        const platformDefs = (await platformDefsRes.json()) as {
          data?: {
            platforms?: Array<{
              id: string;
              name: string;
              icon: string;
              description: string;
              capabilities: string[];
            }>;
          };
        };

        const defs = platformDefs.data?.platforms ?? [];
        const accountMap = new Map(accounts.map((a) => [a.platform, a]));

        setPlatforms(
          defs.map((def) => ({
            ...def,
            connected: accountMap.has(def.id),
            connectedAccount: accountMap.get(def.id)
              ? {
                  displayName: accountMap.get(def.id)!.displayName ?? def.name,
                  avatarUrl: accountMap.get(def.id)!.avatarUrl,
                  connectedAt: accountMap.get(def.id)!.connectedAt,
                }
              : undefined,
          })),
        );

        // Auto-select connected platforms that match initialPlatforms
        if (initialPlatforms.length > 0) {
          setSelectedPlatforms(initialPlatforms.filter((id) => accountMap.has(id)));
        }
      } catch {
        setError('Failed to load connected platforms');
      } finally {
        setPlatformsLoading(false);
      }
    }
    void load();
  }, [initialPlatforms]);

  // Toggle platform selection
  const togglePlatform = useCallback((id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  // Compute scheduledAt from presets
  const getScheduledAt = useCallback((): string | null => {
    if (scheduleMode === 'now') return null;
    if (scheduleMode === 'preset') {
      const date = new Date(Date.now() + scheduleMinutes * 60_000);
      return date.toISOString();
    }
    if (scheduleMode === 'custom' && customDate) {
      return new Date(customDate).toISOString();
    }
    return null;
  }, [scheduleMode, scheduleMinutes, customDate]);

  // Submit post
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setResults(null);

      if (!text.trim()) {
        setError('Post text is required');
        return;
      }

      if (selectedPlatforms.length === 0) {
        setError('Select at least one platform');
        return;
      }

      setPosting(true);

      try {
        const scheduledAt = getScheduledAt();
        const isSchedule = scheduleMode !== 'now' && scheduledAt;

        const endpoint = isSchedule ? '/api/external/schedule' : '/api/external/post';
        const body = {
          text: text.trim(),
          title: title.trim() || undefined,
          platforms: selectedPlatforms,
          hashtags: hashtags
            .split(/[,\s]+/)
            .map((h) => h.replace(/^#/, '').trim())
            .filter(Boolean),
          mediaUrls: mediaUrls
            .split(/[\n,]+/)
            .map((u) => u.trim())
            .filter(Boolean),
          linkUrl: linkUrl.trim() || undefined,
          ...(isSchedule ? { scheduledAt } : {}),
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as {
          data?: { results?: Record<string, PostResult> };
          error?: string;
        };

        if (res.ok && data.data?.results) {
          setResults(data.data.results);
          onPosted?.(data.data.results);
          // Reset form on success
          if (scheduleMode === 'now') {
            setText('');
            setTitle('');
            setHashtags('');
            setMediaUrls('');
            setLinkUrl('');
          }
        } else {
          setError(data.error ?? 'Post failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Post failed');
      } finally {
        setPosting(false);
      }
    },
    [
      text,
      title,
      selectedPlatforms,
      hashtags,
      mediaUrls,
      linkUrl,
      scheduleMode,
      getScheduledAt,
      onPosted,
    ],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Platform selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">Post to</label>
        {platformsLoading ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-24 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <PlatformToggle
                key={p.id}
                platform={p}
                selected={selectedPlatforms.includes(p.id)}
                onToggle={togglePlatform}
              />
            ))}
          </div>
        )}
      </div>

      {/* Title (for YouTube, LinkedIn) */}
      <div>
        <label
          htmlFor="ext-post-title"
          className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
        >
          Title <span className="text-[var(--color-muted)]">(YouTube, LinkedIn)</span>
        </label>
        <input
          id="ext-post-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title..."
          className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
        />
      </div>

      {/* Text content */}
      <div>
        <label
          htmlFor="ext-post-text"
          className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
        >
          Content
        </label>
        <textarea
          id="ext-post-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="What do you want to share?"
          className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--color-muted)]">{text.length} characters</p>
      </div>

      {/* Media URLs */}
      <div>
        <label
          htmlFor="ext-post-media"
          className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
        >
          Media URLs <span className="text-[var(--color-muted)]">(one per line)</span>
        </label>
        <textarea
          id="ext-post-media"
          value={mediaUrls}
          onChange={(e) => setMediaUrls(e.target.value)}
          rows={2}
          placeholder="https://example.com/image.jpg"
          className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
        />
      </div>

      {/* Hashtags + Link */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="ext-post-hashtags"
            className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
          >
            Hashtags <span className="text-[var(--color-muted)]">(comma-separated)</span>
          </label>
          <input
            id="ext-post-hashtags"
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="web3, crypto, nft"
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="ext-post-link"
            className="mb-1 block text-sm font-medium text-[var(--color-fg)]"
          >
            Link URL
          </label>
          <input
            id="ext-post-link"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-white/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Schedule */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">
          When to post
        </label>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                if (preset.value === null) {
                  setScheduleMode('now');
                } else if (preset.value === -1) {
                  setScheduleMode('custom');
                } else {
                  setScheduleMode('preset');
                  setScheduleMinutes(preset.value);
                }
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                (preset.value === null && scheduleMode === 'now') ||
                (preset.value === scheduleMinutes && scheduleMode === 'preset') ||
                (preset.value === -1 && scheduleMode === 'custom')
                  ? 'border-white/40 bg-white/10 text-[var(--color-fg)]'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-white/20'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {scheduleMode === 'custom' && (
          <input
            type="datetime-local"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-white/30 focus:outline-none"
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm">
          <p className="mb-2 font-medium text-green-400">Results</p>
          <div className="space-y-1">
            {Object.entries(results).map(([platform, result]) => (
              <div
                key={platform}
                className={`flex items-center gap-2 ${
                  result.success ? 'text-green-400' : 'text-red-400'
                }`}
              >
                <span>{result.success ? '✓' : '✗'}</span>
                <span className="font-medium capitalize">{platform}:</span>
                <span className="text-[var(--color-muted)]">
                  {result.success ? (result.url ? 'Posted ✓' : 'Published') : result.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={posting || selectedPlatforms.length === 0 || !text.trim()}
        className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {posting
          ? 'Posting...'
          : scheduleMode === 'now'
            ? `Post to ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''}`
            : `Schedule for ${scheduleMode === 'preset' ? `+${scheduleMinutes}min` : 'custom date'}`}
      </button>
    </form>
  );
}

// ─── Premium-Gated Export ─────────────────────────────────────────────────

export function GatedExternalPostComposer(props: ExternalPostComposerProps) {
  return (
    <PremiumGate requiredTier="enterprise" feature="External Platform Posting">
      <ExternalPostComposer {...props} />
    </PremiumGate>
  );
}
