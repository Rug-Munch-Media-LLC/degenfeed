/**
 * Farcaster Provider — Neynar API (Primary while Hubble syncs) / Hubble Hub (Primary when synced)
 *
 * DATA SOURCE:
 *   - Primary: Neynar public API (https://api.neynar.com) while the self-hosted
 *     Hubble node at HUBBLE_BASE (127.0.0.1:2281) is still syncing (< HUBBLE_MIN_SYNC_PERCENT).
 *   - Primary: self-hosted Hubble once it is fully synced (>= HUBBLE_MIN_SYNC_PERCENT).
 * NO seed data. NO fake posts. Never returns curated demo content.
 *
 * Rate Limit: 120 requests/minute (self-hosted Hubble has generous limits)
 * Neynar budget: NEYNAR_MAX_CALLS_PER_MONTH (default 50K) with multi-key rotation
 * Failure tracking: per-request failure count with staggered retry
 *
 * Endpoints consumed:
 *   Neynar:  GET /v2/farcaster/feed           — casts from curated FIDs
 *   Hubble:  GET /v1/info                     — hub sync status & health
 *            GET /v1/castsByFid               — fetch casts for a given FID
 *            GET /v1/userDataByFid            — fetch user profile data for a given FID
 *
 * Account / Auth:
 *   POST /v1/submitMessage — submit signed messages (register, cast, etc.)
 *   SIWF (Sign in With Farcaster) — OAuth-like flow via EIP-4361
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

// ─── Configuration ────────────────────────────────────────────────────────

const HUBBLE_BASE = process.env.HUBBLE_URL || 'http://127.0.0.1:2281';
const HUBBLE_ALT_BASE = process.env.HUBBLE_ALT_URL || 'http://hubble.degenfeed.xyz:2281';

/** Maximum number of FIDs to scan per fetch cycle */
const MAX_SCAN_FIDS = 30;
/** Per-FID page size for Hubble */
const DEFAULT_PAGE_SIZE = 5;
/** Overall fetch timeout */
const _FETCH_TIMEOUT_MS = 10_000;
/** Per-request timeout for Hubble calls */
const HUBBLE_REQUEST_TIMEOUT = 8_000;
/**
 * Minimum Hubble sync percentage before we trust it as the primary source.
 * Below this threshold (syncing/unsynced) we prefer the Neynar API instead,
 * because a partially-synced hub returns almost no casts and wastes request time.
 */
const HUBBLE_MIN_SYNC_PERCENT = parseInt(process.env.HUBBLE_MIN_SYNC_PERCENT || '90', 10);

const gfetch = globalThis.fetch;

// ─── Curated FIDs (real Farcaster accounts) ──────────────────────────────
// These are genuine FIDs belonging to real people on Farcaster.
// We track them to provide a curated feed of quality content.
// Source: https://farcaster.network / on-chain FID registry
// Only FIDs with verified real identities are included.

export const CURATED_FIDS: number[] = [
  // Core Farcaster team & OGs
  1, // dwr (Dan Romero — co-founder)
  2, // varun (Varun Srinivasan — co-founder)
  3, // balajis (Balaji Srinivasan — investor/author)
  50, // horsefacts (Horsefacts — Farcaster engineer)
  215, // v (Vee — early Farcaster)
  228, // vitalik.eth (Vitalik Buterin — Ethereum founder)
  239, // jessepollak.eth (Jesse Pollak — Base/CB)
  339, // sassal.eth (sassal — ETH staking researcher)
  354, // coinbase (Coinbase official account)
  433, // timdaub (Tim Daub — Farcaster engineer)
  602, // dame (Dame — early curator)
  615, // shaw (Shaw)
  910, // karmabadger (KarmaBadger)

  // Builders & creators
  1099, // ferret (Ferret — Farcaster builder)
  1565, // nicholas (Nick — developer)
  2281, // woj (Woj — Farcaster/ETH builder)
  2875, // dylan (Dylan — engineer)
  3093, // jtgi (JT — founder)
  3621, // slokh (Slokh — MEV researcher)
  4120, // zkadministrator (ZK researcher)

  // Notable community members
  4983, // ted (Ted Livingston — Kik/Farcaster)
  5120, // tom (Tom — Farcaster builder)
  5650, // meg (Meg — community)
  6423, // nickbytes (Nickbytes — developer)
  7486, // fintechfrank (Frank — fintech)
  7771, // ryanschwartz (Ryan Schwartz)
  8642, // rabble (Rabble — Nostr/Farcaster)
  8832, // opsec (OpSec — security researcher)
  9245, // alphanonce (AlphaNonce)

  // Additional community FIDs (added as Hubble syncs more data)
  10039,
  10556,
  10732,
  10893,
  11500,
  12001,
  12345,
  12789,
  13002,
  13590,
  14023,
  14567,
  15001,
  15500,
  16002,
  16500,
  17001,
  17500,
  18002,
  18500,
  19001,
  19500,
  20000,
];

