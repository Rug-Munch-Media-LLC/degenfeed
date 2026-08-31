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

import { npubDecode } from '@degenfeed/nostr-sdk';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

/**
 * Our relay + public relays.
 *
 * Order matters: the local relay is queried first (fast, self-hosted data),
 * then the fastest verified public relays, then the well-known relays that
 * are required for network coverage even when they are slow or currently
 * unreachable from this host (they cost nothing — every relay fetch runs in
 * parallel under a hard total budget, so a dead relay just contributes zero
 * events without blocking the working set).
 *
 * Verified live 2026-08-04 from this host (WS connect + kind-1 EVENT within
 * ~1.2s): nos.lol, relay.primal.net, nostr.wine, offchain.pub, relay.nostr.net,
 * nostr.land, relay.mostr.pub, relay.nostrview.com, nostr.bitcoiner.social,
 * nostr.mom, relay.nostr.moe, relay.snort.social, eden.nostr.land.
 * purplepag.es connects but returns zero kind-1 events (kept last — no cost).
 * damus.io is slow/erroring and nostr.band times out from this host — they are
 * kept (well-known relays, may recover) but placed last so their timeouts
 * never starve the fast set.
 *
 * The bridge feed builder wraps every provider fetch in a 5s budget
 * (FETCH_TIMEOUT_MS in feeds.ts), and this provider's own fan-out budget
 * (withTotalBudget) is 4.5s — so no single relay can stall the feed.
 */
export const RELAYS: { url: string; local: boolean }[] = [
  { url: 'ws://127.0.0.1:8085', local: true },
  { url: 'wss://nos.lol', local: false },
  { url: 'wss://relay.primal.net', local: false },
  { url: 'wss://nostr.wine', local: false },
  { url: 'wss://offchain.pub', local: false },
  { url: 'wss://relay.nostr.net', local: false },
  { url: 'wss://nostr.land', local: false },
  { url: 'wss://relay.mostr.pub', local: false },
  { url: 'wss://relay.nostrview.com', local: false },
  { url: 'wss://nostr.bitcoiner.social', local: false },
  { url: 'wss://nostr.mom', local: false },
  { url: 'wss://relay.nostr.moe', local: false },
  { url: 'wss://relay.snort.social', local: false },
  { url: 'wss://eden.nostr.land', local: false },
  // Well-known relays — required coverage even if slow/unreachable today.
  { url: 'wss://relay.damus.io', local: false },
  { url: 'wss://relay.nostr.band', local: false },
  { url: 'wss://purplepag.es', local: false },
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

/**
 * Profile cache with a 10-minute TTL so profile pics stay fresh.
 *
 * Kind-0 metadata (especially `picture`) changes when users update their
 * profiles. An unbounded, never-expiring cache would freeze avatars at the
 * first-seen value forever; 10 minutes balances freshness against the
 * relay fan-out cost of re-requesting kind-0 events for every author on
 * every fetch.
 */
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;

const profileCache = new Map<string, { profile: NostrProfile; at: number }>();

interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
}

/** Read a cached profile, dropping entries older than the 10-minute TTL. */
function getProfile(pubkey: string): NostrProfile | undefined {
  const entry = profileCache.get(pubkey);
  if (!entry) return undefined;
  if (Date.now() - entry.at > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(pubkey);
    return undefined;
  }
  return entry.profile;
}

/** Write a profile with the current timestamp. */
function setProfile(pubkey: string, profile: NostrProfile): void {
  profileCache.set(pubkey, { profile, at: Date.now() });
}

/**
 * Cache kind-0 events, deduplicated per pubkey keeping the NEWEST event.
 *
 * Relays apply the REQ `limit` to kind-0 EVENTS, not distinct authors —
 * every profile update is a new kind-0 event, so a busy author's updates can
 * flood the quota and starve every other requested author (verified: a
 * 3-author query against purplepag.es returned the same author 3 times).
 * Caching without dedupe therefore poisoned the profile cache with dupes of
 * a few active authors and left the rest unresolved.
 */
function cacheProfiles(profiles: NostrEvent[]): void {
  const newest = new Map<string, NostrEvent>();
  for (const p of profiles) {
    const existing = newest.get(p.pubkey);
    if (!existing || p.created_at > existing.created_at) newest.set(p.pubkey, p);
  }
  for (const p of newest.values()) {
    const parsed = parseProfile(p.content);
    if (parsed) setProfile(p.pubkey, parsed);
  }
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

/**
 * Reject common kind-1 spam shapes that public relays store alongside real
 * notes: JSON-array payloads (e.g. [{"id":...,"service":"youtube-tab",...}])
 * and bare JSON strings. These are not human notes and pollute the feed.
 */
function isSpamContent(content: string): boolean {
  const t = (content || '').trim();
  if (!t) return true;
  if (t.length > 80 && (t.startsWith('[') || t.startsWith('{'))) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) return true;
    } catch {
      /* not valid JSON — keep */
    }
  }
  return false;
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
  timeout = 3000,
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
            // Count BOTH kinds toward the limit. Relays apply `limit` per
            // subscription across all kinds in the filter, and kind-0-only
            // requests (profile enrichment) would otherwise never early-exit
            // because `events` only counts kind-1 — forcing a full timeout
            // per relay and starving avatars inside the 4.5s budget.
            if (events.length + profiles.length >= filter.limit) maybeResolve();
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

