import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import type { NewsSourceMeta } from './news-types';

export interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  content?: string;
  image?: string;
  categories: string[];
  /** Media thumbnail URL (media:thumbnail) */
  mediaThumbnail?: string;
  /** Enclosure URL (podcast/video/image) */
  enclosureUrl?: string;
  /** Enclosure type (image/jpeg, etc.) */
  enclosureType?: string;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}

export function stripTags(html: string): string {
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

function extractText(tag: string, xml: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? decodeXmlEntities(match[1] || '') : '';
}

function extractAll(tag: string, xml: string): string[] {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    out.push(decodeXmlEntities(m[1] || ''));
    m = re.exec(xml);
  }
  return out;
}

function _parseFeedXml(xml: string, maxItems = 20): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];

  // Try Atom first
  if (xml.trim().includes('<feed')) {
    return parseAtom(xml, maxItems);
  }

  // RSS 2.0
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const itemXml = m[2] || '';
    const title = extractText('title', itemXml);
    const link = extractText('link', itemXml) || extractText('guid', itemXml);
    const description = extractText('description', itemXml);
    const content = extractText('content:encoded', itemXml) || extractText('content', itemXml);
    const pubDate = extractText('pubDate', itemXml) || extractText('dc:date', itemXml);
    const creator = extractText('dc:creator', itemXml) || extractText('author', itemXml);
    const categories = extractAll('category', itemXml);

    let image = '';
    const media = itemXml.match(/<media:content[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (media?.[1]) image = media[1];
    const mediaThumbnailMatch = itemXml.match(/<media:thumbnail[^>]+url\s*=\s*["']([^"']+)["']/i);
    const mediaThumbnail = mediaThumbnailMatch?.[1] ?? '';
    const enclosure = itemXml.match(/<enclosure[^>]+url\s*=\s*["']([^"']+)["']/i);
    const enclosureUrl = enclosure?.[1] ?? '';
    const enclosureTypeMatch = enclosure?.input?.match(/type\s*=\s*["']([^"']+)["']/i);
    const enclosureType = enclosureTypeMatch?.[1] ?? '';
    if (!image && enclosureUrl && enclosureType?.startsWith('image')) image = enclosureUrl;
    if (!image && mediaThumbnail) image = mediaThumbnail;
    const imgTag = itemXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (!image && imgTag?.[1]) image = imgTag[1];

    if (title && link) {
      items.push({
        title,
        link,
        description,
        pubDate,
        creator,
        content,
        image,
        categories,
        mediaThumbnail,
        enclosureUrl,
        enclosureType,
      });
    }
    m = itemRe.exec(xml);
  }

  return items;
}

function parseAtom(xml: string, maxItems = 20): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = entryRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const entryXml = m[2] || '';
    const title = extractText('title', entryXml);
    const linkMatch = entryXml.match(/<link[^>]+href\s*=\s*["']([^"']+)["']/i);
    const link = linkMatch?.[1] || extractText('id', entryXml);
    const description = extractText('summary', entryXml);
    const content = extractText('content', entryXml);
    const pubDate = extractText('updated', entryXml) || extractText('published', entryXml);
    const creator = extractText('name', entryXml);
    const categories = extractAll('category', entryXml);

    let image = '';
    const imgTag = entryXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (imgTag?.[1]) image = imgTag[1];
    const mediaThumbnailMatch = entryXml.match(/<media:thumbnail[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (!image && mediaThumbnailMatch?.[1]) image = mediaThumbnailMatch[1];

    if (title && link) {
      items.push({ title, link, description, pubDate, creator, content, image, categories });
    }
    m = entryRe.exec(xml);
  }

  return items;
}

async function _fetchRssFeed(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'DegenFeed/0.1 (news aggregator; +https://degenfeed.xyz)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

export interface ArticleEnrichment {
  heroImage: string;
  metaDescription: string;
  authorName: string;
  readingTime: number;
}

/**
 * Estimate reading time from word count.
 */
function _estimateReadingTime(text: string): number {
  const wc = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wc / 200));
}

