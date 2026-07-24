/**
 * Farcaster Provider
 *
 * Fetches casts from the Farcaster network.
 *
 * REQUIREMENTS:
 * - NEYNAR_API_KEY env var: Free tier API key from neynar.com (10k req/day)
 *   Without this key, Farcaster public APIs are currently x402-paywalled.
 *
 * ALTERNATIVES:
 * - Self-hosted Farcaster Hub: Not deployed (complex, ~50GB data)
 * - Public hubs: Most are down or require authentication
 *
 * With NEYNAR_API_KEY set: full cast data with likes, recasts, replies.
 * Without key: returns empty (documented limitation).
 */

import type { SchemaGuard, UnifiedPost } from '../server';

const NEYNAR_BASE = 'https://api.neynar.com';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

// Curated Farcaster FIDs for crypto/tech content
const CURATED_FIDS = [2, 5650, 602, 228, 239, 354, 7486, 339, 4983, 8642, 1214, 3202, 11276];

// ─── Types ─────────────────────────────────────────────────────────────

interface FarcasterCast {
  hash: string;
  author: {
    fid: number;
    username: string;
    displayName?: string;
    pfpUrl?: string;
    bio?: string;
  };
  text: string;
  timestamp: string;
  mentions: Array<{ fid: number }>;
  embeds: Array<{ url: string }>;
  reactions: { likes: number; recasts: number; replies: number };
  channel?: { id: string; name: string };
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|compound|aave)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (/\b(farcaster|fid|warpcast)\b/.test(lower)) niches.push('farcaster');
  if (/\b(rust|typescript|python|code|dev|opensource)\b/.test(lower)) niches.push('tech');
  if (/\b(eth|base|optimism)\b/.test(lower)) niches.push('ethereum');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Neynar API Fetch ──────────────────────────────────────────────────

async function fetchFromNeynar(limit: number): Promise<UnifiedPost[]> {
  if (!NEYNAR_API_KEY) {
    console.log('[bridge] Farcaster: No NEYNAR_API_KEY — Neynar requires API key');
    return [];
  }

  const all: UnifiedPost[] = [];
  const fidsToFetch = CURATED_FIDS.slice(0, 8);
  const perUser = Math.max(2, Math.ceil(limit / fidsToFetch.length));

  try {
    // Fetch recent casts for curated users using v2 feed endpoint
    const url = `${NEYNAR_BASE}/v2/farcaster/feed?fids=${fidsToFetch.slice(0, 5).join(',')}&limit=${perUser * 5}&feed_type=filter&filter_type=fids`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1', api_key: NEYNAR_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.log(`[bridge] Farcaster: Neynar returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { casts?: FarcasterCast[] };
    if (!data.casts) return [];
    all.push(...data.casts.map(castToUnified));
  } catch (err) {
    console.log(`[bridge] Farcaster: Neynar error - ${(err as Error).message}`);
  }

  return all;
}

// ─── Search via Neynar ─────────────────────────────────────────────────

async function searchNeynar(limit: number): Promise<UnifiedPost[]> {
  if (!NEYNAR_API_KEY) return [];

  const queries = ['bitcoin', 'ethereum', 'solana', 'defi', 'crypto', 'ai'];
  const perQuery = Math.max(2, Math.ceil(limit / queries.length));
  const all: UnifiedPost[] = [];

  for (const q of queries.slice(0, 4)) {
    try {
      const url = `${NEYNAR_BASE}/v2/farcaster/cast/search?q=${encodeURIComponent(q)}&limit=${perQuery}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1', api_key: NEYNAR_API_KEY },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { result?: { casts?: FarcasterCast[] } };
      all.push(...(data.result?.casts || []).map(castToUnified));
    } catch {}
  }

  return all;
}

// ─── Mapping ───────────────────────────────────────────────────────────

export function castToUnified(cast: FarcasterCast): UnifiedPost {
  const embeds = cast.embeds?.map((e) => ({ kind: 'link' as const, url: e.url })) || [];

  return {
    id: `farcaster:${cast.hash}`,
    protocol: 'farcaster' as const,
    author: {
      id: `farcaster:${cast.author.fid}`,
      primary: { protocol: 'farcaster' as const, id: String(cast.author.fid) },
      handles: { farcaster: cast.author.username },
      displayName: cast.author.displayName || cast.author.username,
      bio: cast.author.bio || '',
      avatarUrl: cast.author.pfpUrl || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { fid: String(cast.author.fid) },
    },
    text: cast.text,
    embeds,
    contentType: embeds.length > 0 ? 'link' : 'text',
    createdAt: new Date(cast.timestamp).getTime(),
    metrics: {
      likes: cast.reactions?.likes || 0,
      reposts: cast.reactions?.recasts || 0,
      replies: cast.reactions?.replies || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: cast.reactions?.likes || 0,
        reposts: cast.reactions?.recasts || 0,
        replies: cast.reactions?.replies || 0,
        quotes: 0,
      },
    },
    raw: cast,
    niches: guessNiches(cast.text),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'farcaster',
  name: 'Farcaster/Neynar',
  description: 'On-chain social network — requires NEYNAR_API_KEY',
  endpoint: '/api/feed/farcaster',
  requiresAuth: true,
  authEnvVar: 'NEYNAR_API_KEY',
  contentType: 'mixed',
};

export async function fetchFarcasterPosts(limit = 20): Promise<UnifiedPost[]> {
  if (!NEYNAR_API_KEY) {
    console.log(
      '[bridge] Farcaster: Requires NEYNAR_API_KEY env var. Visit neynar.com for free key.',
    );
    return [];
  }

  const all: UnifiedPost[] = [];

  // Primary: Neynar feed
  const feedPosts = await fetchFromNeynar(limit);
  all.push(...feedPosts);

  // If we got little, try search
  if (all.length < 5) {
    const searchPosts = await searchNeynar(limit);
    all.push(...searchPosts);
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Farcaster: ${deduped.length} posts`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchFarcasterPosts;
