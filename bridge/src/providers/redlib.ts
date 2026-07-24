/**
 * Reddit Provider
 *
 * Fetches Reddit content via multiple strategies:
 * 1. PRIMARY: Direct Reddit JSON API (rate-limited, 800ms delay between requests)
 * 2. FALLBACK: Reddit RSS feeds (works when JSON API is blocked)
 * 3. LAST RESORT: Self-hosted Redlib instance (port 8281, often blocked by Reddit CDN)
 *
 * Reddit aggressively blocks unauthenticated requests at their CDN level.
 * Long-term fix: register Reddit OAuth2 app for authenticated API access.
 */

import type { UnifiedPost } from '../server';

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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessNiches(text: string, subreddit: string): string[] {
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
  if (/\b(meme|pepe|dog|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
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

async function fetchFromRedlib(_subreddit: string, _limit: number): Promise<UnifiedPost[]> {
  // Redlib is unreliable due to Reddit rate-limiting. Use direct Reddit JSON API instead.
  return [];
}

// ─── Fallback: Reddit RSS feeds ──────────────────────────────────────

async function fetchFromRedditRss(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(
      `${REDDIT_RSS}/r/${encodeURIComponent(subreddit)}/hot/.rss?limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DegenFeed-Bridge/0.1; +https://degenfeed.xyz)',
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, subreddit, limit);
  } catch {
    return [];
  }
}

function parseRssXml(xml: string, subreddit: string, limit: number): UnifiedPost[] {
  const posts: UnifiedPost[] = [];
  let index = 0;

  // Try Atom format first (<entry>)
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = entryRe.exec(xml)) !== null && posts.length < limit) {
    const e = m[1];
    const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
    const updatedMatch = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const _contentMatch =
      e.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ||
      e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
    if (!title) continue;
    const link = linkMatch ? linkMatch[1] : '';

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
      createdAt: updatedMatch ? new Date(updatedMatch[1]).getTime() : Date.now() - index * 600000,
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
      const e = m[1];
      const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
      if (!title) continue;
      const link = linkMatch ? stripHtml(linkMatch[1]) : '';

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

// ─── Fallback: Direct Reddit JSON API ────────────────────────────────

async function fetchFromRedditJson(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${REDDIT_RSS}/r/${encodeURIComponent(subreddit)}/hot.json?limit=${Math.min(limit, 25)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'web:DegenFeed-Bridge:v0.2.0 (by /u/degenfeed)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
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
        const _permalink = (d.permalink as string) || '';
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

export async function fetchRedditPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSub = Math.max(2, Math.ceil(limit / SUBREDDITS.length));
  const all: UnifiedPost[] = [];
  let jsonCount = 0;
  let rssCount = 0;

  // PRIMARY: Direct Reddit JSON API (most reliable)
  for (const sub of SUBREDDITS.slice(0, 5)) {
    try {
      await new Promise((r) => setTimeout(r, 800)); // 800ms delay to avoid rate limiting
      const posts = await fetchFromRedditJson(sub, perSub);
      all.push(...posts);
      jsonCount += posts.length;
      if (all.length >= limit) break;
    } catch {
      // continue to next subreddit
    }
  }

  // FALLBACK: Reddit RSS if JSON API returns too little
  if (all.length < 5) {
    for (const sub of SUBREDDITS.slice(0, 5)) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        const posts = await fetchFromRedditRss(sub, perSub);
        all.push(...posts);
        rssCount += posts.length;
        if (all.length >= limit) break;
      } catch {
        // continue
      }
    }
  }

  // LAST RESORT: Redlib (often blocked by Reddit)
  if (all.length < 3) {
    for (const sub of SUBREDDITS.slice(0, 3)) {
      try {
        const posts = await fetchFromRedlib(sub, perSub);
        all.push(...posts);
        if (all.length >= limit) break;
      } catch {
        // continue
      }
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

  console.log(
    `[bridge] Reddit: ${deduped.length} posts (json: ${jsonCount}, rss: ${rssCount}, total raw: ${all.length})`,
  );
  return deduped;
}
