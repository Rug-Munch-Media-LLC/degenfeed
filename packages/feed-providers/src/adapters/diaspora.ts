/**
 * Diaspora* Adapter
 *
 * Minimal adapter for Diaspora* — distributed social network.
 * Fetches via RSS from public pods.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const DIASPORA_PODS = ['https://diasp.org', 'https://diaspora-fr.org', 'https://pod.geraspora.de'];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(btc|bitcoin|crypto|blockchain|web3)\b/.test(lower)) n.push('crypto');
  if (/\b(tech|programming|code|software|linux|foss)\b/.test(lower)) n.push('tech');
  if (/\b(privacy|surveillance|encryption|security)\b/.test(lower)) n.push('privacy');
  if (n.length === 0) n.push('social');
  return n;
}

function parseRssItems(xml: string): Array<{
  title?: string;
  link?: string;
  guid?: string;
  description?: string;
  author?: string;
  pubDate?: string;
}> {
  const items: Array<Record<string, string>> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    if (!m[1]) continue;
    const e: string = m[1];
    items.push({
      title: (e.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '',
      link: (e.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '',
      guid: (e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || '',
      description: (e.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '',
      author:
        (e.match(/<author[^>]*>([\s\S]*?)<\/author>/i) || [])[1] ||
        (e.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || [])[1] ||
        '',
      pubDate: (e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '',
    });
  }
  return items;
}

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
