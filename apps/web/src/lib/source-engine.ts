/**
 * Source Engine — Service layer wrapping @degenfeed/source-discovery
 * with in-memory + file-backed storage for the Next.js API routes.
 *
 * In development, data persists to /tmp/degenfeed-sources.json so it
 * survives HMR reloads. In production (Cloudflare Pages), each request
 * is stateless — data comes from the worker API.
 */

import fs from 'node:fs';
import {
  aggregateStats,
  buildTrendingSource,
  computeSourceHealthScore,
  type DiscoveredSource,
  discoverNewSources,
  getNewThisWeek,
  type Platform,
  type SourceHealth,
  type TrendingSource,
} from '@degenfeed/feed-providers';

// === Persistent storage (file-backed) ==================================

const STORAGE_PATH = '/tmp/degenfeed-sources.json';

interface PersistedData {
  allSources: DiscoveredSource[];
  pendingSources: DiscoveredSource[];
  rejectedIds: string[];
  healthMap: Record<string, SourceHealth>;
  trendingSources: TrendingSource[];
  discoveryRuns: Array<{
    platform: string;
    discovered: number;
    autoApproved: number;
    pending: number;
    timestamp: number;
  }>;
  lastRunAt: number | null;
  lastRunDuration: number | null;
}

function loadData(): PersistedData {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
      return JSON.parse(raw) as PersistedData;
    }
  } catch {
    /* ignore corrupt data */
  }
  return {
    allSources: [],
    pendingSources: [],
    rejectedIds: [],
    healthMap: {},
    trendingSources: [],
    discoveryRuns: [],
    lastRunAt: null,
    lastRunDuration: null,
  };
}

function saveData(data: PersistedData): void {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    /* ignore write errors */
  }
}

// === Known existing sources ==========================================

const KNOWN_REDDIT_SUBS = [
  'cryptocurrency',
  'bitcoin',
  'ethereum',
  'cryptomarkets',
  'cryptotechnology',
  'defi',
  'ethfinance',
  'ethdev',
  'uniswap',
  'aave',
  'solana',
  'cardano',
  'polkadot',
  'avax',
  'cosmosnetwork',
  'ethtrader',
  'optimism',
  'arbitrum',
];

function getExistingSources(data: PersistedData): Record<string, string[]> {
  const approved = data.allSources.filter((s) => s.status === 'approved');
  return {
    reddit: [
      ...KNOWN_REDDIT_SUBS,
      ...approved.filter((s) => s.platform === 'reddit').map((s) => s.name.replace('r/', '')),
    ],
    youtube: approved.filter((s) => s.platform === 'youtube').map((s) => s.name.toLowerCase()),
    rss: approved.filter((s) => s.platform === 'rss').map((s) => s.url),
    lemmy: approved.filter((s) => s.platform === 'lemmy').map((s) => s.name.toLowerCase()),
    peertube: approved.filter((s) => s.platform === 'peertube').map((s) => s.name.toLowerCase()),
    newsletter: approved.filter((s) => s.platform === 'newsletter').map((s) => s.url),
  };
}

// === Public API =======================================================

export interface DiscoveryResult {
  success: boolean;
  platform: string;
  discovered: number;
  autoApproved: number;
  pendingReview: number;
  sources: DiscoveredSource[];
  error?: string;
}

/**
 * Run discovery for all platforms or a specific one.
 */
