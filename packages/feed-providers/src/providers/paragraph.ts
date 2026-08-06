/**
 * Paragraph provider — web3 publishing platform (paragraph.xyz).
 *
 * Primary source is the self-hosted `degenfeed-paragraph-bridge`
 * (port 8241), which already tracks 5 curated publications
 * (bankless, a16z, variant, doseofdefi, miles) and serves their latest
 * articles over HTTP. We wire straight through to it, transform the
 * bridge response into UnifiedPosts, and surface images via the shared
 * article-media helper.
 *
 * If the bridge is unavailable, a native RSS fallback fetches the known
 * publications directly from paragraph.xyz (`/api/feeds/rss/@{slug}`).
 *
 * Both paths carry a circuit breaker + health check.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, fetchRss, withTimeout } from '../utils';
import { extractImagesFromItemXml, firstImage, stripArticleHtml } from './article-media';

/** Default bridge endpoint — degenfeed-paragraph-bridge (port 8241). */
export const PARAGRAPH_BRIDGE_URL = 'http://127.0.0.1:8241';
export const PARAGRAPH_FRONT = 'https://paragraph.xyz';

/** Publications tracked by the bridge (also our RSS fallback list). */
export const CURATED_PARAGRAPH_PUBLICATIONS: Array<{ slug: string; name: string }> = [
  { slug: 'bankless', name: 'Bankless' },
  { slug: 'a16z', name: 'a16z Crypto' },
  { slug: 'variant', name: 'Variant Fund' },
  { slug: 'doseofdefi', name: 'Dose of DeFi' },
  { slug: 'miles', name: 'Miles Deutscher' },
];

export interface ParagraphBridgePost {
  id?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  publication?: string;
  slug?: string;
}

export interface ParagraphBridgeResponse {
  source?: string;
  posts?: ParagraphBridgePost[];
  total?: number;
}

export interface ParagraphProviderOptions {
  /** Bridge base URL (default http://127.0.0.1:8241). */
  bridgeUrl?: string;
  /** Publications for the native RSS fallback (default CURATED_PARAGRAPH_PUBLICATIONS). */
  publications?: Array<{ slug: string; name: string }>;
  /** Disable the native RSS fallback (bridge-only mode). */
  disableRssFallback?: boolean;
}

export function bridgePostToPost(post: ParagraphBridgePost): UnifiedPost {
  const slug = post.slug || 'paragraph';
  const publicationName = post.publication || slug;
  const link = post.link || `${PARAGRAPH_FRONT}/@${slug}`;
  const description = post.description ?? '';
  const image = firstImage(extractImagesFromItemXml(description, link)[0], description);

  const author: UnifiedIdentity = {
    id: `paragraph:${slug}`,
    primary: { protocol: 'paragraph', id: slug },
    handles: { paragraph: slug } as UnifiedIdentity['handles'],
    displayName: publicationName,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'paragraph-publication', url: `${PARAGRAPH_FRONT}/@${slug}` }],
    keys: { paragraphSlug: slug },
  };

  const text = (post.title ?? 'Paragraph Article') + (description ? `\n\n${stripArticleHtml(description).slice(0, 500)}` : '');
  const embeds: UnifiedPost['embeds'] = [];
  if (image) embeds.push({ kind: 'image', url: image });
  embeds.push({ kind: 'link', url: link, meta: { title: post.title } });

  const publishedAt = post.pubDate ? new Date(post.pubDate).getTime() : Date.now();

  return {
    id: `paragraph:${post.id || `${slug}:${link.replace(/[^a-zA-Z0-9_-]/g, '_')}`}`,
    protocol: 'paragraph',
    author,
    text,
    html: description || undefined,
    embeds,
    contentType: 'article',
    createdAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    image,
    media: image,
    raw: { source: 'paragraph-bridge', bridgePost: post },
    niches: [...new Set(detectNiches(text))],
  } as UnifiedPost;
}

