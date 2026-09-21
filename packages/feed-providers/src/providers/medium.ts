/**
 * Medium provider — crypto/tech tags + top publications via Medium RSS.
 *
 * Medium exposes RSS at:
 *   https://medium.com/feed/{tag}        — topic tag
 *   https://medium.com/feed/@{username}  — author profile
 *   https://medium.com/feed/{publication} — publication
 *
 * Medium's RSS is served behind Cloudflare. Direct fetches work from most
 * egress IPs; when they fail (or return a Cloudflare challenge page) the
 * provider falls back to the self-hosted FlareSolverr instance
 * (http://127.0.0.1:8192) to bypass the challenge, then optionally an
 * RSS-Bridge URL if configured. We feature CREATORS (tags/publications)
 * and link through to the latest article.
 *
 * Image extraction is shared via article-media.ts (<img>, <enclosure>,
 * <media:content>, <media:thumbnail>, og:image, twitter:image) and the
 * first image is surfaced in post.media[] / embeds.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  fetchRaw,
  fetchRss,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';
import { extractImagesFromItemXml, firstImage, stripArticleHtml } from './article-media';

/** Curated Medium topic tags (RSS: https://medium.com/feed/tag/{tag}). */
export const CURATED_MEDIUM_TAGS = [
  'cryptocurrency',
  'blockchain',
  'defi',
  'web3',
  'ethereum',
  'solana',
  'programming',
  'startup',
  'technology',
  'bitcoin',
  'nft',
  'artificial-intelligence',
  'data-science',
] as const;

/** Top Medium publications + authors (RSS: https://medium.com/feed/{id}). */
export const CURATED_MEDIUM_PUBLICATIONS: Array<{ id: string; name: string; niche: string }> = [
  { id: 'the-capital', name: 'The Capital', niche: 'crypto' },
  { id: 'coinmonks', name: 'Coinmonks', niche: 'crypto' },
  { id: 'better-programming', name: 'Better Programming', niche: 'tech' },
  { id: '@VitalikButerin', name: 'Vitalik Buterin', niche: 'crypto' },
  { id: 'bankless', name: 'Bankless', niche: 'crypto' },
  { id: 'the-dark-side', name: 'The Dark Side', niche: 'crypto' },
];

export type MediumFeedKind = 'tag' | 'publication' | 'author';

export interface MediumSource {
  /** Tag name, publication slug, or @username. */
  id: string;
  kind?: MediumFeedKind;
  name?: string;
  niche?: string;
}

export interface MediumProviderOptions {
  /** Tags to fetch (default: CURATED_MEDIUM_TAGS). */
  tags?: string[];
  /** Extra publications/authors to fetch (default: CURATED_MEDIUM_PUBLICATIONS). */
  publications?: MediumSource[];
  /** FlareSolverr base URL for Cloudflare bypass (default http://127.0.0.1:8192). */
  flareSolverrUrl?: string;
  /** Optional RSS-Bridge base URL used as a second fallback. */
  rssBridgeUrl?: string;
  /** Override the RSS URL builder (testing). */
  feedUrlFor?: (source: MediumSource) => string;
  /** Per-feed concurrency (default 6). */
  concurrency?: number;
  /** Items per feed (default 25). */
  itemsPerFeed?: number;
}

/**
 * Browser-like UA for Medium. Medium's edge rate-limits generic crawler
 * UAs (the DegenFeed UA gets 429) while tolerating browser strings.
 */
export const MEDIUM_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface MediumFeed {
  title: string;
  link: string;
  description: string;
  items: MediumItem[];
}

interface MediumItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  description: string;
  content: string;
  images: string[];
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

/** Parse a Medium RSS 2.0 document (same shape as Substack feeds). */
export function parseMediumRss(xml: string, baseUrl: string): MediumFeed {
  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
  const channelXml = channelMatch?.[1] ?? xml;
  const feed: MediumFeed = {
    title: extractTag(channelXml, 'title') || baseUrl,
    link: extractTag(channelXml, 'link') || baseUrl,
    description: extractTag(channelXml, 'description'),
    items: [],
  };

  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    if (!title || !link) continue;
    feed.items.push({
      title,
      link,
      pubDate: extractTag(itemXml, 'pubDate'),
      author: extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author'),
      description: extractTag(itemXml, 'description'),
      content: extractTag(itemXml, 'content:encoded'),
      images: extractImagesFromItemXml(itemXml, baseUrl),
    });
  }
  return feed;
}

