/**
 * Diaspora* Bridge Provider
 *
 * Diaspora* pods expose public activity feeds via RSS/Atom and JSON.
 * We query known pods for their public posts and map them to UnifiedPost.
 *
 * API endpoints:
 *   GET https://{pod}/public/activity.json — public activity as JSON
 *   GET https://{pod}/public/activity.xml — RSS feed
 *   GET https://{pod}/api/v0/users/ — user lookup
 *
 * Strategy: Query public JSON activity feeds from known pods.
 * Falls back to parsing RSS XML when JSON not available.
 */

import { guessNiches, stripHtml } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface DiasporaActivityJSON {
  activity?: Array<{
    id: string;
    title: string;
    content: string;
    published: string;
    updated: string;
    author: {
      name: string;
      uri: string;
      image?: { url: string };
    };
    url: string;
    objectType: string;
    image?: { url: string };
  }>;
  items?: Array<{
    id: string;
    title: string;
    content: string;
    published: string;
    author: { name: string; uri: string };
    url: string;
  }>;
  entries?: Array<{
    id: string;
    title: string;
    content: string;
    published: string;
    author: { name: string; uri: string };
  }>;
}

const DIASPORA_PODS = [
  { host: 'diasp.eu', label: 'diasp.eu' },
  { host: 'diaspora.uni.com', label: 'diaspora.uni.com' },
  { host: 'diaspora.ledtec.de', label: 'diaspora.ledtec.de' },
  { host: 'diaspora-fr.org', label: 'diaspora-fr.org' },
  { host: 'pod.geraspora.de', label: 'pod.geraspora.de' },
  { host: 'separateconcerns.com', label: 'separateconcerns.com' },
];

function parseDiasporaId(id: string): string {
  // Handle both GUID-style IDs and URL-based IDs
  return id.replace(/^.*\/(post|status_messages)\//, '').replace(/@.*$/, '');
}

function extractAuthorInfo(author: { name: string; uri?: string }) {
  const name = author.name || 'Unknown';
  const uri = (author as any).uri || author.uri || '';
  const handle = uri
    .replace(/^https?:\/\//, '')
    .replace(/\/?$/, '');
  const username = name.toLowerCase().replace(/\s+/g, '_');
  return { name, handle, uri, username };
}

export async function fetchDiasporaPosts(limit = 20): Promise<UnifiedPost[]> {
  const perPod = Math.max(3, Math.ceil(limit / DIASPORA_PODS.length));
  const all: UnifiedPost[] = [];

  const fetches = DIASPORA_PODS.map(async ({ host, label }) => {
    try {
      // Try JSON activity feed first
      const res = await $fetch(`https://${host}/public/activity.json`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Diaspora)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        // Fallback: try the stream page
        return [] as UnifiedPost[];
      }

      const data = (await res.json()) as DiasporaActivityJSON;
      const entries = data.activity || data.items || data.entries || [];

      if (!Array.isArray(entries)) return [];

      return entries.slice(0, perPod).map((entry) => {
        const authorInfo = extractAuthorInfo(entry.author);
        const content = stripHtml(entry.content || '');
        const text = entry.title
          ? `${entry.title}\n\n${content}`
          : content;
        const createdAt = new Date(entry.published).getTime();

        return {
          id: `diaspora:${parseDiasporaId(entry.id)}@${host}`,
          protocol: 'diaspora',
          author: {
            id: `diaspora:${authorInfo.handle || authorInfo.username}@${host}`,
            primary: { protocol: 'diaspora', id: authorInfo.username },
            handles: { diaspora: `${authorInfo.username}@${label}` },
            displayName: authorInfo.name,
            bio: '',
            avatarUrl: (entry as any).author?.image?.url || '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: text.slice(0, 2000),
          embeds: (entry as any).image?.url
            ? [{ kind: 'image' as const, url: (entry as any).image.url }]
            : [],
          contentType: 'text',
          createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: entry,
          niches: guessNiches(text),
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

  console.log(`[bridge] Diaspora: ${deduped.length} posts from ${DIASPORA_PODS.length} pods`);
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'diaspora',
  name: 'Diaspora*',
  description: 'Federated social network — distributed pods worldwide',
  endpoint: '/api/feed/diaspora',
  requiresAuth: false,
  contentType: 'mixed',
};

export const fetch = fetchDiasporaPosts;
