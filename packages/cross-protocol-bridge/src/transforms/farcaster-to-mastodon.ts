/**
 * @degenfeed/cross-protocol-bridge — Farcaster → Mastodon Transform Adapter
 *
 * Cross-post Farcaster casts to Mastodon/GoToSocial.
 * Handles character limit differences (320 for cast vs 500 for Mastodon)
 * and converts plaintext to simple HTML format.
 *
 * Environment:
 *   GTS_ACCESS_TOKEN   — OAuth token for the bridging bot account
 *   GTS_INSTANCE_URL   — our GoToSocial instance (default: http://127.0.0.1:8082)
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

function getInstanceUrl(): string {
  return process.env.GTS_INSTANCE_URL || 'http://127.0.0.1:8082';
}

function getAccessToken(): string | undefined {
  return process.env.GTS_ACCESS_TOKEN;
}

export const farcasterToMastodon: BridgeAdapter = {
  id: 'farcaster→mastodon',
  name: 'Farcaster → Mastodon',
  source: 'farcaster',
  target: 'mastodon',

  async transform(content: NormalizedContent) {
    let text = content.text;

    // Farcaster supports embeds — convert to Mastodon inline format
    for (const link of content.links) {
      if (!text.includes(link)) {
        text += `\n${link}`;
      }
    }

    for (const media of content.media) {
      if (!text.includes(media.url)) {
        text += `\n${media.url}`;
      }
    }

    // Handle Mastodon's 500-char limit
    const attribution = '\n\n[via Farcaster]';
    if (text.length + attribution.length > 500) {
      text = `${text.slice(0, 497 - attribution.length)}…${attribution}`;
    } else {
      text = text + attribution;
    }

    return {
      success: true,
      payload: {
        status: text,
        visibility: 'public' as const,
      },
    };
  },

  async publish(payload: unknown) {
    const { status, visibility } = payload as {
      status: string;
      visibility: string;
    };

    const token = getAccessToken();
    if (!token) {
      return { success: false, error: 'GTS_ACCESS_TOKEN not set', retryable: false };
    }

    try {
      const res = await fetch(`${getInstanceUrl()}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, visibility }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`GTS returned ${res.status}: ${err}`);
      }

      const data = (await res.json()) as { id: string; url?: string };
      return {
        success: true,
        nativeId: data.id,
        url: data.url ?? `https://social.degenfeed.xyz/@degenfeed/${data.id}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to publish to Mastodon: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch(`${getInstanceUrl()}/api/v1/instance`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
