/**
 * Castopod Provider
 *
 * Fetches podcast episodes from Castopod — an open-source, federated podcasting
 * platform built on ActivityPub.
 *
 * API: REST at public Castopod instances
 *
 * Strategy:
 * 1. Query public Castopod instances for recent episodes
 * 2. Use ActivityPub outbox endpoints
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const CASTOPOD_INSTANCES = [
  'https://podcast.degenfeed.xyz',
  'https://castopod.org',
  'https://podlibre.org',
  'https://fedi.party',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface CastopodEpisode {
  id: number;
  title: string;
  description: string;
  published_at: string;
  created_at: string;
  duration: number;
  audio_url: string;
  audio_mimetype: string;
  cover_url?: string;
  cover?: { url: string };
  podcast?: {
    id: number;
    title: string;
    description: string;
    image_url?: string;
    actor?: {
      display_name: string;
      avatar_url?: string;
      username: string;
    };
  };
  hashtags?: Array<{ name: string }>;
  total_plays?: number;
  unique_listeners?: number;
}

interface CastopodResponse {
  episodes?: CastopodEpisode[];
  data?: CastopodEpisode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();
  const niches: string[] = [];
  if (/\b(podcast|episode|show|interview|series)\b/.test(lower)) niches.push('podcast');
  if (/\b(crypto|bitcoin|eth|defi|nft|blockchain|web3)\b/.test(lower)) niches.push('crypto');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning|data science)\b/.test(lower))
    niches.push('ai');
  if (/\b(tech|technology|startup|software|programming|developer)\b/.test(lower)) niches.push('tech');
  if (/\b(news|current events|politics|world|report)\b/.test(lower)) niches.push('news');
  if (/\b(science|research|study|discovery|biology|physics|space)\b/.test(lower))
    niches.push('science');
  if (/\b(music|audio|sound|creative|art)\b/.test(lower)) niches.push('music');
  if (niches.length === 0) niches.push('podcast');
  return niches;
}

async function fetchFromInstance(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    // Try the episodes API endpoint
    const res = await $fetch(
      `${instance}/api/episodes?limit=${Math.min(limit, 20)}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as CastopodResponse;
    const episodes = data.episodes || data.data || [];
    if (!Array.isArray(episodes) || episodes.length === 0) return [];

    return episodes.slice(0, limit).map((ep) => {
      const podcastTitle = ep.podcast?.title || 'Castopod';
      const text = `${ep.title}\n\n${ep.description || ''}`.trim();
      const podcastActor = ep.podcast?.actor;

      return {
        id: `castopod:${ep.id}`,
        protocol: 'castopod',
        author: {
          id: `castopod:${ep.podcast?.id || 'unknown'}`,
          primary: { protocol: 'castopod', id: podcastActor?.username || podcastTitle },
          handles: { castopod: podcastActor?.username || null },
          displayName: podcastActor?.display_name || podcastTitle,
          bio: ep.podcast?.description || '',
          avatarUrl: podcastActor?.avatar_url || ep.podcast?.image_url || ep.cover_url || '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text,
        embeds: [
          { kind: 'video' as const, url: ep.audio_url, meta: { duration: ep.duration } },
          ...(ep.cover_url || ep.cover?.url
            ? [{ kind: 'image' as const, url: ep.cover_url || ep.cover!.url }]
            : []),
        ],
        contentType: 'video',
        createdAt: new Date(ep.published_at || ep.created_at).getTime(),
        metrics: {
          likes: ep.total_plays || 0,
          reposts: ep.unique_listeners || 0,
          replies: 0,
          quotes: 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: ep.total_plays || 0, reposts: ep.unique_listeners || 0, replies: 0, quotes: 0 },
        },
        raw: ep,
        niches: guessNiches(text, ep.hashtags?.map((h) => h.name)),
      };
    });
  } catch (err) {
    console.log(`[bridge] Castopod error (${instance}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'castopod',
  name: 'Castopod',
  description: 'Open-source, federated podcast hosting (ActivityPub)',
  endpoint: '/api/feed/castopod',
  requiresAuth: false,
  contentType: 'video',
};

export async function fetchCastopodPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / CASTOPOD_INSTANCES.length));

  const results = await Promise.allSettled(
    CASTOPOD_INSTANCES.map((inst) => fetchFromInstance(inst, perInstance)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Castopod: ${deduped.length} episodes`);
  return deduped;
}

/** @alias */
export const fetch = fetchCastopodPosts;