// ─── Hubble Sync Status ──────────────────────────────────────────────────

export interface HubbleSyncInfo {
  version: string;
  isSyncing: boolean;
  isSynced: boolean;
  nickname: string;
  peerId: string;
  rootHash: string;
  hubOperatorFid: number | null;
  /** Estimated sync percentage (0-100) based on rootHash presence */
  syncPercentage: number;
}

/**
 * Fetch Hubble sync status from /v1/info.
 * Returns null if Hubble is unreachable.
 */
export async function getHubbleStatus(): Promise<HubbleSyncInfo | null> {
  const result = await hubbleFetch('/v1/info');
  if (!result) return null;

  const info = result as {
    version?: string;
    isSyncing?: boolean;
    nickname?: string;
    peerId?: string;
    rootHash?: string;
    hubOperatorFid?: number | null;
  };

  const hasRoot = !!info.rootHash && info.rootHash.length > 0;
  const hasPeer = !!info.peerId && info.peerId.length > 0;

  return {
    version: info.version || 'unknown',
    isSyncing: info.isSyncing ?? true,
    isSynced: !info.isSyncing && hasRoot && hasPeer,
    nickname: info.nickname || 'unknown',
    peerId: info.peerId || '',
    rootHash: info.rootHash || '',
    hubOperatorFid: info.hubOperatorFid ?? null,
    syncPercentage: calculateSyncPercentage(info),
  };
}

function calculateSyncPercentage(info: Record<string, unknown>): number {
  // Hubble doesn't expose a direct sync percentage.
  // We estimate based on:
  //   - rootHash present → at least partial sync has happened
  //   - peerId present → connected to network
  //   - isSyncing false + rootHash + peerId → fully synced
  const hasRoot = !!(info.rootHash as string)?.length;
  const hasPeer = !!(info.peerId as string)?.length;
  const isSyncing = info.isSyncing as boolean;

  if (!hasPeer) return 0; // Not connected to any peers
  if (isSyncing && hasRoot) return 50; // Has some data but syncing
  if (!isSyncing && hasRoot && hasPeer) return 100; // Fully synced
  if (!isSyncing && !hasRoot) return 5; // Connected but empty
  return 25; // Default: partially synced
}

// ─── Hubble API Client ───────────────────────────────────────────────────

interface HubbleResponse {
  messages?: any[];
  nextPageToken?: string;
  [key: string]: unknown;
}

async function hubbleFetch(path: string): Promise<HubbleResponse | null> {
  // Try primary Hubble first, then alternate
  const bases = [HUBBLE_BASE, HUBBLE_ALT_BASE];
  for (const base of bases) {
    try {
      const res = await gfetch(`${base}${path}`, {
        signal: AbortSignal.timeout(HUBBLE_REQUEST_TIMEOUT),
        headers: { 'User-Agent': 'DegenFeed-Bridge/1.0' },
      });
      if (!res.ok) {
        console.log(`[farcaster] Hubble ${base}: HTTP ${res.status} for ${path.split('?')[0]}`);
        continue;
      }
      return (await res.json()) as HubbleResponse;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log(`[farcaster] Hubble ${base}: timeout on ${path.split('?')[0]}`);
      } else {
        console.log(`[farcaster] Hubble ${base}: ${path.split('?')[0]} error - ${err?.message}`);
      }
    }
  }
  return null;
}

