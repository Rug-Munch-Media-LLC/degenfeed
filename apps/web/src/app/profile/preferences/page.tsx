'use client';

import type { UserPreferences } from '@degenfeed/storage';
import {
  getDefaultPreferences,
  getPreferences,
  getPrimaryIdentity,
  savePreferences,
} from '@degenfeed/storage';
import type { Protocol } from '@degenfeed/types';
import { useEffect, useState } from 'react';

const PROTOCOLS: Protocol[] = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
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

  if (!prefs) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-gray-500">Loading...</div>;
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
                  : 'bg-[var(--color-muted)] text-gray-400 hover:bg-gray-700'
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
                  : 'bg-[var(--color-muted)] text-gray-400 hover:bg-gray-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-semibold text-degen-400">Ranking weights</h2>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-gray-400">
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
          <label className="mb-1 block text-xs text-gray-400">
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
        <label className="flex items-center gap-2 text-sm text-gray-400">
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
