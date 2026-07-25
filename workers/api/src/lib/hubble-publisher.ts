/**
 * @degenfeed/api-worker — Hubble Cast Publisher
 *
 * Signs and submits Farcaster casts to our self-hosted Hubble.
 * Self-hosted Farcaster publishing — no external API dependency.
 *
 * Uses the DegenFeed bot signer key for automated publishing.
 * The bot must have a registered signer on Farcaster.
 *
 * Env vars required:
 *   FARCASTER_BOT_FID        — FID for the bot account
 *   FARCASTER_BOT_SIGNER_KEY — ED25519 private key hex for the bot signer
 *   FARCASTER_BOT_HUB_URL    — Hubble URL (default: http://127.0.0.1:2281)
 */

const DEFAULT_HUB_URL = 'http://127.0.0.1:2281';

export interface PublishCastOptions {
  text: string;
  embeds?: string[];
  channelId?: string;
  parentUrl?: string;
}

export interface PublishCastResult {
  hash?: string;
  error?: string;
}

/**
 * Publish a cast to Farcaster via our self-hosted Hubble.
 * Signs the message using the bot's ED25519 key and submits to /v1/submitMessage.
 */
export async function publishCastToFarcaster(
  env: Record<string, string | undefined>,
  opts: PublishCastOptions,
): Promise<PublishCastResult> {
  const fid = env.FARCASTER_BOT_FID;
  const signerKey = env.FARCASTER_BOT_SIGNER_KEY;
  const hubUrl = env.FARCASTER_BOT_HUB_URL || DEFAULT_HUB_URL;

  if (!fid || !signerKey) {
    return { error: 'Farcaster bot not configured (FARCASTER_BOT_FID / FARCASTER_BOT_SIGNER_KEY)' };
  }

  const fidNum = Number(fid);
  if (!fidNum || !Number.isFinite(fidNum)) {
    return { error: 'Invalid FARCASTER_BOT_FID' };
  }

  const castText = opts.text.length > 320 ? `${opts.text.slice(0, 317)}...` : opts.text;

  try {
    // Dynamically import to avoid bundle issues in edge workers
    const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
    const result = buildFarcasterCastMessage({
      signerKeyHex: signerKey,
      fid: fidNum,
      text: castText,
    });

    if (!result.ok || !result.messageHex) {
      return { error: `Failed to build cast message: ${result.error}` };
    }

    const bodyBytes = hexToBytes(result.messageHex);
    const res = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/1.0',
      },
      body:
        bodyBytes.buffer instanceof ArrayBuffer
          ? bodyBytes.buffer
          : (bodyBytes as unknown as ArrayBuffer),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { error: `Hubble rejected cast: ${res.status} ${errText.slice(0, 200)}` };
    }

    const data = (await res.json()) as { hash?: string } | undefined;
    return { hash: data?.hash || result.messageHex.slice(0, 40) };
  } catch (err) {
    return { error: `Hub publish failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
