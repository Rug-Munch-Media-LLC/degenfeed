/**
 * RedditProvider — Multi-strategy Reddit fetcher with weighted subreddits,
 * category tagging, and quality filtering.
 *
 * Reddit blocks direct API access from CF Workers (no auth, bad UA).
 * Strategy:
 *   1. Reddit's own RSS feeds at www.reddit.com/r/{sub}/.rss (public, needs proper UA)
 *   2. Open-source Reddit frontends: libreddit/teddit instances (CORS-friendly)
 *   3. JSON API at www.reddit.com with proper User-Agent
 *
 * All strategies set a browser-like User-Agent. RSS is preferred — it's
 * public, no auth, and parses cleanly.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  fetchJson,
  fetchRss,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RedditCategory = 'crypto' | 'defi' | 'chain' | 'nft' | 'trading' | 'web3';

export interface SubredditConfig {
  name: string;
  weight: number;
  category?: RedditCategory;
}

/** Quality metadata attached to post.raw for the enrichment pipeline */
interface PostQualityData {
  score: number;
  upvoteRatio?: number;
  isStickied?: boolean;
  selfText?: string;
  isSelf?: boolean;
}

// ─── Crypto / Web3 Subreddit Configs ────────────────────────────────────────
// Organized by category with engagement-based weighting.
// Higher-weight subs get more influence in the feed.

