import {
  GenericRssSource,
  MediumSource,
  MirrorSource,
  ParagraphSource,
  RedditSource,
  SubstackSource,
  feedToUnifiedPosts,
} from '@degenfeed/rss-sdk';
import type { SourcePosts } from '@degenfeed/rss-sdk';
import { type Env, jsonResponse } from '../index';

export async function handleRssFeed(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const source = params.get('source');
  const handle = params.get('handle');
  const url = params.get('url');
  const limit = Number(params.get('limit')) || 25;

  try {
    let src: SourcePosts;

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
      src = await GenericRssSource.fetch(url);
    } else {
      return jsonResponse({ error: 'Missing source/handle or url' }, 400);
    }

    const posts = feedToUnifiedPosts(src).slice(0, limit);
    return jsonResponse({ data: posts, meta: { total: posts.length, limit, source: src.source } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RSS fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}
