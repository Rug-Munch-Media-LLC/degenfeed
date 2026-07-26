/**
 * Friendica Adapter — FULLY FLESHED OUT
 *
 * Friendica is a decentralized social network with ActivityPub + Diaspora + RSS support.
 * This adapter supports all three protocols for maximum content discovery.
 *
 * API: Mastodon-compatible API + Diaspora API + RSS
 *      Friendica-specific: /api/v1/timelines/public (Mastodon compat)
 *                          /dfrn_notify (Diaspora compat)
 *                          /feed/ (RSS)
 * Instances: https://friendica.world, https://libranet.de, https://social.tetaneutral.net,
 *            https://friendicatruth.com, https://friendica.me
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { guessNiches, parseRssItems, stripHtml } from '@degenfeed/utils';

const $fetch = globalThis.fetch;

const FRIENDICA_INSTANCES = [
  { url: 'https://friendica.world', region: 'global' },
  { url: 'https://libranet.de', region: 'de' },
  { url: 'https://social.tetaneutral.net', region: 'fr' },
  { url: 'https://friendica.me', region: 'global' },
  { url: 'https://friendicatruth.com', region: 'global' },
  { url: 'https://snf-40280.ok-kno.grnet.gr', region: 'gr' },
  { url: 'https://social.web3.foundation', region: 'global' },
  { url: 'https://friendica.opensocial.space', region: 'global' },
];

export async function fetchFriendicaPosts(limit = 20): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(2, Math.ceil(limit / FRIENDICA_INSTANCES.length));

  for (const inst of FRIENDICA_INSTANCES) {
    if (posts.length >= limit) break;
    const baseUrl = inst.url;

    // Try Mastodon-compatible API (primary)
    try {
      const res = await $fetch(`${baseUrl}/api/v1/timelines/public?local=true&limit=${perInst}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Friendica)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (Array.isArray(data)) {
          for (const item of data.slice(0, perInst)) {
            const content = stripHtml(String(item.content || ''));
            if (!content) continue;
            const acct = item.account as Record<string, unknown> | undefined;
            const media = item.media_attachments as Array<Record<string, unknown>> | undefined;
            posts.push({
              id: `friendica:${String(item.id)}@${new URL(baseUrl).hostname}`,
              protocol: 'friendica' as Protocol,
              author: {
                id: `friendica:${String(acct?.id || item.id)}@${new URL(baseUrl).hostname}`,
                primary: {
                  protocol: 'friendica' as Protocol,
                  id: String(acct?.acct || acct?.username || ''),
                },
                handles: {
                  friendica: String(acct?.acct || acct?.username || ''),
                  diaspora: String(acct?.acct || ''),
                },
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
              embeds: (media || []).map((m) => ({
                kind: (String(m.type) === 'video' ? 'video' : 'image') as 'image' | 'video',
                url: String(m.url || m.remote_url || ''),
              })),
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
              niches: guessNiches(content),
            });
          }
        }
      }
    } catch {
      // Fallback 1: Try Diaspora API endpoint
      try {
        const diasporaRes = await $fetch(`${baseUrl}/api/v0/posts/public_stream`, {
          headers: { 'User-Agent': 'DegenFeed/0.1 (Friendica)' },
          signal: AbortSignal.timeout(5000),
        });
        if (diasporaRes.ok) {
          const dData = (await diasporaRes.json()) as any[];
          for (const item of dData.slice(0, perInst)) {
            const text = stripHtml(String(item.text || item.body || item.title || ''));
            if (!text) continue;
            const author = item.author || {};
            posts.push({
              id: `friendica:diaspora:${String(item.guid || item.id)}`,
              protocol: 'friendica' as Protocol,
              author: {
                id: `friendica:diaspora:${String(author.diaspora_id || author.id || '')}`,
                primary: {
                  protocol: 'friendica' as Protocol,
                  id: String(author.diaspora_id || ''),
                },
                handles: { friendica: String(author.name || author.username || '') },
                displayName: String(author.name || 'Friendica User'),
                bio: stripHtml(String(author.bio || '')),
                avatarUrl: String(author.avatar || ''),
                followerCount: 0,
                followingCount: 0,
                verified: [],
                links: [],
                keys: {},
              },
              text,
              embeds: [],
              createdAt: new Date(String(item.created_at || item.createdAt)).getTime(),
              metrics: {
                likes: Number(item.likes_count || 0),
                reposts: Number(item.reshares_count || 0),
                replies: Number(item.comments_count || 0),
                quotes: 0,
              },
              engagement: {
                viewerLiked: false,
                viewerReposted: false,
                viewerBookmarked: false,
                raw: {
                  likes: Number(item.likes_count || 0),
                  reposts: Number(item.reshares_count || 0),
                  replies: Number(item.comments_count || 0),
                  quotes: 0,
                },
              },
              raw: item,
              niches: guessNiches(text),
            });
          }
        }
      } catch {
        // Fallback 2: RSS
        try {
          const rssRes = await $fetch(`${baseUrl}/feed/`, {
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
                id: `friendica:rss:${baseUrl}`,
                primary: { protocol: 'friendica' as Protocol, id: item.author || baseUrl },
                handles: { friendica: item.author || null },
                displayName: item.author || new URL(baseUrl).hostname,
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
          // skip completely unreachable instances
        }
      }
    }
  }
  return posts;
}

/**
 * Fetch Friendica-specific events/calendars (Friendica has built-in events)
 */
export async function fetchFriendicaEvents(limit = 5): Promise<any[]> {
  const events: any[] = [];
  for (const inst of FRIENDICA_INSTANCES.slice(0, 3)) {
    try {
      const res = await $fetch(`${inst.url}/api/v1/events?limit=${limit}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Friendica)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as any[];
        events.push(...data.slice(0, limit));
      }
    } catch {
      // skip
    }
  }
  return events;
}