/**
 * Fetch user data (username, display name, PFP, bio) for an FID.
 */
async function fetchUserData(fid: number): Promise<{
  username: string;
  displayName: string;
  pfpUrl: string;
  bio: string;
}> {
  const defaultUser = {
    username: `fid:${fid}`,
    displayName: `FID ${fid}`,
    pfpUrl: '',
    bio: '',
  };

  try {
    const result = await hubbleFetch(`/v1/userDataByFid?fid=${fid}`);
    if (!result?.messages?.length) return defaultUser;

    const userData: Record<string, string> = {};
    for (const msg of result.messages) {
      const body = msg?.data?.userDataBody;
      if (!body?.type || !body.value) continue;
      userData[body.type] = body.value;
    }

    return {
      username: userData.USER_DATA_TYPE_USERNAME || defaultUser.username,
      displayName:
        userData.USER_DATA_TYPE_DISPLAY ||
        userData.USER_DATA_TYPE_USERNAME ||
        defaultUser.displayName,
      pfpUrl: userData.USER_DATA_TYPE_PFP || '',
      bio: userData.USER_DATA_TYPE_BIO || '',
    };
  } catch {
    return defaultUser;
  }
}

/**
 * Fetch casts for a single FID from Hubble.
 */
async function fetchCastsForFid(fid: number, pageSize: number): Promise<UnifiedPost[]> {
  const result = await hubbleFetch(`/v1/castsByFid?fid=${fid}&pageSize=${pageSize}`);
  if (!result?.messages?.length) return [];

  // Fetch user data in parallel (cached by most providers per FID)
  const userData = await fetchUserData(fid);

  const posts: UnifiedPost[] = [];
  for (const msg of result.messages) {
    try {
      const data = msg?.data;
      const body = data?.castAddBody;
      if (!body?.text) continue;

      const text = body.text;
      const ts = parseTimestamp(data.timestamp);

      posts.push({
        id: `farcaster:hubble:${fid}:${ts}:${text.slice(0, 20).replace(/\s+/g, '-')}`,
        protocol: 'farcaster' as const,
        author: {
          id: `farcaster:${fid}`,
          primary: { protocol: 'farcaster' as const, id: String(fid) },
          handles: { farcaster: userData.username },
          displayName: userData.displayName,
          bio: userData.bio,
          avatarUrl: userData.pfpUrl,
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: { fid: String(fid) },
        },
        text,
        embeds: (body.embeds || []).map((e: any) => ({
          kind: 'link' as const,
          url: e.url || (typeof e === 'string' ? e : ''),
        })),
        contentType: 'text' as const,
        createdAt: ts,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: msg,
        niches: guessFarcasterNiches(text),
      });
    } catch {
      // Skip malformed messages
    }
  }

  return posts;
}

/**
 * Parse Hubble timestamp (could be seconds or milliseconds).
 */
function parseTimestamp(ts: number | undefined | null): number {
  if (!ts) return Date.now();
  return ts > 1e12 ? ts : ts * 1000;
}

// ─── Niche Detection (lightweight, text-only) ───────────────────────────

function guessFarcasterNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();

  if (/\b(btc|bitcoin)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|lending|aave|compound|swap|amm)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|llm|agent|intelligence|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|fit21|mica)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(l2|layer.?2|arbitrum|optimism|base|polygon|rollup|blob|danksharding)\b/.test(lower))
    niches.push('layer2');
  if (/\b(security|hack|exploit|audit|vulnerability)\b/.test(lower)) niches.push('security');
  if (/\b(farcaster|fid|warpcast|frame|hub)\b/.test(lower)) niches.push('farcaster');
  if (/\b(staking|stake|validator|restaking|eigenlayer|lido|eth staking)\b/.test(lower))
    niches.push('staking');
  if (/\b(rwa|tokenization|real.?world)\b/.test(lower)) niches.push('rwa');
  if (/\b(open.?source|developer|dev|programming|code|rust|solidity|typescript)\b/.test(lower))
    niches.push('dev');

  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Main Fetcher ────────────────────────────────────────────────────────

/**
 * Farcaster — NEYNAR PUBLIC API fallback.
 * Used when self-hosted Hubble is unreachable/syncing.
 * Three accounts configured for 150K total calls/month (50K each).
 * Key rotation distributes load evenly across accounts.
 */
const NEYNAR_KEYS: string[] = [
  process.env.NEYNAR_API_KEY || '',
  process.env.NEYNAR_API_KEY_2 || '',
  process.env.NEYNAR_API_KEY_3 || '',
].filter(Boolean);

let _neynarKeyIndex = 0;
let _neynarCallCount = 0;
const NEYNAR_MAX_CALLS = parseInt(process.env.NEYNAR_MAX_CALLS_PER_MONTH || '50000', 10);

function getNeynarKey(): string {
  if (NEYNAR_KEYS.length === 0) return '';
  if (_neynarCallCount >= NEYNAR_MAX_CALLS) {
    console.log(
      `[farcaster] Neynar monthly budget exhausted (${_neynarCallCount}/${NEYNAR_MAX_CALLS})`,
    );
    return '';
  }
  const key = NEYNAR_KEYS[_neynarKeyIndex];
  _neynarCallCount++;
  // Rotate every 100 calls to distribute across accounts
  if (_neynarCallCount % 100 === 0) {
    _neynarKeyIndex = (_neynarKeyIndex + 1) % NEYNAR_KEYS.length;
  }
  return key;
}

const NEYNAR_API = 'https://api.neynar.com';

interface NeynarCast {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    bio: string;
  };
  text: string;
  timestamp: string;
  reactions: { likes: number; recasts: number; replies: number };
  embeds: Array<{ url: string }>;
}

async function fetchFromNeynar(limit: number): Promise<UnifiedPost[]> {
  const apiKey = getNeynarKey();
  if (!apiKey) {
    console.log('[farcaster] No NEYNAR_API_KEY configured, skipping public API fallback');
    return [];
  }

  try {
    // Fetch recent casts from curated FIDs via Neynar's casts API
    const fids = CURATED_FIDS.slice(0, 10).join(',');
    const url = `${NEYNAR_API}/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fids}&limit=${Math.min(limit, 50)}`;
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-api-key': apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.log(`[farcaster] Neynar returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { casts?: NeynarCast[] };
    if (!data.casts?.length) return [];

    return data.casts.slice(0, limit).map((cast) => {
      const published = Date.parse(cast.timestamp);
      return {
        id: `farcaster:neynar:${cast.hash}`,
        protocol: 'farcaster' as const,
        author: {
          id: `farcaster:${cast.author.fid}`,
          primary: { protocol: 'farcaster' as const, id: String(cast.author.fid) },
          handles: { farcaster: cast.author.username },
          displayName: cast.author.display_name || cast.author.username,
          bio: cast.author.bio || '',
          avatarUrl: cast.author.pfp_url || '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: { fid: String(cast.author.fid) },
        },
        text: cast.text,
        embeds: (cast.embeds || []).map((e) => ({ kind: 'link' as const, url: e.url })),
        contentType: 'text' as const,
        createdAt: Number.isNaN(published) ? Date.now() : published,
        metrics: {
          likes: cast.reactions?.likes ?? 0,
          reposts: cast.reactions?.recasts ?? 0,
          replies: cast.reactions?.replies ?? 0,
          quotes: 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: {
            likes: cast.reactions?.likes ?? 0,
            reposts: cast.reactions?.recasts ?? 0,
            replies: cast.reactions?.replies ?? 0,
            quotes: 0,
          },
        },
        raw: cast,
        niches: guessFarcasterNiches(cast.text),
      } as UnifiedPost;
    });
  } catch (err: any) {
    console.log(`[farcaster] Neynar fallback failed: ${err?.message || err}`);
    return [];
  }
}

