import type { Embed } from '@degenfeed/types';
import { detectNiches } from '@degenfeed/feed-core';
import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { RssFeedConfig, RssItem, ScoredRssPost } from './types';
import { computeQualityScore } from './quality';

function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRe = /\u003cimg[^\u003e]+src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((match = imgRe.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

export function parseRss(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const trimmed = xml.trim();
  if (trimmed.includes('\u003cfeed')) return parseAtom(trimmed);
  return parseRss2(trimmed);
}

function parseRss2(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const channelMatch = xml.match(/\u003cchannel\u003e([\s\S]*?)\u003c\/channel\u003e/i);
  const channelXml = channelMatch?.[1] ?? '';
  const extract = (tag: string, source: string) => {
    const re = new RegExp(`\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`, 'i');
    const m = source.match(re);
    return m ? stripHtml(m[1] ?? '') : '';
  };
  const feed = {
    title: extract('title', channelXml),
    link: extract('link', channelXml),
    description: extract('description', channelXml),
    items: [] as RssItem[],
  };

  const itemRe = /\u003citem([^\u003e]*)\u003e([\s\S]*?)\u003c\/item\u003e/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extract('title', itemXml);
    const link = extract('link', itemXml) || extract('guid', itemXml);
    if (title && link) {
      const desc = extract('description', itemXml) || extract('content:encoded', itemXml);
      const categories: string[] = [];
      const catRe = /\u003ccategory(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/category\u003e/gi;
      let cm: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
      while ((cm = catRe.exec(itemXml)) !== null) {
        if (cm[1]) categories.push(stripHtml(cm[1]));
      }
      const enclosureMatch = itemXml.match(/\u003cenclosure[^\u003e]+url\s*=\s*["']([^"']+)["']/i);
      feed.items.push({
        title,
        link,
        pubDate: extract('pubDate', itemXml),
        description: desc,
        content: extract('content:encoded', itemXml),
        creator: extract('dc:creator', itemXml) || extract('author', itemXml),
        categories,
        enclosure: enclosureMatch ? { url: enclosureMatch[1] } : undefined,
      });
    }
  }
  return feed;
}

function parseAtom(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const extract = (tag: string) => {
    const re = new RegExp(`\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`, 'i');
    const m = xml.match(re);
    return m ? stripHtml(m[1] ?? '') : '';
  };
  const linkMatch = xml.match(/\u003clink[^\u003e]+href\s*=\s*["']([^"']+)["']/i);
  const feed = {
    title: extract('title'),
    link: linkMatch?.[1] ?? '',
    description: extract('subtitle'),
    items: [] as RssItem[],
  };

  const entryRe = /\u003centry([^\u003e]*)\u003e([\s\S]*?)\u003c\/entry\u003e/gi;
  let em: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((em = entryRe.exec(xml)) !== null) {
    const entryXml = em[2] ?? '';
    const entryTitle = (() => {
      const re = /\u003ctitle(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/title\u003e/i;
      const match = entryXml.match(re);
      return match ? stripHtml(match[1] ?? '') : '';
    })();
    const entryLinkMatch = entryXml.match(/\u003clink[^\u003e]+href\s*=\s*["']([^"']+)["']/i);
    const entryLink = entryLinkMatch?.[1] ?? '';
    if (entryTitle && entryLink) {
      const summaryRe = /\u003csummary(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/summary\u003e/i;
      const contentRe = /\u003ccontent(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/content\u003e/i;
      const summary = entryXml.match(summaryRe)?.[1] ?? '';
      const content = entryXml.match(contentRe)?.[1] ?? '';
      const updatedRe = /\u003cupdated(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/updated\u003e/i;
      const publishedRe = /\u003cpublished(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/published\u003e/i;
      const date = entryXml.match(updatedRe)?.[1] ?? entryXml.match(publishedRe)?.[1] ?? '';
      const nameRe = /\u003cname(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/name\u003e/i;
      const categories: string[] = [];
      const catRe = /\u003ccategory(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/category\u003e/gi;
      let cm: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
      while ((cm = catRe.exec(entryXml)) !== null) {
        if (cm[1]) categories.push(stripHtml(cm[1]));
      }
      feed.items.push({
        title: entryTitle,
        link: entryLink,
        pubDate: date,
        description: summary,
        content,
        creator: entryXml.match(nameRe)?.[1] ?? '',
        categories,
      });
    }
  }
  return feed;
}

export function feedToUnifiedPosts(
  feedConfig: RssFeedConfig,
  feed: ReturnType<typeof parseRss>,
): ScoredRssPost[] {
  const feedUrl = feedConfig.url;
  const author: UnifiedIdentity = {
    id: `rss:${feedUrl}`,
    primary: { protocol: 'rss', id: feedUrl },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: feed.title || feedUrl,
    bio: feed.description?.slice(0, 300) ?? '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'source', url: feed.link || feedUrl }],
    keys: {},
  };

  return feed.items.map((item): ScoredRssPost => {
    const html = item.content || item.description || '';
    const text = stripHtml(html).slice(0, 1000) || item.title || '';
    const embeds: Embed[] = [];
    if (item.enclosure?.url) {
      const type = item.enclosure.type ?? '';
      if (type.startsWith('image/')) embeds.push({ kind: 'image', url: item.enclosure.url });
      else if (type.startsWith('video/')) embeds.push({ kind: 'video', url: item.enclosure.url });
    }
    for (const url of extractImageUrls(html)) {
      embeds.push({ kind: 'image', url });
    }
    if (item.link) embeds.push({ kind: 'link', url: item.link });

    const niches = detectNiches(`${text} ${item.categories?.join(' ') ?? ''}`);

    const post: UnifiedPost = {
      id: `rss:${feedUrl}:${item.link?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? Date.now()}`,
      protocol: 'rss',
      author,
      text,
      html,
      embeds,
      createdAt: parseDate(item.pubDate),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: { item, feedUrl, config: feedConfig },
      niches: [...new Set([...niches, ...(item.categories ?? []).map((c) => c.toLowerCase())])],
    };

    const quality = computeQualityScore(post, feedConfig);

    return { post, config: feedConfig, quality };
  });
}
