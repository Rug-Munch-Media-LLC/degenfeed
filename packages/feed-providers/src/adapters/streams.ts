/**
 * Streams Adapter
 *
 * Streams (the Streams repository / Forte) is a decentralised personal
 * communication system with nomadic identity and fine-grained permissions.
 * Uses ActivityPub and Nomad protocols.
 *
 * API: ActivityPub outbox / Actor discovery via WebFinger
 *      Also supports Mastodon-compatible API
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { guessNiches, parseRssItems, stripHtml } from '@degenfeed/utils';

const $fetch = globalThis.fetch;

const STREAMS_INSTANCES = [
  'https://streams.wivodaim.ch',
  'https://macgirvin.com',
  'https://videos.video',
];

export async function fetchStreamsPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(3, Math.ceil(limit / STREAMS_INSTANCES.length));

  for (const inst of STREAMS_INSTANCES) {
    if (posts.length >= limit) break;
    try {
      // Try Mastodon-compatible API
      const res = await $fetch(`${inst}/api/v1/timelines/public?local=true&limit=${perInst}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Streams)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as any[];
        for (const item of data.slice(0, perInst)) {
          const text = stripHtml(String(item.content || ''));
          if (!text) continue;
          const acct = item.account as Record<string, unknown> | undefined;
          posts.push({
            id: `streams:${String(item.id)}@${new URL(inst).hostname}`,
            protocol: 'streams' as Protocol,
            author: {
              id: `streams:${String(acct?.id || item.id)}`,
              primary: { protocol: 'streams' as Protocol, id: String(acct?.acct || '') },
              handles: { streams: String(acct?.acct || '') } as any,
              displayName: String(acct?.display_name || acct?.username || 'Streams User'),
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
      }
    } catch {
      // Try RSS/Atom feed
      try {
        const rssRes = await $fetch(`${inst}/feed/`, {
          headers: { 'User-Agent': 'DegenFeed/0.1 (Streams)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!rssRes.ok) continue;
        const xml = await rssRes.text();
        const items = parseRssItems(xml);
        for (const item of items.slice(0, perInst)) {
          const text = stripHtml(item.title || item.description || '');
          if (!text) continue;
          posts.push({
            id: `streams:rss:${item.guid || item.link || text.slice(0, 40)}`,
            protocol: 'streams' as Protocol,
            author: {
              id: `streams:rss:${inst}`,
              primary: { protocol: 'streams' as Protocol, id: item.author || inst },
              handles: { streams: item.author || null } as any,
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
      } catch {
        // skip
      }
    }
  }
  return posts;
}
