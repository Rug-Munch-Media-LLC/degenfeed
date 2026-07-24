/**
 * @degenfeed/cross-protocol-bridge — Nostr → Farcaster Bridge
 *
 * Converts Nostr events (kind 1) to Farcaster casts.
 * Maps Nostr tags to Farcaster embeds and mentions.
 * Uses Neynar API or Farcaster Hub for publishing.
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Map Nostr content to a Farcaster cast.
 * Farcaster casts have a 320-character limit.
 */
function mapNostrToFarcasterCast(content: NormalizedContent): { text: string; embeds: Array<{ url: string }> } {
  let text = content.text;

  // Farcaster 320-char limit
  const maxLength = 320;
  const attribution = '\n\n[via Nostr]';

  // Build embeds from media and links
  const embeds: Array<{ url: string }> = [];

  // Add media URLs as embeds
  for (const media of content.media) {
    embeds.push({ url: media.url });
  }

  // Add links as embeds
  for (const link of content.links) {
    if (!embeds.some((e) => e.url === link)) {
      embeds.push({ url: link });
    }
  }

  // Truncate if needed
  const availableSpace = maxLength - attribution.length;
  if (text.length > availableSpace) {
    text = text.slice(0, availableSpace - 3) + '...';
  }

  text += attribution;

  // Limit embeds to 2 (Farcaster limit)
  const limitedEmbeds = embeds.slice(0, 2);

  return { text, embeds: limitedEmbeds };
}

export const nostrToFarcaster: BridgeAdapter = {
  id: 'nostr→farcaster',
  name: 'Nostr → Farcaster',
  source: 'nostr',
  target: 'farcaster',

  async transform(content: NormalizedContent) {
    try {
      const payload = mapNostrToFarcasterCast(content);
      return { success: true, payload };
    } catch (err) {
      return {
        success: false,
        error: `Nostr→Farcaster transform failed: ${(err as Error).message}`,
      };
    }
  },

  async publish(payload: unknown, config?: Record<string, string>) {
    const apiKey = config?.neynarApiKey ?? process.env.NEYNAR_API_KEY ?? '';
    const signerUuid = config?.signerUuid ?? process.env.FARCASTER_SIGNER_UUID ?? '';

    if (!apiKey || !signerUuid) {
      // Fallback: log and simulate (for development)
      const cast = payload as { text: string; embeds: Array<{ url: string }> };
      console.log(`[bridge] Would cast to Farcaster: "${cast.text.slice(0, 50)}..."`);
      return {
        success: true,
        nativeId: `farcaster:sim:${Date.now()}`,
        url: undefined,
      };
    }

    try {
      const cast = payload as { text: string; embeds: Array<{ url: string }> };
      const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_key: apiKey,
        },
        body: JSON.stringify({
          signer_uuid: signerUuid,
          text: cast.text,
          embeds: cast.embeds,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        return { success: false, error: `Farcaster publish failed: ${res.status} ${errText}`, retryable: res.status >= 500 };
      }

      const data = (await res.json()) as { cast?: { hash?: string } };
      return {
        success: true,
        nativeId: data.cast?.hash ?? `fc:${Date.now()}`,
        url: data.cast?.hash ? `https://warpcast.com/0x/${data.cast.hash}` : undefined,
      };
    } catch (err) {
      return { success: false, error: `Farcaster publish error: ${(err as Error).message}`, retryable: true };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch('https://api.neynar.com/v2/farcaster/feed', {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok || res.status === 401; // 401 = up but needs auth
    } catch {
      return false;
    }
  },
};
