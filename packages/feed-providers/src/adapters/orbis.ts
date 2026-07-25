/**
 * Orbis Adapter
 *
 * Orbis is a decentralized social network built on Ceramic Network.
 * Posts are stored as Ceramic streams with cross-protocol support.
 *
 * API: Orbis SDK — https://useorbis.com/
 *      Indexing API: https://ceramic-infra.orbis.club/
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const ORBIS_API = 'https://ceramic-infra.orbis.club';

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
  if (/\b(privacy|identity|ceramic|orbis|decentralized)\b/.test(lower)) n.push('identity');
  if (/\b(fediverse|activitypub|social|community)\b/.test(lower)) n.push('social');
  if (n.length === 0) n.push('social');
  return n;
}

export async function fetchOrbisPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const res = await $fetch(`${ORBIS_API}/v1/posts/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        algorithm: 'recommended',
        limit: Math.min(limit, 50),
        context: '', // global feed
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return posts;
    const data = (await res.json()) as any;
    const items = data?.data || data?.posts || [];
    for (const item of items.slice(0, limit)) {
      const text = stripHtml(item.content?.body || item.content?.text || item.body || '');
      if (!text) continue;
      const author = item.creator || item.author || item.profile || {};
      const creatorDetails = author.details || author;
      posts.push({
        id: `orbis:${String(item.stream_id || item.id || item.post_id)}`,
        protocol: 'orbis' as Protocol,
        author: {
          id: `orbis:${String(creatorDetails.did || creatorDetails.creator_id || creatorDetails.id || '')}`,
          primary: { protocol: 'orbis' as Protocol, id: String(creatorDetails.did || '') },
          handles: {
            orbis: String(
              creatorDetails.username ||
                creatorDetails.handle ||
                creatorDetails.displayName ||
                'Orbis User',
            ),
          },
          displayName: String(
            creatorDetails.displayName ||
              creatorDetails.username ||
              creatorDetails.handle ||
              'Orbis User',
          ),
          bio: String(creatorDetails.description || creatorDetails.bio || ''),
          avatarUrl: String(
            creatorDetails.avatar || creatorDetails.pfp || creatorDetails.image || '',
          ),
          followerCount: Number(creatorDetails.followers || creatorDetails.followersCount || 0),
          followingCount: Number(creatorDetails.following || creatorDetails.followingCount || 0),
          verified: creatorDetails.verified ? [{ protocol: 'orbis', badge: 'Verified' }] : [],
          links: [],
          keys: {},
        },
        text,
        embeds: (item.content?.media || item.media || []).map((m: any) => ({
          kind: m.type === 'video' ? 'video' : 'image',
          url: m.url || m.src || '',
        })),
        createdAt:
          new Date(
            String(item.created_at || item.timestamp || item.content?.timestamp),
          ).getTime() || Date.now(),
        metrics: {
          likes: Number(item.count_likes || item.likes || item.count_upvotes || 0),
          reposts: Number(item.count_shares || item.shares || 0),
          replies: Number(item.count_replies || item.replies || 0),
          quotes: 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: {
            likes: Number(item.count_likes || 0),
            reposts: Number(item.count_shares || 0),
            replies: Number(item.count_replies || 0),
            quotes: 0,
          },
        },
        raw: item,
        niches: guessNiches(text),
      });
    }
  } catch {
    // Orbis API unavailable
  }
  return posts;
}
