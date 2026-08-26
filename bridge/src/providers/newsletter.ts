/**
 * Newsletter Aggregation Provider
 *
 * Dedicated crypto/web3 newsletter feed. Aggregates from:
 *   - Substack (RSS — every Substack has /feed)
 *   - Medium (RSS per publication/tag)
 *   - Mirror.xyz (via the running mirror-bridge container)
 *   - Paragraph.xyz (via the running paragraph-bridge container)
 *   - Ghost (RSS — Ghost-hosted publications expose /feed or /rss/)
 *
 * Every source is normalized into the unified NewsletterPost shape:
 *   { title, author, platform, url, date, excerpt, image }
 * and then mapped onto the bridge UnifiedPost contract (with the normalized
 * newsletter fields kept in `raw.newsletter` for the web app).
 *
 * Bridge container endpoints are configurable via env:
 *   MIRROR_BRIDGE_URL     (default http://127.0.0.1:8240)
 *   PARAGRAPH_BRIDGE_URL  (default http://127.0.0.1:8241)
 */

import { filterFreshPosts } from '../lib/freshness';
import type { SchemaGuard, UnifiedPost } from '../server/types';
import {
  extractFeaturedImage,
  extractLinkUrl,
  guessNiches,
  normalizeUrlKey,
  parseFeedXml,
  titleSimilarity,
} from './rss';

const USER_AGENT = 'DegenFeed-Bridge/0.3 (Newsletter Aggregator)';

const MIRROR_BRIDGE_URL = process.env.MIRROR_BRIDGE_URL || 'http://127.0.0.1:8240';
const PARAGRAPH_BRIDGE_URL = process.env.PARAGRAPH_BRIDGE_URL || 'http://127.0.0.1:8241';

/** Official keyless Paragraph API feed (better data quality than RSS). */
const PARAGRAPH_API_FEED = 'https://public.api.paragraph.com/api/v1/posts/feed';

/**
 * Platform quality tiers used for cross-platform dedup. Lower number = higher
 * quality, kept as the canonical copy when the same story appears on
 * multiple platforms (e.g. Substack + Mirror + Paragraph).
 */
const PLATFORM_TIER: Record<NewsletterPlatform, number> = {
  substack: 1,
  ghost: 1,
  medium: 3,
  mirror: 2,
  paragraph: 2,
  custom: 3,
};

// ─── Types ─────────────────────────────────────────────────────────────

export type NewsletterPlatform =
  | 'substack'
  | 'medium'
  | 'mirror'
  | 'paragraph'
  | 'ghost'
  | 'custom';

export interface NewsletterSource {
  name: string;
  author: string;
  platform: NewsletterPlatform;
  /** RSS/feed URL (Substack, Medium, Ghost) */
  feedUrl: string;
  /** Human-facing publication URL */
  homeUrl: string;
  category: string;
  niches?: string[];
}

/**
 * Unified newsletter post format.
 * Every platform normalizes into this shape.
 */
export interface NewsletterPost {
  title: string;
  author: string;
  platform: NewsletterPlatform;
  url: string;
  date: number;
  excerpt: string;
  image?: string;
  /** Publication/source display name */
  publication: string;
}

// ─── Curated Newsletter Sources ────────────────────────────────────────
// High-quality crypto/web3 newsletters with verified RSS/feed URLs.

