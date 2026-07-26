/**
 * Kbin Bridge Provider
 *
 * Kbin is a Reddit-like content aggregator with microblogging on ActivityPub.
 * Uses the native Kbin REST API for magazine/thread content.
 *
 * API: GET https://{instance}/api/entries?sort=hot&page=1&perPage=N
 */

import { guessNiches, stripHtml } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface KbinEntry {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  image: string | null;
  createdAt: string;
  user: { id: number; username: string; avatar: string | null; about: string | null };
  magazine: { id: number; name: string };
  comments: number;
  uv: number;
  favouriteCount: number;
  tags: string[];
}

const KBIN_INSTANCES = [
  { host: 'kbin.social', label: 'kbin.social' },
  { host: 'karab.in', label: 'karab.in' },
  { host: 'fedia.io', label: 'fedia.io' },
  { host: 'kbin.run', label: 'kbin.run' },
];

export async function fetchKbinPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / KBIN_INSTANCES.length));
  const all: UnifiedPost[] = [];

  const fetches = KBIN_INSTANCES.map(async ({ host, label }) => {
    try {
      const entriesRes = await $fetch(
        `https://${host}/api/entries?sort=hot&page=1&perPage=${perInstance}`,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Kbin)' },
          signal: AbortSignal.timeout(8000),
        },
      );
      const entries: KbinEntry[] = entriesRes.ok ? await entriesRes.json() : [];
      if (!Array.isArray(entries) || entries.length === 0) return [] as UnifiedPost[];

      return entries.slice(0, perInstance).map((entry) => {
        const content = stripHtml(entry.body || '');
        const text = entry.title ? entry.title + (content ? `\n\n${content}` : '') : content;
        const createdAt = new Date(entry.createdAt).getTime();
        return {
          id: `kbin:entry:${entry.id}@${host}`,
          protocol: 'kbin',
          author: {
            id: `kbin:user:${entry.user.id}@${host}`,
            primary: { protocol: 'kbin', id: String(entry.user.id) },
            handles: { kbin: `@${entry.user.username}@${label}` },
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

  console.log(`[bridge] Kbin: ${deduped.length} entries`);
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'kbin',
  name: 'Kbin',
  description: 'Federated link aggregation and microblogging (Reddit+Mastodon hybrid)',
  endpoint: '/api/feed/kbin',
  requiresAuth: false,
  contentType: 'mixed',
};

export const fetch = fetchKbinPosts;
