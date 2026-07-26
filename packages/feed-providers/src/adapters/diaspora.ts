/**
 * Diaspora* Adapter
 *
 * Minimal adapter for Diaspora* — distributed social network.
 * Fetches via RSS from public pods.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { guessNiches, parseRssItems, stripHtml } from '@degenfeed/utils';

const $fetch = globalThis.fetch;

const DIASPORA_PODS = ['https://diasp.org', 'https://diaspora-fr.org', 'https://pod.geraspora.de'];

export async function fetchDiasporaPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perPod = Math.max(2, Math.ceil(limit / DIASPORA_PODS.length));

  for (const pod of DIASPORA_PODS) {
    if (posts.length >= limit) break;
    try {
      const res = await $fetch(`${pod}/public.rss`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Diaspora)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRssItems(xml);

      for (const item of items.slice(0, perPod)) {
        const text = stripHtml(item.title || item.description || '');
        if (!text) continue;
        posts.push({
          id: `diaspora:${pod}:${item.guid || item.link || text.slice(0, 40)}`,
          protocol: 'diaspora' as Protocol,
          author: {
            id: `diaspora:${item.author || pod}`,
            primary: { protocol: 'diaspora' as Protocol, id: item.author || pod },
            handles: { diaspora: item.author || null },
            displayName: item.author || pod.replace('https://', ''),
            bio: '',
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            verified: [],
            links: [],
            keys: {},
          },
          text,
          embeds: [],
          createdAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: item,
          niches: guessNiches(text),
        });
      }
    } catch {
      // skip
    }
  }
  return posts;
}
