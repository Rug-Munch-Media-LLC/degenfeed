/**
 * @degenfeed/cross-protocol-bridge — Bluesky → Lemmy Transform Adapter
 *
 * Cross-post Bluesky skeets to Lemmy communities.
 * Maps Bluesky posts to Lemmy post format (title + body).
 * Routes to communities based on hashtags or default.
 *
 * Environment:
 *   LEMMY_JWT           — JWT auth token for Lemmy API
 *   LEMMY_INSTANCE_URL  — our Lemmy instance (default: http://127.0.0.1:8536)
 *   LEMMY_DEFAULT_COMMUNITY — default community ID (default: 1)
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

// Community routing config: Bluesky hashtag → Lemmy community ID
const BRIDGE_COMMUNITIES: Record<string, number> = {
  degen: 1,
  crypto: 2,
  defi: 3,
  nft: 4,
  memes: 5,
  tech: 6,
  fediverse: 7,
  video: 8,
  music: 9,
  news: 10,
};

function getInstanceUrl(): string {
  return process.env.LEMMY_INSTANCE_URL || 'http://127.0.0.1:8536';
}

function getJwt(): string | undefined {
  return process.env.LEMMY_JWT;
}

function getDefaultCommunity(): number {
  const parsed = parseInt(process.env.LEMMY_DEFAULT_COMMUNITY ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

export const blueskyToLemmy: BridgeAdapter = {
  id: 'bluesky→lemmy',
  name: 'Bluesky → Lemmy',
  source: 'bluesky',
  target: 'lemmy',

  async transform(content: NormalizedContent) {
    const lines = content.text.split('\n').filter((l) => l.trim());
    const title = (lines[0] ?? 'Cross-posted from Bluesky').slice(0, 200);
    const bodyLines = lines.slice(1).filter(Boolean);
    const body = bodyLines.length > 0 ? bodyLines.join('\n\n') : title;

    // Route to community based on hashtag match
    const matchedTag = content.hashtags.find((t) => BRIDGE_COMMUNITIES[t.toLowerCase()]);
    const communityId = matchedTag
      ? BRIDGE_COMMUNITIES[matchedTag.toLowerCase()]
      : getDefaultCommunity();

    // Append media links to body
    let fullBody = body;
    for (const link of content.links) {
      fullBody += `\n\n${link}`;
    }
    for (const media of content.media) {
      fullBody += `\n\n${media.url}${media.alt ? `\n> ${media.alt}` : ''}`;
    }

    fullBody += `\n\n---\n*Cross-posted from Bluesky*`;

    return {
      success: true,
      payload: {
        name: title,
        body: fullBody,
        community_id: communityId,
        url: content.links[0] ?? null,
      },
    };
  },

  async publish(payload: unknown) {
    const { name, body, community_id, url } = payload as {
      name: string;
      body: string;
      community_id: number;
      url: string | null;
    };

    const token = getJwt();
    if (!token) {
      return { success: false, error: 'LEMMY_JWT not set', retryable: false };
    }

    try {
      const res = await fetch(`${getInstanceUrl()}/api/v3/post`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          body,
          community_id,
          url,
          nsfw: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`Lemmy returned ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        post_view: { post: { id: number } };
      };
      return {
        success: true,
        nativeId: String(data.post_view.post.id),
        url: `https://talk.degenfeed.xyz/post/${data.post_view.post.id}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to publish to Lemmy: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch(`${getInstanceUrl()}/api/v3/site`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
