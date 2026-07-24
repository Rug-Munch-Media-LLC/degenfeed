/**
 * DegenFeed Local API Bridge
 *
 * Lightweight server replacing the Cloudflare Worker for local development.
 * Listens on port 8787 and implements the key API endpoints the frontend needs.
 *
 * Data sources:
 *   - GoToSocial (port 8082, Mastodon API) — needs user OAuth, limited
 *   - Redlib (port 8281, Reddit proxy) — HTML extraction
 *   - RSS-Bridge (port 8282) — bridge not configured
 *   - Fallback: well-formed mock posts with recognizable content
 */

import http from 'node:http';

// ─── Constants ─────────────────────────────────────────────────────────

const PORT = parseInt(process.env.BRIDGE_PORT || '8787', 10);
const GTS_BASE = 'http://127.0.0.1:8082';
const REDLIB_BASE = 'http://127.0.0.1:8281';
const _RSS_BRIDGE_BASE = 'http://127.0.0.1:8282';

// GTS app credentials — injected via .env (see .env.example)
const GTS_CLIENT_ID = process.env.GTS_CLIENT_ID || '';
const GTS_CLIENT_SECRET = process.env.GTS_CLIENT_SECRET || '';

// ─── Types (mirror UnifiedPost shape) ──────────────────────────────────

interface UnifiedIdentity {
  id: string;
  primary: { protocol: string; id: string };
  handles: Record<string, string | null>;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  keys: Record<string, string | undefined>;
}

interface UnifiedPost {
  id: string;
  protocol: string;
  author: UnifiedIdentity;
  text: string;
  html?: string;
  embeds: { kind: string; url: string; meta?: Record<string, unknown> }[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number; views?: number };
  engagement: {
    viewerLiked: boolean;
    viewerReposted: boolean;
    viewerBookmarked: boolean;
    raw: { likes: number; reposts: number; replies: number; quotes: number };
  };
  raw: unknown;
  niches: string[];
}

// ─── GTS Auth ──────────────────────────────────────────────────────────

let gtsToken: string | null = null;

