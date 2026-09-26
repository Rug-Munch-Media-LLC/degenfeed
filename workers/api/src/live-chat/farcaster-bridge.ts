/**
 * @degenfeed/api-worker — Farcaster live-chat bridge
 *
 * Polls a Farcaster hub (`FARCASTER_HUB_URL`) for casts replying to the
 * live stream's parent cast, or — when no parent hash is known — for casts
 * replying to the stream's canonical URL.
 */

import type { Env } from '../index';
import { chatLastKey } from './chat-keys';
import { ingestFromProtocol } from './ingest';
import type { SendChatMessage } from './unified-chat';

const DEFAULT_LOOKBACK_MS = 60_000;
const MAX_TEXT = 500;

/** Hub REST payload — every field optional; the bridge filters. */
interface HubMessage {
  data?: {
    fid?: number;
    timestamp?: number;
    castAddBody?: { text: string };
  };
}

/** Casts report seconds; anything above 1e12 is already milliseconds. */
function toMillis(timestamp: number | undefined): number {
  if (!timestamp) return 0;
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

/** Injected by `./bridges` so this module has no engine import cycle. */
export type FarcasterDeps = {
  env: Env;
  send: SendChatMessage;
  hubUrl: string;
};

function hubQuery(hubUrl: string, streamId: string, parentCastHash?: string): string {
  return parentCastHash
    ? `${hubUrl}/v1/castsByParent?hash=${parentCastHash}&limit=50`
    : `${hubUrl}/v1/castsByParent?parentUrl=${encodeURIComponent(`https://app.degenfeed.xyz/live/${streamId}`)}&limit=50`;
}

/**
 * Poll the Farcaster hub for new casts replying to the live stream.
 * Returns the number of messages ingested (0 on any failure).
 */
export async function pollFarcasterChat(
  streamId: string,
  parentCastHash: string | undefined,
  deps: FarcasterDeps,
): Promise<number> {
  const { env, send, hubUrl } = deps;
  const sinceKey = chatLastKey(streamId, 'farcaster');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - DEFAULT_LOOKBACK_MS;

  try {
    const res = await fetch(hubQuery(hubUrl, streamId, parentCastHash), {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;

    const data = (await res.json()) as { messages?: HubMessage[] };
    let count = 0;
    for (const msg of data.messages || []) {
      const text = msg.data?.castAddBody?.text;
      if (!text) continue;
      if (toMillis(msg.data?.timestamp) < since) continue;

      const fid = msg.data?.fid || 0;
      await ingestFromProtocol(
        send,
        env,
        streamId,
        'farcaster',
        `fid:${fid}`,
        `fc:${fid}`,
        text.slice(0, MAX_TEXT),
        { badges: ['farcaster'] },
      );
      count++;
    }

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}