export const CRYPTO_SUBREDDIT_CONFIGS: SubredditConfig[] = [
  // ── Crypto General (high traffic) ────────────────────────────────
  { name: 'CryptoCurrency', weight: 1.0, category: 'crypto' },
  { name: 'Bitcoin', weight: 0.9, category: 'crypto' },
  { name: 'ethereum', weight: 0.9, category: 'crypto' },
  { name: 'CryptoMarkets', weight: 0.8, category: 'crypto' },
  { name: 'CryptoTechnology', weight: 0.7, category: 'crypto' },
  { name: 'cryptocurrencymemes', weight: 0.5, category: 'crypto' },
  { name: 'cryptomoonshots', weight: 0.3, category: 'crypto' },
  // ── Crypto General – expansion (2026-08-06) ────────────────────
  { name: 'altcoin', weight: 0.7, category: 'crypto' },
  { name: 'Litecoin', weight: 0.5, category: 'crypto' },
  { name: 'dogecoin', weight: 0.5, category: 'crypto' },
  { name: 'XRP', weight: 0.5, category: 'crypto' },
  { name: 'BitcoinCash', weight: 0.4, category: 'crypto' },
  { name: 'BitcoinMarkets', weight: 0.7, category: 'crypto' },
  { name: 'blockchain', weight: 0.6, category: 'crypto' },
  // ── Crypto General – sub-categories ──────────────────────────────
  { name: 'CryptoMemes', weight: 0.4, category: 'crypto' },
  { name: 'CryptoShitposting', weight: 0.3, category: 'crypto' },
  { name: 'BitcoinBeginners', weight: 0.5, category: 'crypto' },
  // Regional crypto communities
  { name: 'CryptoIndia', weight: 0.4, category: 'crypto' },
  { name: 'CryptoUK', weight: 0.4, category: 'crypto' },
  { name: 'CryptoAus', weight: 0.4, category: 'crypto' },
  { name: 'BitcoinCA', weight: 0.4, category: 'crypto' },
  { name: 'CryptoEurope', weight: 0.4, category: 'crypto' },
  { name: 'latinocrypto', weight: 0.4, category: 'crypto' },
  // Legacy subs folded in
  { name: 'btc', weight: 0.7, category: 'crypto' },
  { name: 'Crypto_General', weight: 0.6, category: 'crypto' },
  { name: 'BitcoinMining', weight: 0.4, category: 'crypto' },
  { name: 'cryptomining', weight: 0.3, category: 'crypto' },
  { name: 'cryptobounties', weight: 0.3, category: 'crypto' },

  // ── DeFi ─────────────────────────────────────────────────────────
  { name: 'defi', weight: 0.8, category: 'defi' },
  { name: 'ethfinance', weight: 0.7, category: 'defi' },
  { name: 'ethdev', weight: 0.7, category: 'defi' },
  { name: 'UniSwap', weight: 0.6, category: 'defi' },
  { name: 'aave', weight: 0.5, category: 'defi' },
  { name: 'curve', weight: 0.4, category: 'defi' },
  { name: 'defi_bluechips', weight: 0.5, category: 'defi' },
  { name: 'defi_yield', weight: 0.5, category: 'defi' },
  // ── DeFi Deep – sub-categories ──────────────────────────────────
  { name: 'liquiditymining', weight: 0.4, category: 'defi' },
  { name: 'defi_hacks', weight: 0.6, category: 'defi' },
  { name: 'defi_trading', weight: 0.5, category: 'defi' },
  { name: 'defi_education', weight: 0.5, category: 'defi' },
  { name: 'defi_news', weight: 0.5, category: 'defi' },
  { name: 'layer2', weight: 0.6, category: 'defi' },

  // ── Chain-specific ───────────────────────────────────────────────
  { name: 'solana', weight: 0.8, category: 'chain' },
  { name: 'Cardano', weight: 0.7, category: 'chain' },
  { name: 'Polkadot', weight: 0.6, category: 'chain' },
  { name: 'Avax', weight: 0.6, category: 'chain' },
  { name: 'cosmosnetwork', weight: 0.6, category: 'chain' },
  { name: 'ethtrader', weight: 0.5, category: 'chain' },
  { name: 'polygon', weight: 0.5, category: 'chain' },
  { name: 'optimism', weight: 0.5, category: 'chain' },
  // ── Chain-specific – expansion (2026-08-06) ────────────────────
  { name: 'Chainlink', weight: 0.6, category: 'chain' },
  { name: 'Monero', weight: 0.5, category: 'chain' },
  { name: 'Stellar', weight: 0.4, category: 'chain' },
  { name: 'base', weight: 0.5, category: 'chain' },
  { name: 'Injective', weight: 0.4, category: 'chain' },
  // ── Chain-specific – emerging L1s/L2s ───────────────────────────
  { name: 'Hedera', weight: 0.5, category: 'chain' },
  { name: 'Algorand', weight: 0.5, category: 'chain' },
  { name: 'Tezos', weight: 0.5, category: 'chain' },
  { name: 'NearProtocol', weight: 0.5, category: 'chain' },
  { name: 'Aptos', weight: 0.4, category: 'chain' },
  { name: 'Sui', weight: 0.4, category: 'chain' },
  { name: 'Arbitrum', weight: 0.6, category: 'chain' },
  { name: 'zkSync', weight: 0.5, category: 'chain' },

  // ── NFT / Gaming ─────────────────────────────────────────────────
  { name: 'NFT', weight: 0.6, category: 'nft' },
  { name: 'NFTs', weight: 0.6, category: 'nft' },
  { name: 'opensea', weight: 0.5, category: 'nft' },
  { name: 'NFTMarketplace', weight: 0.5, category: 'nft' },
  { name: 'ethgaming', weight: 0.5, category: 'nft' },
  { name: 'playtoearn', weight: 0.4, category: 'nft' },
  // ── NFT / Gaming – sub-categories ───────────────────────────────
  { name: 'NFTsMarketplace', weight: 0.5, category: 'nft' },
  { name: 'NFTCollect', weight: 0.4, category: 'nft' },
  { name: 'NFTArt', weight: 0.5, category: 'nft' },
  { name: 'NFTGaming', weight: 0.5, category: 'nft' },
  { name: 'NFTTickets', weight: 0.3, category: 'nft' },
  { name: 'NFTMusic', weight: 0.4, category: 'nft' },
  { name: 'NFTPhotography', weight: 0.3, category: 'nft' },
  { name: 'CollectibleAvatars', weight: 0.4, category: 'nft' },

  // ── Trading / Analysis ───────────────────────────────────────────
  { name: 'CryptoCurrencyTrading', weight: 0.6, category: 'trading' },
  { name: 'technicalanalysis', weight: 0.5, category: 'trading' },
  { name: 'CryptoCurrencies', weight: 0.7, category: 'trading' },
  { name: 'cryptotrader', weight: 0.4, category: 'trading' },
  { name: 'solanatrader', weight: 0.4, category: 'trading' },
  // ── Trading / TA – sub-categories ───────────────────────────────
  { name: 'Daytrading', weight: 0.6, category: 'trading' },
  { name: 'swingtrading', weight: 0.5, category: 'trading' },
  { name: 'algotrading', weight: 0.6, category: 'trading' },
  { name: 'forex', weight: 0.4, category: 'trading' },
  { name: 'OptionsTrading', weight: 0.5, category: 'trading' },
  { name: 'WallStreetBetsCrypto', weight: 0.4, category: 'trading' },
  { name: 'Trading', weight: 0.6, category: 'trading' },

  // ── Web3 ─────────────────────────────────────────────────────────
  { name: 'web3', weight: 0.7, category: 'web3' },
  { name: 'web3dev', weight: 0.5, category: 'web3' },
  { name: 'Metamask', weight: 0.5, category: 'web3' },
  { name: 'ledgerwallet', weight: 0.4, category: 'web3' },
  // ── Web3 / Tech – sub-categories ────────────────────────────────
  { name: 'solidity', weight: 0.6, category: 'web3' },
  { name: 'ethdevjobs', weight: 0.5, category: 'web3' },
  { name: 'dapps', weight: 0.5, category: 'web3' },
  { name: 'smartcontracts', weight: 0.6, category: 'web3' },
  { name: 'cryptodevs', weight: 0.6, category: 'web3' },
  { name: 'BlockchainStartups', weight: 0.5, category: 'web3' },
  { name: 'TokenEngineering', weight: 0.4, category: 'web3' },
  // ── Web3 – expansion (2026-08-06) ──────────────────────────────
  { name: 'EthereumDev', weight: 0.6, category: 'web3' },
  { name: 'solidity', weight: 0.6, category: 'web3' },
];

