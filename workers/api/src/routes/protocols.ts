import { GtSClient, type GtSStatus, statusToUnifiedPost } from '@degenfeed/mastodon-sdk';
import {
  CURATED_THREADS_HANDLES,
  ThreadsClient,
  type ThreadsPostView,
} from '@degenfeed/threads-sdk';
import { type Env, jsonResponse } from '../index';

export async function handleActivityPubFeed(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const instance = params.get('instance') ?? 'https://social.degenfeed.xyz';
  const type = params.get('type') ?? 'public';
  const hashtag = params.get('hashtag') ?? '';
  const limit = Number(params.get('limit')) || 20;

  try {
    const client = new GtSClient(instance);
    let statuses: GtSStatus[];
    if (type === 'hashtag' && hashtag) {
      statuses = await client.getHashtagTimeline(hashtag, limit);
    } else if (type === 'federated') {
      statuses = await client.getFederatedTimeline(limit);
    } else {
      statuses = await client.getPublicTimeline(limit);
    }
    const unified = statuses.map((s) => statusToUnifiedPost(s, instance));
    return jsonResponse({ data: unified, meta: { total: unified.length, limit, instance } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ActivityPub fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}

export async function handleThreadsFeed(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const actor = params.get('actor') ?? '';
  const limit = Number(params.get('limit')) || 25;

  try {
    const client = new ThreadsClient();
    let posts: ThreadsPostView[] = [];
    if (actor) {
      const feed = await client.getAuthorFeed(actor, limit);
      posts = feed.posts;
    } else {
      posts = await client.getAuthorFeeds(CURATED_THREADS_HANDLES, Math.ceil(limit / 5));
    }
    const unified = posts.slice(0, limit).map((p) => client.postToUnifiedPost(p));
    return jsonResponse({
      data: unified,
      meta: { total: unified.length, limit },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Threads fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}
