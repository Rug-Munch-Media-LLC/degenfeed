/**
 * Flarum Bridge Provider
 *
 * Flarum is a modern open-source forum software with a JSON API.
 * Fetches recent discussions and posts from known Flarum instances.
 *
 * API: GET https://{instance}/api/discussions?include=startUser,tags&page[limit]=N
 *
 * Returns discussion threads with author info and comment counts.
 */

import { guessNiches } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface FlarumDiscussion {
  id: string;
  attributes: {
    title: string;
    createdAt: string;
    commentCount: number;
    participantCount: number;
    isSticky: boolean;
  };
  relationships?: {
    startUser?: { data: { id: string; type: string } };
    tags?: { data: Array<{ id: string; type: string }> };
  };
}

interface FlarumInclude {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

interface FlarumResponse {
  data: FlarumDiscussion[];
  included?: FlarumInclude[];
}

const FLARUM_INSTANCES = [
  { host: 'discuss.flarum.org', label: 'Flarum Community' },
  { host: 'discuss.codeberg.org', label: 'Codeberg Discuss' },
];

function findIncluded(
  included: FlarumInclude[] | undefined,
  id: string,
  type: string,
): FlarumInclude | null {
  if (!included) return null;
  return included.find((i) => i.id === id && i.type === type) || null;
}

export async function fetchFlarumPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / FLARUM_INSTANCES.length));
  const all: UnifiedPost[] = [];

  const fetches = FLARUM_INSTANCES.map(async ({ host, label }) => {
    try {
      const res = await $fetch(
        'https://' +
          host +
          '/api/discussions?include=startUser,tags&page%5Blimit%5D=' +
          perInstance +
          '&sort=-createdAt',
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Flarum)', Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!res.ok) return [] as UnifiedPost[];

      const response = (await res.json()) as FlarumResponse;
      const discussions = response.data || [];
      const included = response.included;

      if (!Array.isArray(discussions)) return [];

      return discussions.slice(0, perInstance).map((disc) => {
        const title = disc.attributes?.title || 'Untitled';
        const createdAt = new Date(disc.attributes?.createdAt || Date.now()).getTime();
        const commentCount = disc.attributes?.commentCount || 0;

        const startUserId = disc.relationships?.startUser?.data?.id;
        const startUser = startUserId ? findIncluded(included, startUserId, 'users') : null;
        const attrs = startUser?.attributes as any;
        const username = attrs?.username || 'Unknown';

        return {
          id: `flarum:disc:${disc.id}@${host}`,
          protocol: 'flarum',
          author: {
            id: `flarum:user:${startUserId || '0'}@${host}`,
            primary: { protocol: 'flarum', id: String(startUserId || '0') },
            handles: { flarum: `@${username}@${label}` },
            displayName: username,
            bio: '',
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: `${title}\n\n${commentCount} comments`.slice(0, 2000),
          embeds: [{ kind: 'link', url: `https://${host}/d/${disc.id}`, meta: { title } }],
          contentType: 'text',
          createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
          metrics: { likes: 0, reposts: 0, replies: commentCount, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: commentCount, quotes: 0 },
          },
          raw: disc,
          niches: guessNiches(title),
        } as UnifiedPost;
      });
    } catch {
      return [] as UnifiedPost[];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
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

  // console.log(`[bridge] Flarum: ${deduped.length} discussions`);
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'flarum',
  name: 'Flarum (Forum Bridge)',
  description: 'Forum discussions from Flarum instances',
  endpoint: '/api/feed/flarum',
  requiresAuth: false,
  contentType: 'mixed',
};

export const fetch = fetchFlarumPosts;