/**
 * ── Non-crypto legacy subreddits ───────────────────────────────
 * Kept for general tech/science/finance coverage. These get no
 * category tag and a neutral weight of 1.0.
 */
const LEGACY_SUBREDDITS: string[] = [
  // ── Tech / Programming ─────────────────────────────────────────
  'programming',
  'rust',
  'golang',
  'python',
  'typescript',
  'javascript',
  'MachineLearning',
  'artificial',
  'LocalLLaMA',
  'OpenAI',
  'ChatGPT',
  'stableDiffusion',
  'datascience',
  'learnmachinelearning',
  'computerscience',
  'cybersecurity',
  'netsec',
  'hacking',
  'ReverseEngineering',
  'devops',
  'kubernetes',
  'docker',
  'linux',
  'selfhosted',
  'homelab',
  // ── Science / Engineering ──────────────────────────────────────
  'science',
  'space',
  'physics',
  'Futurology',
  'singularity',
  'robotics',
  'energy',
  'nuclear',
  'climatescience',
  // ── Finance / Economics ────────────────────────────────────────
  'stocks',
  'investing',
  'wallstreetbets',
  'economics',
  'finance',
  'personalfinance',
  'quant',
  'algotrading',
  // ── Tech News / Discussion ─────────────────────────────────────
  'startups',
  'entrepreneur',
  'SideProject',
  'SaaS',
  'webdev',
  'frontend',
  'opensource',
  'github',
  // ── Tech / Programming – expansion (2026-08-06) ───────────────
  'technology',
  'ExperiencedDevs',
  'cscareerquestions',
  'learnprogramming',
  'reactjs',
  'vuejs',
  'node',
  'PostgreSQL',
  'SQL',
  'java',
  'cpp',
  'csharp',
  'coding',
  'compsci',
  'algorithms',
  'DataEngineering',
  'sysadmin',
  'HomeNetworking',
  'privacy',
  // ── Gaming – expansion (2026-08-06) ───────────────────────────
  'gaming',
  'pcgaming',
  'truegaming',
  'Games',
  'gamedev',
  'GameDeals',
  'patientgamers',
  // ── Science – expansion (2026-08-06) ──────────────────────────
  'askscience',
  'astronomy',
  'chemistry',
  'biology',
  'Physics',
  'engineering',
  'environment',
  'genetics',
  'neuroscience',
  // ── News – expansion (2026-08-06) ─────────────────────────────
  'worldnews',
  'news',
  'geopolitics',
  'politics',
  'economy',
  'business',
  // ── General – expansion (2026-08-06) ──────────────────────────
  'AskReddit',
  'interestingasfuck',
  'todayilearned',
  'dataisbeautiful',
  'aww',
  'funny',
  'mildlyinteresting',
  'UpliftingNews',
  'Damnthatsinteresting',
  'educationalgifs',
  'LifeProTips',
  'food',
  'travel',
  'history',
];