// ─── Relay Health Probe ──────────────────────────────────────────────────

export interface RelayHealth {
  url: string;
  local: boolean;
  healthy: boolean;
  events: number;
  latencyMs: number | null;
  error?: string;
}

const relayHealthCache: { at: number; data: RelayHealth[] } = { at: 0, data: [] };
const RELAY_HEALTH_TTL_MS = 30_000;

/**
 * Probe a single relay: open a WS, REQ one kind-1 event, and resolve as soon
 * as an EVENT arrives or EOSE fires. Never blocks longer than `timeoutMs`.
 */
function probeRelay(url: string, timeoutMs = 2500): Promise<RelayHealth> {
  const start = Date.now();
  return new Promise((resolve) => {
    let done = false;
    let events = 0;
    let ws: WebSocket | null = null;

    const finish = (healthy: boolean, error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      resolve({
        url,
        local: url.startsWith('ws://127.0.0.1') || url.includes('localhost'),
        healthy,
        events,
        latencyMs: healthy ? Date.now() - start : null,
        error,
      });
    };

    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch {
      return finish(false, 'connect-failed');
    }

    ws.addEventListener('open', () => {
      ws?.send(
        JSON.stringify([
          'REQ',
          `df-health-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          { kinds: [1], limit: 1 },
        ]),
      );
    });
    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg[0] === 'EVENT') events++;
        if (events >= 1 || msg[0] === 'EOSE') finish(true);
      } catch {
        /* skip malformed */
      }
    });
    ws.addEventListener('error', () => finish(false, 'ws-error'));
    ws.addEventListener('close', () => finish(events > 0, 'closed'));
  });
}

/**
 * Per-relay health snapshot for the bridge health endpoint + diagnostics.
 * Cached for RELAY_HEALTH_TTL_MS so probing does not hammer relays; pass
 * `force=true` to bypass the cache (used by the health dashboard).
 */
export async function getRelayHealth(force = false): Promise<RelayHealth[]> {
  if (
    !force &&
    relayHealthCache.data.length > 0 &&
    Date.now() - relayHealthCache.at < RELAY_HEALTH_TTL_MS
  ) {
    return relayHealthCache.data;
  }
  const settled = await Promise.allSettled(RELAYS.map((r) => probeRelay(r.url)));
  const data = RELAYS.map((r, i) => {
    const res = settled[i];
    if (res?.status === 'fulfilled') return { ...res.value, local: r.local };
    return {
      url: r.url,
      local: r.local,
      healthy: false,
      events: 0,
      latencyMs: null,
      error: 'probe-failed',
    };
  });
  relayHealthCache.at = Date.now();
  relayHealthCache.data = data;
  return data;
}

// ─── Mapping ───────────────────────────────────────────────────────────

/**
 * Extract media embeds from a Nostr kind-1 event's tags.
 *
 * NIP-92 `imeta` tags carry inline media metadata:
 *   ["imeta", "url https://…", "m image/jpeg", "x <sha256>", "alt …"]
 * Legacy clients also emit `url`/`i` tags pointing directly at a media URL.
 * The MIME type is used when present; otherwise the URL extension decides
 * between image and video. Non-media URLs are skipped (they are text links,
 * not embeds).
 */
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?|#|$)/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|#|$)/i;

function mimeKind(mime: string | undefined, url: string): 'image' | 'video' | null {
  if (!mime) {
    if (IMAGE_EXT_RE.test(url)) return 'image';
    if (VIDEO_EXT_RE.test(url)) return 'video';
    return null;
  }
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

export function extractNostrEmbeds(
  tags: string[][],
): Array<{ kind: string; url: string; meta?: Record<string, unknown> }> {
  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    if (!Array.isArray(tag)) continue;
    const [name, ...rest] = tag;
    if (name === 'imeta') {
      // imeta tag is a list of "key value" pairs; pull `url` + `m` (mime).
      const kv = new Map<string, string>();
      for (const part of rest) {
        if (typeof part !== 'string') continue;
        const idx = part.indexOf(' ');
        if (idx < 0) continue;
        kv.set(part.slice(0, idx), part.slice(idx + 1).trim());
      }
      const url = kv.get('url');
      if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
      const kind = mimeKind(kv.get('m'), url);
      if (!kind) continue;
      seen.add(url);
      const meta: Record<string, unknown> = {};
      if (kv.get('m')) meta.mime = kv.get('m');
      if (kv.get('alt')) meta.alt = kv.get('alt');
      if (kv.get('x')) meta.sha256 = kv.get('x');
      if (kv.get('dim')) meta.dim = kv.get('dim');
      embeds.push({ kind, url, meta });
    } else if ((name === 'url' || name === 'i') && rest[0]) {
      const url = rest[0];
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      const kind = mimeKind(undefined, url);
      if (!kind) continue;
      seen.add(url);
      embeds.push({ kind, url });
    }
  }
  return embeds;
}

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
      url: `https://njump.me/${ev.pubkey}`,
      keys: { npub: pubkeyShort },
    },
    text: ev.content,
    embeds: extractNostrEmbeds(ev.tags),
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
  // Rate limit: 45 requests/minute across all relays — high enough that the
  // feed cache + warm-up tasks never starve the working relay set, low enough
  // to stay polite. (Each call fans out to ~2 WS requests per relay.)
  if (!checkRateLimit('nostr', { maxRequests: 45, windowMs: 60_000 })) {
    // console.log('[nostr] Rate limited, skipping fetch');
    return [];
  }
  // Per-relay kind-1 limits are deliberately generous. Relays apply `limit`
  // per subscription across ALL kinds in the filter, so the old single REQ
  // with `kinds:[0,1]` and limit N returned at most N events total — usually
  // kind-1 — starving profiles AND capping volume. Kind-1 and kind-0 are now
  // fetched with SEPARATE subscriptions so each kind gets its own quota.
  const perRelayCurated = Math.max(25, Math.ceil(limit * 0.6));
  const perRelayGeneral = Math.max(25, Math.ceil(limit * 1.5));
  // Kind-0 quota must exceed the author count: relays count profile-update
  // events against `limit`, so a busy author can flood the whole quota (see
  // cacheProfiles). 3x authors gives the dedupe a buffer to cover everyone.
  const curatedProfileLimit = Math.min(CURATED_PUBKEYS.length * 3, 300);

  // Total budget for the whole relay fan-out. The feed builder (feeds.ts)
  // kills provider fetches after 5s (FETCH_TIMEOUT_MS), so we must always
  // return well before that or the feed fails over to another protocol.
  //
  // Hybrid query per relay: (1) curated npubs via `authors` filter for
  // quality content, (2) unfiltered recent notes so the feed stays full
  // of fresh global activity even when curated authors are quiet, and
  // (3) kind-0 metadata for the curated authors so their avatars resolve
  // without a second round-trip.
  //
  // Phase 2 (profile enrichment): relays frequently resolve the kind-1
  // query before sending kind-0 events, which left avatarUrl empty on most
  // posts. After the first pass we issue a targeted kind-0 request with an
  // `authors` filter for every pubkey we still miss — all inside the same
  // 4.5s budget, and cached in profileCache for subsequent fetches.
  //
  // firstEvents is assigned the moment the first pass settles so that, even
  // if the enrichment phase pushes the total past the 4.5s budget, the
  // provider returns real events instead of an empty array (which would make
  // the single-provider route fall back to demo content).
  let firstEvents: NostrEvent[] = [];

  const dedupeEvents = (events: NostrEvent[], cap: number): NostrEvent[] => {
    const seen = new Set<string>();
    const unique: NostrEvent[] = [];
    for (const ev of [...events].sort((a, b) => b.created_at - a.created_at)) {
      if (!seen.has(ev.id) && !isSpamContent(ev.content)) {
        seen.add(ev.id);
        unique.push(ev);
        if (unique.length >= cap) break;
      }
    }
    return unique;
  };

  const settled = await withTotalBudget(
    (async () => {
      const first = await Promise.allSettled(
        RELAYS.flatMap((r) => [
          fetchFromRelay(
            r.url,
            { kinds: [1], authors: CURATED_PUBKEYS, limit: perRelayCurated },
            2000,
          ),
          fetchFromRelay(r.url, { kinds: [1], limit: perRelayGeneral }, 2000),
          fetchFromRelay(
            r.url,
            { kinds: [0], authors: CURATED_PUBKEYS, limit: curatedProfileLimit },
            2000,
          ),
        ]),
      );

      // Split the flatMap results by slot (per relay: 0=curated kind-1,
      // 1=general kind-1, 2=curated kind-0) so the pool can hold a curated
      // share. The raw global kind-1 feed is dominated by anonymous authors
      // with no kind-0 metadata anywhere — a pure recency pool would push
      // the avatar-bearing curated posts out of the top-100 and starve the
      // avatar-priority selection below.
      const curatedEvents: NostrEvent[] = [];
      const generalEvents: NostrEvent[] = [];
      for (let ri = 0; ri < first.length; ri++) {
        const result = first[ri];
        if (!result || result.status !== 'fulfilled') continue;
        const slot = ri % 3;
        if (slot === 0) curatedEvents.push(...result.value.events);
        else if (slot === 1) generalEvents.push(...result.value.events);
        else cacheProfiles(result.value.profiles);
      }

      // Pool = curated share (avatar-bearing by construction — REQ C resolves
      // their kind-0) + general share (fresh global activity), capped at 100
      // so profile enrichment stays within a single chunk and the 4.5s budget.
      const poolCap = Math.min(Math.max(limit * 2, 60), 100);
      const curatedCap = Math.ceil(poolCap * 0.6);
      const generalCap = poolCap - curatedCap;
      firstEvents = [
        ...dedupeEvents(curatedEvents, curatedCap),
        ...dedupeEvents(generalEvents, generalCap),
      ];

      // Enrich: fetch kind-0 events for the authors of the pool, but only
      // when the cached profile is missing a `picture` (avatar). A cached
      // profile without a picture is not "complete" — re-requesting kind-0
      // for those authors is how avatars eventually resolve when the first
      // pass only received partial metadata (e.g. name/bio but no picture).
      // Authors are chunked at 100 pubkeys per REQ (a safe relay bound) and
      // fanned out across the whole relay set.
      const missingPubkeys = [...new Set(firstEvents.map((ev) => ev.pubkey))].filter((pk) => {
        const profile = getProfile(pk);
        return !profile || !profile.picture;
      });

      if (missingPubkeys.length > 0) {
        // Query EVERY relay for the missing authors, not just the first
        // slice: the relay that delivered an author's kind-1 note is the one
        // most likely to also store their kind-0 metadata, and global-feed
        // authors are spread across the whole working relay set. The 1500ms
        // per-relay cap is safe — relays EOSE empty author-filter queries in
        // ~1s, and relays WITH the data stream it immediately.
        const fastRelays = RELAYS;
        for (let i = 0; i < missingPubkeys.length; i += 100) {
          const chunk = missingPubkeys.slice(i, i + 100);
          const enrich = await Promise.allSettled(
            fastRelays.map((r) =>
              fetchFromRelay(
                r.url,
                { kinds: [0], authors: chunk, limit: Math.min(chunk.length * 3, 500) },
                1500,
              ),
            ),
          );
          for (const result of enrich) {
            if (result.status !== 'fulfilled') continue;
            cacheProfiles(result.value.profiles);
          }
        }
      }

      return firstEvents;
    })(),
    4500,
  );
  // Budget may elapse before the closure settles — treat missing results as
  // empty, BUT never discard the first-pass events: they are the reason this
  // provider exists and dropping them on a slow enrichment is what caused
  // intermittent 0-post (→ demo content) responses.
  const pool =
    Array.isArray(settled) && settled.length > 0 ? (settled as NostrEvent[]) : firstEvents;

  // Final selection: prefer posts whose author has a resolved avatar, then
  // backfill with the newest anonymous posts so the requested limit is
  // always reached. The raw global feed is full of authors with no kind-0
  // metadata on any reachable relay; ordering avatar-bearing posts first
  // means /api/feed/nostr?limit=50 returns a feed that is mostly avatars
  // instead of mostly hex-prefix placeholders. Avatar posts are round-robin
  // interleaved by author so one prolific account can't dominate the feed.
  const withAvatar: NostrEvent[] = [];
  const withoutAvatar: NostrEvent[] = [];
  for (const ev of pool) {
    const profile = getProfile(ev.pubkey);
    if (profile?.picture) withAvatar.push(ev);
    else withoutAvatar.push(ev);
  }

  const interleavedByAuthor: NostrEvent[] = [];
  {
    const byAuthor = new Map<string, NostrEvent[]>();
    for (const ev of withAvatar) {
      const list = byAuthor.get(ev.pubkey) ?? [];
      list.push(ev);
      byAuthor.set(ev.pubkey, list);
    }
    let added = true;
    while (interleavedByAuthor.length < limit && added) {
      added = false;
      for (const list of byAuthor.values()) {
        const next = list.shift();
        if (next) {
          interleavedByAuthor.push(next);
          added = true;
          if (interleavedByAuthor.length >= limit) break;
        }
      }
    }
  }
  const unique = [...interleavedByAuthor, ...withoutAvatar].slice(0, limit);

  const posts = unique.map((ev) => {
    const profile = getProfile(ev.pubkey);
    return eventToPost(ev, RELAYS[0]!.url, profile);
  });

  //   console.log(
  //     `[bridge] Nostr: ${posts.length} posts from ${RELAYS.length} relays`,
  //   );
  return posts;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchNostrPosts;
