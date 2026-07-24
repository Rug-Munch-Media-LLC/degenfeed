import { getEnv } from '../env';
/**
 * @degenfeed/cross-protocol-bridge — RSS → ActivityPub Bridge
 *
 * Converts RSS feed entries to ActivityPub-compatible posts
 * for publishing on Mastodon/GoToSocial instances.
 * Maps RSS fields: title, description, link, pubDate, media:content
 * to ActivityPub Note objects.
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Map RSS content to an ActivityPub Note (Mastodon-compatible status).
 */
function mapRssToActivityPubNote(content: NormalizedContent): Record<string, unknown> {
  let status = content.text;

  // Add original link
  if (content.links.length > 0) {
    status += `\n\n${content.links[0]}`;
  }

  // Add media
  for (const media of content.media) {
    status += `\n${media.url}`;
  }

  return {
    status,
    visibility: 'public',
    content_type: 'text/markdown',
  };
}

export const rssToActivityPub: BridgeAdapter = {
  id: 'rss→activitypub',
  name: 'RSS → ActivityPub (Mastodon)',
  source: 'rss',
  target: 'mastodon',

  async transform(content: NormalizedContent) {
    try {
      const payload = mapRssToActivityPubNote(content);
      return { success: true, payload };
    } catch (err) {
      return {
        success: false,
        error: `RSS→ActivityPub transform failed: ${(err as Error).message}`,
      };
    }
  },

  async publish(payload: unknown, config?: Record<string, string>) {
    const instance =
      config?.instance ?? getEnv('MASTODON_INSTANCE') ?? 'https://social.degenfeed.xyz';
    const token = config?.accessToken ?? getEnv('MASTODON_ACCESS_TOKEN') ?? '';

    if (!token) {
      return { success: false, error: 'Mastodon auth not configured', retryable: false };
    }

    try {
      const res = await fetch(`${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        return {
          success: false,
          error: `Mastodon publish failed: ${res.status} ${errText}`,
          retryable: res.status >= 500,
        };
      }

      const data = (await res.json()) as { id: string; url?: string };
      return {
        success: true,
        nativeId: data.id,
        url: data.url ?? `${instance}/@feed/${data.id}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Mastodon publish error: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    const instance = getEnv('MASTODON_INSTANCE') ?? 'https://social.degenfeed.xyz';
    try {
      const res = await fetch(`${instance}/api/v1/instance`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
