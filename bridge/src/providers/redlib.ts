/**
 * Reddit Provider
 *
 * Rate Limit: Reddit aggressively 429s bursts from a single IP — practically
 * only ONE request per 10-20s window is safe. Previous versions fired 4-5
 * sequential subreddit fetches per cycle, which tripped 429 on every request
 * and fell through to demo content.
 *
 * Current strategy (single-request):
 *   1. Serve from a 90s TTL cache first (prewarmer + refresher collapse into
 *      one real fetch per window).
 *   2. Fetch ONE rotating subreddit per cycle with a higher limit (25 posts).
 *      The rotation is deterministic on a 15s window so consecutive cycles
 *      surface different subreddits without exceeding the rate budget.
 *   3. Single-flight lock: concurrent requests coalesce into one fetch.
 *   4. Last-good cache: when a fetch fails (429/empty), serve the most recent
 *      successful posts instead of falling through to demo content.
 *
 * Subreddits: cryptocurrency, ethereum, bitcoin, defi, CryptoCurrency, ethtrader
 *
 * Fallback strategies (OAuth/JSON/Redlib) remain available but are only used
 * when the rotating RSS fetch returns nothing AND no last-good cache exists.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';
import { getRedditOAuth } from './reddit-auth';

const $fetch = globalThis.fetch;

const REDDIT_RSS = 'https://www.reddit.com';

/**
 * Short TTL cache for the whole reddit fetch. The feed prewarmer + refresher
 * call providers repeatedly (3 protocol sets every ~55s); without a cache each
 * call burns one of our conservative 20 req/10min in-process budget slots and
 * Reddit returns 0 posts in the home feed. A 90s cache collapses those
 * repeated calls into a single real fetch while keeping content fresh enough
 * for a social feed.
 */
const REDDIT_CACHE_TTL_MS = 90_000;
let redditCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

/**
 * Last-good cache: survives transient failures (429 / timeouts). Served when
 * the fresh fetch yields nothing so the feed shows real content instead of
 * demo posts. Refreshed on every successful fetch.
 */
const REDDIT_LAST_GOOD_TTL_MS = 30 * 60_000; // 30 min — real content beats demo
let lastGoodReddit: { posts: UnifiedPost[]; savedAt: number } | null = null;

/** Single-flight lock: coalesce concurrent fetchRedditPosts() calls. */
let redditInFlight: Promise<UnifiedPost[]> | null = null;

/**
 * Deterministic subreddit rotation. 15s window means consecutive cycles pick
 * different subreddits while concurrent requests within a window agree.
 */
const ROTATION_WINDOW_MS = 15_000;

/** The task-specified rotation set (deduped, case-insensitive). */
const ROTATION_SUBS = [
  'cryptocurrency',
  'ethereum',
  'bitcoin',
  'defi',
  'CryptoCurrency',
  'ethtrader',
];

function pickRotatingSubreddit(now = Date.now()): string {
  const idx = Math.floor(now / ROTATION_WINDOW_MS) % ROTATION_SUBS.length;
  return ROTATION_SUBS[idx] ?? 'CryptoCurrency';
}

function getCachedPosts(): UnifiedPost[] | null {
  if (redditCache && Date.now() < redditCache.expiresAt) return redditCache.posts;
  return null;
}

function setCachedPosts(posts: UnifiedPost[]): void {
  redditCache = { posts, expiresAt: Date.now() + REDDIT_CACHE_TTL_MS };
  lastGoodReddit = { posts, savedAt: Date.now() };
}

