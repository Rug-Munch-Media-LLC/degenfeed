/**
 * @degenfeed/cross-protocol-bridge — ActivityPub → Nostr Bridge
 *
 * Converts Mastodon/GoToSocial (ActivityPub) posts to Nostr events (kind 1).
 * Uses Mostr-compatible format: includes proxy tags for bridging info,
 * hashtag tags for content categorization, and proper NIP-01 formatting.
 *
 * Mostr bridge: https://mostr.pub/
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Map ActivityPub content to a Nostr kind 1 text note event.
 * Conforms to NIP-01 (basic event kind) with additional tags:
 *   - t tags for hashtags
 *   - proxy tag for ActivityPub source provenance
 *   - r tag for the original AP URL
 */
function mapContentToNostrEvent(content: NormalizedContent): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);

  // Build content text with attribution
  let text = content.text;

  // Append source attribution
  text += '\n\n— originally from ActivityPub';

  // Build tags
  const tags: string[][] = [];

  // Hashtag tags (NIP-12)
  for (const tag of content.hashtags) {
    tags.push(['t', tag]);
  }

  // Proxy tag for bridge provenance (NIP-35 bridge info)
  tags.push(['proxy', 'activitypub', 'activitypub']);

  // Media as URLs in content
  for (const media of content.media.slice(0, 3)) {
    text += `\n${media.url}`;
  }

  // Links
  for (const link of content.links.slice(0, 3)) {
    text += `\n${link}`;
  }

  const event: Record<string, unknown> = {
    kind: 1,
    content: text,
    created_at: now,
    tags,
  };

  return event;
}

export const activityPubToNostr: BridgeAdapter = {
  id: 'activitypub→nostr',
  name: 'ActivityPub → Nostr (Mostr compatible)',
  source: 'mastodon',
  target: 'nostr',

  async transform(content: NormalizedContent) {
    try {
      const payload = mapContentToNostrEvent(content);
      return { success: true, payload };
    } catch (err) {
      return {
        success: false,
        error: `ActivityPub→Nostr transform failed: ${(err as Error).message}`,
      };
    }
  },

  async publish(payload: unknown, config?: Record<string, string>) {
    const relayUrl = config?.relayUrl ?? process.env.NOSTR_RELAY_URL ?? 'ws://127.0.0.1:8085';

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
              const eventId = typeof msg[1] === 'string' ? msg[1] : `nostr:${Date.now()}`;
              resolve({
                success: true,
                nativeId: eventId,
                url: undefined,
              });
            }
          } catch { /* skip malformed */ }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve({ success: false, error: 'WebSocket connection failed', retryable: true });
        });

        ws.addEventListener('close', () => {
          clearTimeout(timer);
          resolve({ success: false, error: 'WebSocket closed unexpectedly', retryable: true });
        });
      } catch (err) {
        resolve({ success: false, error: `WebSocket error: ${(err as Error).message}`, retryable: true });
      }
    });
  },

  async healthCheck() {
    const relayUrl = process.env.NOSTR_RELAY_URL ?? 'ws://127.0.0.1:8085';
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(relayUrl);
        ws.addEventListener('open', () => { ws.close(); resolve(true); });
        ws.addEventListener('error', () => resolve(false));
        setTimeout(() => resolve(false), 4000);
      } catch {
        resolve(false);
      }
    });
  },
};
