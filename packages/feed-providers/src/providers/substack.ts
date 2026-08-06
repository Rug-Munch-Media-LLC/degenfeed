/**
 * Substack provider — top crypto/tech newsletters via their RSS feeds.
 *
 * Substack publications expose RSS at https://{publication}.substack.com/feed.
 * Each feed item carries: title, link, dc:creator (author), pubDate,
 * description, content:encoded (full HTML body) and usually an inline
 * <img> / media:content thumbnail. We feature CREATORS (the publication)
 * and link through to the latest article — including paid pieces, since
 * users click through to read.
 *
 * Image extraction is shared via article-media.ts and covers <img>,
 * <enclosure>, <media:content>, <media:thumbnail>, og:image and
 * twitter:image — all surfaced in post.media[] / embeds.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchRss,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';
import {
  extractImagesFromItemXml,
  firstImage,
  stripArticleHtml,
} from './article-media';

/** Curated top crypto/tech Substack publications. */
export const CURATED_SUBSTACKS: Array<{ slug: string; name: string; niche: string }> = [
  { slug: 'milkroad', name: 'Milk Road', niche: 'crypto' },
  { slug: 'li', name: "Li's Newsletter", niche: 'crypto' },
  { slug: 'bankless', name: 'Bankless', niche: 'crypto' },
  { slug: 'messari', name: 'Messari', niche: 'crypto' },
  { slug: 'variantfund', name: 'Variant Fund', niche: 'crypto' },
  { slug: 'notboring', name: 'Not Boring', niche: 'tech' },
  { slug: 'platformer', name: 'Platformer', niche: 'tech' },
  { slug: 'every', name: 'Every', niche: 'tech' },
  { slug: 'a16zcrypto', name: 'a16z Crypto', niche: 'crypto' },
  { slug: 'dragonfly', name: 'Dragonfly Research', niche: 'crypto' },
  { slug: 'thedefiant', name: 'The Defiant', niche: 'crypto' },
  { slug: 'blockworks', name: 'Blockworks', niche: 'crypto' },
  { slug: 'decryptmedia', name: 'Decrypt', niche: 'crypto' },
  { slug: 'unchainedcrypto', name: 'Unchained', niche: 'crypto' },
];

export interface SubstackSource {
  slug: string;
  name?: string;
  niche?: string;
}

export interface SubstackProviderOptions {
  /** Substack publication slugs to fetch (default: CURATED_SUBSTACKS). */
  sources?: SubstackSource[];
  /** Override the RSS base URL pattern (testing). */
  feedUrlFor?: (slug: string) => string;
  /** Per-feed concurrency (default 4). */
  concurrency?: number;
}

interface SubstackFeed {
  title: string;
  link: string;
  description: string;
  image?: string;
  items: SubstackItem[];
}

interface SubstackItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  description: string;
  content: string;
  images: string[];
}

/** Extract a single RSS element's text (handles CDATA + entities). */
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

/** Parse a Substack RSS 2.0 document into a normalized feed shape. */
export function parseSubstackRss(xml: string, baseUrl: string): SubstackFeed {
  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
  const channelXml = channelMatch?.[1] ?? xml;
  const feed: SubstackFeed = {
    title: extractTag(channelXml, 'title') || baseUrl,
    link: extractTag(channelXml, 'link') || baseUrl,
    description: extractTag(channelXml, 'description'),
    items: [],
  };
  const channelImageMatch = channelXml.match(/<image>([\s\S]*?)<\/image>/i);
  if (channelImageMatch?.[1]) {
    feed.image = extractTag(channelImageMatch[1], 'url') || '';
  }

  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    if (!title || !link) continue;
    const description = extractTag(itemXml, 'description');
    const content = extractTag(itemXml, 'content:encoded');
    const author = extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author');
    feed.items.push({
      title,
      link,
      pubDate: extractTag(itemXml, 'pubDate'),
      author,
      description,
      content,
      images: extractImagesFromItemXml(itemXml, baseUrl),
    });
  }
  return feed;
}