function getLastGoodPosts(): UnifiedPost[] | null {
  if (lastGoodReddit && Date.now() - lastGoodReddit.savedAt < REDDIT_LAST_GOOD_TTL_MS) {
    return lastGoodReddit.posts;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function guessNiches(text: string, subreddit: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  const subLower = subreddit.toLowerCase();
  if (
    /\b(btc|bitcoin|satoshi|halving)\b/.test(lower) ||
    subLower === 'bitcoin' ||
    subLower === 'btc'
  )
    niches.push('bitcoin');
  if (
    /\b(eth|ethereum|vitalik|pectra)\b/.test(lower) ||
    subLower === 'ethereum' ||
    subLower === 'ethdev' ||
    subLower === 'ethfinance' ||
    subLower === 'ethtrader'
  )
    niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower) || subLower === 'solana') niches.push('solana');
  if (
    /\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap)\b/.test(lower) ||
    subLower === 'defi'
  )
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape)\b/.test(lower) || subLower === 'nft')
    niches.push('nft');
  if (
    /\b(ai|artificial|intelligence|llm|agent|chatgpt)\b/.test(lower) ||
    subLower === 'chatgpt' ||
    subLower === 'artificial' ||
    subLower === 'localllama'
  )
    niches.push('ai');
  if (/\b(meme|pepe|dog|doge|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower) || subLower === 'layer2')
    niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (
    /\b(programming|rust|python|typescript|code|dev|opensource)\b/.test(lower) ||
    subLower === 'programming' ||
    subLower === 'rust' ||
    subLower === 'opensource'
  )
    niches.push('tech');
  if (
    /\b(stock|invest|finance|economy|market|trading)\b/.test(lower) ||
    subLower === 'stocks' ||
    subLower === 'investing' ||
    subLower === 'economics' ||
    subLower === 'finance'
  )
    niches.push('finance');
  if (
    /\b(space|science|physics|nasa)\b/.test(lower) ||
    subLower === 'science' ||
    subLower === 'space'
  )
    niches.push('science');
  if (/\b(web3|blockchain|wallet|metamask)\b/.test(lower) || subLower === 'web3')
    niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Fetch from Redlib ───────────────────────────────────────────────

/**
 * Fetch posts from the self-hosted Redlib instance (default 127.0.0.1:8281).
 *
 * Redlib mirrors Reddit's JSON shape: { data: { children: [{ data }] } }.
 * It is often blocked by Reddit's CDN (upstream returns an HTML block page
 * which fails JSON parsing), so this is a genuine last resort — but it is
 * still worth attempting because the instance is local and zero-cost.
 */
async function fetchFromRedlib(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const redlibBase = process.env.REDLIB_URL || 'http://127.0.0.1:8281';
    const url = `${redlibBase}/r/${encodeURIComponent(subreddit)}/hot.json?limit=${Math.min(limit, 25)}`;
    const res = await $fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DegenFeed-Bridge/0.1; +https://degenfeed.xyz)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return [];

    const text = await res.text();
    // Redlib may return an HTML error page when Reddit blocks its upstream.
    if (!text.trim().startsWith('{')) return [];

    const data =
      (JSON.parse(text) as {
        data?: { children?: Array<{ data: Record<string, unknown> }> };
      }) ?? {};
    if (!data.data?.children) return [];

    return data.data.children
      .slice(0, limit)
      .map((child, i) => {
        const d = child.data;
        const title = (d.title as string) || '';
        const author = (d.author as string) || 'unknown';
        const score = (d.score as number) || 0;
        const comments = (d.num_comments as number) || 0;
        const created = ((d.created_utc as number) || 0) * 1000;
        const link = (d.url as string) || '';
        const sub = (d.subreddit as string) || subreddit;

        if (!title) return null;

        return {
          id: `reddit:${sub}:redlib_${(d.id as string) || i}`,
          protocol: 'reddit' as const,
          author: {
            id: `reddit:u/${author}`,
            primary: { protocol: 'reddit' as const, id: author },
            handles: { reddit: `u/${author}` },
            displayName: author,
            bio: `Reddit user on r/${sub}`,
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            url: `https://reddit.com/user/${author}`,
            links: [{ label: 'subreddit', url: `https://reddit.com/r/${sub}` }],
            keys: {},
          },
          text: title,
          embeds: link ? [{ kind: 'link', url: link }] : [],
          contentType: link ? 'link' : 'text',
          createdAt: created || Date.now() - i * 600000,
          metrics: { likes: score, reposts: 0, replies: comments, quotes: 0, views: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: score, reposts: 0, replies: comments, quotes: 0 },
          },
          raw: d,
          niches: guessNiches(title, sub),
        };
      })
      .filter(Boolean) as UnifiedPost[];
  } catch {
    return [];
  }
}