export const CURATED_NEWSLETTERS: NewsletterSource[] = [
  {
    name: 'Bankless',
    author: 'Bankless LLC',
    platform: 'substack',
    feedUrl: 'https://www.bankless.com/feed',
    homeUrl: 'https://www.bankless.com',
    category: 'defi',
    niches: ['defi', 'crypto', 'ethereum'],
  },
  {
    name: 'The Defiant',
    author: 'The Defiant',
    platform: 'ghost',
    feedUrl: 'https://thedefiant.io/feed',
    homeUrl: 'https://thedefiant.io',
    category: 'defi',
    niches: ['defi', 'crypto'],
  },
  {
    name: 'Messari',
    author: 'Messari',
    platform: 'substack',
    feedUrl: 'https://messari.substack.com/feed',
    homeUrl: 'https://messari.io',
    category: 'research',
    niches: ['crypto', 'research'],
  },
  {
    name: 'Delphi Digital',
    author: 'Delphi Digital',
    platform: 'ghost',
    feedUrl: 'https://members.delphidigital.io/feed',
    homeUrl: 'https://members.delphidigital.io',
    category: 'research',
    niches: ['crypto', 'research'],
  },
  {
    name: 'Variant Fund',
    author: 'Variant Fund',
    platform: 'custom',
    feedUrl: 'https://www.variant.fund/feed',
    homeUrl: 'https://www.variant.fund',
    category: 'vc',
    niches: ['crypto', 'vc'],
  },
  {
    name: 'Decentralized.co',
    author: 'Joel John',
    platform: 'substack',
    feedUrl: 'https://www.decentralised.co/feed',
    homeUrl: 'https://www.decentralised.co',
    category: 'research',
    niches: ['web3', 'research'],
  },
  {
    name: 'Not Boring',
    author: 'Packy McCormick',
    platform: 'substack',
    feedUrl: 'https://notboring.substack.com/feed',
    homeUrl: 'https://www.notboring.co',
    category: 'tech',
    niches: ['tech', 'startup', 'crypto'],
  },
  {
    name: 'Milk Road',
    author: 'Milk Road',
    platform: 'custom',
    feedUrl: 'https://milkroad.com/feed/',
    homeUrl: 'https://milkroad.com',
    category: 'crypto',
    niches: ['crypto', 'news'],
  },
  {
    name: 'Atelier (Li Jin)',
    author: 'Li Jin',
    platform: 'substack',
    feedUrl: 'https://li-jin.substack.com/feed',
    homeUrl: 'https://li-jin.substack.com',
    category: 'creator',
    niches: ['creator', 'web3'],
  },
  {
    name: 'Chris Dixon (a16z)',
    author: 'Chris Dixon',
    platform: 'substack',
    feedUrl: 'https://cdixon.substack.com/feed',
    homeUrl: 'https://cdixon.substack.com',
    category: 'web3',
    niches: ['web3', 'crypto', 'vc'],
  },
  {
    name: 'The Daily Gwei',
    author: 'Anthony Sassano',
    platform: 'substack',
    feedUrl: 'https://thedailygwei.substack.com/feed',
    homeUrl: 'https://thedailygwei.substack.com',
    category: 'ethereum',
    niches: ['ethereum', 'defi'],
  },
  {
    name: 'Cobie (Atrsy)',
    author: 'Cobie',
    platform: 'substack',
    feedUrl: 'https://cobie.substack.com/feed',
    homeUrl: 'https://cobie.substack.com',
    category: 'crypto',
    niches: ['crypto', 'commentary'],
  },
  {
    name: 'Dose of DeFi',
    author: 'The Defiant',
    platform: 'substack',
    feedUrl: 'https://doseofdefi.substack.com/feed',
    homeUrl: 'https://doseofdefi.substack.com',
    category: 'defi',
    niches: ['defi', 'crypto'],
  },
  {
    name: 'Casey Caruso',
    author: 'Casey Caruso',
    platform: 'substack',
    feedUrl: 'https://caseycaruso.substack.com/feed',
    homeUrl: 'https://caseycaruso.substack.com',
    category: 'vc',
    niches: ['crypto', 'vc'],
  },
  {
    name: 'Validity',
    author: 'Validity',
    platform: 'substack',
    feedUrl: 'https://validity.substack.com/feed',
    homeUrl: 'https://validity.substack.com',
    category: 'research',
    niches: ['crypto', 'research'],
  },
];

