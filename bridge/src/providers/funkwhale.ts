/**
 * Funkwhale Provider
 *
 * Fetches audio/music content from Funkwhale — a federated music platform.
 * Funkwhale uses ActivityPub for federation and has a REST API.
 *
 * API: REST at https://open.audio/api/v1/ (or other public instances)
 *
 * Strategy:
 * 1. Query public Funkwhale instances for recent tracks
 * 2. Search for specific genres/tags
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const FUNKWHALE_INSTANCES = [
  'https://open.audio',
  'https://funkwhale.it',
  'https://funkwhale.audio',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface FunkwhaleTrack {
  id: number;
  fid: string;
  title: string;
  creation_date: string;
  artist?: {
    id: number;
    fid: string;
    name: string;
    content_category?: string;
    cover?: {
      urls: { original: string };
    };
  };
  album?: {
    id: number;
    title: string;
    cover?: {
      urls: { original: string };
    };
  };
  license?: string;
  listens?: number;
  downloads?: number;
  tags?: string[];
  uploads?: Array<{
    uuid: string;
    audio_file: string;
    duration: number;
    mimetype: string;
  }>;
}

interface FunkwhaleResponse {
  count: number;
  results: FunkwhaleTrack[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();
  const niches: string[] = [];
  if (/\b(music|audio|song|track|album|playlist)\b/.test(lower)) niches.push('music');
  if (/\b(podcast|episode|show|interview)\b/.test(lower)) niches.push('podcast');
  if (/\b(nft|collectible|mint|audio nft)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|generative|synthesizer)\b/.test(lower)) niches.push('ai');
  if (/\b(tech|technology|electronic|ambient|experimental)\b/.test(lower)) niches.push('tech');
  if (/\b(creative|art|artist|music|indie|alternative)\b/.test(lower)) niches.push('culture');
  niches.push('music');
  return [...new Set(niches)];
}

async function fetchFromInstance(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${instance}/api/v1/tracks/?page_size=${Math.min(limit, 30)}&ordering=-creation_date`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as FunkwhaleResponse;
    if (!data.results) return [];

    return data.results.slice(0, limit).map((track) => {
      const upload = track.uploads?.[0];
      const artistName = track.artist?.name || 'Unknown Artist';
      const text = `${track.title} by ${artistName}${track.album?.title ? ` (Album: ${track.album.title})` : ''}`;

      return {
        id: `funkwhale:${track.fid || track.id}`,
        protocol: 'funkwhale',
        author: {
          id: `funkwhale:${track.artist?.fid || track.artist?.id || 'unknown'}`,
          primary: { protocol: 'funkwhale', id: artistName },
          handles: { funkwhale: artistName },
          displayName: artistName,
          bio: track.artist?.content_category || '',
          avatarUrl:
            track.artist?.cover?.urls?.original || track.album?.cover?.urls?.original || '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text,
        embeds: [
          ...(upload?.audio_file
            ? [
                {
                  kind: 'video' as const,
                  url: upload.audio_file,
                  meta: { duration: upload.duration },
                },
              ]
            : []),
          ...(track.album?.cover?.urls?.original
            ? [{ kind: 'image' as const, url: track.album.cover.urls.original }]
            : []),
        ],
        contentType: 'video',
        createdAt: new Date(track.creation_date).getTime(),
        metrics: {
          likes: track.listens || 0,
          reposts: track.downloads || 0,
          replies: 0,
          quotes: 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: track.listens || 0, reposts: track.downloads || 0, replies: 0, quotes: 0 },
        },
        raw: track,
        niches: guessNiches(text, track.tags),
      };
    });
  } catch {
    // console.log(`[bridge] Funkwhale error (${instance}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'funkwhale',
  name: 'Funkwhale',
  description: 'Federated music/audio sharing platform (ActivityPub)',
  endpoint: '/api/feed/funkwhale',
  requiresAuth: false,
  contentType: 'video',
};

export async function fetchFunkwhalePosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / FUNKWHALE_INSTANCES.length));

  const results = await Promise.allSettled(
    FUNKWHALE_INSTANCES.map((inst) => fetchFromInstance(inst, perInstance)),
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

  // console.log(`[bridge] Funkwhale: ${deduped.length} tracks`);
  return deduped;
}

/** @alias */
export const fetch = fetchFunkwhalePosts;
