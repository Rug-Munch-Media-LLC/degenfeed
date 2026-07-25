/**
 * Paragraph.xyz Bridge Provider
 *
 * Fetches articles from Paragraph.xyz — a web3 publishing and newsletter
 * platform with built-in writer coins, community features, and Farcaster
 * integration. Content is stored on Arweave for permanence.
 *
 * Paragraph REST API: https://public.api.paragraph.com/api
 * Paragraph SDK: @paragraph-com/sdk (npm)
 * Paragraph Entry URL: https://paragraph.xyz/@author/slug
 *
 * Strategy:
 * 1. Paragraph Public REST API for recent and trending posts
 * 2. RSS fallback for known publications
 * 3. Arweave direct read for published content
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const PARAGRAPH_API = 'https://public.api.paragraph.com/api';
const PARAGRAPH_FRONT = 'https://paragraph.xyz';

// ─── Types ─────────────────────────────────────────────────────────────

interface ParagraphAuthor {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  walletAddress?: string;
  fid?: number;
  followerCount?: number;
}

interface ParagraphPost {
  id: string;
  title: string;
  markdown?: string;
  excerpt?: string;
  slug: string;
  status: 'published' | 'draft' | 'archived';
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: ParagraphAuthor;
  publicationSlug?: string;
  publicationName?: string;
  coverImage?: string;
  tags?: string[];
  categories?: string[];
  wordCount?: number;
  readTimeMinutes?: number;
  postUrl?: string;
  farcasterCastHash?: string;
  newsletterId?: string;
  imageUrl?: string;
  metadata?: {
    postPreview?: string;
    featuredImage?: string;
  };
}

interface ParagraphApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
  error?: string;
}

interface ParagraphFeedResponse {
  posts?: ParagraphPost[];
  data?: ParagraphPost[];
  items?: ParagraphPost[];
  total?: number;
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
  if (/\b(nft|art|collectible|mint|token)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning|deep learning)\b/.test(lower))
    niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|policy|congress|law)\b/.test(lower))
    niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk|memecoin)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|paragraph|arweave)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|dev|engineering|startup)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|analysis|opinion|deep.dive|research|report)\b/.test(lower)) niches.push('news');
  if (/\b(newsletter|writing|publishing|writer|substack|blog)\b/.test(lower))
    niches.push('writing');
  if (/\b(farcaster|fid|cast|frame)\b/.test(lower)) niches.push('farcaster');
  if (/\b(writer.coin|post.coin|coin|token.economics)\b/.test(lower)) niches.push('creator-coins');

  if (niches.length === 0) {
    if (/\b(crypto|blockchain|web3)\b/i.test(title)) niches.push('crypto');
    else if (/\b(tech|software|startup)\b/i.test(title)) niches.push('tech');
    else niches.push('article');
  }
  return niches;
}

// ─── Map Paragraph post to UnifiedPost ─────────────────────────────────

function paragraphPostToPost(post: ParagraphPost): UnifiedPost {
  const authorName =
    post.author?.displayName ||
    post.author?.username ||
    post.author?.id?.slice(0, 8) ||
    'Paragraph Author';
  const authorHandle = post.author?.username || `pub:${post.publicationSlug}`;
  const text = post.title
    ? `${post.title}\n\n${stripHtml(post.markdown || post.excerpt || '')}`.trim()
    : stripHtml(post.markdown || '').trim();

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  const coverUrl = post.coverImage || post.imageUrl || post.metadata?.featuredImage;

  if (coverUrl) {
    embeds.push({ kind: 'image', url: coverUrl, meta: { cover: true } });
  }

  const postUrl = post.postUrl || `${PARAGRAPH_FRONT}/@${authorHandle}/${post.slug}`;
  embeds.push({ kind: 'link', url: postUrl, meta: { type: 'paragraph-article' } });

  return {
    id: `paragraph:${post.id}`,
    protocol: 'paragraph',
    author: {
      id: `paragraph:${post.author?.id || post.publicationSlug || post.id}`,
      primary: {
        protocol: 'paragraph',
        id: post.author?.username || post.publicationSlug || post.id,
      },
      handles: {
        paragraph: authorHandle,
        ...(post.author?.fid ? { farcaster: `fid:${post.author.fid}` } : {}),
        ...(post.author?.walletAddress ? { ethereum: post.author.walletAddress } : {}),
      },
      displayName: authorName,
      bio: post.author?.bio || '',
      avatarUrl: post.author?.avatar || '',
      followerCount: post.author?.followerCount || 0,
      followingCount: 0,
      links: post.publicationSlug
        ? [{ label: 'paragraph-publication', url: `${PARAGRAPH_FRONT}/@${post.publicationSlug}` }]
        : [],
      keys: {
        ...(post.author?.walletAddress ? { evmAddress: post.author.walletAddress } : {}),
        ...(post.author?.fid ? { farcasterFid: String(post.author.fid) } : {}),
      },
    },
    text,
    contentType: 'article',
    embeds,
    createdAt: new Date(post.publishedAt || post.createdAt || Date.now()).getTime(),
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
    niches: guessNiches(text, post.title, post.tags || post.categories || []),
  } as UnifiedPost;
}

// ─── Fetch via Paragraph Public REST API ──────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await $fetch(`${PARAGRAPH_API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1 (Paragraph)',
        ...(options.headers as Record<string, string>),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRecentPosts(limit: number): Promise<UnifiedPost[]> {
  try {
    // Try the v1 posts endpoint (most commonly available)
    const res = await apiFetch<ParagraphApiResponse<ParagraphPost[]> | ParagraphFeedResponse>(
      `/v1/posts?limit=${Math.min(limit, 50)}&sort=new`,
    );
    if (!res) return [];

    const posts =
      (res as ParagraphFeedResponse).posts ||
      (res as ParagraphApiResponse<ParagraphPost[]>).data ||
      (res as ParagraphFeedResponse).items ||
      [];
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(paragraphPostToPost);
  } catch {
    return [];
  }
}

async function fetchTrending(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await apiFetch<ParagraphApiResponse<ParagraphPost[]> | ParagraphFeedResponse>(
      `/v1/posts?limit=${Math.min(limit, 30)}&sort=trending`,
    );
    if (!res) return [];

    const posts =
      (res as ParagraphFeedResponse).posts ||
      (res as ParagraphApiResponse<ParagraphPost[]>).data ||
      [];
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(paragraphPostToPost);
  } catch {
    return [];
  }
}

async function fetchByPublication(publicationSlug: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await apiFetch<ParagraphApiResponse<ParagraphPost[]> | ParagraphFeedResponse>(
      `/v1/publications/slug/${publicationSlug}/posts?limit=${Math.min(limit, 20)}`,
    );
    if (!res) return [];

    const posts =
      (res as ParagraphFeedResponse).posts ||
      (res as ParagraphApiResponse<ParagraphPost[]>).data ||
      [];
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(paragraphPostToPost);
  } catch {
    return [];
  }
}

async function fetchExplore(limit: number): Promise<UnifiedPost[]> {
  try {
    // Use discover endpoint if available
    const res = await apiFetch<ParagraphApiResponse<ParagraphPost[]> | ParagraphFeedResponse>(
      `/v1/discover/posts?limit=${Math.min(limit, 30)}`,
    );
    if (!res) return [];

    const posts =
      (res as ParagraphFeedResponse).posts ||
      (res as ParagraphApiResponse<ParagraphPost[]>).data ||
      [];
    if (Array.isArray(posts)) return posts.slice(0, limit).map(paragraphPostToPost);

    return [];
  } catch {
    return [];
  }
}

// ─── RSS Fallback ──────────────────────────────────────────────────────

const CURATED_PUBLICATIONS: Array<{ name: string; slug: string }> = [
  { name: 'Bankless', slug: 'bankless' },
  { name: 'a16z Crypto', slug: 'a16z' },
  { name: 'Variant Fund', slug: 'variant' },
  { name: 'Dose of DeFi', slug: 'doseofdefi' },
  { name: 'Miles Deutscher', slug: 'miles' },
];

async function fetchPublicationRss(slug: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const rssUrl = `${PARAGRAPH_FRONT}/api/feeds/rss/@${slug}`;
    const res = await $fetch(rssUrl, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Paragraph)' },
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

      const title = titleMatch ? stripHtml(titleMatch[1]) : 'Paragraph Article';
      const link = linkMatch ? linkMatch[1] : '';
      const text = `${title}\n\n${descMatch ? stripHtml(descMatch[1]).slice(0, 500) : ''}`.trim();
      const createdAt = dateMatch ? new Date(dateMatch[1]).getTime() : Date.now();
      const articleId = link.split('/').pop() || `idx-${idx}`;

      posts.push({
        id: `paragraph:rss:${slug}:${articleId}`,
        protocol: 'paragraph',
        author: {
          id: `paragraph:rss:${slug}`,
          primary: { protocol: 'paragraph', id: slug },
          handles: { paragraph: slug },
          displayName: `Paragraph:${slug}`,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'paragraph', url: `${PARAGRAPH_FRONT}/@${slug}` }],
          keys: {},
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
  id: 'paragraph',
  name: 'Paragraph.xyz',
  description: 'Web3 publishing platform — newsletters, articles, writer coins',
  endpoint: '/api/feed/paragraph',
  requiresAuth: false,
  contentType: 'article',
};

export async function fetchParagraphPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / 5));

  const [recent, trending, explore, ...pubFeeds] = await Promise.all([
    fetchRecentPosts(perSource),
    fetchTrending(perSource),
    fetchExplore(perSource).catch(() => [] as UnifiedPost[]),
    ...CURATED_PUBLICATIONS.map((p) => fetchPublicationRss(p.slug, 3)),
  ]);

  const all = [recent, trending, explore, ...pubFeeds].flat();

  // Deduplicate by ID
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(
    `[bridge] Paragraph: ${deduped.length} posts (recent: ${recent.length}, trending: ${trending.length}, explore: ${explore.length}, publications: ${pubFeeds.length})`,
  );
  return deduped;
}

/** @alias */
export const fetch = fetchParagraphPosts;
