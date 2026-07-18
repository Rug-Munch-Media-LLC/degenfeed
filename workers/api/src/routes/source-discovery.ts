/**
 * @degenfeed/api-worker — Source Discovery API
 *
 * Endpoints:
 *   GET  /api/sources/discover?platform=reddit — Trigger discovery for a platform
 *   GET  /api/sources/pending                  — List pending discovered sources
 *   POST /api/sources/approve                  — Approve and activate a source
 *   POST /api/sources/reject                   — Reject a discovered source
 *
 * Sources are stored in CACHE KV with keys:
 *   discovered:sources:all        — All discovered sources (JSON array)
 *   discovered:sources:pending    — Pending review sources (JSON array)
 *   discovered:sources:rejected   — Rejected source IDs (JSON array)
 *   discovered:sources:run:{date} — Snapshot of a discovery run
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import {
  discoverNewSources,
  type DiscoveredSource,
  DEFAULT_DISCOVERY_CONFIG,
  computeQualityScore,
  type SourceHealth,
} from '@degenfeed/source-discovery';

// ─── KV key helpers ───────────────────────────────────────────────────

function allSourcesKey(): string {
  return 'discovered:sources:all';
}

function pendingSourcesKey(): string {
  return 'discovered:sources:pending';
}

function rejectedSourcesKey(): string {
  return 'discovered:sources:rejected';
}

function runSnapshotKey(): string {
  return `discovered:sources:run:${new Date().toISOString().slice(0, 10)}`;
}

// ─── KV helpers ───────────────────────────────────────────────────────

async function getPendingSources(env: Env): Promise<DiscoveredSource[]> {
  try {
    const raw = await env.CACHE?.get(pendingSourcesKey());
    return raw ? (JSON.parse(raw) as DiscoveredSource[]) : [];
  } catch {
    return [];
  }
}

async function getAllSources(env: Env): Promise<DiscoveredSource[]> {
  try {
    const raw = await env.CACHE?.get(allSourcesKey());
    return raw ? (JSON.parse(raw) as DiscoveredSource[]) : [];
  } catch {
    return [];
  }
}

async function getRejectedIds(env: Env): Promise<Set<string>> {
  try {
    const raw = await env.CACHE?.get(rejectedSourcesKey());
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function savePendingSources(env: Env, sources: DiscoveredSource[]): Promise<void> {
  await env.CACHE?.put(pendingSourcesKey(), JSON.stringify(sources), { expirationTtl: 86400 * 30 });
}

async function saveAllSources(env: Env, sources: DiscoveredSource[]): Promise<void> {
  await env.CACHE?.put(allSourcesKey(), JSON.stringify(sources), { expirationTtl: 86400 * 30 });
}

async function saveRejectedIds(env: Env, ids: Set<string>): Promise<void> {
  await env.CACHE?.put(rejectedSourcesKey(), JSON.stringify([...ids]), { expirationTtl: 86400 * 30 });
}

// ─── Load known active sources from existing providers ────────────────
// These are the sources already configured in the platform.
// In production this would pull from a database, but for now we use a static list.

const KNOWN_REDDIT_SUBS = [
  'cryptocurrency', 'bitcoin', 'ethereum', 'cryptomarkets', 'cryptotechnology',
  'defi', 'ethfinance', 'ethdev', 'uniswap', 'aave', 'solana', 'cardano',
  'polkadot', 'avax', 'cosmosnetwork', 'ethtrader', 'optimism', 'arbitrum',
];

async function getExistingSources(env: Env): Promise<Record<string, string[]>> {
  const all = await getAllSources(env);
  const approved = all.filter((s) => s.status === 'approved');

  return {
    reddit: [...KNOWN_REDDIT_SUBS, ...approved.filter((s) => s.platform === 'reddit').map((s) => s.name.replace('r/', ''))],
    youtube: approved.filter((s) => s.platform === 'youtube').map((s) => s.name.toLowerCase()),
    rss: approved.filter((s) => s.platform === 'rss').map((s) => s.url),
    lemmy: approved.filter((s) => s.platform === 'lemmy').map((s) => s.name.toLowerCase()),
    peertube: approved.filter((s) => s.platform === 'peertube').map((s) => s.name.toLowerCase()),
    newsletter: approved.filter((s) => s.platform === 'newsletter').map((s) => s.url),
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/sources/discover?platform=reddit
 * Trigger discovery for all platforms or a specific one.
 * Stores results in KV and returns discovered sources.
 */
