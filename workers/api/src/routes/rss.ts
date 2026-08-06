import type { SourcePosts, UnifiedPost } from '@degenfeed/rss-sdk';
import {
  DEFAULT_SUBREDDITS,
  feedToUnifiedPosts,
  GenericRssSource,
  MediumSource,
  MirrorSource,
  ParagraphSource,
  RedditSource,
  SubstackSource,
} from '@degenfeed/rss-sdk';
import { DEFAULT_CRYPTO_FEEDS } from '@degenfeed/feed-providers';
import { jsonResponse } from '../response-helpers';
import { isValidFetchUrl } from '../sanitize';
import type { Env } from '../types';

/** Maximum number of feeds fetched in the default (no-args) RSS path. */
const DEFAULT_PATH_MAX_FEEDS = 12;

/**
 * Return a bounded slice of the curated crypto RSS feeds (DEFAULT_CRYPTO_FEEDS)
 * as raw URL strings. Bounding keeps the default path fast (Cloudflare CPU
 * budget) while still pulling real news from the top-tier sources.
 */
function DEFAULT_CRYPTO_FEEDS_SLICE(): string[] {
  return DEFAULT_CRYPTO_FEEDS.slice(0, DEFAULT_PATH_MAX_FEEDS)
    .map((f) => (typeof f === 'string' ? f : f.url))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
}

export async function handleRssFeed(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const source = params.get('source');
  const handle = params.get('handle');
  const url = params.get('url');
  const limit = Number(params.get('limit')) || 25;

  try {
    let src: SourcePosts | undefined;

    if (source === 'reddit' && handle) {
      const sort = (params.get('sort') as 'hot' | 'new' | 'top' | 'rising') || 'hot';
      src = await RedditSource.fetch(handle, sort, limit);
    } else if (source === 'reddit-user' && handle) {
      src = await RedditSource.fetchUser(handle);
    } else if (source === 'mirror' && handle) {
      src = await MirrorSource.fetch(handle);
    } else if (source === 'substack' && handle) {
      src = await SubstackSource.fetch(handle);
    } else if (source === 'medium' && handle) {
      src = await MediumSource.fetch(handle);
    } else if (source === 'paragraph' && handle) {
      src = await ParagraphSource.fetch(handle);
    } else if (url) {
      if (!isValidFetchUrl(url)) return jsonResponse({ error: 'Invalid URL' }, 400);
      src = await GenericRssSource.fetch(url);
    } else if (!source && !handle && !url) {
      const results = await Promise.allSettled(
        DEFAULT_SUBREDDITS.map((sub) =>
          RedditSource.fetch(sub, 'hot', Math.ceil(limit / DEFAULT_SUBREDDITS.length)),
        ),
      );
      const posts: UnifiedPost[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          posts.push(...feedToUnifiedPosts(r.value));
        }
      }

      // Merge in crypto news RSS (DEFAULT_CRYPTO_FEEDS) so the general RSS
      // endpoint returns real news, not just Reddit discussion. The
      // RssWithFallbackProvider in feed-fetcher.ts uses the same feed list,
      // so behavior is consistent with the unified feed pipeline.
      const { RssProvider } = await import('@degenfeed/feed-providers');
      const rssProvider = new RssProvider({
        feeds: DEFAULT_CRYPTO_FEEDS_SLICE(),
      });
      const rssResult = await rssProvider.fetchFeed({ timeoutMs: 4000, concurrency: 4 });
      if (rssResult.posts.length > 0) {
        posts.push(...rssResult.posts);
      }

      // Deduplicate by id, then slice to the requested limit.
      const seen = new Set<string>();
      const deduped = posts.filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      const sliced = deduped.slice(0, limit);
      return jsonResponse({
        data: sliced,
        meta: {
          total: sliced.length,
          limit,
          source: 'reddit+rss',
          rssPosts: rssResult.posts.length,
        },
      });
    }

    if (!src) {
      return jsonResponse({ error: 'Missing source/handle or url' }, 400);
    }

    const posts = feedToUnifiedPosts(src).slice(0, limit);
    return jsonResponse({
      data: posts,
      meta: { total: posts.length, limit, source: src.source },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RSS fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}
