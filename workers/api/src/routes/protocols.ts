import { type Env, jsonResponse } from '../index';
import { GtSClient, statusToUnifiedPost } from '@degenfeed/mastodon-sdk';
import { ThreadsClient } from '@degenfeed/threads-sdk';

export async function handleActivityPubFeed(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const instance = params.get('instance') ?? 'https://degenfeed.xyz';
  const type = params.get('type') ?? 'public';
  const hashtag = params.get('hashtag') ?? '';
  const limit = Number(params.get('limit')) || 20;

  try {
    const client = new GtSClient(instance);
    let statuses;
    if (type === 'hashtag' && hashtag) {
      statuses = await client.getHashtagTimeline(hashtag, limit);
    } else if (type === 'federated') {
      statuses = await client.getFederatedTimeline(limit);
    } else {
      statuses = await client.getPublicTimeline(limit);
    }
    const unified = statuses.map((s: any) => statusToUnifiedPost(s, instance));
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
    const { posts: rawPosts, cursor } = await client.getAuthorFeed(actor, limit);
    const unified = rawPosts.map((p) => client.postToUnifiedPost(p));
    return jsonResponse({ data: unified.slice(0, limit), meta: { total: unified.length, limit, cursor } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Threads fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}
