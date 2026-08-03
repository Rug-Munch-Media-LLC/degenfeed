/**
 * Reddit Provider
 *
 * Rate Limit: 600 requests/10 minutes (OAuth2 API)
 * Rate Limit: 60 requests/10 minutes (unauthenticated fallback)
 *
 * Fetches Reddit content via multiple strategies:
 * 1. PRIMARY: Reddit RSS feeds (www.reddit.com/r/{sub}/hot/.rss) — no auth,
 *    works from datacenter IPs where the JSON API is CDN-blocked
 * 2. SECONDARY: OAuth2-authenticated Reddit JSON API (600 req/10min)
 * 3. TERTIARY: Direct Reddit JSON API (rate-limited, 800ms delay between requests)
 * 4. LAST RESORT: Self-hosted Redlib instance (port 8281, often blocked by Reddit CDN)
 *
 * With OAuth2 configured (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME,
 * REDDIT_PASSWORD) we get 600 requests per 10 minutes vs 60 unauthenticated.
 * See reddit-auth.ts for OAuth token management.
 *
 * To set up: https://www.reddit.com/prefs/apps → Create "script" app
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';
import { getRedditOAuth } from './reddit-auth';

const $fetch = globalThis.fetch;

const REDDIT_RSS = 'https://www.reddit.com';

/** Crypto/tech subreddits ranked by relevance */
const SUBREDDITS = [
  'CryptoCurrency',
  'Bitcoin',
  'ethereum',
  'solana',
  'CryptoMarkets',
  'defi',
  'ethfinance',
  'NFT',
  'Layer2',
  'web3',
  'programming',
  'rust',
  'MachineLearning',
  'artificial',
  'LocalLLaMA',
  'ChatGPT',
  'opensource',
  'startups',
  'stocks',
  'investing',
  'economics',
  'finance',
  'technology',
  'science',
  'space',
  'Futurology',
  'WallStreetBetsCrypto',
  'CryptoTechnology',
];

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
        console.log(`[bridge] Reddit OAuth: rate limited on r/${subreddit}`);
      } else if (res?.status === 403) {
        console.log(`[bridge] Reddit OAuth: forbidden on r/${subreddit} (private?)`);
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
        console.log(`[bridge] Reddit JSON: rate limited on r/${subreddit}`);
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
  // Reddit unauthenticated limit: ~60 requests/10 min per IP. Keep our own
  // in-process budget far below that so bursts don't trip Reddit's CDN.
  if (!checkRateLimit('reddit', { maxRequests: 20, windowMs: 600_000 })) {
    console.log('[reddit] Rate limited, skipping fetch');
    return [];
  }
  const all: UnifiedPost[] = [];
  let oauthCount = 0;
  let jsonCount = 0;
  let rssCount = 0;
  let redlibCount = 0;

  const hasOAuth = getRedditOAuth().isConfigured;

  // PRIMARY: RSS feeds — the only strategy verified working from this host.
  // Keep the request count LOW: one subreddit usually satisfies small limits,
  // and each call is wrapped in buildFeed's 5s timeout, so we must return fast.
  const rssSubs = ['CryptoCurrency', 'Bitcoin', 'ethereum'];
  const perSubRss = Math.max(2, Math.ceil(limit / rssSubs.length));
  for (const sub of rssSubs) {
    try {
      const posts = await fetchFromRedditRss(sub, perSubRss);
      all.push(...posts);
      rssCount += posts.length;
      if (all.length >= limit) break;
      // Space out requests — Reddit 429s bursts from a single IP.
      await new Promise((r) => setTimeout(r, 400));
    } catch {
      // continue to next subreddit
    }
  }

  // SECONDARY: OAuth2-authenticated JSON API (600 req/10min, no delays needed)
  if (hasOAuth && all.length < limit) {
    for (const sub of SUBREDDITS.slice(0, 4)) {
      try {
        const perSub = Math.max(2, Math.ceil((limit - all.length) / 2));
        const posts = await fetchFromRedditOAuth(sub, perSub);
        all.push(...posts);
        oauthCount += posts.length;
        if (all.length >= limit) break;
      } catch {
        // continue to next subreddit
      }
    }
  }

  // TERTIARY: Unauthenticated JSON API (usually CDN-blocked; quick attempt
  // only when RSS returned nothing at all).
  if (!hasOAuth && all.length === 0) {
    try {
      await new Promise((r) => setTimeout(r, 300));
      const posts = await fetchFromRedditJson('CryptoCurrency', perSubRss);
      all.push(...posts);
      jsonCount += posts.length;
    } catch {
      // continue
    }
  }

  // LAST RESORT: Redlib (often blocked by Reddit CDN, but local + free)
  if (all.length === 0) {
    try {
      const posts = await fetchFromRedlib('CryptoCurrency', perSubRss);
      all.push(...posts);
      redlibCount += posts.length;
    } catch {
      // continue
    }
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

  const authMode = hasOAuth ? 'oauth' : 'unauthenticated';
  console.log(
    `[bridge] Reddit: ${deduped.length} posts [${authMode}] (rss: ${rssCount}, oauth: ${oauthCount}, json: ${jsonCount}, redlib: ${redlibCount}, total raw: ${all.length})`,
  );
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchRedditPosts;
