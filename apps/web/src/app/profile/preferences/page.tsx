'use client';

import type { UserPreferences } from '@degenfeed/storage';
import {
  getDefaultPreferences,
  getPreferences,
  getPrimaryIdentity,
  savePreferences,
} from '@degenfeed/storage';
import type { Protocol } from '@degenfeed/types';
import { useCallback, useEffect, useState } from 'react';

const PROTOCOLS: Protocol[] = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'rss',
];

const NICHES = [
  'crypto',
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'nft',
  'ai',
  'regulation',
  'security',
  'macro',
  'stablecoin',
  'etf',
  'layer2',
  'memecoin',
  'onchain',
];

export const dynamic = 'force-dynamic';

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [identityId, setIdentityId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const primary = await getPrimaryIdentity();
      const id = primary?.id ?? 'anon';
      setIdentityId(id);
      const existing = await getPreferences(id);
      const defaults = await getDefaultPreferences(id);
      if (!cancelled) setPrefs({ ...defaults, ...(existing ?? {}) });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── AI-learned topic preferences ───────────────────────────────
  interface LearnedTopic {
    topic: string;
    weight: number;
    direction: 'up' | 'down' | 'neutral';
  }
  const [learnedTopics, setLearnedTopics] = useState<LearnedTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const fetchLearnedTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      const res = await fetch('/api/preferences/topics', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { topics: LearnedTopic[] };
        setLearnedTopics(data.topics ?? []);
      }
    } catch {
      /* no session yet */
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLearnedTopics();
  }, [fetchLearnedTopics]);

  const adjustTopic = useCallback(async (topic: string, delta: number) => {
    try {
      const res = await fetch('/api/preferences/topics', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, delta }),
      });
      if (res.ok) {
        const data = (await res.json()) as { topics: LearnedTopic[] };
        setLearnedTopics(data.topics ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const clearTopic = useCallback(async (topic: string) => {
    try {
      const res = await fetch('/api/preferences/topics/clear', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (res.ok) {
        setLearnedTopics((prev) => prev.filter((t) => t.topic !== topic));
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!prefs) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-[var(--color-muted)]">Loading...</div>;
  }

  const update = (patch: Partial<UserPreferences>) => {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    setSaved(false);
  };

  const togglePlatform = (protocol: Protocol) => {
    const set = new Set(prefs.preferredPlatforms);
    if (set.has(protocol)) set.delete(protocol);
    else set.add(protocol);
    update({ preferredPlatforms: Array.from(set) });
  };

  const toggleNiche = (niche: string) => {
    const set = new Set(prefs.preferredNiches);
    if (set.has(niche)) set.delete(niche);
    else set.add(niche);
    update({ preferredNiches: Array.from(set) });
  };

  const handleSave = async () => {
    await savePreferences({ ...prefs, identityId });
    setSaved(true);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Algorithm Preferences</h1>
        <a href="/profile" className="text-sm text-degen-500 hover:underline">
          ← Back to profile
        </a>
      </div>

      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">Preferred platforms</h2>
        <div className="flex flex-wrap gap-2">
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                prefs.preferredPlatforms.includes(p)
                  ? 'bg-degen-500 text-black'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">Preferred niches</h2>
        <div className="flex flex-wrap gap-2">
          {NICHES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggleNiche(n)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                prefs.preferredNiches.includes(n)
                  ? 'bg-degen-500 text-black'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── AI-learned topics ── */}
      <div className="card mb-4" id="topics">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">
          AI-learned topics
          {!topicsLoading && learnedTopics.length > 0 && (
            <span className="ml-2 text-[10px] font-normal text-[var(--color-muted)]">
              Based on your likes, reposts, and bookmarks
            </span>
          )}
        </h2>
        {topicsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Loading your learned topics...
          </div>
        ) : learnedTopics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">
            Start liking, reposting, and bookmarking posts to build your AI profile.
            <br />
            The feed learns what topics you care about automatically.
          </div>
        ) : (
          <div className="space-y-1.5">
            {learnedTopics.map((t) => (
              <div
                key={t.topic}
                className="flex items-center justify-between rounded-lg bg-[var(--color-muted)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm capitalize text-[var(--color-fg)]">{t.topic}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      t.direction === 'up'
                        ? 'bg-degen-500/15 text-degen-400'
                        : t.direction === 'down'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                    }`}
                  >
                    {t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '—'}
                    {Math.abs(t.weight).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustTopic(t.topic, 0.2)}
                    className="rounded-md p-1 text-degen-500 hover:bg-degen-500/10 transition-colors"
                    aria-label={`Increase ${t.topic} preference`}
                    title="I want more of this topic"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 3l5 10H3L8 3z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTopic(t.topic, -0.2)}
                    className="rounded-md p-1 text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label={`Decrease ${t.topic} preference`}
                    title="Show me less of this topic"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 5h10L8 15 3 5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => clearTopic(t.topic)}
                    className="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-muted)] transition-colors"
                    aria-label={`Remove ${t.topic}`}
                    title="Forget this topic"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Protocol Quality Presets ── */}
      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">Protocol Quality</h2>
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Each protocol has smart quality defaults. Choose a preset or stick with the smart
          defaults.
        </p>
        {PROTOCOLS.map((p) => {
          const currentPreset = prefs.protocolPresets?.[p] ?? 'quality';
          return (
            <div
              key={p}
              className="mb-2 flex items-center justify-between rounded-lg bg-[var(--color-muted)] px-3 py-2"
            >
              <span className="text-sm capitalize text-[var(--color-fg)]">{p}</span>
              <select
                value={currentPreset}
                onChange={(e) => {
                  const newPresets = { ...(prefs.protocolPresets ?? {}), [p]: e.target.value };
                  update({ protocolPresets: newPresets });
                }}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-degen-500"
                aria-label={`${p} quality preset`}
              >
                <option value="quality">Quality (smart defaults)</option>
                <option value="balanced">Balanced</option>
                <option value="everything">Everything (no filter)</option>
              </select>
            </div>
          );
        })}
      </div>

      {/* ── Feed Layout ── */}
      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">Feed Layout</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Comfortable */}
          <button
            type="button"
            onClick={() => update({ feedLayout: 'comfortable' })}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              prefs.feedLayout === 'comfortable'
                ? 'border-degen-500 bg-degen-500/10 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                : 'border-[var(--color-border)] bg-[var(--color-muted)] hover:border-degen-500/30'
            }`}
            aria-pressed={prefs.feedLayout === 'comfortable'}
          >
            {prefs.feedLayout === 'comfortable' && (
              <span className="absolute right-2 top-2 text-degen-400 text-xs font-bold">✓</span>
            )}
            <div className="mb-2 text-[11px] font-semibold text-[var(--color-fg)]">Comfortable</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 shrink-0 rounded-full bg-degen-500/30" />
                <div className="h-2 flex-1 rounded-full bg-[var(--color-fg)]/20" />
              </div>
              <div className="h-3 rounded bg-[var(--color-fg)]/10" />
              <div className="flex gap-3">
                <div className="h-2 w-6 rounded bg-red-400/30" />
                <div className="h-2 w-6 rounded bg-green-400/30" />
                <div className="h-2 w-6 rounded bg-blue-400/30" />
              </div>
            </div>
            <div className="mt-2 text-[10px] text-[var(--color-muted)]">
              Relaxed spacing. More breathing room.
            </div>
          </button>

          {/* Compact */}
          <button
            type="button"
            onClick={() => update({ feedLayout: 'compact' })}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              prefs.feedLayout === 'compact'
                ? 'border-degen-500 bg-degen-500/10 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                : 'border-[var(--color-border)] bg-[var(--color-muted)] hover:border-degen-500/30'
            }`}
            aria-pressed={prefs.feedLayout === 'compact'}
          >
            {prefs.feedLayout === 'compact' && (
              <span className="absolute right-2 top-2 text-degen-400 text-xs font-bold">✓</span>
            )}
            <div className="mb-2 text-[11px] font-semibold text-[var(--color-fg)]">Compact</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 shrink-0 rounded-full bg-degen-500/30" />
                <div className="h-1.5 flex-1 rounded-full bg-[var(--color-fg)]/20" />
              </div>
              <div className="h-2 rounded bg-[var(--color-fg)]/10" />
              <div className="flex gap-2">
                <div className="h-1.5 w-5 rounded bg-red-400/30" />
                <div className="h-1.5 w-5 rounded bg-green-400/30" />
                <div className="h-1.5 w-5 rounded bg-blue-400/30" />
              </div>
            </div>
            <div className="mt-2 text-[10px] text-[var(--color-muted)]">
              Twitter-like density. More content per screen.
            </div>
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Also available: <strong>Media Grid</strong> (images/videos only) and{' '}
          <strong>Reader</strong> (full article view). Press Ctrl+Shift+L to cycle layouts.
        </p>
      </div>

      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">Ranking weights</h2>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-[var(--color-muted)]">
            Recency weight: {prefs.recencyWeight.toFixed(1)}
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={prefs.recencyWeight}
              onChange={(e) => update({ recencyWeight: Number(e.target.value) })}
              className="mt-1 w-full accent-degen-500"
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-[var(--color-muted)]">
            Engagement weight: {prefs.engagementWeight.toFixed(1)}
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={prefs.engagementWeight}
              onChange={(e) => update({ engagementWeight: Number(e.target.value) })}
              className="mt-1 w-full accent-degen-500"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={prefs.diversityBoost}
            onChange={(e) => update({ diversityBoost: e.target.checked })}
            className="accent-degen-500"
          />
          Boost author diversity
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" className="btn-primary" onClick={handleSave}>
          Save preferences
        </button>
        {saved && <span className="text-sm text-degen-400">Saved.</span>}
      </div>
    </div>
  );
}