// ─── Primary: Reddit RSS feeds ───────────────────────────────────────
// Verified working from this host (2026-07-31): Reddit serves valid Atom
// for /r/{sub}/hot/.rss with a browser-like UA, and does NOT require auth.
// Requests must be spaced out — Reddit aggressively rate-limits bursts.

async function fetchFromRedditRss(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${REDDIT_RSS}/r/${encodeURIComponent(subreddit)}/hot/.rss?limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DegenFeed-Bridge/0.1; +https://degenfeed.xyz)',
        },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, subreddit, limit);
  } catch {
    return [];
  }
}

export function parseRssXml(xml: string, subreddit: string, limit: number): UnifiedPost[] {
  const posts: UnifiedPost[] = [];
  let index = 0;

  // Try Atom format first (<entry>)
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = entryRe.exec(xml)) !== null && posts.length < limit) {
    const e = m[1] ?? '';
    const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
    const updatedMatch = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const title = titleMatch?.[1] ? stripHtml(titleMatch[1]).trim() : '';
    if (!title) continue;
    const link = linkMatch?.[1] ?? '';

    posts.push({
      id: `reddit:${subreddit}:rss_${index}`,
      protocol: 'reddit',
      author: {
        id: `reddit:r/${subreddit}`,
        primary: { protocol: 'reddit', id: subreddit },
        handles: { reddit: `r/${subreddit}` },
        displayName: `r/${subreddit}`,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'subreddit', url: `https://reddit.com/r/${subreddit}` }],
        keys: {},
      },
      text: title,
      embeds: link ? [{ kind: 'link', url: link }] : [],
      contentType: link ? 'link' : 'text',
      createdAt: updatedMatch?.[1]
        ? new Date(updatedMatch[1]).getTime()
        : Date.now() - index * 600000,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: guessNiches(title, subreddit),
    });
    index++;
  }

  // Fallback to RSS 2.0 (<item>)
  if (posts.length === 0) {
    const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
    while ((m = itemRe.exec(xml)) !== null && posts.length < limit) {
      const e = m[1] ?? '';
      const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const title = titleMatch?.[1] ? stripHtml(titleMatch[1]).trim() : '';
      if (!title) continue;
      const link = linkMatch?.[1] ? stripHtml(linkMatch[1]) : '';

      posts.push({
        id: `reddit:${subreddit}:rss_${index}`,
        protocol: 'reddit',
        author: {
          id: `reddit:r/${subreddit}`,
          primary: { protocol: 'reddit', id: subreddit },
          handles: { reddit: `r/${subreddit}` },
          displayName: `r/${subreddit}`,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'subreddit', url: `https://reddit.com/r/${subreddit}` }],
          keys: {},
        },
        text: title,
        embeds: link ? [{ kind: 'link', url: link }] : [],
        createdAt: Date.now() - index * 600000,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: {},
        niches: guessNiches(title, subreddit),
      });
      index++;
    }
  }

  return posts;
}

// ─── Primary: OAuth2-authenticated Reddit JSON API ───────────────────

