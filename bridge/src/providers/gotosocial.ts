/**
 * GotoSocial / Mastodon Provider
 *
 * Rate Limit: 300 requests/5 minutes (public Mastodon APIs)
 *
 * Fetches posts from the local GotoSocial instance (port 8082) and from
 * public Mastodon instances that serve their public timeline without auth.
 *
 * GotoSocial 0.22.x requires OAuth for timelines, so we also pull from
 * popular public instances (mastodon.social, bitcoinhackers.org, etc.)
 * which serve /api/v1/timelines/public without authentication.
 */

import { filterFreshPosts } from '../lib/freshness';
import { guessNiches, stripHtml } from '../lib/utils';
import { checkRateLimit } from '../rate-limiter';

export { guessNiches, stripHtml };

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// Prefer the externally-reachable GTS/Mastodon origin when configured
// (GTS_BASE_URL in bridge/.env → social.degenfeed.xyz). Falls back to the
// container-local default only so deployments without the env var still
// degrade to the public-instance fetch below instead of a dead loopback.
const GTS_BASE = process.env.GTS_BASE_URL || 'http://127.0.0.1:8082';

/** Public Mastodon instances that serve public timeline without auth */
const PUBLIC_INSTANCES = [
  'https://mastodon.social',
  'https://bitcoinhackers.org',
  'https://hachyderm.io',
  'https://fosstodon.org',
  'https://infosec.exchange',
  'https://cryptodon.lol',
  'https://mas.to',
  'https://mstdn.social',
  'https://techhub.social',
  // Additional fediverse instances (2026-08-04) — general, tech, art,
  // open-source, science and music communities for broader content
  // diversity. Unreachable instances are skipped gracefully by the
  // per-instance catch, so adding more sources is strictly additive.
  'https://mastodon.online',
  'https://mastodon.world',
  'https://mastodon.art',
  'https://hackers.town',
  'https://mastodon.cloud',
  'https://universeodon.com',
  'https://floss.social',
  'https://norden.social',
  'https://mastodon.ie',
  'https://todon.eu',
  'https://social.treehouse.systems',
  'https://metalhead.club',
  'https://mastodon.green',
  // Additional crypto/tech-friendly instances (verified public timeline
  // 2026-08-05). mastodon.nl and mastodon.scot are large general instances
  // with strong tech/crypto communities; phpc.social and journa.host are
  // tech/verification communities.
  'https://mastodon.nl',
  'https://mastodon.scot',
  'https://phpc.social',
  'https://journa.host',
];

// ─── Helpers ──────────────────────────────────────────────────────────
// stripHtml and guessNiches are imported from ../lib/utils

// ─── Type ─────────────────────────────────────────────────────────────

interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  /** Static (non-animated) avatar — used when `avatar` is absent. */
  avatar_static?: string;
  followers_count: number;
  following_count: number;
  header: string;
  header_static: string;
}

interface MastodonStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: string;
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: Array<{ type: string; url: string }>;
  tags: Array<{ name: string }>;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  account: MastodonAccount;
  reblog: MastodonStatus | null;
  card: { url: string; title: string; description: string; image: string | null } | null;
}

// ─── Mapping ──────────────────────────────────────────────────────────

export function statusToPost(s: MastodonStatus, instanceHost: string): UnifiedPost {
  const acct = s.account;
  const original = s.reblog ?? s;
  const content = stripHtml(original.content || '');
  const text = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${content}` : content;
  const createdAt = new Date(original.created_at).getTime();
  const handle = acct.acct.includes('@') ? acct.acct : `${acct.acct}@${instanceHost}`;

  return {
    id: `mastodon:${original.id}@${instanceHost}`,
    protocol: 'mastodon',
    author: {
      id: `mastodon:${acct.id}@${instanceHost}`,
      primary: { protocol: 'mastodon', id: acct.id },
      handles: { mastodon: handle },
      displayName: acct.display_name || acct.username || 'Unknown',
      bio: stripHtml(acct.note || ''),
      avatarUrl: acct.avatar || acct.avatar_static || '',
      followerCount: acct.followers_count || 0,
      followingCount: acct.following_count || 0,
      links: [],
      url: handle.includes('@') ? `https://${handle.split('@')[1]}/@${handle.split('@')[0]}` : '',
      keys: {},
    },
    text,
    html: original.content || '',
    embeds: [],
    contentType:
      original.media_attachments?.length > 0 ? 'image' : original.card?.image ? 'link' : 'text',
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: original.favourites_count ?? 0,
        reposts: original.reblogs_count ?? 0,
        replies: original.replies_count ?? 0,
        quotes: 0,
      },
    },
    raw: s,
    niches: guessNiches(text),
  };
}

// ─── Fetch from GTS (auth required) ──────────────────────────────────