/**
 * Full default subreddit list — crypto configs + legacy non-crypto subs.
 * Built once at module load.
 */
function buildDefaultConfigs(): SubredditConfig[] {
  const cryptoNames = new Set(CRYPTO_SUBREDDIT_CONFIGS.map((c) => c.name.toLowerCase()));
  return [
    ...CRYPTO_SUBREDDIT_CONFIGS,
    ...LEGACY_SUBREDDITS.filter((name) => !cryptoNames.has(name.toLowerCase())).map((name) => ({
      name,
      weight: 1.0,
    })),
  ];
}

const DEFAULT_CONFIGS: SubredditConfig[] = buildDefaultConfigs();

/**
 * Backward-compatible string[] of default subreddit names.
 * Used by external consumers (rss.ts, communities.ts, discover.ts).
 */
export const DEFAULT_SUBREDDITS: string[] = DEFAULT_CONFIGS.map((c) => c.name);

// ─── Reddit Fetch Infrastructure ────────────────────────────────────────────

// Community-run Reddit frontends used as fallback when self-hosted Redlib
// is unreachable (e.g., from Cloudflare Workers if REDLIB_URL is not set).
const COMMUNITY_REDDIT_FRONTENDS = [
  'https://libreddit.kavin.rocks',
  'https://libreddit.privacydev.net',
  'https://lr.vern.cc',
  'https://red.ngn.tf',
];

// Reddit's own RSS feeds — these are public, no auth needed.
const REDDIT_RSS_BASE = 'https://www.reddit.com';

// OAuth API base — used when REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET
// are configured. The OAuth client-credentials flow gets ~100 QPM per
// client (vs ~10 QPM unauthenticated) and is NOT blocked from datacenter
// IPs the way www.reddit.com/.rss and .json are.
const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const REDDIT_OAUTH_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

/** Module-level OAuth token cache (Workers are per-isolate, so this survives warm isolates). */
let oauthTokenCache: { token: string; expiresAt: number } | null = null;

interface RedditOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Fetch a client-credentials OAuth token for Reddit's API. Caches the
 * token until 60s before it expires. Returns null when credentials are
 * missing or the token endpoint rejects us (so callers fall back to RSS).
 */
async function getRedditOAuthToken(
  clientId: string | undefined,
  clientSecret: string | undefined,
): Promise<string | null> {
  if (!clientId || !clientSecret) return null;
  if (oauthTokenCache && Date.now() < oauthTokenCache.expiresAt) {
    return oauthTokenCache.token;
  }
  try {
    const basic = btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`);
    const res = await fetch(REDDIT_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/1.0; +https://degenfeed.xyz)',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      console.warn(`[reddit] OAuth token request failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as RedditOAuthToken;
    if (!data.access_token) {
      console.warn('[reddit] OAuth token response missing access_token');
      return null;
    }
    oauthTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in > 0 ? data.expires_in : 3600) * 1000 - 60000,
    };
    return oauthTokenCache.token;
  } catch (err) {
    console.warn(
      '[reddit] OAuth token fetch failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function redditHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/1.0; +https://degenfeed.xyz)',
    accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  contentSnippet?: string;
  author?: string;
  categories?: string[];
}

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);
  while (m !== null) {
    const entryXml = m[2] ?? '';
    const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["']/i);
    const pubDateMatch =
      entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ??
      entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
    const contentMatch =
      entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ??
      entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (titleMatch && linkMatch) {
      items.push({
        title: stripHtml(titleMatch[1] ?? ''),
        link: linkMatch[1] ?? '',
        pubDate: pubDateMatch?.[1]?.trim(),
        description: stripHtml(contentMatch?.[1] ?? ''),
        content: contentMatch?.[1] ?? '',
      });
    }
    m = itemRe.exec(xml);
  }

  if (items.length === 0) {
    const rssItemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let rm: RegExpExecArray | null = rssItemRe.exec(xml);
    while (rm !== null) {
      const itemXml = rm[1] ?? '';
      const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      if (titleMatch && linkMatch) {
        items.push({
          title: stripHtml(titleMatch[1] ?? ''),
          link: stripHtml(linkMatch[1] ?? ''),
          pubDate: pubDateMatch?.[1]?.trim(),
          description: stripHtml(descMatch?.[1] ?? ''),
        });
      }
      rm = rssItemRe.exec(xml);
    }
  }

  return items;
}