/** Medium publications (RSS: https://medium.com/feed/{publication}) */
export const MEDIUM_SOURCES: NewsletterSource[] = [
  {
    name: 'Coinmonks',
    author: 'Coinmonks',
    platform: 'medium',
    feedUrl: 'https://medium.com/feed/coinmonks',
    homeUrl: 'https://medium.com/coinmonks',
    category: 'crypto',
    niches: ['crypto', 'defi'],
  },
  {
    name: 'The Capital',
    author: 'The Capital',
    platform: 'medium',
    feedUrl: 'https://medium.com/feed/the-capital',
    homeUrl: 'https://medium.com/the-capital',
    category: 'finance',
    niches: ['crypto', 'finance'],
  },
  {
    name: 'ETHGlobal',
    author: 'ETHGlobal',
    platform: 'medium',
    feedUrl: 'https://medium.com/feed/ethglobal',
    homeUrl: 'https://medium.com/ethglobal',
    category: 'ethereum',
    niches: ['ethereum', 'dev'],
  },
];

/** Ghost publications fed by RSS (Ghost exposes /feed or /rss/) */
export const GHOST_SOURCES: NewsletterSource[] = [
  {
    name: 'The Defiant (Ghost)',
    author: 'The Defiant',
    platform: 'ghost',
    feedUrl: 'https://thedefiant.io/feed',
    homeUrl: 'https://thedefiant.io',
    category: 'defi',
    niches: ['defi', 'crypto'],
  },
];

/**
 * All configured newsletter RSS sources (Substack + Medium + Ghost).
 * Mirror and Paragraph are fetched through their bridge containers.
 */
export const NEWSLETTER_SOURCES: NewsletterSource[] = [...CURATED_NEWSLETTERS, ...MEDIUM_SOURCES];

/** Get the configured newsletter sources (for meta / diagnostics). */
export function getNewsletterFeeds(): NewsletterSource[] {
  return NEWSLETTER_SOURCES;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function toNewsletterPost(
  src: NewsletterSource,
  title: string,
  author: string,
  url: string,
  date: number,
  excerpt: string,
  image?: string,
): NewsletterPost {
  return {
    title: title || `${src.name} article`,
    author: author || src.author || src.name,
    platform: src.platform,
    url,
    date,
    excerpt: (excerpt || '').slice(0, 500),
    image,
    publication: src.name,
  };
}

function toUnifiedPost(src: NewsletterSource, n: NewsletterPost): UnifiedPost {
  const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [
    { kind: 'link', url: n.url },
  ];
  if (n.image) embeds.push({ kind: 'image', url: n.image, meta: { cover: true } });

  return {
    id: `newsletter:${src.platform}:${src.name}:${n.date}:${encodeURIComponent(n.title).slice(0, 80)}`,
    protocol: 'newsletter',
    author: {
      id: `newsletter:${src.name}`,
      primary: { protocol: 'newsletter', id: src.name },
      handles: { newsletter: src.name },
      displayName: n.author || src.name,
      bio: `${src.name} — ${src.category} newsletter`,
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'publication', url: src.homeUrl }],
      keys: { feedUrl: src.feedUrl },
    },
    text: n.title,
    embeds,
    createdAt: n.date,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: { newsletter: n },
    niches: guessNiches(`${n.title} ${n.excerpt}`, src.niches || []),
    contentType: 'article',
  } as UnifiedPost;
}

// ─── RSS fetchers (Substack / Medium / Ghost) ──────────────────────────

async function fetchRssSource(src: NewsletterSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await globalThis.fetch(src.feedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // console.log(`[newsletter] ${src.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    if (!xml || xml.length < 50) return [];

    const parsed = parseFeedXml(xml);
    const items = parsed.items.slice(0, limit);

    return items
      .map((item) => {
        const image = item.featuredImage || extractFeaturedImage(item.contentHtml);
        const n = toNewsletterPost(
          src,
          item.title,
          item.authorName || '',
          item.link || src.homeUrl,
          item.publishedAt,
          item.description || item.contentText,
          image,
        );
        return toUnifiedPost(src, n);
      })
      .filter(Boolean);
  } catch (err) {
    //     console.log(
    //       `[newsletter] ${src.name}: error — ${err instanceof Error ? err.message : 'unknown'}`,
    //     );
    return [];
  }
}

