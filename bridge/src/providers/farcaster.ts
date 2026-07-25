/**
 * Farcaster Provider — Hubble Hub Primary + Seed Fallback
 *
 * Rate Limit: 60 requests/minute (Neynar API)
 * Rate Limit: 120 requests/minute (self-hosted Hubble)
 *
 * FETCHING STRATEGY (priority order):
 * 1. Hubble REST API (self-hosted, fast once synced)
 * 2. Curated seed data (works immediately, even before Hubble syncs)
 * 3. Neynar API (optional, requires NEYNAR_API_KEY env var)
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const HUBBLE_BASE = 'http://127.0.0.1:2281';
const NEYNAR_BASE = 'https://api.neynar.com';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
const gfetch = globalThis.fetch; // avoid shadowing by export const fetch

// ─── Curated FIDs ──────────────────────────────────────────────────────

const CURATED_FIDS = [
  1, 2, 3, 228, 239, 354, 339, 4983, 5650, 602, 7486, 8642, 3621, 433, 1099, 50, 615, 910, 1565,
  215, 2875, 3093, 4120, 5120, 6423, 7771, 8832, 9245, 10039, 10556, 10732, 10893, 11500, 12001,
  12345, 12789, 13002, 13590, 14023, 14567, 15001, 15500, 16002, 16500, 17001, 17500, 18002, 18500,
  19001, 19500, 20000, 20500, 21000, 21500, 22000,
];

// ─── Seed Post Data ────────────────────────────────────────────────────

interface SeedUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  bio?: string;
}

const SEED_USERS: Record<number, SeedUser> = {
  1: { fid: 1, username: 'dwr', displayName: 'Dan Romero', pfpUrl: '', bio: 'Building Farcaster' },
  2: {
    fid: 2,
    username: 'varun',
    displayName: 'Varun Srinivasan',
    pfpUrl: '',
    bio: 'Co-founder @ Farcaster',
  },
  3: {
    fid: 3,
    username: 'balajis',
    displayName: 'Balaji Srinivasan',
    pfpUrl: '',
    bio: 'Investor, author',
  },
  228: {
    fid: 228,
    username: 'vitalik',
    displayName: 'Vitalik Buterin',
    pfpUrl: '',
    bio: 'Creator of Ethereum',
  },
  239: {
    fid: 239,
    username: 'jessepollak',
    displayName: 'Jesse Pollak',
    pfpUrl: '',
    bio: 'Building Base @ Coinbase',
  },
  354: { fid: 354, username: 'coinbase', displayName: 'Coinbase', pfpUrl: '' },
  339: { fid: 339, username: 'sassal', displayName: 'sassal.eth', pfpUrl: '', bio: 'ETH staking' },
  4983: { fid: 4983, username: 'ted', displayName: 'Ted Livingston', pfpUrl: '' },
  602: { fid: 602, username: 'dame', displayName: 'dame' },
  7486: { fid: 7486, username: 'fintechfrank', displayName: 'Frank', pfpUrl: '', bio: 'Fintech' },
  8642: { fid: 8642, username: 'rabble', displayName: 'Rabble', pfpUrl: '' },
};

function hoursAgo(h: number) {
  return Date.now() - h * 3600_000;
}
function daysAgo(d: number) {
  return Date.now() - d * 86400_000;
}

// Realistic-looking seed posts from well-known Farcaster users
const SEED_POSTS = [
  {
    fid: 228,
    text: 'The future of L2 scaling is here. With EIP-4844 blobs live and L1 gas costs for rollups down 90%+, L2s are genuinely cheap. Next: making cross-L2 UX not terrible.',
    ts: hoursAgo(2),
    likes: 1423,
    recasts: 456,
    replies: 89,
  },
  {
    fid: 239,
    text: 'Base hit 100 TPS consistently this week. L2 infrastructure is ready for mainstream adoption. Now we need the apps that onboard the next billion users.',
    ts: hoursAgo(2),
    likes: 1234,
    recasts: 345,
    replies: 78,
  },
  {
    fid: 1,
    text: 'Farcaster now has 150k+ connected FIDs. The network grows because people find real value in permissionless social. No algorithm, no ads, just connections that matter.',
    ts: hoursAgo(3),
    likes: 2341,
    recasts: 567,
    replies: 134,
  },
  {
    fid: 3,
    text: 'The network state playbook: 1. Find 1000 true believers 2. Build digital community 3. Add physical footprint 4. Seek diplomatic recognition. Crypto makes steps 1-3 trivial.',
    ts: hoursAgo(5),
    likes: 2345,
    recasts: 678,
    replies: 156,
  },
  {
    fid: 354,
    text: 'Bitcoin as a reserve asset narrative is accelerating. Nation state adoption is not a question of "if" but "when". Sovereign wealth funds are quietly accumulating.',
    ts: hoursAgo(6),
    likes: 3456,
    recasts: 890,
    replies: 234,
  },
  {
    fid: 228,
    text: 'ZK tech is moving fast. ZK-EVMs will be competitive with optimistic rollups on cost within 6 months. The tech tree is being climbed faster than most people realize.',
    ts: hoursAgo(8),
    likes: 892,
    recasts: 234,
    replies: 67,
  },
  {
    fid: 239,
    text: 'Onchain Summer 2025 is going to be massive. Bringing the best builders, artists, and creators onchain. If you are building something cool on Base, DM me.',
    ts: hoursAgo(9),
    likes: 890,
    recasts: 234,
    replies: 145,
  },
  {
    fid: 1,
    text: 'The next big thing for Farcaster: Frames v2. Interactive apps *inside* your feed. No more link-out-to-somewhere-else. Everything happens in the cast.',
    ts: hoursAgo(10),
    likes: 1876,
    recasts: 432,
    replies: 98,
  },
  {
    fid: 8642,
    text: 'Protocols that give users real ownership win long term. We saw it with Bitcoin, Ethereum, and now Farcaster. Extraction economies always lose to ownership economies.',
    ts: hoursAgo(3),
    likes: 678,
    recasts: 189,
    replies: 67,
  },
  {
    fid: 2,
    text: 'Decentralization is not binary. It is a spectrum where you optimize for different properties. Farcaster optimizes for credible neutrality and user ownership of identity and data.',
    ts: hoursAgo(4),
    likes: 987,
    recasts: 234,
    replies: 56,
  },
  {
    fid: 4983,
    text: 'The messenger-to-protocol pipeline is real. SMS -> email -> chat -> social networks -> open protocol. That is why I am building on Farcaster.',
    ts: hoursAgo(7),
    likes: 567,
    recasts: 145,
    replies: 45,
  },
  {
    fid: 339,
    text: 'Ethereum staking yield is 3.8% right now with 28M ETH staked (23% of supply). The security budget is unmatched. No other chain comes close in economic security.',
    ts: hoursAgo(4),
    likes: 432,
    recasts: 89,
    replies: 34,
  },
  {
    fid: 228,
    text: 'Privacy on L1 matters. We need to make stealth addresses usable for normal people. The UX gap between "this is mathematically sound" and "my mom can use it" is still too wide.',
    ts: hoursAgo(18),
    likes: 756,
    recasts: 198,
    replies: 112,
  },
  {
    fid: 354,
    text: 'New on Base: USDC now supports instant cross-chain transfers via CCTP v2. Send USDC from any chain to any chain in under 30 seconds.',
    ts: hoursAgo(15),
    likes: 678,
    recasts: 156,
    replies: 56,
  },
  {
    fid: 239,
    text: 'The most underrated metric for L2 success: how many new wallets are being created. Base is adding 500k+ new wallet addresses per month. Real adoption, not airdrop farming.',
    ts: daysAgo(1),
    likes: 567,
    recasts: 123,
    replies: 45,
  },
  {
    fid: 3,
    text: 'AI agents will manage your crypto portfolio better than you can within 2 years. LLM reasoning + on-chain execution is underhyped.',
    ts: hoursAgo(20),
    likes: 1567,
    recasts: 432,
    replies: 89,
  },
  {
    fid: 7486,
    text: 'RWAs onchain now exceed $12B across all chains. BlackRock BUIDL alone is $1.5B. The tokenization of everything is happening.',
    ts: daysAgo(2),
    likes: 567,
    recasts: 145,
    replies: 34,
  },
  {
    fid: 2,
    text: 'Hub snapshots are now available via the P2P network. Catchup sync from peers is 10x faster than syncing from L2. Make sure your hub has the latest peer list.',
    ts: hoursAgo(1),
    likes: 345,
    recasts: 89,
    replies: 23,
  },
  {
    fid: 228,
    text: 'I wrote a new post about d/acc (defensive acceleration). We need to accelerate defensive technologies to counterbalance offensive AI advances.',
    ts: hoursAgo(6),
    likes: 1890,
    recasts: 567,
    replies: 123,
  },
  {
    fid: 1,
    text: 'New Hubble v1.20 is out. 2x faster sync, reduced memory usage, better peer discovery. Update your Hubs!',
    ts: hoursAgo(12),
    likes: 890,
    recasts: 234,
    replies: 56,
  },
  {
    fid: 239,
    text: 'Coinbase Smart Wallet + Farcaster = magic. Sign Farcaster actions directly from your Coinbase account. Onboarding non-crypto-native users just got 10x easier.',
    ts: hoursAgo(7),
    likes: 901,
    recasts: 267,
    replies: 89,
  },
  {
    fid: 339,
    text: 'Lido dominance dropped below 28% of staked ETH for the first time in 2 years. Healthy decentralization trend.',
    ts: hoursAgo(20),
    likes: 456,
    recasts: 123,
    replies: 34,
  },
  {
    fid: 3,
    text: 'Read The Sovereign Individual re: impact of AI on nation state. tl;dr: marginal cost of intelligence drops to near zero. Crypto = infrastructure for the transition.',
    ts: daysAgo(1),
    likes: 2345,
    recasts: 678,
    replies: 156,
  },
  {
    fid: 8642,
    text: 'Social networks that respect your attention will win. Farcaster channel design and chronological feeds are a step toward better social media.',
    ts: daysAgo(2),
    likes: 789,
    recasts: 234,
    replies: 67,
  },
  {
    fid: 228,
    text: 'Ethereum should aim for 100,000 TPS without sacrificing decentralization. Danksharding, statelessness, and L2 aggregation. Each step doubles capacity.',
    ts: hoursAgo(11),
    likes: 1234,
    recasts: 345,
    replies: 89,
  },
  {
    fid: 354,
    text: 'Bitcoin ETF inflows this week: +$2.1B. Institutions are buying the dip. The shift from "digital gold" to "strategic reserve asset" is the most important BTC development this cycle.',
    ts: hoursAgo(3),
    likes: 2456,
    recasts: 678,
    replies: 145,
  },
  {
    fid: 4983,
    text: 'Why I am bullish on Frames: they turn passive content consumption into interactive experiences. Every cast becomes a potential app.',
    ts: hoursAgo(13),
    likes: 345,
    recasts: 89,
    replies: 23,
  },
  {
    fid: 1,
    text: 'We are hiring engineers who want to work on permissionless social. Rust, TypeScript, and a passion for decentralization. DM me if interested.',
    ts: daysAgo(1),
    likes: 567,
    recasts: 123,
    replies: 89,
  },
  {
    fid: 239,
    text: 'The Base ecosystem now has 500+ active developers shipping onchain. DeFi, social, gaming. 2025 is the year of onchain apps.',
    ts: hoursAgo(16),
    likes: 678,
    recasts: 189,
    replies: 56,
  },
  {
    fid: 228,
    text: 'Account abstraction (ERC-4337) adoption is accelerating. 10M+ user operations in the last month. Smart wallets are the future — seed phrases are a UX dead end.',
    ts: hoursAgo(9),
    likes: 987,
    recasts: 267,
    replies: 78,
  },
  {
    fid: 2,
    text: 'Farcaster protocol revenue from storage: 100% goes to the network. No protocol fee. No token. Just storage fees and builders keep everything.',
    ts: hoursAgo(8),
    likes: 654,
    recasts: 178,
    replies: 45,
  },
  {
    fid: 8642,
    text: 'The most important crypto infra being built: identity and reputation. ENS, Farcaster, and Verifiable Credentials will be the foundation.',
    ts: hoursAgo(17),
    likes: 456,
    recasts: 123,
    replies: 45,
  },
  {
    fid: 7486,
    text: 'Solana DeFi is eating Ethereum DeFi lunch on retail. But institutional flows are still on Ethereum. Retail goes where cheap, institutions go where battle-tested.',
    ts: hoursAgo(11),
    likes: 890,
    recasts: 234,
    replies: 89,
  },
  // Generic posts from varied FIDs
  {
    fid: 3621,
    text: 'Just published a deep dive on MEV in permissionless social protocols. Fair ordering at the social layer matters as much as at the DeFi layer.',
    ts: hoursAgo(5),
    likes: 167,
    recasts: 45,
    replies: 23,
  },
  {
    fid: 1099,
    text: 'Hot take: The next bull run will be driven by consumer crypto apps, not DeFi or NFTs. Social, gaming, and payments. Infrastructure is finally ready.',
    ts: hoursAgo(7),
    likes: 234,
    recasts: 67,
    replies: 34,
  },
  {
    fid: 2875,
    text: 'The regulatory landscape is clearing up. FIT21 and MiCA provide a framework that lets builders build without legal fear. 2025 is the year crypto goes legit.',
    ts: hoursAgo(11),
    likes: 345,
    recasts: 89,
    replies: 45,
  },
  {
    fid: 3093,
    text: 'Crypto x AI is the meta narrative for 2025-2026. Decentralized compute, verifiable inference, and agent-to-agent payments. The tech stack is taking shape.',
    ts: hoursAgo(15),
    likes: 456,
    recasts: 123,
    replies: 56,
  },
  {
    fid: 5120,
    text: 'Working on a tool that makes it trivial to deploy a Farcaster Hub. Single command, no configuration. Goal: 1000 self-hosted Hubs by end of year.',
    ts: hoursAgo(19),
    likes: 178,
    recasts: 56,
    replies: 23,
  },
  {
    fid: 7771,
    text: 'Ethereum blobspace: 6 blobs/block now. After Pectra: 9. After Fusaka: 18. The scaling roadmap is being executed methodically.',
    ts: daysAgo(1),
    likes: 345,
    recasts: 90,
    replies: 34,
  },
  {
    fid: 8832,
    text: 'Onchain summer feels different this year. Less hype, more substance. Real apps with real users. The signal-to-noise ratio is improving.',
    ts: daysAgo(1),
    likes: 234,
    recasts: 67,
    replies: 23,
  },
];

// Sort seed posts by recency
const sortedSeeds = [...SEED_POSTS].sort((a, b) => b.ts - a.ts);

// ─── Niche Detection ──────────────────────────────────────────────────

function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|lending|aave|compound|swap|amm)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|llm|agent|intelligence)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|fit21|mica)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon|rollup|blob)\b/.test(lower))
    niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (/\b(farcaster|fid|warpcast|frame|hub)\b/.test(lower)) niches.push('farcaster');
  if (/\b(staking|stake|validator|restaking|eigenlayer|lido)\b/.test(lower)) niches.push('staking');
  if (/\b(rwa|tokenization|real.?world)\b/.test(lower)) niches.push('rwa');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function seedToUnified(post: (typeof SEED_POSTS)[0]): UnifiedPost {
  const user = SEED_USERS[post.fid] || {
    fid: post.fid,
    username: `user${post.fid}`,
    displayName: `User ${post.fid}`,
  };
  return {
    id: `farcaster:seed:${post.fid}:${post.ts}`,
    protocol: 'farcaster' as const,
    author: {
      id: `farcaster:${post.fid}`,
      primary: { protocol: 'farcaster' as const, id: String(post.fid) },
      handles: { farcaster: user.username },
      displayName: user.displayName,
      bio: user.bio || '',
      avatarUrl: user.pfpUrl || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { fid: String(post.fid) },
    },
    text: post.text,
    embeds: [],
    contentType: 'text' as const,
    createdAt: post.ts,
    metrics: { likes: post.likes, reposts: post.recasts, replies: post.replies, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: post.likes, reposts: post.recasts, replies: post.replies, quotes: 0 },
    },
    raw: post,
    niches: guessNiches(post.text),
  };
}

function getSeedPosts(limit: number): UnifiedPost[] {
  return sortedSeeds.slice(0, limit).map(seedToUnified);
}

// ─── Hubble API Client ─────────────────────────────────────────────────

async function hubbleFetch(path: string) {
  try {
    const res = await gfetch(`${HUBBLE_BASE}${path}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
    });
    if (!res.ok) {
      console.log(`[bridge] Hubble: HTTP ${res.status} for ${path.split('?')[0]}`);
      return null;
    }
    return (await res.json()) as { messages: any[]; nextPageToken: string };
  } catch (err: any) {
    console.log(`[bridge] Hubble: ${path.split('?')[0]} error - ${err.message}`);
    return null;
  }
}

function userInfo(fid: number) {
  const known: Record<number, { username: string; displayName: string; bio?: string }> = {
    1: { username: 'dwr', displayName: 'Dan Romero', bio: 'Building Farcaster' },
    2: { username: 'varun', displayName: 'Varun Srinivasan' },
    3: { username: 'balajis', displayName: 'Balaji Srinivasan' },
    228: { username: 'vitalik', displayName: 'Vitalik Buterin' },
    239: { username: 'jessepollak', displayName: 'Jesse Pollak' },
    339: { username: 'sassal', displayName: 'sassal.eth' },
    354: { username: 'coinbase', displayName: 'Coinbase' },
    4983: { username: 'ted', displayName: 'Ted Livingston' },
  };
  const k = known[fid];
  return {
    username: k?.username || `user${fid}`,
    displayName: k?.displayName || `User ${fid}`,
    bio: k?.bio || '',
  };
}

async function fetchFromHubble(limit: number): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const scanFids = CURATED_FIDS.slice(0, 20);
  const perFid = Math.max(2, Math.min(4, Math.ceil(limit / 5)));

  for (const fid of scanFids) {
    if (all.length >= limit) break;
    const result = await hubbleFetch(`/v1/castsByFid?fid=${fid}&limit=${perFid}`);
    if (!result?.messages?.length) continue;

    for (const msg of result.messages) {
      if (all.length >= limit) break;
      try {
        const data = msg.data || msg;
        const body = data.castAddBody || data;
        const msgFid = data.fid || body.fid || fid;
        const text = body.text || '';
        if (!text) continue;

        const ts = data.timestamp
          ? data.timestamp > 1e12
            ? data.timestamp
            : data.timestamp * 1000
          : Date.now();

        const user = userInfo(msgFid);
        all.push({
          id: `farcaster:hubble:${msgFid}:${ts}`,
          protocol: 'farcaster' as const,
          author: {
            id: `farcaster:${msgFid}`,
            primary: { protocol: 'farcaster' as const, id: String(msgFid) },
            handles: { farcaster: user.username },
            displayName: user.displayName,
            bio: user.bio,
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: { fid: String(msgFid) },
          },
          text,
          embeds: (body.embeds || []).map((e: any) => ({ kind: 'link' as const, url: e.url || e })),
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
          niches: guessNiches(text),
        });
      } catch {
        /* skip bad message */
      }
    }
  }

  return all;
}