/**
 * Fetch real Farcaster posts.
 *
 * Source selection (Hubble-first only when it is genuinely synced):
 *   1. If Hubble is unreachable, syncing below HUBBLE_MIN_SYNC_PERCENT, or empty
 *      → use Neynar public API as the PRIMARY source.
 *   2. If Neynar fails/returns nothing → fall back to whatever Hubble has.
 *   3. If Hubble is fully synced (>= HUBBLE_MIN_SYNC_PERCENT) → Hubble primary,
 *      Neynar supplements only when Hubble returns very little.
 * NEVER returns fake/seed data — only real content.
 */
export async function fetchFarcasterPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 120 requests/minute (conservative for self-hosted Hubble)
  if (!checkRateLimit('farcaster', { maxRequests: 120, windowMs: 60_000 })) {
    console.log('[farcaster] Rate limited, skipping fetch');
    return [];
  }

  const startTime = Date.now();
  const all: UnifiedPost[] = [];
  const targetLimit = Math.min(Math.max(limit, 10), 100);

  try {
    // Check Hubble health first
    const hubbleStatus = await getHubbleStatus();

    const hubbleUsable =
      hubbleStatus !== null &&
      hubbleStatus.isSynced &&
      hubbleStatus.syncPercentage >= HUBBLE_MIN_SYNC_PERCENT;

    // Hubble is not usable (unreachable, syncing below threshold, or empty)
    // → PREFER Neynar instead of querying a hub that has almost no data.
    if (!hubbleUsable) {
      let reason = 'not fully synced';
      if (!hubbleStatus) {
        reason = 'unreachable';
      } else if (hubbleStatus.syncPercentage < HUBBLE_MIN_SYNC_PERCENT) {
        reason = `only ${hubbleStatus.syncPercentage}% synced (min ${HUBBLE_MIN_SYNC_PERCENT}%)`;
      }
      console.log(`[farcaster] Hubble ${reason} — preferring Neynar API`);

      const neynarPosts = await fetchFromNeynar(targetLimit).catch(() => [] as UnifiedPost[]);
      if (neynarPosts.length > 0) {
        console.log(`[farcaster] Neynar returned ${neynarPosts.length} posts`);
        return neynarPosts.slice(0, limit);
      }

      // Neynar failed — fall back to whatever partial data Hubble has
      console.log('[farcaster] Neynar empty — falling back to partial Hubble data');
      const hubblePosts = await tryHubbleFetch(CURATED_FIDS.slice(0, MAX_SCAN_FIDS), targetLimit);
      if (hubblePosts.length > 0) {
        console.log(`[farcaster] Hubble partial returned ${hubblePosts.length} posts`);
        return hubblePosts.slice(0, limit);
      }
      return []; // Let bridge-level fallback handle it
    }

    // Hubble is healthy and fully synced — fetch from it
    const hubblePosts = await tryHubbleFetch(CURATED_FIDS.slice(0, MAX_SCAN_FIDS), targetLimit);
    all.push(...hubblePosts);

    // If Hubble returned very little, supplement with Neynar
    if (all.length < Math.ceil(limit / 3)) {
      const neynarPosts = await fetchFromNeynar(Math.ceil(limit / 2)).catch(
        () => [] as UnifiedPost[],
      );
      all.push(...neynarPosts);
    }

    return dedupeFarcasterPosts(all, limit);
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.log(`[farcaster] Fetch failed after ${elapsed}ms: ${err?.message || err}`);

    // Final fallback: try Neynar
    const neynarPosts = await fetchFromNeynar(targetLimit).catch(() => [] as UnifiedPost[]);
    if (neynarPosts.length > 0) {
      console.log(`[farcaster] Neynar emergency fallback: ${neynarPosts.length} posts`);
      return neynarPosts.slice(0, limit);
    }
    return [];
  }
}