// ─── Mirror bridge container ───────────────────────────────────────────

interface MirrorBridgeArticle {
  arweaveTxId?: string;
  title?: string;
  digest?: string;
  body?: string;
  excerpt?: string;
  publishedAt?: string;
  author?: string;
  tags?: Array<{ name: string; value: string }>;
}

async function fetchMirrorBridge(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await globalThis.fetch(`${MIRROR_BRIDGE_URL}/api/mirror/articles?limit=${limit}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // console.log(`[newsletter] mirror-bridge: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { articles?: MirrorBridgeArticle[] };
    const articles = (data.articles || []).filter((a) => {
      // Drop placeholder / empty content txs (profile updates, metadata-only).
      const hasRealTitle = a.title && a.title !== 'Mirror Article';
      const hasBody = Boolean(a.body?.trim());
      return hasRealTitle || hasBody;
    });

    return articles
      .map((a) => {
        const contributor = a.author || a.tags?.find((t) => t.name === 'Contributor')?.value || '';
        const author = contributor ? shortAddress(contributor) : 'Mirror writer';
        const url = `https://mirror.xyz/${contributor || '0x0'}/${a.digest || a.arweaveTxId || ''}`;
        const date = a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now();
        const n: NewsletterPost = {
          title:
            a.title && a.title !== 'Mirror Article'
              ? a.title
              : (a.body || '').slice(0, 80) || 'Mirror Article',
          author,
          platform: 'mirror',
          url,
          date,
          excerpt: (a.excerpt || a.body || '').slice(0, 500),
          publication: 'Mirror.xyz',
        };
        return toUnifiedPost(
          {
            name: 'Mirror.xyz',
            author,
            platform: 'mirror',
            feedUrl: `${MIRROR_BRIDGE_URL}/api/mirror/articles`,
            homeUrl: 'https://mirror.xyz',
            category: 'web3',
            niches: ['web3', 'crypto'],
          },
          n,
        );
      })
      .filter(Boolean);
  } catch (err) {
    //     console.log(
    //       `[newsletter] mirror-bridge: error — ${err instanceof Error ? err.message : 'unknown'}`,
    //     );
    return [];
  }
}

/** Shorten an Ethereum address for display (0x1234…abcd). */
function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// ─── Paragraph (official keyless API, bridge fallback) ────────────────

interface ParagraphFeedItem {
  post?: {
    id?: string;
    title?: string;
    slug?: string;
    publishedAt?: string;
    imageUrl?: string;
  };
  publication?: {
    id?: string;
    name?: string;
    slug?: string;
    customDomain?: string;
    summary?: string;
    logoUrl?: string;
  };
  user?: {
    id?: string;
    name?: string;
    walletAddress?: string;
    avatarUrl?: string;
  };
}

interface ParagraphBridgePost {
  id?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  publication?: string;
  slug?: string;
}