export async function runDiscovery(platform: string = 'all'): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const data = loadData();
  const existing = getExistingSources(data);
  const rejectedSet = new Set(data.rejectedIds);

  try {
    let sources: DiscoveredSource[];

    if (platform === 'all') {
      sources = await discoverNewSources(existing);
    } else {
      sources = await discoverForPlatform(platform as Platform, existing);
    }

    // Filter rejected
    sources = sources.filter((s) => !rejectedSet.has(s.id));

    // Separate into auto-approved and pending
    const autoApproved = sources.filter((s) => s.status === 'approved');
    const pending = sources.filter((s) => s.status === 'pending');

    // Deduplicate against existing
    const existingIds = new Set(data.allSources.map((s) => s.id));
    const newSources = sources.filter((s) => !existingIds.has(s.id));

    // Merge
    data.allSources.push(...autoApproved.filter((s) => !existingIds.has(s.id)));
    const pendingIds = new Set(data.pendingSources.map((s) => s.id));
    for (const s of pending) {
      if (!pendingIds.has(s.id)) data.pendingSources.push(s);
    }

    // Initialize health entries for new sources
    for (const s of newSources) {
      if (!data.healthMap[s.id]) {
        data.healthMap[s.id] = {
          sourceId: s.id,
          platform: s.platform,
          lastPostAt: Date.now(),
          postFrequency: s.weeklyActivity,
          engagementScore: s.relevanceScore * 0.5,
          relevanceScore: s.relevanceScore,
          spamScore: 0,
          compositeScore: s.score,
          lastCheckedAt: Date.now(),
          spamFlagCount: 0,
          engagement30d: 0,
          postCount30d: 0,
        };
      }
    }

    // Record run
    data.discoveryRuns.push({
      platform,
      discovered: sources.length,
      autoApproved: autoApproved.length,
      pending: pending.length,
      timestamp: startTime,
    });

    data.lastRunAt = startTime;
    data.lastRunDuration = Date.now() - startTime;

    saveData(data);

    return {
      success: true,
      platform,
      discovered: sources.length,
      autoApproved: autoApproved.length,
      pendingReview: pending.length,
      sources: sources.slice(0, 50),
    };
  } catch (err) {
    return {
      success: false,
      platform,
      discovered: 0,
      autoApproved: 0,
      pendingReview: 0,
      sources: [],
      error: String(err),
    };
  }
}

async function discoverForPlatform(
  platform: Platform,
  existing: Record<string, string[]>,
): Promise<DiscoveredSource[]> {
  switch (platform) {
    case 'reddit': {
      const { discoverRedditSubreddits } = await import('@degenfeed/source-discovery');
      return discoverRedditSubreddits(existing.reddit);
    }
    case 'youtube': {
      const { discoverYouTubeChannels } = await import('@degenfeed/source-discovery');
      return discoverYouTubeChannels(undefined, existing.youtube);
    }
    case 'rss': {
      const { discoverRSSFeeds } = await import('@degenfeed/source-discovery');
      return discoverRSSFeeds(existing.rss);
    }
    case 'lemmy': {
      const { discoverLemmyCommunities } = await import('@degenfeed/source-discovery');
      return discoverLemmyCommunities(existing.lemmy);
    }
    case 'peertube': {
      const { discoverPeerTubeChannels } = await import('@degenfeed/source-discovery');
      return discoverPeerTubeChannels(existing.peertube);
    }
    case 'newsletter': {
      const { discoverNewsletters } = await import('@degenfeed/source-discovery');
      return discoverNewsletters(existing.newsletter);
    }
    default:
      return [];
  }
}

/**
 * Get pending sources.
 */
export function getPendingSources(): { sources: DiscoveredSource[]; total: number } {
  const data = loadData();
  const sorted = [...data.pendingSources].sort((a, b) => b.score - a.score);
  return { sources: sorted, total: sorted.length };
}

/**
 * Approve sources by ID.
 */
export function approveSources(ids: string[]): {
  approved: number;
  sources: Array<{ id: string; name: string; platform: string }>;
} {
  const data = loadData();
  const approved: DiscoveredSource[] = [];
  const remaining: DiscoveredSource[] = [];

  for (const source of data.pendingSources) {
    if (ids.includes(source.id)) {
      approved.push({ ...source, status: 'approved', autoApproved: true });
    } else {
      remaining.push(source);
    }
  }

  data.allSources.push(...approved);
  data.pendingSources = remaining;
  saveData(data);

  return {
    approved: approved.length,
    sources: approved.map((s) => ({ id: s.id, name: s.name, platform: s.platform })),
  };
}

/**
 * Reject sources by ID.
 */
