/**
 * Guppe Groups Adapter
 *
 * Guppe adds federated social groups to the fediverse via ActivityPub.
 * Groups are followed like regular actors; posts mentioning the group
 * are auto-boosted to all members.
 *
 * API: ActivityPub actor outbox, WebFinger discovery
 *      Guppe server: https://gup.pe
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const _GUPPE_INSTANCES = ['https://gup.pe'];

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
  if (/\b(btc|bitcoin|crypto|blockchain|web3|defi|nft)\b/.test(lower)) n.push('crypto');
  if (/\b(tech|programming|code|software|foss|linux)\b/.test(lower)) n.push('tech');
  if (/\b(gaming|games|game|play)\b/.test(lower)) n.push('gaming');
  if (/\b(art|photo|photography|music|creative)\b/.test(lower)) n.push('art');
  if (/\b(fediverse|activitypub|groups|social)\b/.test(lower)) n.push('fediverse');
  if (n.length === 0) n.push('social');
  return n;
}

const POPULAR_GROUPS = [
  'fediverse',
  'photography',
  'music',
  'gaming',
  'tech',
  'art',
  'books',
  'movies',
  'science',
  'opensource',
];

export async function fetchGuppePosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perGroup = Math.max(1, Math.ceil(limit / POPULAR_GROUPS.length));

  for (const group of POPULAR_GROUPS) {
    if (posts.length >= limit) break;
    try {
      // Try to fetch the group's outbox via ActivityPub
      const actorUrl = `https://${group}.gup.pe`;
      const res = await $fetch(`${actorUrl}/outbox?page=true`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Guppe)', Accept: 'application/activity+json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const items = data?.orderedItems || data?.items || [];
      for (const item of items.slice(0, perGroup)) {
        const obj = item.object || item;
        const text = stripHtml(String(obj.content || obj.name || obj.summary || ''));
        if (!text) continue;
        const author = obj.attributedTo || obj.actor || {};
        const authorId = typeof author === 'string' ? author : author.id || '';
        const authorName =
          typeof author === 'string'
            ? author.split('/').pop() || 'Guppe User'
            : author.name || author.preferredUsername || 'Guppe User';
        posts.push({
          id: `guppe:${String(obj.id || item.id)}`,
          protocol: 'guppe' as Protocol,
          author: {
            id: `guppe:${authorId}`,
            primary: { protocol: 'guppe' as Protocol, id: authorId },
            handles: { guppe: authorName },
            displayName: authorName,
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
          createdAt: new Date(String(obj.published || item.published)).getTime() || Date.now(),
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
      // Skip unreachable groups
    }
  }
  return posts;
}