/** Official Paragraph API feed — keyless, rich author/publication data. */
async function fetchParagraphOfficial(limit: number): Promise<UnifiedPost[]> {
  const res = await globalThis.fetch(`${PARAGRAPH_API_FEED}?limit=${Math.min(limit, 30)}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    // console.log(`[newsletter] paragraph official API: HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { items?: ParagraphFeedItem[] };
  const items = (data.items || []).slice(0, limit);

  return items
    .map((it) => {
      const pub = it.publication || {};
      const post = it.post || {};
      const user = it.user || {};
      const publication = pub.name || 'Paragraph';
      const slug = pub.slug || '';
      const title = post.title && post.title !== 'Untitled' ? post.title : 'Paragraph article';
      const author = user.name || pub.name || 'Paragraph writer';
      const url = pub.customDomain
        ? `https://${pub.customDomain}/${post.slug || ''}`
        : `https://paragraph.xyz/@${slug}/${post.slug || ''}`;
      const date = post.publishedAt ? new Date(post.publishedAt).getTime() : Date.now();
      const n: NewsletterPost = {
        title,
        author,
        platform: 'paragraph',
        url,
        date,
        excerpt: (pub.summary || '').slice(0, 500),
        image: post.imageUrl || pub.logoUrl,
        publication,
      };
      return toUnifiedPost(
        {
          name: publication,
          author,
          platform: 'paragraph',
          feedUrl: PARAGRAPH_API_FEED,
          homeUrl: pub.customDomain
            ? `https://${pub.customDomain}`
            : `https://paragraph.xyz/@${slug}`,
          category: 'web3',
          niches: ['web3', 'crypto'],
        },
        n,
      );
    })
    .filter(Boolean);
}

async function fetchParagraphBridge(limit: number): Promise<UnifiedPost[]> {
  try {
    // Prefer the official keyless API for better data quality.
    const official = await fetchParagraphOfficial(limit);
    if (official.length > 0) return official;

    // Fallback: legacy paragraph-bridge container (RSS-based).
    const res = await globalThis.fetch(
      `${PARAGRAPH_BRIDGE_URL}/api/paragraph/posts?limit=${limit}`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) {
      // console.log(`[newsletter] paragraph-bridge: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { posts?: ParagraphBridgePost[] };
    const posts = data.posts || [];

    return posts
      .map((p) => {
        const publication = p.publication || 'Paragraph';
        const date = p.pubDate ? new Date(p.pubDate).getTime() : Date.now();
        const n: NewsletterPost = {
          title: p.title && p.title !== 'Untitled' ? p.title : 'Paragraph article',
          author: publication,
          platform: 'paragraph',
          url: p.link || `https://paragraph.xyz/@${p.slug || ''}`,
          date,
          excerpt: (p.description || '').slice(0, 500),
          publication,
        };
        return toUnifiedPost(
          {
            name: publication,
            author: publication,
            platform: 'paragraph',
            feedUrl: `${PARAGRAPH_BRIDGE_URL}/api/paragraph/posts`,
            homeUrl: `https://paragraph.xyz/@${p.slug || ''}`,
            category: 'web3',
            niches: ['web3', 'crypto'],
          },
          n,
        );
      })
      .filter(Boolean);
  } catch (err) {
    //     console.log(
    //       `[newsletter] paragraph-bridge: error — ${err instanceof Error ? err.message : 'unknown'}`,
    //     );
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

/**
 * Extract the canonical platform for a newsletter post (raw.newsletter.platform).
 */
function newsletterPlatformOf(post: UnifiedPost): NewsletterPlatform {
  const raw = post.raw as { newsletter?: NewsletterPost } | undefined;
  return raw?.newsletter?.platform || 'custom';
}

/**
 * Cross-platform dedup for newsletter posts.
 *
 * Strategy:
 *   1. canonical URL normalization (strip params, lowercase host) — exact match
 *   2. title similarity (Jaccard > 0.6) — catches the same story syndicated
 *      across Substack / Mirror / Paragraph / Medium
 *   3. prefer the highest-quality platform as canonical (platform tier)
 *
 * Duplicates are merged into the kept post's crossReference metadata so the
 * ranking/grounding pass can see the story was covered by multiple platforms.
 */
export function deduplicateNewsletterPosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  // Highest-quality platform first, then freshest. This makes the canonical
  // copy the best source for the same story.
  const sorted = [...posts].sort((a, b) => {
    const ta = PLATFORM_TIER[newsletterPlatformOf(a)] ?? 9;
    const tb = PLATFORM_TIER[newsletterPlatformOf(b)] ?? 9;
    if (ta !== tb) return ta - tb;
    return b.createdAt - a.createdAt;
  });

  const kept: UnifiedPost[] = [];
  const TITLE_THRESHOLD = 0.6;
  const WINDOW = 80;

  for (const post of sorted) {
    const url = extractLinkUrl(post);
    const urlKey = url ? normalizeUrlKey(url) : '';
    const platform = newsletterPlatformOf(post);
    let matched: UnifiedPost | undefined;

    // Layer 1: exact canonical URL
    if (urlKey) {
      matched = kept.find((p) => {
        const pu = extractLinkUrl(p);
        return pu ? normalizeUrlKey(pu) === urlKey : false;
      });
    }

    // Layer 2: fuzzy title similarity (Jaccard > 0.6) within a bounded window
    if (!matched && post.text.length > 10) {
      let bestSim = 0;
      for (const p of kept.slice(0, WINDOW)) {
        const sim = titleSimilarity(post.text, p.text);
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim >= TITLE_THRESHOLD)
        matched = kept.find((p) => titleSimilarity(post.text, p.text) === bestSim);
    }

    if (matched) {
      // Merge niches into the canonical copy
      matched.niches = [...new Set([...matched.niches, ...post.niches])];

      // Record cross-platform reference (grounding signal)
      const mRaw = matched.raw as Record<string, unknown> | undefined;
      if (mRaw) {
        const refs = new Set<string>((mRaw.crossReference as string[] | undefined) ?? []);
        refs.add(platform);
        const otherPlatform = newsletterPlatformOf(post);
        if (otherPlatform) refs.add(otherPlatform);
        mRaw.crossReference = [...refs];
        const urls = new Set<string>((mRaw.crossReferenceUrls as string[] | undefined) ?? []);
        if (url) urls.add(url);
        const otherUrl = extractLinkUrl(post);
        if (otherUrl) urls.add(otherUrl);
        mRaw.crossReferenceUrls = [...urls];
      }
    } else {
      // Fresh canonical copy — seed cross-reference tracking
      const raw = post.raw as Record<string, unknown> | undefined;
      if (raw) {
        raw.crossReference = [platform];
        if (url) raw.crossReferenceUrls = [url];
      }
      kept.push(post);
    }
  }

  return kept.slice(0, limit);
}

/**
 * Aggregate newsletter posts from Substack, Medium, Mirror, Paragraph, and Ghost.
 */
export async function fetchNewsletterPosts(limit = 30): Promise<UnifiedPost[]> {
  const perSource = Math.max(2, Math.ceil((limit * 2) / NEWSLETTER_SOURCES.length));

  const rssSources = [...NEWSLETTER_SOURCES, ...GHOST_SOURCES];

  const results = await Promise.allSettled([
    ...rssSources.map((src) => fetchRssSource(src, perSource)),
    fetchMirrorBridge(perSource),
    fetchParagraphBridge(perSource),
  ]);

  const all: UnifiedPost[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
    else failed++;
  }

  // Freshness: discard posts published outside the FEED_MAX_AGE_HOURS
  // window (48h) BEFORE the fuzzy cross-platform dedup.
  const fresh = filterFreshPosts(all);
  const deduped = deduplicateNewsletterPosts(fresh, limit);
  const platforms = new Set(deduped.map(newsletterPlatformOf));
  //   console.log(
  //     `[newsletter] ${deduped.length} posts from ${rssSources.length} RSS sources + mirror-bridge + paragraph-api across ${platforms.size} platforms (${failed} fetch groups failed)`,
  //   );
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'newsletter',
  name: 'Newsletters (Substack/Medium/Mirror/Paragraph/Ghost)',
  description: 'Curated crypto & web3 newsletters aggregated across five publishing platforms',
  endpoint: '/api/feed/newsletter',
  requiresAuth: false,
  contentType: 'article',
};

/** @alias */
export const fetch = fetchNewsletterPosts;