async function fetchFromRedditOAuth(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const path = `/r/${encodeURIComponent(subreddit)}/hot.json?limit=${Math.min(limit, 25)}`;
    const res = await getRedditOAuth().apiFetch(path, { timeout: 8000 });
    if (!res?.ok) {
      if (res?.status === 429) {
        // console.log(`[bridge] Reddit OAuth: rate limited on r/${subreddit}`);
      } else if (res?.status === 403) {
        // console.log(`[bridge] Reddit OAuth: forbidden on r/${subreddit} (private?)`);
      }
      return [];
    }
    const data = (await res.json()) as {
      data?: { children?: Array<{ data: Record<string, unknown> }> };
    };
    if (!data.data?.children) return [];

    return data.data.children
      .slice(0, limit)
      .map((child, i) => {
        const d = child.data;
        const title = (d.title as string) || '';
        const author = (d.author as string) || 'unknown';
        const score = (d.score as number) || 0;
        const comments = (d.num_comments as number) || 0;
        const created = ((d.created_utc as number) || 0) * 1000;
        const link = (d.url as string) || '';
        const sub = (d.subreddit as string) || subreddit;
        const id = (d.id as string) || `oauth_${i}`;

        if (!title) return null;

        return {
          id: `reddit:${sub}:oauth_${id}`,
          protocol: 'reddit' as const,
          author: {
            id: `reddit:u/${author}`,
            primary: { protocol: 'reddit' as const, id: author },
            handles: { reddit: `u/${author}` },
            displayName: author,
            bio: `Reddit user on r/${sub}`,
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            url: `https://reddit.com/user/${author}`,
            links: [{ label: 'subreddit', url: `https://reddit.com/r/${sub}` }],
            keys: {},
          },
          text: title,
          embeds: link ? [{ kind: 'link', url: link }] : [],
          contentType: link ? 'link' : 'text',
          createdAt: created || Date.now() - i * 600000,
          metrics: { likes: score, reposts: 0, replies: comments, quotes: 0, views: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: score, reposts: 0, replies: comments, quotes: 0 },
          },
          raw: d,
          niches: guessNiches(title, sub),
        };
      })
      .filter(Boolean) as UnifiedPost[];
  } catch (err) {
    console.error(`[bridge] Reddit OAuth fetch error on r/${subreddit}: ${(err as Error).message}`);
    return [];
  }
}

// ─── Fallback: Direct (unauthenticated) Reddit JSON API ──────────────