async function getGtsToken(): Promise<string | null> {
  if (gtsToken) return gtsToken;
  try {
    const res = await fetch(`${GTS_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GTS_CLIENT_ID,
        client_secret: GTS_CLIENT_SECRET,
        grant_type: 'client_credentials',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'read:statuses read:accounts',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    gtsToken = data.access_token ?? null;
    return gtsToken;
  } catch {
    return null;
  }
}

// ─── Data Sources ──────────────────────────────────────────────────────

/** Fetch posts from GoToSocial (Mastodon-compatible API) */
async function fetchGtsPosts(limit = 20): Promise<UnifiedPost[]> {
  const token = await getGtsToken();
  if (!token) return [];

  try {
    // GTS needs user-level OAuth for timeline — try the federated timeline
    const res = await fetch(`${GTS_BASE}/api/v1/timelines/public?local=true&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[bridge] GTS returned ${res.status}`);
      return [];
    }
    const raw = (await res.json()) as Array<Record<string, unknown>>;
    return raw.map((s) => gtsPostToUnified(s));
  } catch (err) {
    console.warn('[bridge] GTS fetch error:', err);
    return [];
  }
}

function gtsPostToUnified(s: Record<string, unknown>): UnifiedPost {
  const acct = (s.account as Record<string, unknown>) || {};
  const content = (s.content as string) || '';
  const createdAt = new Date(s.created_at as string).getTime();
  const id = `mastodon:${s.id}`;

  return {
    id,
    protocol: 'mastodon',
    author: {
      id: `mastodon:${acct.id}`,
      primary: { protocol: 'mastodon', id: acct.id as string },
      handles: { mastodon: acct.acct as string },
      displayName: (acct.display_name as string) || (acct.username as string) || 'Unknown',
      bio: (acct.note as string) || '',
      avatarUrl: (acct.avatar as string) || '',
      followerCount: (acct.followers_count as number) || 0,
      followingCount: (acct.following_count as number) || 0,
      links: [],
      keys: {},
    },
    text: stripHtml(content),
    html: content,
    embeds: [],
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: (s.favourites_count as number) || 0,
      reposts: (s.reblogs_count as number) || 0,
      replies: (s.replies_count as number) || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: (s.favourites_count as number) || 0,
        reposts: (s.reblogs_count as number) || 0,
        replies: (s.replies_count as number) || 0,
        quotes: 0,
      },
    },
    raw: s,
    niches: ['crypto', 'web3'],
  };
}

/** Scrape Redlib HTML for posts — Reddit content via proxy */
async function fetchRedlibPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(`${REDLIB_BASE}/r/all/hot`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseRedlibHtml(html, limit);
  } catch {
    return [];
  }
}

function parseRedlibHtml(html: string, limit: number): UnifiedPost[] {
  const posts: UnifiedPost[] = [];
  // Extract posts from Redlib HTML — look for article/post entries
  // Redlib uses a specific HTML structure with <a> tags containing titles
  const _titleRegex =
    /<a[^>]*class="[^"]*post_title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const _authorRegex = /<a[^>]*href="\/user\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const _scoreRegex = /<span[^>]*class="[^"]*score[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  const _commentRegex = /<a[^>]*href="[^"]*"[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  // Extract all articles
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;
  let index = 0;

  while ((articleMatch = articleRegex.exec(html)) !== null && posts.length < limit) {
    const articleHtml = articleMatch[1];

    // Extract title
    const titleMatch = /<a[^>]*class="[^"]*post_title[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(
      articleHtml,
    );
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

    // Extract author
    const authorMatch = /<a[^>]*href="\/user\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(articleHtml);
    const authorName = authorMatch ? stripHtml(authorMatch[2]).trim() : `redditor_${index}`;
    const authorId = authorMatch ? authorMatch[1] : `unknown_${index}`;

    // Extract subreddit
    const subMatch = /<a[^>]*href="\/r\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(articleHtml);
    const subreddit = subMatch ? subMatch[1] : 'all';

    // Extract score
    const scoreMatch = /(?:↑|score["> ]+)([0-9,.KM]+)/i.exec(articleHtml);
    const score = scoreMatch ? parseCount(scoreMatch[1]) : 0;

    // Extract comment count
    const commentCountMatch = /([0-9,.KM]+)\s*(?:comment|reply)/i.exec(articleHtml);
    const commentCount = commentCountMatch ? parseCount(commentCountMatch[1]) : 0;

    // Extract link
    const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>/i.exec(articleHtml);
    const link = linkMatch ? linkMatch[1] : '';

    if (title) {
      // Remove flair prefixes like "[Meta] " or "Daily Discussion "
      const cleanTitle = title.replace(/^\[[^\]]*\]\s*/, '').trim();
      if (cleanTitle) {
        posts.push({
          id: `reddit:${index}_${Date.now()}`,
          protocol: 'reddit',
          author: {
            id: `reddit:${authorId}`,
            primary: { protocol: 'reddit', id: authorId },
            handles: { reddit: `u/${authorId}` },
            displayName: authorName,
            bio: `Reddit user on r/${subreddit}`,
            avatarUrl: `https://www.redditstatic.com/avatars/avatar_${(index % 10) + 1}.png`,
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: cleanTitle,
          embeds: link ? [{ kind: 'link', url: `https://reddit.com${link}` }] : [],
          createdAt: Date.now() - index * 900000, // Stagger by 15min each
          metrics: {
            likes: score,
            reposts: 0,
            replies: commentCount,
            quotes: 0,
          },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: score, reposts: 0, replies: commentCount, quotes: 0 },
          },
          raw: {},
          niches: guessNiches(cleanTitle),
        });
      }
    }
    index++;
  }
  return posts;
}

// ─── Fallback mock data ────────────────────────────────────────────────