export async function handleSourcesDiscover(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') || 'all';

    const existing = await getExistingSources(env);
    const rejected = await getRejectedIds(env);

    console.log(`[source-discovery] running for platform=${platform}`);

    let sources: DiscoveredSource[];

    if (platform === 'all') {
      sources = await discoverNewSources(existing, env.YOUTUBE_API_KEY);
    } else {
      // Single-platform discovery
      const platformModule = await importDiscoveryModule(platform);
      if (!platformModule) {
        return jsonResponse({ error: `Unknown platform: ${platform}` }, 400);
      }
      const existingList = existing[platform] ?? [];
      sources = await platformModule(existingList, env.YOUTUBE_API_KEY);
    }

    // Filter out rejected sources
    sources = sources.filter((s) => !rejected.has(s.id));

    // Separate into auto-approved and pending
    const autoApproved = sources.filter((s) => s.status === 'approved');
    const pending = sources.filter((s) => s.status === 'pending');

    // Merge with existing known sources
    const existingAll = await getAllSources(env);
    const existingIds = new Set(existingAll.map((s) => s.id));
    const newSources = sources.filter((s) => !existingIds.has(s.id));

    // Save to KV
    const mergedAll = [...existingAll, ...autoApproved];
    await saveAllSources(env, mergedAll);

    const existingPending = await getPendingSources(env);
    const pendingIds = new Set(existingPending.map((s) => s.id));
    const newPending = pending.filter((s) => !pendingIds.has(s.id));
    await savePendingSources(env, [...existingPending, ...newPending]);

    // Snapshot this run
    await env.CACHE?.put(
      runSnapshotKey(),
      JSON.stringify({ date: new Date().toISOString(), platform, count: sources.length }),
      { expirationTtl: 86400 * 90 },
    );

    return jsonResponse({
      success: true,
      platform,
      discovered: sources.length,
      autoApproved: autoApproved.length,
      pendingReview: pending.length,
      sources: sources.slice(0, 50),
    });
  } catch (err) {
    console.error('[source-discovery] error:', err);
    return jsonResponse({ error: 'Discovery failed', details: String(err) }, 500);
  }
}

/**
 * GET /api/sources/pending
 * List discovered sources that need manual review.
 */
export async function handleSourcesPending(_request: Request, env: Env): Promise<Response> {
  const pending = await getPendingSources(env);
  return noCacheJsonResponse({
    sources: pending.sort((a, b) => b.score - a.score),
    total: pending.length,
  });
}

/**
 * POST /api/sources/approve
 * Approve and activate a pending source.
 * Body: { id: string } or { ids: string[] }
 */
