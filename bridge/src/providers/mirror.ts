/**
 * Mirror.xyz Provider
 *
 * Fetches articles from Mirror.xyz — a decentralized publishing platform
 * built on Ethereum (Arweave storage + crypto-native features like
 * crowdfunding, token-gating, and writing NFTs).
 *
 * Mirror exposes a GraphQL API at https://mirror-api.com/graphql
 * Also reads from its RSS/Blog feeds and individual writer pages.
 *
 * Strategy:
 * 1. Mirror GraphQL API for recent posts and crowdfunding entries
 * 2. RSS fallback from known Mirror writers/blogs
 * 3. Writer discovery via ENS / Etherscan
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const MIRROR_GRAPHQL = 'https://mirror-api.com/graphql';
const MIRROR_FRONT = 'https://mirror.xyz';

// ─── Types ─────────────────────────────────────────────────────────────

interface MirrorAuthor {
  address: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  ens?: string;
}

interface MirrorPost {
  /** Digest or content hash */
  digest: string;
  /** Publication timestamp */
  publishedAt: number;
  /** Original authorship timestamp */
  originalDigest?: string;
  /** Title of the entry */
  title: string;
  /** Body of the entry (Markdown) */
  body?: string;
  /** Excerpt / description */
  excerpt?: string;
  /** Arweave transaction ID */
  arweaveTxId?: string;
  /** Content contributors */
  contributors?: string[];
  /** Writer's Ethereum address */
  author: string;
  /** Author details (populated from ENS resolution) */
  authorDetails?: MirrorAuthor;
  /** Crowdfunding details (if applicable) */
  crowdfunding?: {
    campaignId: string;
    goal: string;
    amountRaised: string;
    tokenAddress: string;
    endsAt: number;
  };
  /** Token-gating details */
  tokenGate?: {
    contractAddress: string;
    minBalance: string;
    chainId: number;
  };
  /** Tags/categories */
  tags?: string[];
  /** Original URL on Mirror */
  url?: string;
  /** Cover image */
  coverImage?: string;
  /** Writing NFT info */
  writingNft?: {
    contractAddress: string;
    tokenId: string;
    chainId: number;
  };
}

interface MirrorGraphqlResponse {
  data?: {
    posts?: MirrorPost[];
    entries?: MirrorPost[];
    projects?: Array<{ entries: MirrorPost[] }>;
  };
  errors?: Array<{ message: string }>;
}

interface MirrorExploreResponse {
  entries: MirrorPost[];
  cursor?: string;
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
    .replace(/\s+/g, ' ')
    .trim();
}

export function guessNiches(text: string, title: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking|amm)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|token|opensea|blur)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning|deep learning)\b/.test(lower))
    niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|policy|congress|law)\b/.test(lower))
    niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk|memecoin)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach|vuln)\b/.test(lower))
    niches.push('security');
  if (/\b(crypto|blockchain|web3|mirror|arweave|permaweb)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|dev|engineering|startup)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|analysis|opinion|deep.dive|research|report)\b/.test(lower)) niches.push('news');
  if (/\b(science|research|paper|discovery|biology|physics|space)\b/.test(lower))
    niches.push('science');
  if (/\b(philosophy|ethics|society|culture|governance|dao)\b/.test(lower))
    niches.push('governance');
  if (/\b(creator|writing|publishing|writer|poem|story|essay)\b/.test(lower))
    niches.push('writing');

  if (niches.length === 0) {
    if (/\b(crypto|blockchain|web3|dao|defi|nft)\b/i.test(title)) niches.push('crypto');
    else if (/\b(tech|software|startup)\b/i.test(title)) niches.push('tech');
    else niches.push('article');
  }
  return niches;
}

// ─── Map Mirror post to UnifiedPost ───────────────────────────────────

function mirrorPostToPost(post: MirrorPost): UnifiedPost {
  const authorAddr = post.author || post.authorDetails?.address || '';
  const authorName =
    post.authorDetails?.displayName ||
    post.authorDetails?.ens ||
    `${authorAddr.slice(0, 6)}...${authorAddr.slice(-4)}`;
  const text = post.title
    ? `${post.title}\n\n${stripHtml(post.body || post.excerpt || '')}`.trim()
    : stripHtml(post.body || '').trim();
  const url = post.url || `${MIRROR_FRONT}/${authorAddr}/${post.digest}`;

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  if (post.coverImage) {
    embeds.push({ kind: 'image', url: post.coverImage, meta: { cover: true } });
  }

  embeds.push({ kind: 'link', url, meta: { type: 'mirror-article' } });

  // Paywall / token gate info
  const paywall = post.tokenGate
    ? {
        amount: post.tokenGate.minBalance,
        recipient: post.tokenGate.contractAddress,
      }
    : undefined;

  return {
    id: `mirror:${post.digest}`,
    protocol: 'mirror',
    author: {
      id: `mirror:${authorAddr}`,
      primary: { protocol: 'mirror', id: authorAddr },
      handles: {
        mirror: authorName,
        ethereum: authorAddr,
        ...(post.authorDetails?.ens ? { ens: post.authorDetails.ens } : {}),
      },
      displayName: authorName,
      bio: post.authorDetails?.bio || '',
      avatarUrl: post.authorDetails?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: authorAddr ? [{ label: 'mirror-writer', url: `${MIRROR_FRONT}/${authorAddr}` }] : [],
      keys: {
        evmAddress: authorAddr,
        ...(post.arweaveTxId ? { arweaveTxId: post.arweaveTxId } : {}),
      },
    },
    text,
    contentType: 'article',
    embeds,
    createdAt: post.publishedAt || 0,
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: post,
    niches: guessNiches(text, post.title, post.tags || []),
    ...(paywall ? { paywall } : {}),
  } as UnifiedPost;
}

