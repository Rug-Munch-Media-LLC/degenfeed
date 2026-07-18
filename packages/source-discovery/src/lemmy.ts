/**
 * @degenfeed/source-discovery — Lemmy community discovery engine.
 *
 * Browses federated Lemmy instances for crypto/web3 communities.
 * Searches our own instance + known public instances.
 */

import { computeQualityScore, estimateRelevance } from './quality';
import type { DiscoveredSource } from './types';
import { CRYPTO_KEYWORDS, DEFAULT_DISCOVERY_CONFIG, SEARCH_KEYWORDS } from './types';

const REQUEST_TIMEOUT_MS = 5000;

/** Known Lemmy instances (our own + popular public ones) */
const LEMMY_INSTANCES = [
  'https://community.degenfeed.xyz', // Own instance
  'https://lemmy.world',
  'https://lemmy.ml',
  'https://sh.itjust.works',
  'https://lemmy.ca',
  'https://feddit.de',
  'https://lemmy.one',
  'https://discuss.online',
  'https://programming.dev',
  'https://lemm.ee',
  'https://lemmy.dbzer0.com',
  'https://sopuli.xyz',
  'https://feddit.org',
  'https://lemmy.zip',
  'https://discuss.tchncs.de',
  'https://lemmy.nz',
  'https://feddit.uk',
  'https://lemmy.blahaj.zone',
  'https://lemmy.sdf.org',
  'https://lemmy.eco.br',
  'https://lemmy.fmhy.ml',
  'https://midwest.social',
  'https://reddthat.com',
  'https://startrek.website',
  'https://infosec.pub',
];

interface LemmyCommunity {
  community: {
    id: number;
    name: string;
    title?: string;
    description?: string;
    icon?: string;
    actor_id: string;
    published: string;
  };
  counts?: {
    subscribers?: number;
    posts?: number;
    comments?: number;
    users_active_day?: number;
    users_active_week?: number;
    users_active_month?: number;
  };
}

interface LemmySearchResponse {
  communities?: LemmyCommunity[];
}

/**
 * Search a Lemmy instance for communities matching a keyword.
 */
async function searchLemmyInstance(
  instanceUrl: string,
  keyword: string,
): Promise<LemmyCommunity[]> {
  try {
    const url = `${instanceUrl}/api/v3/search?q=${encodeURIComponent(keyword)}&type_=Communities&limit=10&sort=TopAll`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const body = (await res.json()) as LemmySearchResponse;
    return body.communities ?? [];
  } catch {
    return [];
  }
}

/**
 * Get trending communities from a Lemmy instance (general browsing).
 */
async function getTrendingCommunities(instanceUrl: string): Promise<LemmyCommunity[]> {
  try {
    const url = `${instanceUrl}/api/v3/community/list?type_=All&sort=Hot&limit=20`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const body = (await res.json()) as { communities?: LemmyCommunity[] };
    return body.communities ?? [];
  } catch {
    return [];
  }
}

/**
 * Discover new Lemmy crypto communities across federated instances.
 */
export async function discoverLemmyCommunities(
  existingCommunities: string[] = [],
): Promise<DiscoveredSource[]> {
  const seen = new Set<string>();
  const sources: DiscoveredSource[] = [];
  const existingLower = new Set(existingCommunities.map((c) => c.toLowerCase()));

  // Phase 1: Search known instances with crypto keywords
  for (const instance of LEMMY_INSTANCES) {
    for (const keyword of SEARCH_KEYWORDS) {
      const communities = await searchLemmyInstance(instance, keyword);
      for (const c of communities) {
        const community = c.community;
        const nameLower = community.name.toLowerCase();
        const uniqueKey = `${instance}:${community.name}`;

        if (seen.has(uniqueKey)) continue;
        if (existingLower.has(nameLower)) continue;
        seen.add(uniqueKey);

        const relevanceScore = estimateRelevance(
          community.title ?? community.name,
          community.description,
        );

        const subscriberCount = c.counts?.subscribers ?? 0;
        const weeklyActivity =
          c.counts?.users_active_week ??
          Math.max(1, Math.round((c.counts?.users_active_month ?? 10) / 4));

        const candidate = {
          id: `lemmy:${community.name}@${new URL(instance).hostname}`,
          platform: 'lemmy' as const,
          name: community.title ?? community.name,
          url: community.actor_id,
          iconUrl: community.icon || undefined,
          description: community.description?.slice(0, 300),
          subscriberCount,
          weeklyActivity,
          sourceCreatedAt: new Date(community.published).getTime(),
          relevanceScore,
          metadata: { instance, communityId: community.id, keyword },
        };

        const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

        sources.push({
          ...candidate,
          score,
          autoApproved: passed,
          status: passed ? 'approved' : 'pending',
          discoveredAt: Date.now(),
        });
      }
    }

    // Phase 2: Browse trending communities and filter for crypto-relevant ones
    const trending = await getTrendingCommunities(instance);
    for (const c of trending) {
      const community = c.community;
      const uniqueKey = `${instance}:${community.name}`;
      if (seen.has(uniqueKey) || existingLower.has(community.name.toLowerCase())) continue;
      seen.add(uniqueKey);

      // Check if title has crypto keywords
      const hasCryptoKeywords = CRYPTO_KEYWORDS.some(
        (kw) =>
          community.title?.toLowerCase().includes(kw) ||
          community.description?.toLowerCase().includes(kw),
      );
      if (!hasCryptoKeywords) continue;

      const relevanceScore = estimateRelevance(
        community.title ?? community.name,
        community.description,
      );

      const subscriberCount = c.counts?.subscribers ?? 0;
      const weeklyActivity =
        c.counts?.users_active_week ??
        Math.max(1, Math.round((c.counts?.users_active_month ?? 10) / 4));

      const candidate = {
        id: `lemmy:${community.name}@${new URL(instance).hostname}`,
        platform: 'lemmy' as const,
        name: community.title ?? community.name,
        url: community.actor_id,
        iconUrl: community.icon || undefined,
        description: community.description?.slice(0, 300),
        subscriberCount,
        weeklyActivity,
        sourceCreatedAt: new Date(community.published).getTime(),
        relevanceScore,
        metadata: { instance, communityId: community.id, source: 'trending' },
      };

      const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

      sources.push({
        ...candidate,
        score,
        autoApproved: passed,
        status: passed ? 'approved' : 'pending',
        discoveredAt: Date.now(),
      });
    }
  }

  return sources.sort((a, b) => b.score - a.score);
}