/** Build a UnifiedPost from one Medium item. */
export function mediumItemToPost(
  source: MediumSource,
  feed: MediumFeed,
  item: MediumItem,
  index: number,
): UnifiedPost {
  const displayName = source.name || feed.title || source.id;
  const image = firstImage(item.images[0], item.content, item.description);
  const author: UnifiedIdentity = {
    id: `medium:${source.kind ?? 'tag'}:${source.id}`,
    primary: { protocol: 'medium', id: source.id },
    handles: { medium: source.id } as UnifiedIdentity['handles'],
    displayName,
    bio: feed.description.slice(0, 300),
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'medium-source', url: feed.link }],
    keys: { mediumSource: source.id },
  };

  const html = item.content || item.description || '';
  const text = (item.title + (html ? `\n\n${stripArticleHtml(html).slice(0, 900)}` : '')).trim();
  const niches = new Set<string>(detectNiches(`${text} ${source.niche ?? ''}`));

  const embeds: UnifiedPost['embeds'] = [];
  for (const url of item.images.slice(0, 4)) embeds.push({ kind: 'image', url });
  embeds.push({ kind: 'link', url: item.link, meta: { title: item.title } });

  const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

  return {
    id: `medium:${source.id}:${item.link.replace(/[^a-zA-Z0-9_-]/g, '_') || index}`,
    protocol: 'medium',
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
      mediumSource: source.id,
      kind: source.kind ?? 'tag',
      itemTitle: item.title,
      author: item.author,
      pubDate: item.pubDate,
      images: item.images,
    },
    niches: [...niches],
  } as UnifiedPost;
}

/**
 * Detect whether a fetched RSS body is actually a Cloudflare challenge page
 * (HTML with "Just a moment" / challenge markup instead of <rss>/<feed>).
 */
export function isChallengePage(body: string): boolean {
  const head = body.slice(0, 4000).toLowerCase();
  return (
    !body.includes('<rss') &&
    !body.includes('<feed') &&
    (head.includes('just a moment') ||
      head.includes('attention required') ||
      head.includes('cf-challenge') ||
      head.includes('challenges.cloudflare.com'))
  );
}

export class MediumProvider implements FeedProvider {
  readonly protocol: Protocol = 'medium';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly tags: string[];
  private readonly publications: MediumSource[];
  private readonly flareSolverrUrl: string;
  private readonly flareSolverrExplicit: boolean;
  private readonly rssBridgeUrl?: string;
  private readonly feedUrlFor: (source: MediumSource) => string;
  private readonly concurrency: number;
  private readonly itemsPerFeed: number;
  private readonly breaker = new CircuitBreaker('medium');

  constructor(options: MediumProviderOptions = {}) {
    this.tags = options.tags ?? [...CURATED_MEDIUM_TAGS];
    this.publications = options.publications ?? CURATED_MEDIUM_PUBLICATIONS;
    this.flareSolverrUrl = (options.flareSolverrUrl ?? 'http://127.0.0.1:8192').replace(/\/+$/, '');
    this.flareSolverrExplicit = options.flareSolverrUrl !== undefined;
    this.rssBridgeUrl = options.rssBridgeUrl?.replace(/\/+$/, '');
    this.feedUrlFor =
      options.feedUrlFor ??
      ((source) => {
        if (source.kind === 'author') return `https://medium.com/feed/${source.id}`;
        if (source.kind === 'publication') return `https://medium.com/feed/${source.id}`;
        return `https://medium.com/feed/tag/${source.id}`;
      });
    this.concurrency = options.concurrency ?? 6;
    this.itemsPerFeed = options.itemsPerFeed ?? 25;
  }