export function rejectSources(ids: string[]): { rejected: number } {
  const data = loadData();
  data.rejectedIds.push(...ids.filter((id) => !data.rejectedIds.includes(id)));
  data.pendingSources = data.pendingSources.filter((s) => !ids.includes(s.id));
  saveData(data);
  return { rejected: ids.length };
}

/**
 * Get trending sources (computed from health + scoring).
 */
export function getTrendingSources(limit = 10): { trending: TrendingSource[] } {
  const data = loadData();
  const now = Date.now();
  const windowStart = now - 7 * 86_400_000;

  const trending: TrendingSource[] = [];

  for (const health of Object.values(data.healthMap)) {
    const source = data.allSources.find((s) => s.id === health.sourceId);
    if (source?.status !== 'approved') continue;

    // Compute engagement velocity (eng/day over 7d window)
    const daysActive = Math.max(1, (now - health.lastCheckedAt) / 86_400_000);
    const engagementVelocity = health.engagement30d / Math.max(1, daysActive);
    const postVelocity = health.postCount30d / Math.max(1, daysActive);

    trending.push(
      buildTrendingSource(
        health.sourceId,
        source.name,
        source.platform,
        engagementVelocity,
        postVelocity,
        0.5, // default baseline
        windowStart,
        now,
      ),
    );
  }

  trending.sort((a, b) => b.trendingScore - a.trendingScore);

  return { trending: trending.slice(0, limit) };
}

/**
 * Get stale sources (no activity in 14+ days).
 */
export function getStaleSources(): {
  sources: Array<{ source: DiscoveredSource; health: SourceHealth; daysSinceLastPost: number }>;
} {
  const data = loadData();
  const now = Date.now();
  const threshold = now - 14 * 86_400_000;

  const stale: Array<{
    source: DiscoveredSource;
    health: SourceHealth;
    daysSinceLastPost: number;
  }> = [];

  for (const health of Object.values(data.healthMap)) {
    if (health.lastPostAt >= threshold) continue;
    const source = data.allSources.find((s) => s.id === health.sourceId);
    if (source?.status !== 'approved') continue;

    stale.push({
      source,
      health,
      daysSinceLastPost: Math.round((now - health.lastPostAt) / 86_400_000),
    });
  }

  stale.sort((a, b) => b.daysSinceLastPost - a.daysSinceLastPost);

  return { sources: stale };
}

/**
 * Get new sources discovered this week.
 */
export function getNewThisWeekSources(): { sources: DiscoveredSource[] } {
  const data = loadData();
  const sources = getNewThisWeek(data.allSources, Date.now(), 7);
  sources.sort((a, b) => b.score - a.score);
  return { sources };
}

/**
 * Get aggregated discovery stats.
 */
export function getStats() {
  const data = loadData();
  const healthMap = new Map(Object.entries(data.healthMap));
  const stats = aggregateStats(data.allSources, healthMap, data.discoveryRuns);
  return {
    ...stats,
    lastRunAt: data.lastRunAt,
    lastRunDuration: data.lastRunDuration,
    runHistory: data.discoveryRuns.slice(-20).reverse(),
  };
}

/**
 * Get all health scores.
 */
export function getSourceHealth(): {
  health: Array<{
    source: DiscoveredSource;
    health: SourceHealth;
    signals: ReturnType<typeof computeSourceHealthScore>;
  }>;
} {
  const data = loadData();
  const result: Array<{
    source: DiscoveredSource;
    health: SourceHealth;
    signals: ReturnType<typeof computeSourceHealthScore>;
  }> = [];

  for (const health of Object.values(data.healthMap)) {
    const source = data.allSources.find((s) => s.id === health.sourceId);
    if (!source) continue;
    const signals = computeSourceHealthScore(health);
    result.push({ source, health, signals });
  }

  result.sort((a, b) => b.signals.score - a.signals.score);
  return { health: result };
}

/**
 * Update source health with engagement data.
 * Called when content from a source receives engagement events.
 */