async function fetchFromGts(limit: number): Promise<UnifiedPost[]> {
  // Try OAuth client_credentials with env credentials
  const clientId = process.env.GTS_CLIENT_ID || '';
  const clientSecret = process.env.GTS_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    // console.log('[bridge] GTS: no credentials configured, skipping');
    return [];
  }

  try {
    const tokenRes = await $fetch(`${GTS_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'read:statuses read:accounts read:timelines',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!tokenRes.ok) {
      // console.log(`[bridge] GTS: OAuth failed (${tokenRes.status}), trying without auth`);
      // Fall through to try without auth — some GTS configs allow public access
    } else {
      const data = (await tokenRes.json()) as { access_token?: string };
      if (data.access_token) {
        const res = await $fetch(`${GTS_BASE}/api/v1/timelines/public?local=true&limit=${limit}`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (res.ok) {
          const raw = (await res.json()) as MastodonStatus[];
          return raw.map((s) => statusToPost(s, 'social.degenfeed.xyz'));
        }
      }
    }

    // Try without auth (some instances allow it)
    const res = await $fetch(`${GTS_BASE}/api/v1/timelines/public?local=true&limit=${limit}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const raw = (await res.json()) as MastodonStatus[];
      return raw.map((s) => statusToPost(s, 'social.degenfeed.xyz'));
    }
  } catch {
    // console.log('[bridge] GTS: fetch error:', (err as Error).message);
  }

  return [];
}

// ─── Fetch from public instances (no auth) ───────────────────────────

async function fetchFromPublicInstances(limit: number): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / PUBLIC_INSTANCES.length));
  const results: UnifiedPost[] = [];

  const fetches = PUBLIC_INSTANCES.map(async (baseUrl) => {
    try {
      const hostname = new URL(baseUrl).hostname;
      const res = await $fetch(
        `${baseUrl}/api/v1/timelines/public?local=true&limit=${perInstance}`,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) return [];
      const raw = (await res.json()) as MastodonStatus[];
      return raw.map((s) => statusToPost(s, hostname));
    } catch {
      return [] as UnifiedPost[];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }

  return results;
}

// ─── Crypto/web3 keyword filter ────────────────────────────────────────
// Mastodon is a general social network — most public-instance posts are
// off-niche. We keep crypto/web3-relevant posts first and drop the rest when
// enough matches exist, so the feed stays on-niche without ever returning
// empty when matches are scarce.

const CRYPTO_KEYWORDS =
  /(bitcoin|btc|ethereum|eth|solana|sol\b|crypto|defi|nft|web3|blockchain|onchain|on-chain|altcoin|token|airdrop|staking|stake|yield|liquidity|memecoin|meme coin|stablecoin|etf|sec|regulation|wallet|dex|cex|layer ?2|l2|arbitrum|optimism|base\b|polygon|rollup|zk|mining|halving|sats|lightning|jupiter|uniswap|aave|compound|farcaster|nostr|bitcoin hack|hodl|btc\b)/i;

function isCryptoPost(post: UnifiedPost): boolean {
  return CRYPTO_KEYWORDS.test(post.text || '');
}

/**
 * Sort a post batch so crypto/web3-relevant posts surface first. When at
 * least 70% of the requested limit is matched, non-matching posts are
 * dropped entirely; otherwise the full mix is preserved (never return
 * empty).
 */
function boostCryptoPosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  const matching = posts.filter(isCryptoPost);
  const nonMatching = posts.filter((p) => !isCryptoPost(p));
  if (matching.length >= Math.ceil(limit * 0.7)) return matching.slice(0, limit);
  return [...matching, ...nonMatching].slice(0, limit);
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'mastodon',
  name: 'Mastodon/GoToSocial',
  description: 'Federated microblogging on ActivityPub — public instances',
  endpoint: '/api/feed/mastodon',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchMastodonPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 300 requests/5 minutes (public Mastodon API)
  if (!checkRateLimit('mastodon', { maxRequests: 300, windowMs: 300_000 })) {
    // console.log('[mastodon] Rate limited, skipping fetch');
    return [];
  }
  const [gts, publics] = await Promise.all([
    fetchFromGts(Math.ceil(limit / 3)),
    fetchFromPublicInstances(Math.ceil(limit / 1.5)),
  ]);

  const all = [...gts, ...publics];

  // Freshness: discard posts outside the FEED_MAX_AGE_HOURS window (48h)
  // BEFORE dedup so the cap fills with fresh content only.
  const fresh = filterFreshPosts(all);

  // Crypto/web3 relevance filter — keep the feed on-niche, never empty.
  const boosted = boostCryptoPosts(fresh, limit);

  // Deduplicate by content
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of boosted) {
    const key = p.text.slice(0, 80);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  if (deduped.length === 0) {
    // console.log('[bridge] GTS/Mastodon: no posts from any instance');
  } else {
    //     console.log(
    //       `[bridge] GTS/Mastodon: ${deduped.length} posts (GTS: ${gts.length}, public: ${publics.length})`,
    //     );
  }

  return deduped;
}

/** @alias Use `fetchPosts` as the standardized export name */
export const fetchPosts = fetchMastodonPosts;