/** Parse a Paragraph publication RSS feed (native fallback). */
export function parseParagraphRss(
  xml: string,
  source: { slug: string; name: string },
  baseUrl: string,
): UnifiedPost[] {
  const posts: UnifiedPost[] = [];
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extractTag(itemXml, 'title') || 'Paragraph Article';
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    if (!link) continue;
    const description = extractTag(itemXml, 'description');
    const content = extractTag(itemXml, 'content:encoded') || description;
    const images = extractImagesFromItemXml(itemXml, baseUrl);
    const image = firstImage(images[0], content, description);
    const publishedAt = new Date(extractTag(itemXml, 'pubDate')).getTime();
    const slug = source.slug;

    const author: UnifiedIdentity = {
      id: `paragraph:${slug}`,
      primary: { protocol: 'paragraph', id: slug },
      handles: { paragraph: slug } as UnifiedIdentity['handles'],
      displayName: source.name,
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'paragraph-publication', url: `${PARAGRAPH_FRONT}/@${slug}` }],
      keys: { paragraphSlug: slug },
    };

    const text =
      title + (content ? `\n\n${stripArticleHtml(content).slice(0, 500)}` : '');
    const embeds: UnifiedPost['embeds'] = [];
    for (const url of images.slice(0, 3)) embeds.push({ kind: 'image', url });
    embeds.push({ kind: 'link', url: link, meta: { title } });

    posts.push({
      id: `paragraph:rss:${slug}:${link.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      protocol: 'paragraph',
      author,
      text,
      html: content || undefined,
      embeds,
      contentType: 'article',
      createdAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      image,
      media: image,
      raw: { source: 'paragraph-rss', slug, rssUrl: baseUrl },
      niches: [...new Set(detectNiches(text))],
    } as UnifiedPost);
  }
  return posts;
}

function extractTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}(?:[^>]*)>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const m = re.exec(xml);
  if (!m?.[1]) return '';
  return m[1]
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

export class ParagraphProvider implements FeedProvider {
  readonly protocol: Protocol = 'paragraph';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly bridgeUrl: string;
  private readonly publications: Array<{ slug: string; name: string }>;
  private readonly disableRssFallback: boolean;
  private readonly breaker = new CircuitBreaker('paragraph');

  constructor(options: ParagraphProviderOptions = {}) {
    this.bridgeUrl = (options.bridgeUrl ?? PARAGRAPH_BRIDGE_URL).replace(/\/+$/, '');
    this.publications = options.publications ?? CURATED_PARAGRAPH_PUBLICATIONS;
    this.disableRssFallback = options.disableRssFallback ?? false;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const bridgePosts = await this.fetchFromBridge(timeoutMs, opts);
        if (bridgePosts.length > 0) {
          return {
            posts: bridgePosts.slice(0, 50),
            notice: `Paragraph: ${bridgePosts.length} posts from bridge (${this.publications.length} publications)`,
          };
        }
        if (this.disableRssFallback) {
          return { posts: [], notice: 'Paragraph: bridge returned no posts (RSS fallback disabled)' };
        }
        // Native RSS fallback
        const rssPosts = await this.fetchRssFallback(timeoutMs, opts);
        return {
          posts: rssPosts.slice(0, 50),
          notice:
            rssPosts.length > 0
              ? `Paragraph: ${rssPosts.length} posts via native RSS fallback (bridge unavailable)`
              : 'Paragraph: no posts (bridge + RSS fallback unavailable)',
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Paragraph: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Paragraph feed unavailable' };
    }
  }

  private async fetchFromBridge(
    timeoutMs: number,
    opts: FetchOptions,
  ): Promise<UnifiedPost[]> {
    try {
      const data = await withTimeout(
        fetchJson<ParagraphBridgeResponse>(
          `${this.bridgeUrl}/api/paragraph/posts?limit=50`,
          { signal: opts.signal },
        ),
        timeoutMs,
        'paragraph:bridge',
      );
      const posts = data.posts ?? [];
      if (!Array.isArray(posts)) return [];
      return posts.map(bridgePostToPost);
    } catch {
      return [];
    }
  }

  private async fetchRssFallback(
    timeoutMs: number,
    opts: FetchOptions,
  ): Promise<UnifiedPost[]> {
    const all: UnifiedPost[] = [];
    for (const pub of this.publications) {
      try {
        const url = `${PARAGRAPH_FRONT}/api/feeds/rss/@${pub.slug}`;
        const xml = await withTimeout(
          fetchRss(url, {
            headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers },
          }),
          timeoutMs,
          `paragraph:rss:${pub.slug}`,
        );
        all.push(...parseParagraphRss(xml, pub, url));
      } catch {
        // skip failed publication
      }
    }
    // Deduplicate by id, newest first
    const seen = new Set<string>();
    const out: UnifiedPost[] = [];
    for (const p of all.sort((a, b) => b.createdAt - a.createdAt)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      const res = await withTimeout(
        fetch(`${this.bridgeUrl}/health`, {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
          signal: opts.signal,
        }),
        opts.timeoutMs ?? 3000,
        'paragraph:health',
      );
      if (res.ok) return { healthy: true, latencyMs: Date.now() - start };
      return { healthy: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