export function recordEngagement(
  sourceId: string,
  engagementDelta: number,
  postCount: number,
  spamScore?: number,
): void {
  const data = loadData();
  const health = data.healthMap[sourceId];
  if (!health) return;

  health.engagement30d += engagementDelta;
  health.postCount30d += postCount;
  health.lastPostAt = Date.now();
  health.lastCheckedAt = Date.now();

  if (spamScore !== undefined) {
    health.spamScore = Math.min(1, health.spamScore + spamScore);
    health.spamFlagCount++;
  }

  // Recompute frequency
  health.postFrequency = health.postCount30d / Math.max(1, 30);
  health.engagementScore = Math.min(
    1,
    health.engagement30d / Math.max(1, health.postCount30d || 1),
  );

  const result = computeSourceHealthScore(health);
  health.compositeScore = result.score;

  // Auto-cull if health is very low and source is stale
  if (result.lifecycle === 'culled') {
    const idx = data.allSources.findIndex((s) => s.id === sourceId);
    if (idx !== -1) {
      data.allSources[idx] = {
        ...data.allSources[idx],
        lifecycle: 'culled',
        lifecycleCheckedAt: Date.now(),
      };
    }
  }

  saveData(data);
}

/**
 * Cull low-quality sources (health < 0.3, stale).
 */
export function cullLowQualitySources(): { culled: number; ids: string[] } {
  const data = loadData();
  const culled: string[] = [];

  for (const [sourceId, health] of Object.entries(data.healthMap)) {
    const result = computeSourceHealthScore(health);
    const daysSinceLastPost = health.lastPostAt
      ? (Date.now() - health.lastPostAt) / 86_400_000
      : Infinity;

    if (result.score < 0.3 && daysSinceLastPost >= 14) {
      const idx = data.allSources.findIndex((s) => s.id === sourceId);
      if (idx !== -1 && data.allSources[idx].status === 'approved') {
        data.allSources[idx] = {
          ...data.allSources[idx],
          lifecycle: 'culled',
          lifecycleCheckedAt: Date.now(),
          status: 'rejected',
        };
        culled.push(sourceId);
      }
    }
  }

  // Also remove from pending
  data.pendingSources = data.pendingSources.filter((s) => !culled.includes(s.id));
  data.rejectedIds.push(...culled.filter((id) => !data.rejectedIds.includes(id)));

  saveData(data);
  return { culled: culled.length, ids: culled };
}

/**
 * Run health check on all sources.
 */
export function runHealthCheck(): { checked: number; stale: number; culled: number } {
  const data = loadData();
  let stale = 0;
  let culledCount = 0;
  const now = Date.now();
  const _staleThreshold = now - 14 * 86_400_000;

  for (const health of Object.values(data.healthMap)) {
    health.lastCheckedAt = now;
    const result = computeSourceHealthScore(health);
    health.compositeScore = result.score;

    if (result.lifecycle === 'stale') stale++;
    if (result.lifecycle === 'culled') {
      culledCount++;
      const idx = data.allSources.findIndex((s) => s.id === health.sourceId);
      if (idx !== -1) {
        data.allSources[idx] = {
          ...data.allSources[idx],
          lifecycle: 'culled',
          lifecycleCheckedAt: now,
        };
      }
    }
  }

  saveData(data);
  return { checked: Object.keys(data.healthMap).length, stale, culled: culledCount };
}

/**
 * Check if the auto-discovery cron should run.
 * Runs if last run was > 7 days ago or never.
 */
export function shouldRunDiscovery(): {
  shouldRun: boolean;
  lastRunAt: number | null;
  hoursSinceLastRun: number;
} {
  const data = loadData();
  if (!data.lastRunAt) {
    return { shouldRun: true, lastRunAt: null, hoursSinceLastRun: Infinity };
  }
  const hoursSinceLastRun = (Date.now() - data.lastRunAt) / 3_600_000;
  return { shouldRun: hoursSinceLastRun >= 168, lastRunAt: data.lastRunAt, hoursSinceLastRun };
}