const FALLBACK_POSTS: UnifiedPost[] = [
  {
    id: 'fallback:1',
    protocol: 'farcaster',
    author: {
      id: 'farcaster:1',
      primary: { protocol: 'farcaster', id: '1' },
      handles: { farcaster: 'cryptoan@fcast' },
      displayName: 'Crypto Analyst',
      bio: 'Web3 analyst. DeFi, L2s, market structure.',
      avatarUrl: '',
      followerCount: 12500,
      followingCount: 340,
      links: [],
      keys: {},
    },
    text: 'Bitcoin dominance is at 58% — alt season incoming? 🚀 The rotation from BTC to alts historically happens when BTC dominance peaks. Keep an eye on ETH/BTC ratio.',
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 234, reposts: 56, replies: 42, quotes: 12 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 234, reposts: 56, replies: 42, quotes: 12 },
    },
    raw: {},
    niches: ['crypto', 'trading'],
  },
  {
    id: 'fallback:2',
    protocol: 'nostr',
    author: {
      id: 'nostr:2',
      primary: { protocol: 'nostr', id: '2' },
      handles: { nostr: 'l2res@nostr' },
      displayName: 'L2 Researcher',
      bio: 'Layer 2 scaling research. Optimism, Arbitrum, Base.',
      avatarUrl: '',
      followerCount: 8900,
      followingCount: 210,
      links: [],
      keys: {},
    },
    text: 'Just published my research on L2 scaling solutions. TL;DR: Arbitrum leads in TVL, Base in daily active users, Optimism in developer activity.',
    embeds: [],
    createdAt: Date.now() - 7200000,
    metrics: { likes: 189, reposts: 43, replies: 28, quotes: 8 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 189, reposts: 43, replies: 28, quotes: 8 },
    },
    raw: {},
    niches: ['crypto', 'layer2'],
  },
  {
    id: 'fallback:3',
    protocol: 'bluesky',
    author: {
      id: 'bluesky:3',
      primary: { protocol: 'bluesky', id: '3' },
      handles: { bluesky: 'macroden.bsky.social' },
      displayName: 'Macro Degen',
      bio: 'Macro analysis for crypto. Fed watcher.',
      avatarUrl: '',
      followerCount: 15200,
      followingCount: 480,
      links: [],
      keys: {},
    },
    text: "The Fed pivot narrative is real. Rate cuts = liquidity injection = crypto pumps. History doesn't repeat but it often rhymes. 📈",
    embeds: [],
    createdAt: Date.now() - 14400000,
    metrics: { likes: 312, reposts: 67, replies: 89, quotes: 23 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 312, reposts: 67, replies: 89, quotes: 23 },
    },
    raw: {},
    niches: ['crypto', 'macro'],
  },
  {
    id: 'fallback:4',
    protocol: 'mastodon',
    author: {
      id: 'mastodon:4',
      primary: { protocol: 'mastodon', id: '4' },
      handles: { mastodon: 'dcabot@social.degenfeed.xyz' },
      displayName: 'DCA Bot',
      bio: 'Automated DCA. Stacking sats daily.',
      avatarUrl: '',
      followerCount: 3400,
      followingCount: 120,
      links: [],
      keys: {},
    },
    text: 'Daily DCA thread for July 23, 2026. Stacking sats: 0.001 BTC, 0.1 ETH, 50 SOL. What are you buying today?',
    embeds: [],
    createdAt: Date.now() - 28800000,
    metrics: { likes: 89, reposts: 34, replies: 15, quotes: 3 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 89, reposts: 34, replies: 15, quotes: 3 },
    },
    raw: {},
    niches: ['crypto', 'trading'],
  },
  {
    id: 'fallback:5',
    protocol: 'lemmy',
    author: {
      id: 'lemmy:5',
      primary: { protocol: 'lemmy', id: '5' },
      handles: { lemmy: 'stablemax@lemmy.world' },
      displayName: 'Stablecoin Maxi',
      bio: 'Stablecoin research. USDC, USDT, DAI.',
      avatarUrl: '',
      followerCount: 5600,
      followingCount: 190,
      links: [],
      keys: {},
    },
    text: "Hot take: USDC is more decentralized than most people think. Circle's multi-chain strategy and Basel III compliance actually matter.",
    embeds: [],
    createdAt: Date.now() - 43200000,
    metrics: { likes: 156, reposts: 89, replies: 67, quotes: 14 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 156, reposts: 89, replies: 67, quotes: 14 },
    },
    raw: {},
    niches: ['crypto', 'stablecoins'],
  },
  {
    id: 'fallback:6',
    protocol: 'rss',
    author: {
      id: 'rss:6',
      primary: { protocol: 'rss', id: '6' },
      handles: { rss: 'coindesk' },
      displayName: 'CoinDesk',
      bio: 'Leading crypto news outlet.',
      avatarUrl: '',
      followerCount: 250000,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: 'Solana (SOL) surged past $300 for the first time, marking a new all-time high as institutional inflows accelerate and ecosystem activity reaches record levels.',
    embeds: [{ kind: 'link', url: 'https://coindesk.com/solana-ath' }],
    createdAt: Date.now() - 54000000,
    metrics: { likes: 1200, reposts: 450, replies: 234, quotes: 89 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 1200, reposts: 450, replies: 234, quotes: 89 },
    },
    raw: {},
    niches: ['crypto', 'solana'],
  },
  {
    id: 'fallback:7',
    protocol: 'farcaster',
    author: {
      id: 'farcaster:7',
      primary: { protocol: 'farcaster', id: '7' },
      handles: { farcaster: 'defiden@fcast' },
      displayName: 'DeFi Degen',
      bio: 'Yield farming, LPs, and DeFi alpha.',
      avatarUrl: '',
      followerCount: 22000,
      followingCount: 560,
      links: [],
      keys: {},
    },
    text: 'New Base native yield aggregator just launched. 15% APY on USDC deposits, audited by Trail of Bits. Early TVL is already $50M. Worth a look: app.base-yield.xyz',
    embeds: [],
    createdAt: Date.now() - 60000000,
    metrics: { likes: 445, reposts: 123, replies: 78, quotes: 25 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 445, reposts: 123, replies: 78, quotes: 25 },
    },
    raw: {},
    niches: ['crypto', 'defi', 'base'],
  },
  {
    id: 'fallback:8',
    protocol: 'reddit',
    author: {
      id: 'reddit:8',
      primary: { protocol: 'reddit', id: '8' },
      handles: { reddit: 'u/crypto_maxi' },
      displayName: 'CryptoMaxi',
      bio: 'Reddit crypto enthusiast',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: "What's everyone's thoughts on Ethereum Pectra upgrade? The EIP improvements look promising for L1 scalability. Discussion thread.",
    embeds: [{ kind: 'link', url: 'https://reddit.com/r/ethereum' }],
    createdAt: Date.now() - 72000000,
    metrics: { likes: 678, reposts: 0, replies: 234, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 678, reposts: 0, replies: 234, quotes: 0 },
    },
    raw: {},
    niches: ['crypto', 'ethereum'],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCount(s: string): number {
  s = s.replace(/,/g, '').trim();
  if (s.endsWith('K') || s.endsWith('k')) return Math.round(parseFloat(s) * 1000);
  if (s.endsWith('M') || s.endsWith('m')) return Math.round(parseFloat(s) * 1000000);
  return parseInt(s, 10) || 0;
}

function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|sec\.|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Feed Builder ──────────────────────────────────────────────────────

async function buildFeed(
  protocols: string[],
  limit: number,
): Promise<{ posts: UnifiedPost[]; meta: Record<string, unknown> }> {
  const promises: Promise<UnifiedPost[]>[] = [];

  // Try GTS (mastodon)
  if (protocols.includes('mastodon')) {
    promises.push(fetchGtsPosts(Math.ceil(limit / 3)));
  }

  // Try Redlib (reddit)
  if (protocols.includes('reddit')) {
    promises.push(fetchRedlibPosts(Math.ceil(limit / 3)));
  }

  const results = await Promise.allSettled(promises);
  const live: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      live.push(...r.value);
    }
  }

  // If we got live data, use it. Otherwise fallback to mock data.
  const posts = live.length >= 3 ? live : FALLBACK_POSTS;

  // Limit and deduplicate by text content
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of posts) {
    const key = p.text.slice(0, 80);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  // If we used fallback, mark it
  const source = live.length >= 3 ? 'live' : 'fallback';

  const perProtocol: Record<string, number> = {};
  for (const p of deduped) {
    perProtocol[p.protocol] = (perProtocol[p.protocol] || 0) + 1;
  }

  return {
    posts: deduped,
    meta: {
      total: deduped.length,
      limit,
      perProtocol,
      notices:
        source === 'fallback' ? ['Using demo data — connect social accounts for live feed'] : [],
      fetchedAt: Date.now(),
      source,
    },
  };
}

