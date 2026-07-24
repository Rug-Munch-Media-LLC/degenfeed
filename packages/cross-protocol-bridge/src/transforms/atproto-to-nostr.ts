import { getEnv } from '../env';
/**
 * @degenfeed/cross-protocol-bridge — AT Protocol → Nostr Bridge
 *
 * Converts Bluesky (AT Protocol) posts to Nostr events (kind 1).
 * Handles Bluesky facets (mentions, links, hashtags) to Nostr tags.
 * Media embeds are included as URLs in the content or as imeta tags.
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Map AT Protocol content to a Nostr kind 1 event.
 */
function mapBskyToNostrEvent(content: NormalizedContent): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  let text = content.text;
  const tags: string[][] = [];

  // Hashtag tags
  for (const tag of content.hashtags) {
    tags.push(['t', tag]);
  }

  // Bluesky proxy tag for bridge provenance
  tags.push(['proxy', 'bluesky', 'atproto']);

  // Media as imeta tags (NIP-92) or inline URLs
  for (const media of content.media) {
    tags.push(['imeta', `url ${media.url}`, `m ${media.mimeType ?? 'image/jpeg'}`]);
    text += `\n${media.url}`;
  }

  // Links
  for (const link of content.links) {
    text += `\n${link}`;
  }

  // Bridge attribution
  text += '\n\n— from Bluesky';

  return {
    kind: 1,
    content: text,
    created_at: now,
    tags,
  };
}

export const atProtoToNostr: BridgeAdapter = {
  id: 'atproto→nostr',
  name: 'AT Protocol → Nostr',
  source: 'bluesky',
  target: 'nostr',

  async transform(content: NormalizedContent) {
    try {
      const payload = mapBskyToNostrEvent(content);
      return { success: true, payload };
    } catch (err) {
      return {
        success: false,
        error: `ATProto→Nostr transform failed: ${(err as Error).message}`,
      };
    }
  },

  async publish(payload: unknown, config?: Record<string, string>) {
    const relayUrl = config?.relayUrl ?? getEnv('NOSTR_RELAY_URL') ?? 'ws://127.0.0.1:8085';

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(relayUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Relay timeout', retryable: true });
        }, 10_000);

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(['EVENT', payload]));
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'OK') {
              clearTimeout(timer);
              ws.close();
              resolve({ success: true, nativeId: msg[1] ?? `nostr:${Date.now()}`, url: undefined });
            }
          } catch {
            /* skip */
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve({ success: false, error: 'WebSocket failed', retryable: true });
        });

        ws.addEventListener('close', () => {
          clearTimeout(timer);
          resolve({ success: false, error: 'WebSocket closed', retryable: true });
        });
      } catch (err) {
        resolve({ success: false, error: `WS error: ${(err as Error).message}`, retryable: true });
      }
    });
  },

  async healthCheck() {
    return new Promise((resolve) => {
      const relayUrl = getEnv('NOSTR_RELAY_URL') ?? 'ws://127.0.0.1:8085';
      try {
        const ws = new WebSocket(relayUrl);
        ws.addEventListener('open', () => {
          ws.close();
          resolve(true);
        });
        ws.addEventListener('error', () => resolve(false));
        setTimeout(() => resolve(false), 4000);
      } catch {
        resolve(false);
      }
    });
  },
};
