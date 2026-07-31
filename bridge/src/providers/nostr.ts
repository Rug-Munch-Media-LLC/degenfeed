/**
 * Nostr Provider
 *
 * Rate Limit: 30 requests/minute per relay
 *
 * Fetches notes from the self-hosted Nostr relay (ws://127.0.0.1:8085)
 * AND from public Nostr relays. Uses native WebSocket (Node 18+).
 *
 * Connects to multiple relays in parallel, requests kind 1 (short text note)
 * events, and merges results.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const _$fetch = globalThis.fetch;

/**
 * Our relay + public relays.
 *
 * Order matters: the local relay is queried first (fast, self-hosted data),
 * then reliable public relays. Known-flaky relays are kept but queried with
 * a short timeout so they never block the feed: the bridge feed builder
 * wraps every provider fetch in a 5s budget (FETCH_TIMEOUT_MS in feeds.ts),
 * so any relay that hangs for its full per-relay timeout would cause the
 * whole provider to be killed and fail over to a different protocol.
 */
const RELAYS = [
  { url: 'ws://127.0.0.1:8085', local: true },
  { url: 'wss://nos.lol', local: false },
  { url: 'wss://purplepag.es', local: false },
  { url: 'wss://relay.damus.io', local: false },
  { url: 'wss://relay.primal.net', local: false },
  { url: 'wss://relay.nostr.band', local: false },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

const profileCache = new Map<string, NostrProfile>();

interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|punk)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|scam)\b/.test(lower)) niches.push('security');
  if (/\b(zap|zaps|sats|lightning|lnurl)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(nostr|relay|nip)\b/.test(lower)) niches.push('nostr');
  if (/\b(rust|typescript|python|code|dev|github)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function hexToBech32(hex: string): string {
  if (!hex || hex.length < 8) return hex || 'unknown';
  return hex.substring(0, 12);
}

function parseProfile(content: string): NostrProfile | null {
  try {
    return JSON.parse(content) as NostrProfile;
  } catch {
    return null;
  }
}

// ─── Relay Fetch ───────────────────────────────────────────────────────

/**
 * Resolve a promise with whatever it produced once the budget elapses.
 * Used to guarantee the Nostr provider never exceeds the feed builder's
 * 5s fetch budget — slow/hanging relays must not trigger failover.
 */
async function withTotalBudget<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(undefined as unknown as T), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fetchFromRelay(
  relayUrl: string,
  kinds: number[],
  limit: number,
  timeout = 2500,
): Promise<{ events: NostrEvent[]; profiles: NostrEvent[] }> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const profiles: NostrEvent[] = [];
    let resolved = false;
    let ws: WebSocket | null = null;

    // Early-exit when we already collected enough events — never wait
    // the full timeout for a slow relay when we have what we need.
    const maybeResolve = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      resolve({ events, profiles });
    };

    const timer = setTimeout(() => {
      maybeResolve();
    }, timeout);

    try {
      ws = new WebSocket(relayUrl);

      ws.addEventListener('open', () => {
        const subId = `df-sub-${Date.now()}`;
        ws?.send(JSON.stringify(['REQ', subId, { kinds, limit }]));
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg[0] === 'EVENT') {
            const ev = msg[2] as NostrEvent;
            if (ev.kind === 0) profiles.push(ev);
            else if (ev.kind === 1) events.push(ev);
            if (events.length >= limit) maybeResolve();
          } else if (msg[0] === 'EOSE') {
            maybeResolve();
          }
        } catch {
          /* skip malformed */
        }
      });

      ws.addEventListener('error', () => {
        maybeResolve();
      });

      ws.addEventListener('close', () => {
        maybeResolve();
      });
    } catch {
      maybeResolve();
    }
  });
}

// ─── Mapping ───────────────────────────────────────────────────────────

export function eventToPost(ev: NostrEvent, relayUrl: string, profile?: NostrProfile): UnifiedPost {
  const relayName = new URL(relayUrl).hostname;
  const pubkeyShort = hexToBech32(ev.pubkey);
  const displayName = profile?.display_name || profile?.name || pubkeyShort;
  const avatarUrl = profile?.picture || '';

  return {
    id: `nostr:${ev.id}@${relayName}`,
    protocol: 'nostr' as const,
    author: {
      id: `nostr:${ev.pubkey}`,
      primary: { protocol: 'nostr' as const, id: ev.pubkey },
      handles: { nostr: pubkeyShort, nip05: profile?.nip05 || null },
      displayName,
      bio: profile?.about || '',
      avatarUrl,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { npub: pubkeyShort },
    },
    text: ev.content,
    embeds: [],
    contentType: 'text',
    createdAt: ev.created_at * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, zaps: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: ev,
    niches: guessNiches(ev.content),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'nostr',
  name: 'Nostr',
  description: 'Notes and Other Stuff Transmitted by Relays — WebSocket relays',
  endpoint: '/api/feed/nostr',
  requiresAuth: false,
  contentType: 'text',
};

export async function fetchNostrPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 30 requests/minute per relay; check total across relays
  if (!checkRateLimit('nostr', { maxRequests: 30, windowMs: 60_000 })) {
    console.log('[nostr] Rate limited, skipping fetch');
    return [];
  }
  const perRelay = Math.max(3, Math.ceil(limit / RELAYS.length));

  // Total budget for the whole relay fan-out. The feed builder (feeds.ts)
  // kills provider fetches after 5s (FETCH_TIMEOUT_MS), so we must always
  // return well before that or the feed fails over to another protocol.
  const settled = await withTotalBudget(
    Promise.allSettled(
      RELAYS.map((r) => fetchFromRelay(r.url, [0, 1], perRelay + 5)),
    ),
    3500,
  );
  // Budget may elapse before allSettled finishes — treat missing results as empty.
  const results: PromiseSettledResult<{ events: NostrEvent[]; profiles: NostrEvent[] }>[] =
    Array.isArray(settled) ? settled : [];

  const allEvents: NostrEvent[] = [];
  const allProfiles: NostrEvent[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value.events);
      allProfiles.push(...result.value.profiles);
    }
  }

  // Cache profiles
  for (const p of allProfiles) {
    const parsed = parseProfile(p.content);
    if (parsed) profileCache.set(p.pubkey, parsed);
  }

  // Sort by created_at descending, deduplicate by id
  const seen = new Set<string>();
  const unique: NostrEvent[] = [];
  const sorted = allEvents.sort((a, b) => b.created_at - a.created_at);

  for (const ev of sorted) {
    if (!seen.has(ev.id) && ev.content && ev.content.trim()) {
      seen.add(ev.id);
      unique.push(ev);
      if (unique.length >= limit) break;
    }
  }

  const posts = unique.map((ev) => {
    const profile = profileCache.get(ev.pubkey);
    return eventToPost(ev, RELAYS[0].url, profile);
  });

  console.log(
    `[bridge] Nostr: ${posts.length} posts from ${RELAYS.length} relays (${allEvents.length} raw events)`,
  );
  return posts;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchNostrPosts;