  getSources(): MediumSource[] {
    return [
      ...this.tags.map((t) => ({ id: t, kind: 'tag' as const })),
      ...this.publications.map((p) => ({
        ...p,
        kind: (p.kind || 'publication') as 'tag' | 'publication',
      })),
    ];
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const sources = this.getSources();
    if (sources.length === 0) return { posts: [], notice: 'Medium: no sources configured' };
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const posts: UnifiedPost[] = [];
        let failed = 0;

        const results = await withConcurrencyLimit(sources, this.concurrency, async (source) => {
          try {
            const feed = await this.fetchMediumSource(source, timeoutMs, opts);
            if (!feed) {
              failed++;
              return [] as UnifiedPost[];
            }
            return feed.items
              .slice(0, this.itemsPerFeed)
              .map((item, index) => mediumItemToPost(source, feed, item, index));
          } catch {
            failed++;
            return [] as UnifiedPost[];
          }
        });
        for (const r of results) posts.push(...r);

        const deduped = deduplicateById(posts);
        const notice =
          failed > 0
            ? `Medium: ${deduped.length} posts from ${sources.length - failed}/${sources.length} tags/publications (${failed} failed)`
            : `Medium: ${deduped.length} posts from ${sources.length} tags/publications`;
        return { posts: deduped.slice(0, 100), notice };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Medium: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Medium feed unavailable' };
    }
  }

  /** Fetch one source's feed, falling back to FlareSolverr / RSS-Bridge. */
  private async fetchMediumSource(
    source: MediumSource,
    timeoutMs: number,
    opts: FetchOptions,
  ): Promise<MediumFeed | null> {
    const url = this.feedUrlFor(source);
    // Medium's edge treats generic crawler UAs poorly (429) but serves
    // browser strings reliably. Use the browser UA for the direct fetch.
    const headers = {
      'user-agent': MEDIUM_BROWSER_UA,
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      ...opts.headers,
    };

    // 1) Direct RSS fetch (works from most egress IPs)
    try {
      const xml = await withTimeout(
        fetchRss(url, {
          headers,
          signal: opts.signal,
        }),
        timeoutMs,
        `medium:${source.id}`,
      );
      if (!isChallengePage(xml)) return parseMediumRss(xml, url);
    } catch {
      // fall through to FlareSolverr
    }

    // 2) FlareSolverr Cloudflare bypass — fail fast (service often down).
    //    Give it a short, hard cap so a dead service can't eat the whole
    //    feed-generation budget for every source.
    // Skip the implicit default FlareSolverr (often down) unless it was
    // explicitly configured — an explicit opt-in must always be honored.
    if (
      this.flareSolverrUrl &&
      (this.flareSolverrExplicit || this.flareSolverrUrl !== 'http://127.0.0.1:8192')
    ) {
      try {
        const xml = await this.fetchViaFlareSolverr(url, Math.min(timeoutMs, 4000));
        if (xml && !isChallengePage(xml)) return parseMediumRss(xml, url);
      } catch {
        // fall through to RSS-Bridge
      }
    }

    // 3) RSS-Bridge proxy (if configured) — the Medium bridge may not be
    //    installed on the instance; try the specific bridge URL, else the
    //    generic UrlBridge. Fail fast either way.
    if (this.rssBridgeUrl) {
      try {
        const proxyUrl = `${this.rssBridgeUrl}/?action=display&bridge=Medium&context=By+tag&tag=${encodeURIComponent(source.id)}&format=Atom`;
        const res = await withTimeout(
          fetchRaw(proxyUrl, {
            headers: { 'user-agent': MEDIUM_BROWSER_UA },
          }),
          Math.min(timeoutMs, 4000),
          `medium:rssbridge:${source.id}`,
        );
        const body = await res.text();
        if (!isChallengePage(body) && (body.includes('<rss') || body.includes('<feed'))) {
          return parseMediumRss(body, url);
        }
      } catch {
        // give up on this source
      }
    }

    return null;
  }

  private async fetchViaFlareSolverr(url: string, timeoutMs: number): Promise<string | null> {
    const res = await withTimeout(
      fetchRaw(`${this.flareSolverrUrl}/v1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cmd: 'request.get',
          url,
          maxTimeout: Math.min(timeoutMs, 25000),
        }),
      }),
      Math.min(timeoutMs + 5000, 35000),
      `medium:flaresolverr:${url.slice(0, 48)}`,
    );
    const data = (await res.json()) as {
      status?: string;
      solution?: { response?: string };
    };
    if (data.status !== 'ok') return null;
    return data.solution?.response ?? null;
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    const probe = this.getSources()[0];
    if (!probe) return { healthy: false, latencyMs: 0, error: 'No sources' };
    try {
      const feed = await this.fetchMediumSource(probe, opts.timeoutMs ?? 4000, {});
      if (!feed || feed.items.length === 0) {
        return { healthy: false, latencyMs: Date.now() - start, error: 'No items from probe feed' };
      }
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