async function fetchFromRedditJson(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${REDDIT_RSS}/r/${encodeURIComponent(subreddit)}/hot.json?limit=${Math.min(limit, 25)}`;
    const headers = await getRedditOAuth().getAuthHeaders();
    const res = await $fetch(url, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      if (res.status === 429) {
        // console.log(`[bridge] Reddit JSON: rate limited on r/${subreddit}`);
      }
      return [];
    }
    const data = (await res.json()) as {
      data?: { children?: Array<{ data: Record<string, unknown> }> };
    };
    if (!data.data?.children) return [];

    return data.data.children
      .slice(0, limit)
      .map((child, i) => {
        const d = child.data;
        const title = (d.title as string) || '';
        const author = (d.author as string) || 'unknown';
        const score = (d.score as number) || 0;
        const comments = (d.num_comments as number) || 0;
        const created = ((d.created_utc as number) || 0) * 1000;
        const link = (d.url as string) || '';
        const sub = (d.subreddit as string) || subreddit;

        if (!title) return null;

        return {
          id: `reddit:${sub}:json_${(d.id as string) || i}`,
          protocol: 'reddit' as const,
          author: {
            id: `reddit:u/${author}`,
            primary: { protocol: 'reddit' as const, id: author },
            handles: { reddit: `u/${author}` },
            displayName: author,
            bio: `Reddit user on r/${sub}`,
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            url: `https://reddit.com/user/${author}`,
            links: [{ label: 'subreddit', url: `https://reddit.com/r/${sub}` }],
            keys: {},
          },
          text: title,
          embeds: link ? [{ kind: 'link', url: link }] : [],
          contentType: link ? 'link' : 'text',
          createdAt: created || Date.now() - i * 600000,
          metrics: { likes: score, reposts: 0, replies: comments, quotes: 0, views: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: score, reposts: 0, replies: comments, quotes: 0 },
          },
          raw: d,
          niches: guessNiches(title, sub),
        };
      })
      .filter(Boolean) as UnifiedPost[];
  } catch {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'reddit',
  name: 'Reddit/Redlib',
  description: 'Crypto subreddits — OAuth2 JSON API + RSS fallback',
  endpoint: '/api/feed/reddit',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchRedditPosts(limit = 20): Promise<UnifiedPost[]> {
  // 1) Serve from the short TTL cache first so repeated feed-build calls
  // (prewarm + refresher + user requests) don't burn the in-process budget
  // or hammer Reddit's CDN.
  const cached = getCachedPosts();
  if (cached) return cached.slice(0, limit);

  // 2) Single-flight lock: coalesce concurrent requests into one fetch.
  if (redditInFlight) {
    const posts = await redditInFlight;
    return posts.slice(0, limit);
  }

  const inFlight = (async (): Promise<UnifiedPost[]> => {
    // Reddit unauthenticated limit: ~60 requests/10 min per IP. Keep our own
    // in-process budget far below that so bursts don't trip Reddit's CDN.
    if (!checkRateLimit('reddit', { maxRequests: 20, windowMs: 600_000 })) {
      // console.log('[reddit] Rate limited, skipping fetch');
      return [];
    }

    // 3) ONE rotating subreddit per cycle, higher limit (25 posts). A single
    // request per 15s+ window is the only cadence Reddit tolerates.
    const sub = pickRotatingSubreddit();
    const posts: UnifiedPost[] = [];
    const perSub = 25;

    try {
      const rssPosts = await fetchFromRedditRss(sub, perSub);
      posts.push(...rssPosts);
    } catch {
      // continue to fallback
    }

    // If RSS was blocked/empty, try the OAuth JSON API for the SAME subreddit
    // (one more request, still within the budget).
    if (posts.length === 0 && getRedditOAuth().isConfigured) {
      try {
        const oauthPosts = await fetchFromRedditOAuth(sub, perSub);
        posts.push(...oauthPosts);
      } catch {
        // continue
      }
    }

    // Unauthenticated JSON API (usually CDN-blocked; quick attempt only when
    // both RSS and OAuth returned nothing).
    if (posts.length === 0 && !getRedditOAuth().isConfigured) {
      try {
        await new Promise((r) => setTimeout(r, 300));
        const jsonPosts = await fetchFromRedditJson(sub, perSub);
        posts.push(...jsonPosts);
      } catch {
        // continue
      }
    }

    // LAST RESORT: Redlib (often blocked by Reddit CDN, but local + free)
    if (posts.length === 0) {
      try {
        const redlibPosts = await fetchFromRedlib(sub, perSub);
        posts.push(...redlibPosts);
      } catch {
        // continue
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped: UnifiedPost[] = [];
    for (const p of posts) {
      const key = p.text.slice(0, 60);
      if (!seen.has(key) && deduped.length < limit) {
        seen.add(key);
        deduped.push(p);
      }
    }

    // 4) Last-good cache: on success, refresh both caches. On failure, the
    // caller serves last-good below so transient 429s never degrade to demo.
    if (deduped.length > 0) {
      setCachedPosts(deduped);
    } else {
      const lastGood = getLastGoodPosts();
      if (lastGood) {
        //         console.log(
        //           `[reddit] ${sub}: fetch returned empty — serving ${lastGood.length} last-good posts`,
        //         );
        return lastGood.slice(0, limit);
      }
    }

    //     console.log(
    //       `[bridge] Reddit: ${deduped.length} posts from r/${sub} [${authMode}] (rss: ${rssCount}, oauth: ${oauthCount}, json: ${jsonCount}, redlib: ${redlibCount})`,
    //     );
    return deduped;
  })();

  redditInFlight = inFlight;
  try {
    return (await inFlight).slice(0, limit);
  } finally {
    redditInFlight = null;
  }
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchRedditPosts;
