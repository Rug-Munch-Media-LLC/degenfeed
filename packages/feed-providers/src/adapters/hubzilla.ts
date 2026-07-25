/**
 * Hubzilla Adapter
 *
 * Hubzilla is a federated CMS/social platform with nomadic identity.
 * Uses the Zot API (api/z/1.0) plus Mastodon-compatible API.
 *
 * API: GET /api/z/1.0/channel/stream
 *      GET /api/z/1.0/network/stream
 *      GET /api/v1/timelines/public (Mastodon-compat)
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const HUBZILLA_INSTANCES = [
  'https://hubzilla.org',
  'https://federatedhub.org',
  'https://hub.grifon.fr',
  'https://hubs.selfhosted.social',
  'https://hub.ssh.surf',
];

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
  if (/\b(privacy|surveillance|encryption|security|decentralized|nomadic)\b/.test(lower))
    n.push('privacy');
  if (/\b(fediverse|activitypub|hubzilla|zot|social)\b/.test(lower)) n.push('fediverse');
  if (n.length === 0) n.push('social');
  return n;
}

export async function fetchHubzillaPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(2, Math.ceil(limit / HUBZILLA_INSTANCES.length));

  for (const inst of HUBZILLA_INSTANCES) {
    if (posts.length >= limit) break;
    try {
      // Try Zot API first
      const res = await $fetch(`${inst}/api/z/1.0/network/stream`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Hubzilla)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const items = Array.isArray(data) ? data : data?.results || data?.items || [];
        for (const item of items.slice(0, perInst)) {
          const text = stripHtml(item.body || item.title || item.summary || '');
          if (!text) continue;
          posts.push({
            id: `hubzilla:${String(item.id || item.mid || item.uuid)}@${new URL(inst).hostname}`,
            protocol: 'hubzilla' as Protocol,
            author: {
              id: `hubzilla:${String(item.author?.xchan_hash || item.owner?.xchan_hash || item.id || '')}`,
              primary: {
                protocol: 'hubzilla' as Protocol,
                id: String(item.author?.xchan_addr || ''),
              },
              handles: { hubzilla: String(item.author?.xchan_name || item.author?.name || '') },
              displayName: String(item.author?.xchan_name || item.author?.name || 'Hubzilla User'),
              bio: stripHtml(String(item.author?.xchan_description || '')),
              avatarUrl: String(
                item.author?.xchan_photo_mimetype
                  ? `${inst}/photo/${item.author?.xchan_hash}`
                  : item.author?.photo || '',
              ),
              followerCount: Number(item.author?.xchan_followers || 0),
              followingCount: Number(item.author?.xchan_connections || 0),
              verified: [],
              links: [],
              keys: {},
            },
            text,
            embeds: [],
            createdAt:
              new Date(String(item.created || item.created_at || item.updated || '')).getTime() ||
              Date.now(),
            metrics: {
              likes: Number(item.likes || 0),
              reposts: Number(item.reshare || item.repeat || 0),
              replies: Number(item.comment_count || item.comments || 0),
              quotes: 0,
            },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: {
                likes: Number(item.likes || 0),
                reposts: Number(item.reshare || 0),
                replies: Number(item.comment_count || 0),
                quotes: 0,
              },
            },
            raw: item,
            niches: guessNiches(text),
          });
        }
      }
    } catch {
      // Mastodon-compat API fallback
      try {
        const res2 = await $fetch(`${inst}/api/v1/timelines/public?local=true&limit=${perInst}`, {
          headers: { 'User-Agent': 'DegenFeed/0.1 (Hubzilla)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res2.ok) continue;
        const data = (await res2.json()) as any[];
        for (const item of data.slice(0, perInst)) {
          const text = stripHtml(String(item.content || ''));
          if (!text) continue;
          const acct = item.account as Record<string, unknown> | undefined;
          posts.push({
            id: `hubzilla:mast:${String(item.id)}@${new URL(inst).hostname}`,
            protocol: 'hubzilla' as Protocol,
            author: {
              id: `hubzilla:mast:${String(acct?.id || item.id)}`,
              primary: { protocol: 'hubzilla' as Protocol, id: String(acct?.acct || '') },
              handles: { hubzilla: String(acct?.acct || '') },
              displayName: String(acct?.display_name || 'Hubzilla User'),
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