// ─── Fetch via Mirror GraphQL API ──────────────────────────────────────

async function graphqlQuery(query: string): Promise<MirrorGraphqlResponse> {
  const res = await $fetch(MIRROR_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DegenFeed-Bridge/0.1 (Mirror)',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Mirror GraphQL HTTP ${res.status}`);
  return res.json() as Promise<MirrorGraphqlResponse>;
}

async function fetchRecentPosts(limit: number): Promise<UnifiedPost[]> {
  try {
    const query = `
      {
        posts(first: ${Math.min(limit, 50)}, orderBy: publishedAt, orderDirection: desc) {
          digest
          publishedAt
          title
          excerpt
          body
          arweaveTxId
          author
          coverImage
          tags
        }
      }
    `;
    const result = await graphqlQuery(query);
    const posts = result?.data?.posts || [];
    return posts.map(mirrorPostToPost);
  } catch (err) {
    console.log(`[bridge] Mirror GraphQL error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchExplore(limit: number): Promise<UnifiedPost[]> {
  try {
    const query = `
      {
        explore(first: ${Math.min(limit, 30)}) {
          entries {
            digest
            publishedAt
            title
            excerpt
            author
            coverImage
            tags
          }
        }
      }
    `;
    const result = await graphqlQuery(query);
    const entries = result?.data?.explore?.[0]?.entries || [];
    return entries.map(mirrorPostToPost);
  } catch {
    return [];
  }
}

// ─── Fetch via RSS (fallback) ──────────────────────────────────────────

const CURATED_WRITERS = [
  'https://mirror.xyz/vasa.eth', // Tech/crypto
  'https://mirror.xyz/chainyman.eth', // Web3
  'https://mirror.xyz/0x1379971e6380c0c1E92c0e0E1260f068c118016', // Crypto analysis
];

async function fetchWriterRss(writerUrl: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const rssUrl = `${writerUrl}/rss`;
    const res = await $fetch(rssUrl, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Mirror)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const posts: UnifiedPost[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    let idx = 0;

    while ((m = itemRe.exec(xml)) !== null && posts.length < limit) {
      const item = m[1];
      const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const dateMatch = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const descMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);

      const title = titleMatch ? stripHtml(titleMatch[1]) : 'Mirror Article';
      const link = linkMatch ? linkMatch[1] : '';
      const text = `${title}\n\n${descMatch ? stripHtml(descMatch[1]).slice(0, 500) : ''}`.trim();
      const createdAt = dateMatch ? new Date(dateMatch[1]).getTime() : Date.now();
      const digest = link.split('/').pop() || `idx-${idx}`;

      posts.push({
        id: `mirror:rss:${digest}`,
        protocol: 'mirror',
        author: {
          id: `mirror:rss:${writerUrl}`,
          primary: { protocol: 'mirror', id: writerUrl },
          handles: { mirror: new URL(writerUrl).pathname.replace('/', '') || writerUrl },
          displayName: `Mirror:${new URL(writerUrl).hostname}${new URL(writerUrl).pathname.slice(0, 12)}`,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'mirror', url: writerUrl }],
          keys: { rssUrl },
        },
        text,
        contentType: 'article',
        embeds: [{ kind: 'link', url: link }],
        createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: { title, link, description: descMatch?.[1] },
        niches: guessNiches(text, title),
      });
      idx++;
    }

    return posts;
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'mirror',
  name: 'Mirror.xyz',
  description: 'Decentralized publishing on Ethereum + Arweave',
  endpoint: '/api/feed/mirror',
  requiresAuth: false,
  contentType: 'article',
};

export async function fetchMirrorPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / 4));

  const [graphqlPosts, explorePosts, ...writerPosts] = await Promise.all([
    fetchRecentPosts(perSource),
    fetchExplore(perSource),
    ...CURATED_WRITERS.map((w) => fetchWriterRss(w, 5)),
  ]);

  const all = [graphqlPosts, explorePosts, ...writerPosts].flat();

  // Deduplicate by digest
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(
    `[bridge] Mirror: ${deduped.length} posts (graphql: ${graphqlPosts.length}, explore: ${explorePosts.length}, writers: ${writerPosts.length} feeds)`,
  );
  return deduped;
}

/** @alias */
export const fetch = fetchMirrorPosts;