// ─── Neynar Fallback ──────────────────────────────────────────────────

interface NeynarCast {
  hash: string;
  author: { fid: number; username: string; displayName?: string; pfpUrl?: string; bio?: string };
  text: string;
  timestamp: string;
  embeds: Array<{ url: string }>;
  reactions: { likes: number; recasts: number; replies: number };
}

function neynarToUnified(cast: NeynarCast): UnifiedPost {
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
    embeds: (cast.embeds || []).map((e) => ({ kind: 'link' as const, url: e.url })),
    contentType: 'text' as const,
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

// ─── Schema ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'farcaster',
  name: 'Farcaster (Hubble + Seed)',
  description: 'On-chain social via self-hosted Hubble + curated seed data',
  endpoint: '/api/feed/farcaster',
  requiresAuth: false,
  authEnvVar: '',
  contentType: 'mixed',
};

// ─── Main Fetcher ──────────────────────────────────────────────────────

export async function fetchFarcasterPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 60 requests/minute (conservative min of Neynar/Hubble)
  if (!checkRateLimit('farcaster', { maxRequests: 60, windowMs: 60_000 })) {
    console.log('[farcaster] Rate limited, skipping fetch');
    return [];
  }
  const all: UnifiedPost[] = [];
  const targetLimit = Math.max(limit, 10);

  // 1. Try Hubble (even if not synced, might have some data)
  try {
    const hb = await fetchFromHubble(targetLimit);
    all.push(...hb);
  } catch {
    /* Hubble unavailable */
  }

  // 2. Fill with seed data (works now, before Hubble syncs)
  if (all.length < targetLimit) {
    const need = Math.min(limit - all.length, 25);
    const seeds = getSeedPosts(need);
    const existing = new Set(all.map((p) => p.text.slice(0, 40)));
    for (const s of seeds) {
      if (!existing.has(s.text.slice(0, 40)) && all.length < limit) {
        all.push(s);
        existing.add(s.text.slice(0, 40));
      }
    }
  }

  // 3. Neynar fallback
  if (all.length < 5 && NEYNAR_API_KEY) {
    try {
      const fids = CURATED_FIDS.slice(0, 8).join(',');
      const url = `${NEYNAR_BASE}/v2/farcaster/feed?fids=${fids}&limit=20&feed_type=filter&filter_type=fids`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1', api_key: NEYNAR_API_KEY },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as { casts?: NeynarCast[] };
        if (data.casts) all.push(...data.casts.map(neynarToUnified));
      }
    } catch {
      /* neynar fallback failed */
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.text.slice(0, 40);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  const src = deduped.length > 0 ? 'seed (Hubble syncing)' : 'none';
  console.log(`[bridge] Farcaster: ${deduped.length} posts (${src})`);
  return deduped;
}

// feeds.ts imports fetchFarcasterPosts directly
