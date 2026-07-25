/**
 * Mbin Bridge Provider
 *
 * Mbin is the community-maintained fork of Kbin.
 * Uses the same Kbin-compatible REST API.
 *
 * API: GET https://{instance}/api/entries?sort=hot&page=1&perPage=N
 */

import { guessNiches, stripHtml } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface MbinEntry {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  image: string | null;
  createdAt: string;
  user: { id: number; username: string; avatar: string | null; about: string | null };
  magazine: { id: number; name: string };
  comments: number;
  favouriteCount: number;
  tags: string[];
}

const MBIN_INSTANCES = [
  { host: 'fedia.io', label: 'fedia.io' },
  { host: 'mbin.gabe.biz', label: 'mbin.gabe.biz' },
  { host: 'mbin.cyberdi.sk', label: 'mbin.cyberdi.sk' },
  { host: 'lab.nyarla.net', label: 'lab.nyarla.net' },
];

export async function fetchMbinPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / MBIN_INSTANCES.length));
  const all: UnifiedPost[] = [];

  const fetches = MBIN_INSTANCES.map(async ({ host, label }) => {
    try {
      const entriesRes = await $fetch(
        'https://' + host + '/api/entries?sort=hot&page=1&perPage=' + perInstance,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Mbin)' },
          signal: AbortSignal.timeout(8000),
        },
      );
      const entries: MbinEntry[] = entriesRes.ok ? await entriesRes.json() : [];
      if (!Array.isArray(entries) || entries.length === 0) return [] as UnifiedPost[];

      return entries.slice(0, perInstance).map((entry) => {
        const content = stripHtml(entry.body || '');
        const text = entry.title ? entry.title + (content ? '\n\n' + content : '') : content;
        const createdAt = new Date(entry.createdAt).getTime();
        return {
          id: 'mbin:entry:' + entry.id + '@' + host,
          protocol: 'mbin',
          author: {
            id: 'mbin:user:' + entry.user.id + '@' + host,
            primary: { protocol: 'mbin', id: String(entry.user.id) },
            handles: { mbin: '@' + entry.user.username + '@' + label },
            displayName: entry.user.username,
            bio: (entry.user.about || '').slice(0, 200),
            avatarUrl: entry.user.avatar || '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: text.slice(0, 2000),
          embeds: entry.image
            ? [{ kind: 'image' as const, url: entry.image }]
            : entry.url
              ? [{ kind: 'link' as const, url: entry.url }]
              : [],
          contentType: entry.image ? 'image' : 'text',
          createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
          metrics: {
            likes: entry.favouriteCount || 0,
            reposts: 0,
            replies: entry.comments || 0,
            quotes: 0,
          },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: {
              likes: entry.favouriteCount || 0,
              reposts: 0,
              replies: entry.comments || 0,
              quotes: 0,
            },
          },
          raw: entry,
          niches: guessNiches(text, [...(entry.tags || []), entry.magazine?.name].filter(Boolean)),
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

  console.log('[bridge] Mbin: ' + deduped.length + ' entries');
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'mbin',
  name: 'Mbin',
  description: 'Active Kbin fork — federated content aggregation + microblogging',
  endpoint: '/api/feed/mbin',
  requiresAuth: false,
  contentType: 'mixed',
};

export const fetch = fetchMbinPosts;
