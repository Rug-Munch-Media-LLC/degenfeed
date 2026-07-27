/**
 * Epicyon Adapter
 *
 * Epicyon is a lightweight ActivityPub server designed for low resource usage.
 * No JavaScript, no database (file-based), runs on single board computers.
 * Supports ActivityPub C2S and S2S, RSS, CalDAV.
 *
 * API: ActivityPub outbox, RSS feeds, Mastodon-compatible endpoints
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { guessNiches, parseRssItems, stripHtml } from '@degenfeed/utils';

const $fetch = globalThis.fetch;

const EPICYON_INSTANCES = ['https://epicyon.net', 'https://epicyon.libreserver.org'];

export async function fetchEpicyonPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(5, Math.ceil(limit / EPICYON_INSTANCES.length));

  for (const inst of EPICYON_INSTANCES) {
    if (posts.length >= limit) break;
    try {
      // Try RSS feed first (Epicyon always has RSS)
      const rssRes = await $fetch(`${inst}/users/rss.xml`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Epicyon)' },
        signal: AbortSignal.timeout(5000),
      });
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const items = parseRssItems(xml);
        for (const item of items.slice(0, perInst)) {
          const text = stripHtml(item.title || item.description || '');
          if (!text) continue;
          posts.push({
            id: `epicyon:rss:${item.guid || item.link || text.slice(0, 40)}`,
            protocol: 'epicyon' as Protocol,
            author: {
              id: `epicyon:rss:${inst}`,
              primary: { protocol: 'epicyon' as Protocol, id: item.author || inst },
              handles: { epicyon: item.author || new URL(inst).hostname } as any,
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
      }
    } catch {
      // Try Mastodon-compat API
      try {
        const res = await $fetch(`${inst}/api/v1/timelines/public?local=true&limit=${perInst}`, {
          headers: { 'User-Agent': 'DegenFeed/0.1 (Epicyon)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as any[];
        for (const item of data.slice(0, perInst)) {
          const text = stripHtml(String(item.content || ''));
          if (!text) continue;
          const acct = item.account as Record<string, unknown> | undefined;
          posts.push({
            id: `epicyon:${String(item.id)}`,
            protocol: 'epicyon' as Protocol,
            author: {
              id: `epicyon:${String(acct?.id || item.id)}`,
              primary: { protocol: 'epicyon' as Protocol, id: String(acct?.acct || '') },
              handles: { epicyon: String(acct?.acct || '') } as any,
              displayName: String(acct?.display_name || acct?.username || 'Epicyon User'),
              bio: stripHtml(String(acct?.note || '')),
              avatarUrl: String(acct?.avatar || ''),
              followerCount: Number(acct?.followers_count || 0),
              followingCount: Number(acct?.following_count || 0),
              verified: [],
              links: [],
              keys: {},
            },
            text,
            embeds: [],
            createdAt: new Date(String(item.created_at)).getTime(),
            metrics: {
              likes: Number(item.favourites_count || 0),
              reposts: Number(item.reblogs_count || 0),
              replies: Number(item.replies_count || 0),
              quotes: 0,
            },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: {
                likes: Number(item.favourites_count || 0),
                reposts: Number(item.reblogs_count || 0),
                replies: Number(item.replies_count || 0),
                quotes: 0,
              },
            },
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
