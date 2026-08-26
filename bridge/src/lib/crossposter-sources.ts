/**
 * Cross-poster source pollers — fetches latest post from each protocol
 */

import type { UnifiedPost } from '../server/types';

// ─── GTS/Mastodon Source ────────────────────────────────────────────────

export async function fetchLatestGtsPost(): Promise<UnifiedPost | null> {
  const gtsBase = process.env.GTS_BASE_URL || 'http://127.0.0.1:8082';
  const clientId = process.env.GTS_CLIENT_ID || '';
  const clientSecret = process.env.GTS_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    // console.log('[crossposter] GTS: no credentials');
    return null;
  }

  try {
    const tokenRes = await fetch(`${gtsBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'read:statuses read:accounts read:timelines',
      }),
    });

    if (!tokenRes.ok) {
      // console.log('[crossposter] GTS token failed');
      return null;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return null;

    const res = await fetch(`${gtsBase}/api/v1/timelines/public?local=true&limit=1`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!res.ok) return null;

    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      account: { id: string; username: string; acct: string; display_name: string };
      media_attachments?: Array<{ type: string; url: string }>;
    }>;

    if (!raw.length) return null;

    const s = raw[0];
    return {
      id: `mastodon:${s.id}@social.degenfeed.xyz`,
      protocol: 'mastodon',
      author: {
        id: `mastodon:${s.account.id}`,
        primary: { protocol: 'mastodon', id: s.account.id },
        handles: { mastodon: s.account.acct },
        displayName: s.account.display_name || s.account.username,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: s.content.replace(/<[^>]*>/g, '').trim(),
      embeds: (s.media_attachments || []).map((m) => ({
        kind: m.type === 'video' ? ('video' as const) : ('image' as const),
        url: m.url,
        meta: {},
      })),
      createdAt: new Date(s.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: [],
    };
  } catch (err) {
    // console.log('[crossposter] GTS fetch error:', (err as Error).message);
    return null;
  }
}

// ─── Pixelfed Source ────────────────────────────────────────────────────

export async function fetchLatestPixelfedPost(): Promise<UnifiedPost | null> {
  const pixelfedBase = process.env.PIXELFED_BASE_URL || 'http://127.0.0.1:8087';
  const token = process.env.PIXELFED_ACCESS_TOKEN || '';

  if (!token) {
    // console.log('[crossposter] Pixelfed: missing PIXELFED_ACCESS_TOKEN');
    return null;
  }

  try {
    const res = await fetch(`${pixelfedBase}/api/v1/timelines/public?local=true&limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      media_attachments?: Array<{ type: string; url: string; description?: string }>;
      account: { id: string; username: string; acct: string; display_name: string };
    }>;

    if (!raw.length) return null;

    const s = raw[0];
    return {
      id: `pixelfed:${s.id}@photos.degenfeed.xyz`,
      protocol: 'pixelfed',
      author: {
        id: `pixelfed:${s.account.id}`,
        primary: { protocol: 'pixelfed', id: s.account.id },
        handles: { pixelfed: s.account.acct },
        displayName: s.account.display_name || s.account.username,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: s.content.replace(/<[^>]*>/g, '').trim(),
      embeds: (s.media_attachments || []).map((m) => ({
        kind: (m.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        url: m.url,
        meta: { description: m.description || '' },
      })),
      createdAt: new Date(s.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: [],
    };
  } catch (err) {
    // console.log('[crossposter] Pixelfed fetch error:', (err as Error).message);
    return null;
  }
}

// ─── Lemmy Source ───────────────────────────────────────────────────────

export async function fetchLatestLemmyPost(): Promise<UnifiedPost | null> {
  const lemmyBase = process.env.LEMMY_BASE_URL || 'http://127.0.0.1:8536';

  try {
    const res = await fetch(`${lemmyBase}/api/v3/post/list?sort=New&limit=1&type_=Local`, {
      headers: { 'User-Agent': 'DegenFeed-CrossPoster/0.2' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      posts?: Array<{
        post: { id: number; name: string; body?: string; published: string; ap_id: string };
        creator?: { person: { id: number; name: string; display_name?: string; avatar?: string } };
        community?: { community: { id: number; name: string; title: string } };
      }>;
    };

    if (!data.posts?.length) return null;

    const pv = data.posts[0];
    return {
      id: `lemmy:${pv.post.id}`,
      protocol: 'lemmy',
      author: {
        id: `lemmy:${pv.creator?.person?.id || 0}`,
        primary: { protocol: 'lemmy', id: String(pv.creator?.person?.id || 0) },
        handles: { lemmy: pv.creator?.person?.name || 'unknown' },
        displayName: pv.creator?.person?.display_name || pv.creator?.person?.name || 'Unknown',
        bio: '',
        avatarUrl: pv.creator?.person?.avatar || '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: pv.post.body ? `${pv.post.name}\n\n${pv.post.body}` : pv.post.name,
      embeds: [],
      createdAt: new Date(pv.post.published).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: pv,
      niches: [],
    };
  } catch {
    return null;
  }
}

// ─── Source Pollers Map ─────────────────────────────────────────────────

export const SOURCE_POLLERS: Record<string, () => Promise<UnifiedPost | null>> = {
  mastodon: fetchLatestGtsPost,
  lemmy: fetchLatestLemmyPost,
  pixelfed: fetchLatestPixelfedPost,
};