/**
async function enrichArticle(url: string, timeoutMs = 3000): Promise<ArticleEnrichment> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/1.0; +https://degenfeed.xyz)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };
    }

    // Read first 64KB — enough for <head> metadata
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      while (!(chunk = await reader.read()).done && html.length < 65536) {
        html += decoder.decode(chunk.value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
      html = html.slice(0, 65536);
    }

    const enrichment: ArticleEnrichment = {
      heroImage: '',
      metaDescription: '',
      authorName: '',
      readingTime: 0,
    };

    // og:image
    const ogImageMatch = html.match(
      /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    );
    if (ogImageMatch?.[1]) enrichment.heroImage = ogImageMatch[1];

    // twitter:image
    if (!enrichment.heroImage) {
      const twImageMatch = html.match(
        /<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i,
      );
      if (twImageMatch?.[1]) enrichment.heroImage = twImageMatch[1];
    }

    // First large image in body as fallback
    if (!enrichment.heroImage) {
      const firstImg = html.match(
        /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*(?:width\s*=\s*["'](\d+)["'])?[^>]*>/i,
      );
      if (firstImg?.[1] && (!firstImg[2] || Number(firstImg[2]) > 200)) {
        const src = firstImg[1];
        if (src.startsWith('http')) enrichment.heroImage = src;
      }
    }

    // Meta description
    const descMatch = html.match(
      /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    );
    if (descMatch?.[1]) enrichment.metaDescription = descMatch[1].slice(0, 300);

    // og:description fallback
    if (!enrichment.metaDescription) {
      const ogDescMatch = html.match(
        /<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']+)["']/i,
      );
      if (ogDescMatch?.[1]) enrichment.metaDescription = ogDescMatch[1].slice(0, 300);
    }

    // Author from meta
    const authorMatch = html.match(
      /<meta[^>]+name\s*=\s*["']author["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    );
    if (authorMatch?.[1]) enrichment.authorName = authorMatch[1];

    // og:author fallback
    if (!enrichment.authorName) {
      const ogAuthorMatch = html.match(
        /<meta[^>]+property\s*=\s*["']article:author["'][^>]+content\s*=\s*["']([^"']+)["']/i,
      );
      if (ogAuthorMatch?.[1]) enrichment.authorName = ogAuthorMatch[1];
    }

    return enrichment;
  } catch {
    return { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };
  }
} */

// ─── Protocol Source Fetching ──────────────────────────────────────────

async function _fetchProtocolSources(
  env: Env,
): Promise<Array<{ item: ParsedRssItem; source: NewsSourceMeta }>> {
  const results: Array<{ item: ParsedRssItem; source: NewsSourceMeta }> = [];

  // Try to fetch from Nostr news relays, Farcaster, Bluesky via existing providers
  try {
    const { getProvider } = await import('./feed-fetcher');
    const providers = ['nostr', 'farcaster', 'bluesky'] as Protocol[];

    const providerResults = await Promise.allSettled(
      providers.map(async (protocol) => {
        try {
          const provider = getProvider(protocol, env);
          const result = await provider.fetchFeed({ timeoutMs: 4000, concurrency: 2 });
          return result.posts
            .filter((p) => {
              const text = `${p.text} ${p.niches?.join(' ') ?? ''}`.toLowerCase();
              // Filter for news-like content: has link, niche tags, crypto terms
              return (
                p.embeds?.some((e) => e.kind === 'link') &&
                (p.niches?.length > 0 || text.includes('news') || text.includes('report'))
              );
            })
            .map((post): { item: ParsedRssItem; source: NewsSourceMeta } => ({
              item: {
                title:
                  post.text.slice(0, 200).split('\n')[0] || `Post from ${post.author.displayName}`,
                link:
                  post.embeds?.find((e) => e.kind === 'link')?.url ??
                  `https://degenfeed.xyz/post/${post.id}`,
                description: post.text.slice(0, 500),
                pubDate: new Date(post.createdAt).toISOString(),
                creator: post.author.displayName,
                content: post.html || post.text,
                image: post.embeds?.find((e) => e.kind === 'image')?.url ?? '',
                categories: post.niches ?? [],
              },
              source: {
                id: `${protocol}:${post.id.slice(0, 8)}`,
                name: `${protocol.charAt(0).toUpperCase() + protocol.slice(1)} News`,
                category: 'crypto',
                tier: 3,
                credibility: 0.65,
                weight: 0.9,
                url: '',
                type: protocol as 'nostr' | 'farcaster' | 'bluesky',
              },
            }));
        } catch {
          return [] as Array<{ item: ParsedRssItem; source: NewsSourceMeta }>;
        }
      }),
    );

    for (const r of providerResults) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  } catch {
    // Protocol sources unavailable — skip
  }

  return results;
}

// ─── Concurrency Limit Helper ──────────────────────────────────────────

async function _withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = new Set<Promise<void>>();
  while (queue.length > 0 || runners.size > 0) {
    while (runners.size < limit && queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      const promise = fn(item)
        .catch(() => {})
        .finally(() => {
          runners.delete(promise);
        });
      runners.add(promise);
    }
    if (runners.size > 0) await Promise.race(runners);
  }
}