/** Build a UnifiedPost from one Substack item. */
export function substackItemToPost(
  source: SubstackSource,
  feed: SubstackFeed,
  item: SubstackItem,
  index: number,
): UnifiedPost {
  const displayName = source.name || feed.title || source.slug;
  const image = firstImage(item.images[0], item.content, item.description, feed.image);
  const author: UnifiedIdentity = {
    id: `substack:${source.slug}`,
    primary: { protocol: 'substack', id: source.slug },
    handles: { substack: source.slug } as UnifiedIdentity['handles'],
    displayName,
    bio: feed.description.slice(0, 300),
    avatarUrl: feed.image ?? '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'substack-publication', url: feed.link }],
    keys: { substackSlug: source.slug },
  };

  const html = item.content || item.description || '';
  const text = (item.title + (html ? `\n\n${stripArticleHtml(html).slice(0, 900)}` : '')).trim();
  const niches = new Set<string>(detectNiches(`${text} ${source.niche ?? ''}`));

  const embeds: UnifiedPost['embeds'] = [];
  for (const url of item.images.slice(0, 4)) embeds.push({ kind: 'image', url });
  embeds.push({ kind: 'link', url: item.link, meta: { title: item.title } });

  const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

  return {
    id: `substack:${source.slug}:${item.link.replace(/[^a-zA-Z0-9_-]/g, '_') || index}`,
    protocol: 'substack',
    author,
    text,
    html,
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
    raw: {
      substackSlug: source.slug,
      itemTitle: item.title,
      author: item.author,
      pubDate: item.pubDate,
      images: item.images,
    },
    niches: [...niches],
  } as UnifiedPost;
}

export class SubstackProvider implements FeedProvider {
  readonly protocol: Protocol = 'substack';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly sources: SubstackSource[];
  private readonly feedUrlFor: (slug: string) => string;
  private readonly concurrency: number;
  private readonly breaker = new CircuitBreaker('substack');

  constructor(options: SubstackProviderOptions = {}) {
    const raw = options.sources ?? CURATED_SUBSTACKS;
    this.sources = raw.map((s) => ({
      slug: s.slug.toLowerCase().replace(/\.substack\.com$/, ''),
      name: s.name,
      niche: s.niche,
    }));
    this.feedUrlFor =
      options.feedUrlFor ?? ((slug) => `https://${slug}.substack.com/feed`);
    this.concurrency = options.concurrency ?? 4;
  }

  getSources(): SubstackSource[] {
    return this.sources;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    if (this.sources.length === 0) return { posts: [], notice: 'Substack: no sources configured' };
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const posts: UnifiedPost[] = [];
        let failed = 0;

        const results = await withConcurrencyLimit(
          this.sources,
          this.concurrency,
          async (source) => {
            try {
              const url = this.feedUrlFor(source.slug);
              const xml = await withTimeout(
                fetchRss(url, {
                  headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers },
                  signal: opts.signal,
                }),
                timeoutMs,
                `substack:${source.slug}`,
              );
              const feed = parseSubstackRss(xml, url);
              return feed.items.slice(0, 5).map((item, index) =>
                substackItemToPost(source, feed, item, index),
              );
            } catch {
              failed++;
              return [] as UnifiedPost[];
            }
          },
        );
        for (const r of results) posts.push(...r);

        const deduped = deduplicateById(posts);
        const notice =
          failed > 0
            ? `Substack: ${deduped.length} posts from ${this.sources.length - failed}/${this.sources.length} publications (${failed} failed)`
            : `Substack: ${deduped.length} posts from ${this.sources.length} publications`;
        return { posts: deduped.slice(0, 100), notice };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Substack: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Substack feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    const probe = this.sources[0];
    if (!probe) return { healthy: false, latencyMs: 0, error: 'No sources' };
    try {
      await withTimeout(
        fetchRss(this.feedUrlFor(probe.slug), {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
        }),
        opts.timeoutMs ?? 3000,
        `substack:health:${probe.slug}`,
      );
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}

function deduplicateById(posts: UnifiedPost[]): UnifiedPost[] {
  const seen = new Set<string>();
  const out: UnifiedPost[] = [];
  for (const p of posts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
