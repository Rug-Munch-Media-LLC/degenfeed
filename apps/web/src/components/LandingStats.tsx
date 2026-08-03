'use client';

/**
 * LandingStats — honest stats bar for the marketing landing page.
 *
 * Fetches real counts from the bridge instead of fabricated numbers:
 *   - Protocols  → number of sources reported by /api/feed/health
 *   - RSS Sources → totalSources from /api/rss/sources
 *   - Reddit Communities / YouTube Channels / Reachable → no real data
 *     source exists, so we show "—" rather than inventing numbers.
 *
 * If a fetch fails, the affected stat shows "—".
 */

import { useEffect, useState } from 'react';

interface Stat {
  label: string;
  value: string;
}

interface HealthPayload {
  sources?: Record<string, unknown>;
}

interface RssSourcesPayload {
  totalSources?: number;
}

const FALLBACK_STATS: Stat[] = [
  { label: 'Protocols', value: '—' },
  { label: 'RSS Sources', value: '—' },
  { label: 'Reddit Communities', value: '—' },
  { label: 'YouTube Channels', value: '—' },
];

export function LandingStats() {
  const [stats, setStats] = useState<Stat[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let protocols = '—';
      let rssSources = '—';

      try {
        const healthRes = await fetch('/api/feed/health', { credentials: 'include' });
        if (healthRes.ok) {
          const health = (await healthRes.json()) as HealthPayload;
          if (health.sources) protocols = String(Object.keys(health.sources).length);
        }
      } catch {
        // keep "—"
      }

      try {
        const rssRes = await fetch('/api/rss/sources', { credentials: 'include' });
        if (rssRes.ok) {
          const rss = (await rssRes.json()) as RssSourcesPayload;
          if (typeof rss.totalSources === 'number') rssSources = String(rss.totalSources);
        }
      } catch {
        // keep "—"
      }

      if (cancelled) return;
      setStats([
        { label: 'Protocols', value: protocols },
        { label: 'RSS Sources', value: rssSources },
        { label: 'Reddit Communities', value: '—' },
        { label: 'YouTube Channels', value: '—' },
      ]);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = stats ?? FALLBACK_STATS;

  return (
    <>
      {items.map((stat) => (
        <span key={stat.label} className="stat-item">
          <span className="stat-value">{stat.value}</span>
          <span className="stat-label">{stat.label}</span>
        </span>
      ))}
      <span className="stat-divider" aria-hidden="true" />
      <span className="stat-item">
        <span className="stat-value">—</span>
        <span className="stat-label">Reachable</span>
      </span>
    </>
  );
}