interface RedditJsonPost {
  data: {
    title: string;
    permalink: string;
    url: string;
    created_utc: number;
    selftext?: string;
    author?: string;
    subreddit?: string;
    score?: number;
    num_comments?: number;
    /** Fraction 0.0–1.0; only available from JSON API */
    upvote_ratio?: number;
    /** True for moderator announcements */
    stickied?: boolean;
    /** True when post body is text (not a link) */
    is_self?: boolean;
  };
}

// ─── Quality Filter & Enrichment Pipeline ────────────────────────────────────

/**
 * Apply quality filters, weight score, and add category niche tags.
 *
 * Quality filter (applied only when quality data is available from JSON API):
 *   - Score < 5 → filtered out (low engagement)
 *   - Upvote ratio < 0.6 → filtered out (controversial/heavily downvoted)
 *   - Stickied → filtered out (mod announcements)
 *   - Self-post with body < 100 chars → filtered out (low effort)
 *
 * Weight: multiplied into the score so higher-quality subs get more influence.
 * Category: added as a niche tag for downstream ranking/surfacing.
 */
function enrichPost(post: UnifiedPost, config: SubredditConfig): UnifiedPost | null {
  const quality: PostQualityData | undefined = (post.raw as Record<string, unknown>)
    ?._redditQuality as PostQualityData | undefined;

  // ── Quality filters (only when we have JSON API quality data) ──
  if (quality) {
    // Score < 5 (low engagement)
    if (quality.score < 5) return null;
    // Upvote ratio < 0.6 (controversial)
    if (quality.upvoteRatio !== undefined && quality.upvoteRatio < 0.6) return null;
    // Pinned/stickied (mod announcements)
    if (quality.isStickied) return null;
    // Self-post with body < 100 chars (low effort)
    if (quality.isSelf && (!quality.selfText || quality.selfText.length < 100)) return null;
  }

  // ── Apply subreddit weight to score ──
  const weightedScore = Math.round((post.metrics?.likes ?? 0) * config.weight);

  // ── Build category niche tags ──
  const categoryTags: string[] = [];
  if (config.category) {
    categoryTags.push(config.category);
  }

  return {
    ...post,
    metrics: {
      ...post.metrics,
      likes: weightedScore,
    },
    engagement: {
      ...post.engagement,
      raw: {
        ...post.engagement.raw,
        likes: weightedScore,
      },
    },
    niches: [...new Set([...(post.niches ?? []), ...categoryTags])],
  };
}

// ─── Post Construction ───────────────────────────────────────────────────────

function itemToUnifiedPost(item: RssItem, subreddit: string, score = 0, comments = 0): UnifiedPost {
  const text = item.contentSnippet || item.description || item.title || '';
  const author: UnifiedIdentity = {
    id: `reddit:r:${subreddit}`,
    primary: { protocol: 'reddit' as Protocol, id: subreddit },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: `r/${subreddit}`,
    bio: item.author ? `Posted by u/${item.author}` : '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'subreddit', url: `https://www.reddit.com/r/${subreddit}` }],
    keys: {},
  };

  const id = item.link
    ? `reddit:${subreddit}:${item.link.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}`
    : `reddit:${subreddit}:${Date.now()}`;

  return {
    id,
    protocol: 'reddit' as Protocol,
    author,
    text: `${item.title ?? ''}\n\n${text}`.slice(0, 1500),
    embeds: item.link ? [{ kind: 'link', url: item.link }] : [],
    createdAt: parseDate(item.pubDate),
    metrics: { likes: score, reposts: 0, replies: comments, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: score, reposts: 0, replies: comments, quotes: 0 },
    },
    raw: item,
    niches: detectNiches(`${item.title ?? ''} ${text} r/${subreddit}`),
  };
}

