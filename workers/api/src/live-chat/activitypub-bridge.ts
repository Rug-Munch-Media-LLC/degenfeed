/**
 * @degenfeed/api-worker — ActivityPub / Mastodon live-chat bridge
 *
 * Polls the instance status API for replies to the live post. When no post
 * id is known it falls back to a status search for the stream URL. Threads
 * (threads.net accounts) are tagged `activitypub`; every other account on
 * the instance is tagged `mastodon`, so the protocol badge stays honest.
 *
 * Credentials: `GTS_ACCESS_TOKEN` / `MASTODON_ACCESS_TOKEN`, instance from
 * `GTS_INSTANCE_URL` / `MASTODON_INSTANCE_URL`.
 */

import type { Env } from '../index';
import { chatLastKey } from './chat-keys';
import { ingestFromProtocol } from './ingest';
import type { ChatProtocol, SendChatMessage } from './unified-chat';

const DEFAULT_LOOKBACK_MS = 60_000;
const MAX_TEXT = 500;

/** Mastodon status shape — every field optional; the bridge filters. */
export interface MastodonStatus {
  id: string;
  account?: { acct: string; display_name?: string; avatar?: string };
  content?: string;
  created_at?: string;
}

/** Injected by `./bridges` so this module has no engine import cycle. */
export type ActivityPubDeps = {
  env: Env;
  send: SendChatMessage;
  accessToken: string;
  instance: string;
};

/** Threads is ActivityPub-native; everything else on the instance is Mastodon. */
export function protocolForAcct(acct: string | undefined): ChatProtocol {
  return acct?.includes('threads.net') ? 'activitypub' : 'mastodon';
}

/** Strip tags and decode the entities Mastodon returns in `content`. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Ingest a batch of statuses, skipping stale and HTML-empty replies. */
async function ingestStatuses(
  streamId: string,
  statuses: MastodonStatus[],
  since: number,
  tagAcct: (acct: string | undefined) => ChatProtocol,
  deps: ActivityPubDeps,
): Promise<number> {
  let count = 0;
  for (const status of statuses) {
    const createdAt = status.created_at ? new Date(status.created_at).getTime() : 0;
    if (createdAt < since) continue;
    const plaintext = stripHtml(status.content || '');
    if (!plaintext) continue;

    const protocol = tagAcct(status.account?.acct);
    const acct = status.account?.acct || status.id;
    await ingestFromProtocol(
      deps.send,
      deps.env,
      streamId,
      protocol,
      acct,
      status.account?.display_name || acct || 'anon',
      plaintext.slice(0, MAX_TEXT),
      { avatarUrl: status.account?.avatar, badges: [protocol] },
    );
    count++;
  }
  return count;
}

async function pollContext(
  streamId: string,
  apPostId: string,
  since: number,
  deps: ActivityPubDeps,
): Promise<number> {
  const res = await fetch(
    `${deps.instance}/api/v1/statuses/${encodeURIComponent(apPostId)}/context`,
    {
      headers: { authorization: `Bearer ${deps.accessToken}` },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) return 0;

  const data = (await res.json()) as { descendants?: MastodonStatus[] };
  return ingestStatuses(streamId, data.descendants || [], since, protocolForAcct, deps);
}

async function pollSearch(streamId: string, since: number, deps: ActivityPubDeps): Promise<number> {
  const res = await fetch(
    `${deps.instance}/api/v2/search?q=${encodeURIComponent(`degenfeed.xyz/live/${streamId}`)}&type=statuses&limit=20`,
    {
      headers: { authorization: `Bearer ${deps.accessToken}` },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) return 0;

  const data = (await res.json()) as { statuses?: MastodonStatus[] };
  // Search hits are tagged `mastodon` unconditionally: the acct-derived
  // split only applies to genuine reply threads on the context path.
  return ingestStatuses(streamId, data.statuses || [], since, () => 'mastodon', deps);
}

/**
 * Poll Mastodon/ActivityPub for replies to the live stream post.
 * Returns the number of messages ingested (0 on any failure).
 */
export async function pollActivityPubChat(
  streamId: string,
  apPostId: string | undefined,
  deps: ActivityPubDeps,
): Promise<number> {
  const { env } = deps;
  const sinceKey = chatLastKey(streamId, 'activitypub');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - DEFAULT_LOOKBACK_MS;

  try {
    const count = apPostId
      ? await pollContext(streamId, apPostId, since, deps)
      : await pollSearch(streamId, since, deps);

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}