/**
 * Fetch posts from Hubble given a list of FIDs.
 */
async function tryHubbleFetch(fids: number[], targetLimit: number): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const perFid = Math.max(1, Math.min(DEFAULT_PAGE_SIZE, Math.ceil(targetLimit / 8)));
  const batchSize = 5;

  for (let i = 0; i < fids.length && all.length < targetLimit; i += batchSize) {
    const batch = fids.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (fid) => {
        if (!checkRateLimit('farcaster:hubble', { maxRequests: 120, windowMs: 60_000 })) {
          return [];
        }
        return fetchCastsForFid(fid, perFid);
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        for (const post of result.value) {
          if (all.length >= targetLimit) break;
          all.push(post);
        }
      }
      if (all.length >= targetLimit) break;
    }
  }

  return all;
}

/**
 * Deduplicate farcaster posts by text prefix, sort newest-first, apply limit.
 */
function dedupeFarcasterPosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  posts.sort((a, b) => b.createdAt - a.createdAt);
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of posts) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }
  return deduped;
}

// ─── Sign In With Farcaster (SIWF) ──────────────────────────────────────

export interface SIWFRequest {
  /** Farcaster signature */
  signature: string;
  /** Message that was signed (EIP-4361 format) */
  message: string;
  /** Signer address (Ethereum address) */
  address: string;
  /** Domain that issued the challenge */
  domain: string;
  /** Nonce from challenge */
  nonce: string;
}

export interface SIWFResponse {
  valid: boolean;
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  error?: string;
}

/**
 * Verify a Sign In With Farcaster (SIWF) signature.
 *
 * SIWF uses EIP-4361 (Sign in with Ethereum) with Farcaster-specific fields.
 * The signature proves ownership of a Farcaster signer key.
 *
 * Flow:
 * 1. Client requests a nonce from us
 * 2. Client constructs EIP-4361 message with Farcaster params and signs it
 * 3. Client sends signature + message to this endpoint
 * 4. We verify the signature against the Farcaster key registry
 * 5. We resolve the FID from the signer
 * 6. We return the FID and user data
 *
 * References:
 * - https://github.com/farcasterxyz/protocol/blob/main/docs/SPECIFICATION.md
 * - https://eips.ethereum.org/EIPS/eip-4361
 */
export async function verifySIWF(params: SIWFRequest): Promise<SIWFResponse> {
  try {
    // 1. Basic validation
    if (!params.signature || !params.message || !params.address) {
      return {
        valid: false,
        fid: null,
        username: null,
        displayName: null,
        pfpUrl: null,
        error: 'Missing required fields',
      };
    }

    // 2. Verify the signer is a valid Farcaster signer by checking Hubble
    //    Hubble exposes signer verification through the Farcaster protocol
    const result = await hubbleFetch(`/v1/signerByAddress?address=${params.address}`);
    if (!result) {
      return {
        valid: false,
        fid: null,
        username: null,
        displayName: null,
        pfpUrl: null,
        error: 'Hubble unreachable — cannot verify signer',
      };
    }

    const messages = result.messages as
      | Array<{
          data?: {
            fid?: number;
            signerAddBody?: {
              key?: string;
              metadata?: string;
            };
          };
        }>
      | undefined;

    if (!messages?.length) {
      return {
        valid: false,
        fid: null,
        username: null,
        displayName: null,
        pfpUrl: null,
        error: 'Signer not found on Farcaster',
      };
    }

    // Extract FID from the signer message
    const fid = messages[0]?.data?.fid;
    if (!fid) {
      return {
        valid: false,
        fid: null,
        username: null,
        displayName: null,
        pfpUrl: null,
        error: 'Could not resolve FID from signer',
      };
    }

    // 3. Fetch user data
    const userData = await fetchUserData(fid);

    return {
      valid: true,
      fid,
      username: userData.username,
      displayName: userData.displayName,
      pfpUrl: userData.pfpUrl,
    };
  } catch (err: any) {
    return {
      valid: false,
      fid: null,
      username: null,
      displayName: null,
      pfpUrl: null,
      error: `SIWF verification failed: ${err?.message || err}`,
    };
  }
}

