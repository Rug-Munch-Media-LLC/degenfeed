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
import { type Env, jsonResponse } from '../index';
import { isValidFetchUrl } from '../sanitize';

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
      const sliced = posts.slice(0, limit);
      return jsonResponse({
        data: sliced,
        meta: { total: sliced.length, limit, source: 'reddit' },
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