interface FrontendListing {
  posts: Array<{
    title?: string;
    url?: string;
    permalink?: string;
    selftext?: string;
    author?: string;
    subreddit?: string;
    score?: number;
    num_comments?: number;
    created?: number;
    created_utc?: number;
  }>;
}

// ─── Strategy Implementations ────────────────────────────────────────────────

/**
 * Strategy 1: Open-source Reddit frontends (libreddit, teddit).
 * These are community-run instances that proxy Reddit's API without auth.
 * Returns JSON with post data.
 */
async function fetchFromFrontend(
  frontend: string,
  subreddit: string,
  sort: string,
  limit: number,
): Promise<UnifiedPost[]> {
  const path = sort === 'hot' ? '' : sort === 'new' ? '/new' : sort === 'top' ? '/top' : '';
  const url = `${frontend}/r/${encodeURIComponent(subreddit)}${path}.json?limit=${Math.min(limit, 50)}`;
  const data = await fetchJson<FrontendListing>(url, { headers: redditHeaders() });
  return (data.posts ?? []).map((p) => {
    const sub = p.subreddit ?? subreddit;
    const link = p.permalink
      ? p.permalink.startsWith('http')
        ? p.permalink
        : `${frontend}${p.permalink}`
      : (p.url ?? `https://www.reddit.com/r/${sub}`);
    const item: RssItem = {
      title: p.title,
      link,
      contentSnippet: p.selftext,
      author: p.author,
    };
    const post = itemToUnifiedPost(item, sub, p.score ?? 0, p.num_comments ?? 0);
    post.createdAt = (p.created_utc ?? p.created ?? Date.now() / 1000) * 1000;

    // Attach partial quality data (frontends usually don't provide upvote_ratio or stickied)
    (post.raw as Record<string, unknown>)._redditQuality = {
      score: p.score ?? 0,
      isSelf: !!p.selftext,
      selfText: p.selftext,
    } satisfies PostQualityData;

    return post;
  });
}

/**
 * Strategy 2: Reddit's own JSON API with proper User-Agent.
 * www.reddit.com serves JSON if you send a browser-like User-Agent.
 * This is the richest data source — provides upvote ratio, stickied status, etc.
 */
async function fetchFromRedditJson(
  subreddit: string,
  sort: string,
  limit: number,
): Promise<UnifiedPost[]> {
  const sortPath = sort === 'new' ? 'new' : sort === 'top' ? 'top' : 'hot';
  const url = buildUrl(REDDIT_RSS_BASE, `/r/${encodeURIComponent(subreddit)}/${sortPath}.json`, {
    limit: String(Math.min(limit, 50)),
  });
  const data = await fetchJson<{ data?: { children?: RedditJsonPost[] } }>(url, {
    headers: redditHeaders(),
  });
  return (data.data?.children ?? []).map((child) => {
    const d = child.data;
    const sub = d.subreddit ?? subreddit;
    const link = d.url?.startsWith('/r/') ? `https://www.reddit.com${d.url}` : d.url;
    const item: RssItem = {
      title: d.title,
      link: `https://www.reddit.com${d.permalink}`,
      contentSnippet: d.selftext,
      author: d.author,
    };
    const post = itemToUnifiedPost(item, sub, d.score ?? 0, d.num_comments ?? 0);
    if (link) post.embeds.unshift({ kind: 'link', url: link });
    post.createdAt = d.created_utc * 1000;

    // Attach full quality data from JSON API
    (post.raw as Record<string, unknown>)._redditQuality = {
      score: d.score ?? 0,
      upvoteRatio: d.upvote_ratio,
      isStickied: d.stickied ?? false,
      selfText: d.selftext,
      isSelf: d.is_self ?? false,
    } satisfies PostQualityData;

    return post;
  });
}

/**
 * Strategy 1.5: Reddit's OAuth JSON API (oauth.reddit.com).
 * Requires client credentials. Gets ~100 QPM per client and is not
 * blocked from datacenter IPs the way www.reddit.com is. This is the
 * preferred strategy when credentials are configured.
 */