// ─── Preference defaults ──────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  hideLowQuality: false,
  hideLowQualityThreshold: 1.0,
  allowNonCrypto: false,
  recencyWeight: 1.0,
  engagementWeight: 1.0,
  showOriginalContent: false,
  minEngagement: 0,
  maxPerNiche: 5,
  topicWeights: { crypto: 100, defi: 90, nft: 50, ai: 70, solana: 60, ethereum: 80 },
  algorithmTransparent: false,
  freshnessPreference: 50,
  creatorDiversity: 5,
  exploreRatio: 30,
  activePreset: null,
  feedMixConfig: {
    sources: ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'rss'],
    contentTypes: { posts: 100, images: 40, videos: 20, links: 30, threads: 40 },
    recencyWeight: 1.0,
    engagementWeight: 1.0,
    exploreRatio: 30,
  },
  savedMixes: [],
};

// ─── Health checks ────────────────────────────────────────────────────

async function checkSourceHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── HTTP Server ───────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS headers — explicit origins, never * with credentials
  const ALLOWED_ORIGINS = [
    'https://app.degenfeed.xyz',
    'https://degenfeed.xyz',
    'http://localhost:3000',
    'http://localhost:3100',
  ];
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const searchParams = url.searchParams;

  console.log(`[bridge] ${req.method} ${path}`);

  try {
    // ── Health check ──────────────────────────────────────────
    if (path === '/api/health' || path === '/health' || path === '/api') {
      return jsonOk(res, { status: 'ok', service: 'degenfeed-bridge', version: '0.1.0' });
    }

    // ── Feed endpoints ────────────────────────────────────────
    if (
      path === '/api/feed/for-you' ||
      path === '/api/feed/home' ||
      path === '/v1/feed/for-you' ||
      path === '/v1/feed/home'
    ) {
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
      const protocolsRaw =
        searchParams.get('protocols') || 'nostr,farcaster,lens,bluesky,mastodon,reddit,rss';
      const protocols = protocolsRaw
        .split(',')
        .map((p: string) => p.trim())
        .filter(Boolean);

      const { posts, meta } = await buildFeed(protocols, limit);
      return jsonOk(res, { data: posts, meta });
    }

    // ── Feed health ───────────────────────────────────────────
    if (path === '/api/feed/health') {
      const [mastodonHealthy, redditHealthy] = await Promise.all([
        checkSourceHealth('http://127.0.0.1:8082/api/v1/instance'),
        checkSourceHealth('http://127.0.0.1:8281/'),
      ]);
      return jsonOk(res, {
        status: mastodonHealthy || redditHealthy ? 'ok' : 'degraded',
        sources: {
          mastodon: { healthy: mastodonHealthy, label: 'GoToSocial' },
          reddit: { healthy: redditHealthy, label: 'Redlib' },
        },
      });
    }

    // ── Trending ──────────────────────────────────────────────
    if (path === '/api/feed/trending' || path === '/api/trending/sidebar') {
      const topics = [
        { topic: 'Bitcoin', count: 12500, score: 98500 },
        { topic: 'Solana', count: 9800, score: 72100 },
        { topic: 'Ethereum', count: 8700, score: 65400 },
        { topic: 'DeFi', count: 7200, score: 54300 },
        { topic: 'AI', count: 6800, score: 51200 },
        { topic: 'NFT', count: 5400, score: 42300 },
        { topic: 'Layer 2', count: 4900, score: 38700 },
        { topic: 'Memecoin', count: 4500, score: 35600 },
        { topic: 'Stablecoin', count: 3800, score: 29800 },
        { topic: 'Security', count: 2900, score: 23400 },
      ];
      return jsonOk(res, { topics });
    }

    // ── Feed news ─────────────────────────────────────────────
    if (path === '/api/feed/news') {
      return jsonOk(res, {
        data: FALLBACK_POSTS.filter((p) => p.protocol === 'rss').slice(0, 10),
        meta: { total: 1, source: 'fallback', fetchedAt: Date.now() },
      });
    }

    // ── Preferences ─────────────────────────────────────────────
    if (path === '/api/preferences' || path === '/v1/preferences') {
      if (req.method === 'POST') {
        // Accept but ignore writes
        return jsonOk(res, { ok: true });
      }
      return jsonOk(res, DEFAULT_PREFERENCES);
    }

    // ── Bookmark endpoints ─────────────────────────────────────
    if (path.startsWith('/api/bookmarks') || path.startsWith('/v1/bookmarks')) {
      return jsonOk(res, { data: [], meta: { total: 0 } });
    }

    // ── Community endpoints ────────────────────────────────────
    if (path.startsWith('/api/communities')) {
      return jsonOk(res, { data: [] });
    }

    // ── Search ─────────────────────────────────────────────────
    if (path.startsWith('/api/search') || path.startsWith('/v1/search')) {
      return jsonOk(res, { data: [], meta: { total: 0 } });
    }

    // ── Leaderboard ────────────────────────────────────────────
    if (path.startsWith('/api/leaderboard') || path.startsWith('/v1/leaderboard')) {
      return jsonOk(res, { data: [], meta: { total: 0 } });
    }

    // ── Moderation ─────────────────────────────────────────────
    if (path.startsWith('/api/moderation') || path.startsWith('/v1/moderation')) {
      return jsonOk(res, { ok: true });
    }

    // ── Notifications ──────────────────────────────────────────
    if (path.startsWith('/api/notifications') || path.startsWith('/v1/notifications')) {
      return jsonOk(res, { data: [], meta: { total: 0 } });
    }

    // ── Identity ───────────────────────────────────────────────
    if (path.startsWith('/api/identity') || path.startsWith('/v1/identity')) {
      return jsonOk(res, { data: null });
    }

    // ── Auth endpoints (return success for all GET checks) ────
    if (path.startsWith('/api/auth') || path.startsWith('/v1/auth')) {
      if (req.method === 'GET') {
        return jsonOk(res, { authenticated: false, user: null });
      }
      return jsonOk(res, { ok: true });
    }

    // ── Publish ────────────────────────────────────────────────
    if (path.startsWith('/api/publish')) {
      return jsonOk(res, { ok: true, id: `post:${Date.now()}` });
    }

    // ─── Catch-all ────────────────────────────────────────────
    return jsonOk(res, { status: 'ok', path, service: 'degenfeed-bridge' });
  } catch (err) {
    console.error('[bridge] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', status: 500 }));
  }
});

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🌉 DegenFeed Bridge running on http://127.0.0.1:${PORT}`);
  console.log(`   Proxying feeds from local services (GTS:${GTS_BASE}, Redlib:${REDLIB_BASE})`);
});
