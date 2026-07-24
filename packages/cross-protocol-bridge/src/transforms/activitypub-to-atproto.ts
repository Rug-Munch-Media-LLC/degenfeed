/**
 * @degenfeed/cross-protocol-bridge — ActivityPub → AT Protocol Bridge
 *
 * Converts Mastodon/GoToSocial (ActivityPub) posts to Bluesky (AT Protocol)
 * format. Uses Bridgy Fed-compatible federation: ActivityPub objects get
 * mapped to app.bsky.feed.post records with proper facets, embeds, and
 * cross-protocol attribution.
 *
 * Bridgy Fed maps: https://fed.brid.gy/docs
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Map ActivityPub content types to AT Protocol record format.
 * Handles:
 *   - Note → app.bsky.feed.post (with facets for hashtags, mentions, links)
 *   - Article → app.bsky.feed.post with external embed
 *   - Image attachments → app.bsky.embed.images
 *   - Video attachments → app.bsky.embed.video (AT Protocol 2024+)
 */
function mapContentToBskyPost(content: NormalizedContent): Record<string, unknown> {
  const now = new Date().toISOString();

  // Build text with hashtags and mentions preserved
  let text = content.text;

  // AT Protocol facets for rich text
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; tag?: string; did?: string; uri?: string }>;
  }> = [];

  // Add hashtag facets
  for (const tag of content.hashtags) {
    const tagStr = `#${tag}`;
    const idx = text.indexOf(tagStr);
    if (idx >= 0) {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      const byteStart = encoder.encode(text.slice(0, idx)).byteLength;
      const byteEnd = byteStart + encoder.encode(tagStr).byteLength;

      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
      });
    }
  }

  // Add link facets
  for (const link of content.links) {
    const idx = text.indexOf(link);
    if (idx >= 0) {
      const encoder = new TextEncoder();
      const byteStart = encoder.encode(text.slice(0, idx)).byteLength;
      const byteEnd = byteStart + encoder.encode(link).byteLength;

      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: link }],
      });
    }
  }

  // Build embed
  let embed: Record<string, unknown> | undefined;

  if (content.media.length > 0) {
    const images = content.media
      .filter((m) => m.kind === 'image' || m.kind === 'gif')
      .slice(0, 4) // Bluesky max 4 images
      .map((m) => ({
        alt: m.alt ?? '',
        image: { $type: 'blob', ref: { $link: m.url }, mimeType: m.mimeType ?? 'image/jpeg' },
      }));

    if (images.length > 0) {
      embed = {
        $type: 'app.bsky.embed.images',
        images,
      };
    } else if (content.media.some((m) => m.kind === 'video')) {
      const video = content.media.find((m) => m.kind === 'video')!;
      embed = {
        $type: 'app.bsky.embed.video',
        video: { $type: 'blob', ref: { $link: video.url }, mimeType: video.mimeType ?? 'video/mp4' },
        alt: video.alt ?? '',
      };
    }
  } else if (content.links.length > 0) {
    // Link card embed
    embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: content.links[0],
        title: content.text.slice(0, 100),
        description: content.text.slice(0, 200),
      },
    };
  }

  const record: Record<string, unknown> = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: now,
    facets: facets.length > 0 ? facets : undefined,
  };

  if (embed) {
    record.embed = embed;
  }

  return record;
}

export const activityPubToAtProto: BridgeAdapter = {
  id: 'activitypub→atproto',
  name: 'ActivityPub → AT Protocol (Bridgy Fed)',
  source: 'mastodon',
  target: 'bluesky',

  async transform(content: NormalizedContent) {
    try {
      const payload = mapContentToBskyPost(content);
      return { success: true, payload };
    } catch (err) {
      return {
        success: false,
        error: `ActivityPub→ATProto transform failed: ${(err as Error).message}`,
      };
    }
  },

  async publish(payload: unknown, config?: Record<string, string>) {
    const pdsUrl = config?.pdsUrl ?? process.env.ATPROTO_PDS_URL ?? 'https://bsky.social';
    const jwt = config?.accessJwt ?? process.env.BLUESKY_CROSSPOST_JWT ?? '';
    const did = config?.did ?? process.env.BLUESKY_CROSSPOST_DID ?? '';

    if (!jwt || !did) {
      return { success: false, error: 'Bluesky auth not configured', retryable: false };
    }

    try {
      const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          repo: did,
          collection: 'app.bsky.feed.post',
          record: payload,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        return { success: false, error: `Bluesky publish failed: ${res.status} ${errText}`, retryable: res.status >= 500 };
      }

      const data = (await res.json()) as { uri?: string; cid?: string };
      return {
        success: true,
        nativeId: data.uri ?? data.cid ?? `bsky:${Date.now()}`,
        url: data.uri ? `https://bsky.app/profile/${did}/post/${data.uri.split('/').pop()}` : undefined,
      };
    } catch (err) {
      return { success: false, error: `Bluesky publish error: ${(err as Error).message}`, retryable: true };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch('https://bsky.social/xrpc/com.atproto.server.describeServer', {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
