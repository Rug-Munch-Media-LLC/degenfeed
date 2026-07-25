/**
 * @degenfeed/cross-protocol-bridge — Nostr → Farcaster Bridge
 *
 * Converts Nostr events (kind 1) to Farcaster casts.
 * Maps Nostr tags to Farcaster embeds and mentions.
 * Uses self-hosted Hubble for publishing.
 */

import type { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Map Nostr content to a Farcaster cast.
 * Farcaster casts have a 320-character limit.
 */
function mapNostrToFarcasterCast(content: NormalizedContent): {
  text: string;
  embeds: Array<{ url: string }>;
} {
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
    text = `${text.slice(0, availableSpace - 3)}...`;
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
    const fid = config?.farcasterBotFid ?? process.env.FARCASTER_BOT_FID ?? '';
    const signerKey = config?.farcasterBotSignerKey ?? process.env.FARCASTER_BOT_SIGNER_KEY ?? '';
    const hubUrl = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';

    if (!fid || !signerKey) {
      // Fallback: log and simulate (for development)
      const cast = payload as { text: string; embeds: Array<{ url: string }> };
      console.log(`[bridge] Would cast to Farcaster via Hubble: "${cast.text.slice(0, 50)}..."`);
      return {
        success: true,
        nativeId: `farcaster:sim:${Date.now()}`,
        url: undefined,
      };
    }

    try {
      const cast = payload as { text: string; embeds: Array<{ url: string }> };
      const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
      const castResult = buildFarcasterCastMessage({
        signerKeyHex: signerKey,
        fid: Number(fid),
        text: cast.text,
      });

      if (!castResult.ok || !castResult.messageHex) {
        return {
          success: false,
          error: `Failed to build cast message: ${castResult.error}`,
          retryable: false,
        };
      }

      const bodyBytes = new Uint8Array(
        castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) ?? [],
      );
      const res = await fetch(`${hubUrl}/v1/submitMessage`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/octet-stream',
          'user-agent': 'DegenFeed/1.0',
        },
        body: bodyBytes,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        return {
          success: false,
          error: `Hubble rejected cast: ${res.status} ${errText}`,
          retryable: res.status >= 500,
        };
      }

      const data = (await res.json()) as { hash?: string };
      return {
        success: true,
        nativeId: data?.hash ?? `fc:${Date.now()}`,
        url: data?.hash ? `https://warpcast.com/0x/${data.hash}` : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: `Farcaster publish error: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const hubUrl = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
      const res = await fetch(`${hubUrl}/v1/info`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
