/**
 * @degenfeed/api-worker — Bluesky live-chat bridge
 *
 * Two ingestion paths, both against the public bsky.social XRPC:
 *   1. `getPostThread` on the live post URI — the canonical reply thread.
 *   2. `searchPosts` for the stream URL — fallback when no post URI exists.
 *
 * Both require `BSKY_ACCESS_TOKEN` + `BSKY_DID`; without them the bridge
 * is a no-op (returns 0) rather than issuing anonymous requests.
 */

import type { Env } from '../index';
import { chatLastKey } from './chat-keys';
import { ingestFromProtocol } from './ingest';
import type { SendChatMessage } from './unified-chat';

const XRPC_BASE = 'https://bsky.social/xrpc';
const DEFAULT_LOOKBACK_MS = 60_000;
const MAX_TEXT = 500;

/** Minimal post shape shared by the thread-reply and search payloads. */
export interface BlueskyPost {
  author?: { did?: string; displayName?: string; avatar?: string };
  record?: { text?: string; createdAt?: string };
}

/** Injected by `./bridges` so this module has no engine import cycle. */
export type BlueskyDeps = {
  env: Env;
  send: SendChatMessage;
  accessToken: string;
  senderDid: string;
};

/** Ingestable reply, or null when the post lacks an author or body. */
function toIngestable(post: BlueskyPost) {
  const author = post.author;
  const record = post.record;
  if (!author?.did || !record?.text) return null;
  return {
    userId: author.did,
    displayName: author.displayName || author.did.slice(0, 10),
    message: record.text.slice(0, MAX_TEXT),
    avatarUrl: author.avatar,
  };
}

/** Ingest a batch of posts, skipping any created before the cursor. */
async function ingestPosts(
  streamId: string,
  posts: BlueskyPost[],
  since: number,
  deps: BlueskyDeps,
): Promise<number> {
  let count = 0;
  for (const post of posts) {
    const createdAt = post.record?.createdAt ? new Date(post.record.createdAt).getTime() : 0;
    if (createdAt < since) continue;
    const p = toIngestable(post);
    if (!p) continue;

    await ingestFromProtocol(
      deps.send,
      deps.env,
      streamId,
      'bluesky',
      p.userId,
      p.displayName,
      p.message,
      { avatarUrl: p.avatarUrl, badges: ['bluesky'] },
    );
    count++;
  }
  return count;
}

async function pollThread(
  streamId: string,
  postUri: string,
  since: number,
  deps: BlueskyDeps,
): Promise<number> {
  const res = await fetch(
    `${XRPC_BASE}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}&depth=1`,
    {
      headers: { authorization: `Bearer ${deps.accessToken}` },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) return 0;

  const data = (await res.json()) as {
    thread?: { replies?: Array<{ post?: BlueskyPost }> };
  };
  const replies = (data.thread?.replies || []).flatMap((r) => (r.post ? [r.post] : []));
  return ingestPosts(streamId, replies, since, deps);
}

async function pollSearch(streamId: string, since: number, deps: BlueskyDeps): Promise<number> {
  const res = await fetch(
    `${XRPC_BASE}/app.bsky.feed.searchPosts?q=${encodeURIComponent(`degenfeed.xyz/live/${streamId}`)}&limit=20`,
    {
      headers: { authorization: `Bearer ${deps.accessToken}` },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) return 0;

  const data = (await res.json()) as { posts?: BlueskyPost[] };
  return ingestPosts(streamId, data.posts || [], since, deps);
}

/**
 * Poll Bluesky for replies/mentions related to the live stream post.
 * Returns the number of messages ingested (0 on any failure).
 */
export async function pollBlueskyChat(
  streamId: string,
  bskyPostUri: string | undefined,
  deps: BlueskyDeps,
): Promise<number> {
  const { env } = deps;
  const sinceKey = chatLastKey(streamId, 'bluesky');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - DEFAULT_LOOKBACK_MS;

  try {
    const count = bskyPostUri
      ? await pollThread(streamId, bskyPostUri, since, deps)
      : await pollSearch(streamId, since, deps);

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}
