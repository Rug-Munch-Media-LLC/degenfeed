/**
 * @degenfeed/api-worker — Nostr live-chat bridge
 *
 * Polls Nostr relays for kind-1 replies that reference the live event
 * (NIP-53 live streaming) and forwards each into the unified feed.
 * Relay list is configurable via `RELAY_URLS`.
 */

import type { Env } from '../index';
import { chatLastKey } from './chat-keys';
import { ingestFromProtocol } from './ingest';
import type { SendChatMessage } from './unified-chat';

/** Max 500 new kind-1 replies per poll window (relay page size). */
const PAGE_LIMIT = 50;

/** Lookback when no cursor has been stored yet. */
const DEFAULT_LOOKBACK_MS = 60_000;

/** Per-event failures never abort the poll window. */
type NostrEvent = { pubkey: string; content: string };

/** Injected by `./bridges` so this module has no engine import cycle. */
export type NostrDeps = {
  env: Env;
  send: SendChatMessage;
};

function parseRelayUrls(raw: string | undefined): string[] {
  return (raw || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalise a kind-1 reply into the fields the ingest seam needs. */
function toIngestPayload(nostr: { npubEncode: (pk: string) => string }, ev: NostrEvent) {
  return {
    userId: ev.pubkey,
    displayName: nostr.npubEncode(ev.pubkey).slice(0, 16),
    message: ev.content,
    badges: ['nostr'],
  };
}

/**
 * Poll Nostr relays for new replies to a live event (NIP-53).
 * Returns the number of messages ingested (0 on any failure).
 */
export async function pollNostrChat(
  streamId: string,
  eventId: string,
  deps: NostrDeps,
): Promise<number> {
  const { env, send } = deps;
  const relayUrls = parseRelayUrls(env.RELAY_URLS);
  if (relayUrls.length === 0) return 0;

  const sinceKey = chatLastKey(streamId, 'nostr');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - DEFAULT_LOOKBACK_MS;

  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 4000 });
    const events = (await pool.list({
      '#e': [eventId],
      kinds: [1],
      since: Math.floor(since / 1000),
      limit: PAGE_LIMIT,
    })) as NostrEvent[];
    pool.disconnectAll();

    let count = 0;
    for (const ev of events) {
      try {
        const p = toIngestPayload(nostr, ev);
        await ingestFromProtocol(send, env, streamId, 'nostr', p.userId, p.displayName, p.message, {
          badges: p.badges,
        });
        count++;
      } catch {
        // Skip individual failures
      }
    }

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}
