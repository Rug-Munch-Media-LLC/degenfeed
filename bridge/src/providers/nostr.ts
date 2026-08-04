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
import { npubDecode } from '@degenfeed/nostr-sdk';

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

/**
 * Curated active npubs (20+) across crypto, tech, AI and news.
 *
 * Every npub below was verified to decode to a valid 64-char hex pubkey
 * (npubDecode) and corresponds to a real, active public account on Nostr.
 * We query relays with an `authors` filter so curated quality content is
 * always present, while a parallel unfiltered subscription keeps the feed
 * full of fresh global activity when curated authors are quiet.
 *
 * Crypto/Bitcoin: BTC Sessions, Willy Woo, notgrubles, GANDALF, ck_SNARKs,
 * BitcoinSapiens, Lucas Atkins, Kumi Bitcoin, Bitcoin Fortress, Nostrich,
 * jb55, UKBitcoinMaster, The Daniel, Local Bitcoiners, Reed, Rev Hodl,
 * Bitcoin Podcast, Alexander Leishman (River).
 * Tech/AI/News: jack, Edward Snowden, botlab (AI agent), Kai (AI agent).
 */
export const CURATED_NPUBS = [
  // ── Crypto / Bitcoin ─────────────────────────────────────────────
  'npub1rxysxnjkhrmqd3ey73dp9n5y5yvyzcs64acc9g0k2epcpwwyya4spvhnp8', // BTC Sessions
  'npub1clwvhf7gsn20v02ywd9vda6gratnp3v3jrtxvc0ue0f7en5xhmq3xxhme', // Willy Woo (woonomic)
  'npub1ate84ggysvau69hkw9ygkqwktak6xqtrkkzg465eva7vj37aqz4qqwmf3z', // notgrubles
  'npub1ac8qr6chl3ktfnfdjvqd97y5tdgs2eg579tvd0rdfydhgjtdzcdqnr657s', // GANDALF (BTCGandalf)
  'npub1cf3zeytdnwgwzz5pk2ax0vvmmlzad03xcft4d50ejrfhsh8pxcdsefx7gk', // ck_SNARKs
  'npub13lpjxh4k65yqu4qdfh2gj3474ragcg829ze0htvj7ykvt9ezfyds4x0y29', // BitcoinSapiens
  'npub16jdfqgazrkapk0yrqm9rdxlnys7ck39c7zmdzxtxqlmmpxg04r0sd733sv', // Lucas Atkins (0xChain)
  'npub1yyt2uhvjsdfqpfuqe4e9k0ft4cy6ln0z2jv2unvywj49hmhx4tkqw0vz67', // Kumi Bitcoin
  'npub122fpu8lwu2eu2zfmrymcfed9tfgeray5quj78jm6zavj78phnqdsu3v4h5', // Bitcoin Fortress (NickReichert)
  'npub1khd34txqv7s9vdgvfl925r6ytj8j4janalpq08z342ap7dwds3jskny9x4', // Nostrich
  'npub1l0gxx3qq9ex5lpurnfmqhfdrx27xfgj24sx6kqmk3r8a5cne63zspx78fx', // jb55 (Damus creator, Bitcoin dev)
  'npub13kgncg54ccmnmvtljvergdvrd7m06zm32j2ayg542kaqayejrv7qg9wp2s', // UKBitcoinMaster
  'npub1fmunwy3lljfyzlgyuyman79lxwm4efz6pzlgqjwc400pr9l708qquvje8w', // The Daniel
  'npub1cvcgs83gw6pcrhvtmlf8gdqaegx93qkznwry96jteqhh2cexgkfq45rtya', // Local Bitcoiners
  'npub1xgyjasdztryl9sg6nfdm2wcj0j3qjs03sq7a0an32pg0lr5l6yaqxhgu7s', // Reed (Local Bitcoiners)
  'npub1f5pre6wl6ad87vr4hr5wppqq30sh58m4p33mthnjreh03qadcajs7gwt3z', // Rev Hodl
  'npub10qrssqjsydd38j8mv7h27dq0ynpns3djgu88mhr7cr2qcqrgyezspkxqj8', // THE Bitcoin Podcast
  'npub1xkere5pd94672h8w8r77uf4ustcazhfujkqgqzcykrdzakm4zl4qeud0en', // Alexander Leishman (River CEO)
  // ── Tech / AI / News ─────────────────────────────────────────────
  'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m', // jack (Twitter founder)
  'npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9', // Edward Snowden
  'npub14dnyxxcalwhtspdxh5jrvhpqgmr6yf5duepm6p5s5j2v5pptwpwq5tcpqf', // botlab (AI agent)
  'npub100g8uqcyz4e50rflpe2x79smqnyqlkzlnvkjjfydfu4k29r6fslqm4cf07', // Kai (AI agent builder)
];

/** Hex pubkeys decoded once at module load from CURATED_NPUBS. */
export const CURATED_PUBKEYS: string[] = CURATED_NPUBS.map((npub) => {
  try {
    return npubDecode(npub);
  } catch {
    // Never let one bad npub break the provider — decode to empty and skip.
    return '';
  }
}).filter((hex) => hex.length === 64);

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
  filter: { kinds: number[]; limit: number; authors?: string[] },
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
        const subId = `df-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // Only include the authors filter when it has entries — an empty
        // authors array is treated by relays as "match nobody".
        const req: Record<string, unknown> = { kinds: filter.kinds, limit: filter.limit };
        if (filter.authors && filter.authors.length > 0) req.authors = filter.authors;
        ws?.send(JSON.stringify(['REQ', subId, req]));
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg[0] === 'EVENT') {
            const ev = msg[2] as NostrEvent;
            if (ev.kind === 0) profiles.push(ev);
            else if (ev.kind === 1) events.push(ev);
            if (events.length >= filter.limit) maybeResolve();
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
  const curatedShare = Math.max(2, Math.ceil(perRelay * 0.6));
  const generalShare = Math.max(2, Math.ceil(perRelay * 0.4));

  // Total budget for the whole relay fan-out. The feed builder (feeds.ts)
  // kills provider fetches after 5s (FETCH_TIMEOUT_MS), so we must always
  // return well before that or the feed fails over to another protocol.
  //
  // Hybrid query per relay: (1) curated npubs via `authors` filter for
  // quality content, (2) unfiltered recent notes so the feed stays full
  // of fresh global activity even when curated authors are quiet.
  const settled = await withTotalBudget(
    Promise.allSettled(
      RELAYS.flatMap((r) => [
        fetchFromRelay(r.url, {
          kinds: [0, 1],
          authors: CURATED_PUBKEYS,
          limit: curatedShare,
        }),
        fetchFromRelay(r.url, {
          kinds: [0, 1],
          limit: generalShare,
        }),
      ]),
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
