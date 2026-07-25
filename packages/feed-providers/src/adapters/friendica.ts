/**
 * Friendica Adapter
 *
 * Minimal adapter for Friendica — decentralized social network
 * with ActivityPub support. Uses Mastodon-compatible API.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const FRIENDICA_INSTANCES = [
  'https://friendica.world',
  'https://libranet.de',
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function guessNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(btc|bitcoin|crypto|blockchain|web3|defi|nft)\b/.test(lower)) n.push('crypto');
  if (/\b(tech|programming|code|software|foss|linux)\b/.test(lower)) n.push('tech');
  if (/\b(privacy|surveillance|encryption|security|decentralized)\b/.test(lower)) n.push('privacy');
  if (/\b(fediverse|activitypub|friendica|social)\b/.test(lower)) n.push('fediverse');
  if (n.length === 0) n.push('social');
  return n;
}

function parseRssItems(xml: string): Array<{ title?: string; link?: string; guid?: string; description?: string; author?: string; pubDate?: string }> {
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
      author: (e.match(/<author[^>]*>([\s\S]*?)<\/author>/i) || [])[1] || (e.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || [])[1] || '',
      pubDate: (e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '',
    });
  }
  return items;
}

export async function fetchFriendicaPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(2, Math.ceil(limit / FRIENDICA_INSTANCES.length));

  for (const inst of FRIENDICA_INSTANCES) {
    if (posts.length >= limit) break;
    try {
      // Try Mastodon-compatible API first
      const res = await $fetch(`${inst}/api/v1/timelines/public?local=true&limit=${perInst}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Friendica)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as Array<Record<string, unknown>>;
        if (Array.isArray(data)) {
          for (const item of data.slice(0, perInst)) {
            const content = stripHtml(String(item.content || ''));
            if (!content) continue;
            const acct = item.account as Record<string, unknown> | undefined;
            posts.push({
              id: `friendica:${String(item.id)}@${new URL(inst).hostname}`,
              protocol: 'friendica' as Protocol,
              author: {
                id: `friendica:${String(acct?.id || item.id)}@${new URL(inst).hostname}`,
                primary: { protocol: 'friendica' as Protocol, id: String(acct?.acct || acct?.username || '') },
                handles: { friendica: String(acct?.acct || acct?.username || '') },
                displayName: String(acct?.display_name || acct?.username || 'Friendica User'),
                bio: stripHtml(String(acct?.note || '')),
                avatarUrl: String(acct?.avatar || ''),
                followerCount: Number(acct?.followers_count || 0),
                followingCount: Number(acct?.following_count || 0),
                verified: [],
                links: [],
                keys: {},
              },
              text: content,
              embeds: [],
              createdAt: new Date(String(item.created_at)).getTime(),
              metrics: { likes: Number(item.favourites_count || 0), reposts: Number(item.reblogs_count || 0), replies: Number(item.replies_count || 0), quotes: 0 },
              engagement: {
                viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
                raw: { likes: Number(item.favourites_count || 0), reposts: Number(item.reblogs_count || 0), replies: Number(item.replies_count || 0), quotes: 0 },
              },
              raw: item,
              niches: guessNiches(content),
            });
          }
        }
      }
    } catch {
      // RSS fallback
      try {
        const rssRes = await $fetch(`${inst}/feed/`, {
          headers: { 'User-Agent': 'DegenFeed/0.1 (Friendica)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!rssRes.ok) continue;
        const xml = await rssRes.text();
        const items = parseRssItems(xml);
        for (const item of items.slice(0, perInst)) {
          const text = stripHtml(item.title || item.description || '');
          if (!text) continue;
          posts.push({
            id: `friendica:rss:${item.guid || item.link || text.slice(0, 40)}`,
            protocol: 'friendica' as Protocol,
            author: {
              id: `friendica:rss:${inst}`,
              primary: { protocol: 'friendica' as Protocol, id: item.author || inst },
              handles: { friendica: item.author || null },
              displayName: item.author || new URL(inst).hostname,
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
            engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 } },
            raw: item,
            niches: guessNiches(text),
          });
        }
      } catch {
        // skip
      }
    }
  }
  return posts;
}
