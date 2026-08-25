/**
 * Lobsters provider — computing-focused link aggregation (like HN for tech).
 *
 * Primary source is the official JSON API (`https://lobste.rs/hottest.json`),
 * which returns real stories with score, comment counts, tags, and author.
 * When the JSON endpoint is unavailable we fall back to the RSS feed
 * (`https://lobste.rs/rss`), verified working 2026-08-06.
 *
 * Both paths carry a circuit breaker + health check.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, fetchRss, withTimeout } from '../utils';
import { extractImagesFromItemXml, firstImage, stripArticleHtml } from './article-media';

export const LOBSTERS_JSON_URL = 'https://lobste.rs/hottest.json';
export const LOBSTERS_RSS_URL = 'https://lobste.rs/rss';

export interface LobstersStory {
  short_id?: string;
  short_id_url?: string;
  created_at?: string;
  title?: string;
  url?: string;
  score?: number;
  comment_count?: number;
  description?: string;
  description_plain?: string;
  submitter_user?: string;
  tags?: string[];
}

interface LobstersRssItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  description: string;
  images: string[];
}

/** Build a UnifiedPost from one Lobsters JSON story. */
export function lobstersStoryToPost(story: LobstersStory): UnifiedPost | null {
  const title = (story.title ?? '').trim();
  const link = story.url || story.short_id_url || '';
  if (!title || !link) return null;

  const submitter = story.submitter_user || 'lobsters-user';
  const author: UnifiedIdentity = {
    id: `lobsters:${submitter}`,
    primary: { protocol: 'lobsters', id: submitter },
    handles: { lobsters: submitter } as UnifiedIdentity['handles'],
    displayName: submitter,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'lobsters-user', url: `https://lobste.rs/u/${submitter}` }],
    keys: { lobstersUsername: submitter },
  };

  const body = story.description_plain || story.description || '';
  const text = title + (body ? `\n\n${stripArticleHtml(body).slice(0, 500)}` : '');
  const commentLink = story.short_id_url || link;

  const embeds: UnifiedPost['embeds'] = [
    { kind: 'link', url: link, meta: { title } },
    {
      kind: 'link',
      url: commentLink,
      meta: { title: `${story.comment_count ?? 0} comments on Lobsters` },
    },
  ];

  const created = story.created_at ? new Date(story.created_at).getTime() : Date.now();

  return {
    id: `lobsters:${story.short_id || link.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    protocol: 'lobsters',
    author,
    text,
    html: body
      ? `<p>${stripArticleHtml(body).slice(0, 1200).replace(/\n/g, '<br/>')}</p>`
      : undefined,
    embeds,
    contentType: 'link',
    createdAt: Number.isNaN(created) ? Date.now() : created,
    metrics: {
      likes: story.score ?? 0,
      reposts: 0,
      replies: story.comment_count ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: story.score ?? 0, reposts: 0, replies: story.comment_count ?? 0, quotes: 0 },
    },
    url: link,
    raw: { source: 'lobsters-json', shortId: story.short_id, tags: story.tags },
    niches: [...new Set(detectNiches(`${title} ${body} ${(story.tags ?? []).join(' ')}`))],
  } as UnifiedPost;
}

/** Parse the Lobsters RSS feed into posts (fallback path). */
export function lobstersRssToPosts(xml: string): UnifiedPost[] {
  const posts: UnifiedPost[] = [];
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    if (!title || !link) continue;
    const item: LobstersRssItem = {
      title,
      link,
      pubDate: extractTag(itemXml, 'pubDate'),
      author: extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author') || 'lobsters-user',
      description: extractTag(itemXml, 'description'),
      images: extractImagesFromItemXml(itemXml, LOBSTERS_RSS_URL),
    };
    const post = lobstersRssItemToPost(item);
    if (post) posts.push(post);
  }
  return posts;
}

function lobstersRssItemToPost(item: LobstersRssItem): UnifiedPost | null {
  const title = (item.title ?? '').trim();
  if (!title || !item.link) return null;
  const submitter = item.author || 'lobsters-user';
  const author: UnifiedIdentity = {
    id: `lobsters:${submitter}`,
    primary: { protocol: 'lobsters', id: submitter },
    handles: { lobsters: submitter } as UnifiedIdentity['handles'],
    displayName: submitter,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'lobsters-user', url: `https://lobste.rs/u/${submitter}` }],
    keys: { lobstersUsername: submitter },
  };
  const image = firstImage(item.images[0], item.description);
  const embeds: UnifiedPost['embeds'] = [];
  for (const url of item.images.slice(0, 3)) embeds.push({ kind: 'image', url });
  embeds.push({ kind: 'link', url: item.link, meta: { title } });

  const publishedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

  return {
    id: `lobsters:rss:${item.link.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    protocol: 'lobsters',
    author,
    text: title,
    html: item.description
      ? `<p>${stripArticleHtml(item.description).slice(0, 900)}</p>`
      : undefined,
    embeds,
    contentType: 'link',
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
    url: item.link,
    raw: { source: 'lobsters-rss', author: item.author },
    niches: [...new Set(detectNiches(title))],
  } as UnifiedPost;
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

export class LobstersProvider implements FeedProvider {
  readonly protocol: Protocol = 'lobsters';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly jsonUrl: string;
  private readonly rssUrl: string;
  private readonly breaker = new CircuitBreaker('lobsters');

  constructor(options: { jsonUrl?: string; rssUrl?: string } = {}) {
    this.jsonUrl = options.jsonUrl ?? LOBSTERS_JSON_URL;
    this.rssUrl = options.rssUrl ?? LOBSTERS_RSS_URL;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

        // 1) Primary: official JSON API
        try {
          const stories = await withTimeout(
            fetchJson<LobstersStory[]>(this.jsonUrl, {
              headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers },
              signal: opts.signal,
            }),
            timeoutMs,
            'lobsters:json',
          );
          if (Array.isArray(stories) && stories.length > 0) {
            const posts: UnifiedPost[] = [];
            for (const s of stories) {
              const post = lobstersStoryToPost(s);
              if (post) posts.push(post);
            }
            if (posts.length > 0) {
              return {
                posts: posts.slice(0, 50),
                notice: `Lobsters: ${posts.length} stories via hottest.json`,
              };
            }
          }
        } catch {
          // fall through to RSS
        }

        // 2) Fallback: RSS feed
        try {
          const xml = await withTimeout(
            fetchRss(this.rssUrl, {
              headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers },
              signal: opts.signal,
            }),
            timeoutMs,
            'lobsters:rss',
          );
          const posts = lobstersRssToPosts(xml);
          if (posts.length > 0) {
            return {
              posts: posts.slice(0, 50),
              notice: `Lobsters: ${posts.length} stories via RSS fallback`,
            };
          }
          return { posts: [], notice: 'Lobsters: RSS fallback returned no stories' };
        } catch {
          return { posts: [], notice: 'Lobsters: no posts (JSON + RSS unavailable)' };
        }
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Lobsters: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Lobsters feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      const stories = await withTimeout(
        fetchJson<LobstersStory[]>(this.jsonUrl, {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
        }),
        opts.timeoutMs ?? 4000,
        'lobsters:health',
      );
      if (Array.isArray(stories) && stories.length > 0) {
        return { healthy: true, latencyMs: Date.now() - start };
      }
      return { healthy: false, latencyMs: Date.now() - start, error: 'Empty response' };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