async function fetchFromOAuthJson(
  subreddit: string,
  sort: string,
  limit: number,
  token: string,
): Promise<UnifiedPost[]> {
  const sortPath = sort === 'new' ? 'new' : sort === 'top' ? 'top' : 'hot';
  const url = buildUrl(REDDIT_OAUTH_BASE, `/r/${encodeURIComponent(subreddit)}/${sortPath}`, {
    limit: String(Math.min(limit, 50)),
    raw_json: '1',
  });
  const data = await fetchJson<{ data?: { children?: RedditJsonPost[] } }>(url, {
    headers: redditHeaders(token),
  });
  return (data.data?.children ?? []).map((child) => {
    const d = child.data;
    const sub = d.subreddit ?? subreddit;
    const link = d.url?.startsWith('/r/') ? `https://www.reddit.com${d.url}` : d.url;
    const item: RssItem = {
      title: d.title,
      link: `https://www.reddit.com${d.permalink}`,
      contentSnippet: d.selftext,
      author: d.author,
    };
    const post = itemToUnifiedPost(item, sub, d.score ?? 0, d.num_comments ?? 0);
    if (link) post.embeds.unshift({ kind: 'link', url: link });
    post.createdAt = d.created_utc * 1000;

    // Attach full quality data from JSON API
    (post.raw as Record<string, unknown>)._redditQuality = {
      score: d.score ?? 0,
      upvoteRatio: d.upvote_ratio,
      isStickied: d.stickied ?? false,
      selfText: d.selftext,
      isSelf: d.is_self ?? false,
    } satisfies PostQualityData;

    return post;
  });
}

/**
 * Strategy 3: Reddit's own RSS feed at www.reddit.com.
 * Public, no auth, parses cleanly. Does NOT include score or metadata,
 * so quality filtering is bypassed for RSS-sourced posts.
 */
async function fetchFromRedditRss(
  subreddit: string,
  sort: string,
  limit: number,
): Promise<UnifiedPost[]> {
  const sortPath = sort === 'new' ? 'new' : sort === 'top' ? 'top' : 'hot';
  const xml = await fetchRss(
    `${REDDIT_RSS_BASE}/r/${encodeURIComponent(subreddit)}/${sortPath}/.rss?limit=${Math.min(limit, 50)}`,
    { headers: redditHeaders() },
  );
  // RSS has no quality data — posts pass through unfiltered
  return parseRssXml(xml).map((item) => itemToUnifiedPost(item, subreddit));
}

/**
 * Fetch from a single subreddit using strategies in priority order.
 * RSS first (no auth, works from datacenter IPs), then JSON API, then
 * community frontends. Strategies run SEQUENTIALLY — firing them all in
 * parallel multiplied requests per subreddit by 4-6x and instantly tripped
 * Reddit's per-IP rate limiter, which is what made "all strategies fail".
 */
async function fetchSubreddit(
  config: SubredditConfig,
  sort: string,
  limit: number,
  timeoutMs: number,
  frontends: string[],
  oauthToken?: string | null,
): Promise<UnifiedPost[]> {
  const { name: subreddit } = config;

  const strategies: Array<{ name: string; fn: () => Promise<UnifiedPost[]> }> = [];
  // OAuth first — best rate limits, not blocked from datacenter IPs.
  if (oauthToken) {
    strategies.push({
      name: 'oauth-json',
      fn: () => fetchFromOAuthJson(subreddit, sort, limit, oauthToken as string),
    });
  }
  strategies.push(
    { name: 'rss', fn: () => fetchFromRedditRss(subreddit, sort, limit) },
    { name: 'json', fn: () => fetchFromRedditJson(subreddit, sort, limit) },
    ...frontends.map((frontend) => ({
      name: `frontend:${frontend}`,
      fn: () => fetchFromFrontend(frontend, subreddit, sort, limit),
    })),
  );

  // Run strategies in order and return the first non-empty result.
  // Sequential execution keeps per-IP request volume low enough to avoid
  // Reddit's CDN rate limiting.
  for (const strategy of strategies) {
    try {
      const posts = await withTimeout(strategy.fn(), timeoutMs, `reddit:${strategy.name}`);
      if (posts.length === 0) continue;
      // Apply enrichPost to every post (quality filter + weight + category tags)
      const enriched = posts
        .map((post) => enrichPost(post, config))
        .filter((post): post is UnifiedPost => post !== null);
      if (enriched.length > 0) return enriched;
    } catch {
      // try next strategy
    }
    // Small spacing between strategies to stay under per-IP rate limits.
    await new Promise((r) => setTimeout(r, 250));
  }
  return [];
}