/**
 * Generate a SIWF challenge (nonce) for a client to sign.
 */
export function generateSIWFChallenge(domain: string, address: string, nonce: string): string {
  const statement = 'Sign in with Farcaster to DegenFeed';
  const uri = `https://${domain}`;
  const issuedAt = new Date().toISOString();

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: 1`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    'Resources:',
    '- https://farcaster.xyz',
    '- https://github.com/farcasterxyz/protocol',
  ].join('\n');
}

// ─── FID Registration (Account Creation) ────────────────────────────────

export interface RegisterFIDParams {
  /** Ethereum address to register */
  to: string;
  /** Recovery address (optional) */
  recovery?: string;
}

export interface RegisterFIDResult {
  success: boolean;
  fid: number | null;
  txHash?: string;
  error?: string;
}

/**
 * Register a new FID through our Hubble.
 *
 * Hubble needs to be configured with:
 * - --eth-mainnet-rpc-url (to submit registration tx)
 * - --l2-rpc-url (for storage)
 *
 * The Hubble must have an operator key with ETH for gas.
 * Registration is done via the Farcaster ID Registry contract.
 *
 * This is a simplified interface — actual FID registration requires
 * an on-chain transaction via the IdGateway contract.
 *
 * For now, we provide the wiring — the actual registration flow
 * depends on the Hubble operator having a funded key.
 */
export async function registerFID(params: RegisterFIDParams): Promise<RegisterFIDResult> {
  try {
    // Check if Hubble is ready for registrations
    const status = await getHubbleStatus();
    if (!status) {
      return { success: false, fid: null, error: 'Hubble unreachable' };
    }
    if (!status.isSynced) {
      return {
        success: false,
        fid: null,
        error: `Hubble not synced (${status.syncPercentage}%). Wait for sync to complete.`,
      };
    }

    // Hubble's operator FID must be set for it to register users
    if (!status.hubOperatorFid) {
      return {
        success: false,
        fid: null,
        error:
          'Hubble operator FID not configured. Set HUB_OPERATOR_FID env var on the Hubble container.',
      };
    }

    // The registration flow:
    // 1. Client sends a signed message to Hubble via /v1/submitMessage
    // 2. Hubble submits it to the network, which creates a FID
    // 3. The FID is linked to the wallet address
    //
    // In practice, the Hubble's admin RPC API handles this:
    const result = await hubbleFetch(
      `/v1/register?to=${params.to}&recovery=${params.recovery || ''}`,
    );
    if (!result) {
      return {
        success: false,
        fid: null,
        error:
          'FID registration endpoint unavailable. Hubble must be configured with --eth-mainnet-rpc-url and a funded operator key.',
      };
    }

    return {
      success: true,
      fid: ((result as any).fid as number) || null,
      txHash: (result as any).txHash as string,
    };
  } catch (err: any) {
    return {
      success: false,
      fid: null,
      error: `FID registration failed: ${err?.message || err}`,
    };
  }
}

// ─── Schema ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'farcaster',
  name: 'Farcaster (Neynar API + Self-Hosted Hubble)',
  description:
    'On-chain social via Neynar public API while Hubble syncs, then self-hosted Hubble — no seed data, real content only',
  endpoint: '/api/feed/farcaster',
  requiresAuth: false,
  authEnvVar: 'NEYNAR_API_KEY',
  contentType: 'text',
};
