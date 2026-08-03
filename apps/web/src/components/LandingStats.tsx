'use client';

/**
 * LandingStats — honest stats bar for the marketing landing page.
 *
 * Fetches real counts from the bridge instead of fabricated numbers:
 *   - Protocols      → number of sources reported by /api/feed/health
 *   - News Sources   → totalSources from /api/rss/sources
 *   - Trending Topics→ topics.length from /api/feed/trending
 *   - Live Mentions  → sum of topic counts from /api/feed/trending
 *
 * If a fetch fails, the affected stat shows "—" rather than inventing a number.
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

interface TrendingPayload {
  topics?: Array<{ topic: string; count: number; score?: number }>;
}

const FALLBACK_STATS: Stat[] = [
  { label: 'Protocols', value: '—' },
  { label: 'News Sources', value: '—' },
  { label: 'Trending Topics', value: '—' },
  { label: 'Live Mentions', value: '—' },
];

function formatCompact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
  }
  return String(n);
}

export function LandingStats() {
  const [stats, setStats] = useState<Stat[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let protocols = '—';
      let sources = '—';
      let trendingTopics = '—';
      let liveMentions = '—';

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
          if (typeof rss.totalSources === 'number') sources = String(rss.totalSources);
        }
      } catch {
        // keep "—"
      }

      try {
        const trendingRes = await fetch('/api/feed/trending', { credentials: 'include' });
        if (trendingRes.ok) {
          const trending = (await trendingRes.json()) as TrendingPayload;
          const topics = trending.topics ?? [];
          if (topics.length > 0) {
            trendingTopics = String(topics.length);
            const total = topics.reduce((acc, t) => acc + (t.count || 0), 0);
            if (total > 0) liveMentions = formatCompact(total);
          }
        }
      } catch {
        // keep "—"
      }

      if (cancelled) return;
      setStats([
        { label: 'Protocols', value: protocols },
        { label: 'News Sources', value: sources },
        { label: 'Trending Topics', value: trendingTopics },
        { label: 'Live Mentions', value: liveMentions },
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
    </>
  );
}