// ─── Provider Class ──────────────────────────────────────────────────────────

export interface RedditProviderOptions {
  /** Subreddits to fetch. Accepts names (string) or full SubredditConfig objects. */
  subreddits?: (string | SubredditConfig)[];
  sort?: 'hot' | 'new' | 'top';
  /** Base URL of a self-hosted Redlib instance (e.g. https://redlib.degenfeed.xyz) */
  redlibUrl?: string;
  /** Reddit OAuth app credentials (client_credentials flow). Optional — RSS fallback used when absent. */
  clientId?: string;
  clientSecret?: string;
}

export class RedditProvider implements FeedProvider {
  readonly protocol: Protocol = 'reddit';

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly configs: SubredditConfig[];
  private readonly sort: 'hot' | 'new' | 'top';
  private readonly frontends: string[];
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly breaker = new CircuitBreaker('reddit');

  constructor(options: RedditProviderOptions = {}) {
    const raw = options.subreddits ?? DEFAULT_CONFIGS;
    this.configs = raw.map((entry) =>
      typeof entry === 'string' ? { name: entry, weight: 1.0 } : entry,
    );
    this.sort = options.sort ?? 'hot';
    const selfHostedRedlib = options.redlibUrl ?? 'http://127.0.0.1:8281';
    this.frontends = [selfHostedRedlib, ...COMMUNITY_REDDIT_FRONTENDS];
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        // Internal target: 50-100 posts per request. Raised from 25
        // (2026-08-06). The feed fetcher doesn't pass limit directly, so
        // we default internally and the route slices to the request limit.
        const limit = 100;

        // OAuth path: fewer subreddits with a bigger per-sub slice so the
        // whole fetch fits in the request budget (10s provider timeout).
        // Unauthenticated path: more subreddits, 3 per sub (quality headroom).
        let oauthToken: string | null = null;
        if (this.clientId && this.clientSecret) {
          oauthToken = await getRedditOAuthToken(this.clientId, this.clientSecret);
        }

        const subsToFetch = oauthToken ? this.configs.slice(0, 20) : this.configs;
        const capSubs = Math.min(subsToFetch.length, oauthToken ? 20 : 50);
        const perSub = oauthToken
          ? Math.max(5, Math.ceil(limit / capSubs))
          : Math.max(3, Math.ceil(limit / capSubs));
        const concurrency = oauthToken ? 5 : 4;

        const results = await withConcurrencyLimit(
          subsToFetch.slice(0, capSubs),
          concurrency,
          async (config) => {
            try {
              return await fetchSubreddit(
                config,
                this.sort,
                perSub,
                timeoutMs,
                this.frontends,
                oauthToken,
              );
            } catch {
              return [] as UnifiedPost[];
            }
          },
        );

        const posts = results.flat().slice(0, limit);
        if (posts.length > 0) return { posts };
        return { posts: [], notice: 'Reddit feed unavailable — all strategies failed' };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Reddit: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Reddit feed unavailable — all strategies failed' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      // Prefer OAuth health probe when credentials are configured.
      if (this.clientId && this.clientSecret) {
        const token = await getRedditOAuthToken(this.clientId, this.clientSecret);
        if (token) {
          const data = await withTimeout(
            fetchJson<{ data?: { children?: RedditJsonPost[] } }>(
              buildUrl(REDDIT_OAUTH_BASE, '/r/Bitcoin/hot', { limit: '1', raw_json: '1' }),
              { headers: redditHeaders(token) },
            ),
            opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            'reddit:health',
          );
          if ((data.data?.children?.length ?? 0) > 0) {
            return { healthy: true, latencyMs: Date.now() - start };
          }
          return { healthy: false, latencyMs: Date.now() - start, error: 'empty response' };
        }
      }
      const xml = await withTimeout(
        fetchRss(`${REDDIT_RSS_BASE}/r/Bitcoin/hot/.rss?limit=1`, { headers: redditHeaders() }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'reddit:health',
      );
      if (xml && xml.length > 50) {
        return { healthy: true, latencyMs: Date.now() - start };
      }
      return { healthy: false, latencyMs: Date.now() - start, error: 'empty response' };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