export async function handleSourcesApprove(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { id?: string; ids?: string[] };
    const approveIds = body.ids ?? (body.id ? [body.id] : []);
    if (approveIds.length === 0) {
      return jsonResponse({ error: 'No source IDs provided' }, 400);
    }

    const pending = await getPendingSources(env);
    const all = await getAllSources(env);

    const approved: DiscoveredSource[] = [];
    const remaining: DiscoveredSource[] = [];

    for (const source of pending) {
      if (approveIds.includes(source.id)) {
        approved.push({ ...source, status: 'approved', autoApproved: true });
      } else {
        remaining.push(source);
      }
    }

    // Move approved to all sources
    await saveAllSources(env, [...all, ...approved]);
    await savePendingSources(env, remaining);

    // Initialize health tracking for newly approved sources
    for (const source of approved) {
      const healthKey = `discovered:sources:health:${source.id}`;
      const existingHealth = await env.CACHE?.get(healthKey);
      if (!existingHealth) {
        const health: SourceHealth = {
          sourceId: source.id,
          platform: source.platform,
          lastPostAt: Date.now(),
          postFrequency: source.weeklyActivity,
          engagementScore: source.relevanceScore * 0.5,
          relevanceScore: source.relevanceScore,
          spamScore: 0,
          compositeScore: source.score,
          lastCheckedAt: Date.now(),
          spamFlagCount: 0,
          engagement30d: 0,
          postCount30d: 0,
        };
        await env.CACHE?.put(healthKey, JSON.stringify(health), { expirationTtl: 86400 * 90 });

        // Add to health index
        const indexKey = 'discovered:sources:health:index';
        const raw = await env.CACHE?.get(indexKey);
        const index: string[] = raw ? (JSON.parse(raw) as string[]) : [];
        if (!index.includes(source.id)) {
          index.push(source.id);
          await env.CACHE?.put(indexKey, JSON.stringify(index), { expirationTtl: 86400 * 90 });
        }
      }
    }

    return jsonResponse({
      success: true,
      approved: approved.length,
      sources: approved.map((s) => ({ id: s.id, name: s.name, platform: s.platform })),
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to approve sources', details: String(err) }, 500);
  }
}

/**
 * POST /api/sources/reject
 * Reject a pending source (won't be re-suggested).
 * Body: { id: string } or { ids: string[] }
 */
export async function handleSourcesReject(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { id?: string; ids?: string[] };
    const rejectIds = body.ids ?? (body.id ? [body.id] : []);
    if (rejectIds.length === 0) {
      return jsonResponse({ error: 'No source IDs provided' }, 400);
    }

    const pending = await getPendingSources(env);
    const rejected = await getRejectedIds(env);

    // Add to rejected set
    for (const id of rejectIds) {
      rejected.add(id);
    }
    await saveRejectedIds(env, rejected);

    // Remove from pending
    const remaining = pending.filter((s) => !rejectIds.includes(s.id));
    await savePendingSources(env, remaining);

    return jsonResponse({
      success: true,
      rejected: rejectIds.length,
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to reject sources', details: String(err) }, 500);
  }
}

/**
 * Dynamic import helper — loads the correct discovery module for a platform.
 */
async function importDiscoveryModule(
  platform: string,
): Promise<((existing: string[], apiKey?: string) => Promise<DiscoveredSource[]>) | null> {
  switch (platform) {
    case 'reddit': {
      const { discoverRedditSubreddits } = await import('@degenfeed/source-discovery');
      return discoverRedditSubreddits as (existing: string[]) => Promise<DiscoveredSource[]>;
    }
    case 'youtube': {
      const { discoverYouTubeChannels } = await import('@degenfeed/source-discovery');
      return (existing: string[], apiKey?: string) => discoverYouTubeChannels(apiKey, existing);
    }
    case 'rss': {
      const { discoverRSSFeeds } = await import('@degenfeed/source-discovery');
      return discoverRSSFeeds as (existing: string[]) => Promise<DiscoveredSource[]>;
    }
    case 'lemmy': {
      const { discoverLemmyCommunities } = await import('@degenfeed/source-discovery');
      return discoverLemmyCommunities as (existing: string[]) => Promise<DiscoveredSource[]>;
    }
    case 'peertube': {
      const { discoverPeerTubeChannels } = await import('@degenfeed/source-discovery');
      return discoverPeerTubeChannels as (existing: string[]) => Promise<DiscoveredSource[]>;
    }
    case 'newsletter': {
      const { discoverNewsletters } = await import('@degenfeed/source-discovery');
      return discoverNewsletters as (existing: string[]) => Promise<DiscoveredSource[]>;
    }
    default:
      return null;
  }
}
