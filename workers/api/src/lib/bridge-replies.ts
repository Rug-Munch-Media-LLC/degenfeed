/**
 * @degenfeed/api-worker — Cross-Protocol Reply Fetchers
 *
 * Fetches replies/thread context from each supported protocol.
 */

import type { Env } from '../index';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { CrossProtocolReply } from './bridge-types';

async function reliableBridgePublish<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    recordBridgeOperation(env, protocol, true, performance.now() - start);
    return result;
  } catch (err) {
    recordBridgeOperation(
      env,
      protocol,
      false,
      performance.now() - start,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fetchReplies(
  protocol: string,
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const normalized = normalizeProtocol(protocol);
  switch (normalized) {
    case 'mastodon':
      return fetchRepliesFromMastodon(nativeId, auth, env);
    case 'bluesky':
      return fetchRepliesFromBluesky(nativeId, auth, env);
    case 'nostr':
      return fetchRepliesFromNostr(nativeId, auth, env);
    case 'farcaster':
      return fetchRepliesFromFarcaster(nativeId, auth, env);
    case 'lens':
      return fetchRepliesFromLens(nativeId, auth, env);
    case 'telegram':
      return fetchRepliesFromTelegram(nativeId, auth, env);
    default:
      return [];
  }
}

function normalizeProtocol(p: string): string {
  if (p === 'activitypub' || p === 'mastodon') return 'mastodon';
  if (p === 'atproto' || p === 'bluesky') return 'bluesky';
  return p;
}

async function fetchRepliesFromMastodon(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const instance =
    auth.mastodon_instance || env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = auth.mastodon || auth.mastodon_token;
  if (!accessToken) return [];
  const result = await reliableBridgePublish(
    'activitypub',
    async () => {
      const res = await fetch(`${instance}/api/v1/statuses/${nativeId}/context`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        descendants?: Array<{
          id: string;
          content: string;
          account?: { display_name?: string; username?: string };
          created_at?: string;
        }>;
      };
      return (data.descendants ?? []).map((reply) => ({
        parentUri: `df://mastodon:${nativeId}`,
        sourceProtocol: 'mastodon',
        replyNativeId: reply.id,
        text: stripHtml(reply.content || ''),
        authorName: reply.account?.display_name || reply.account?.username,
        createdAt: reply.created_at ? new Date(reply.created_at).getTime() : Date.now(),
      }));
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromBluesky(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const _pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
  const did = auth.bluesky_did || auth.did;
  const result = await reliableBridgePublish(
    'atproto',
    async () => {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://${did}/app.bsky.feed.post/${nativeId}&depth=1`,
      );
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        thread?: {
          replies?: Array<{
            post?: {
              uri?: string;
              record?: { text?: string; createdAt?: string };
              author?: { displayName?: string; handle?: string };
            };
          }>;
        };
      };
      return (data.thread?.replies ?? []).map((reply) => ({
        parentUri: `df://bluesky:${nativeId}`,
        sourceProtocol: 'bluesky',
        replyNativeId: reply.post?.uri?.split('/').pop() || '',
        text: reply.post?.record?.text || '',
        authorName: reply.post?.author?.displayName || reply.post?.author?.handle,
        createdAt: reply.post?.record?.createdAt
          ? new Date(reply.post.record.createdAt).getTime()
          : Date.now(),
      }));
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromNostr(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const relayUrls = (auth.nostr_relays || env.NOSTR_RELAYS || '').split(',').filter(Boolean);
  if (relayUrls.length === 0) return [];
  const result = await reliableBridgePublish(
    'nostr',
    async () => {
      const nostr = await import('@degenfeed/nostr-sdk');
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
      const events = await pool.list([{ '#e': [nativeId], kinds: [1] }]);
      return (events ?? []).map((e: any) => ({
        parentUri: `df://nostr:${nativeId}`,
        sourceProtocol: 'nostr',
        replyNativeId: e.id || '',
        text: e.content || '',
        authorName: e.pubkey ? `npub${e.pubkey.slice(0, 8)}` : undefined,
        createdAt: (e.created_at || 0) * 1000,
      }));
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromFarcaster(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
  const result = await reliableBridgePublish(
    'farcaster',
    async () => {
      const res = await fetch(
        `${hubUrl}/v1/castsByParent?fid=0&hash=0x${nativeId.replace('0x', '')}`,
      );
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        messages?: Array<{ data?: { castAddBody?: { text?: string }; hash?: string } }>;
      };
      return (data.messages ?? []).map((msg) => ({
        parentUri: `df://farcaster:${nativeId}`,
        sourceProtocol: 'farcaster',
        replyNativeId: msg.data?.hash || '',
        text: msg.data?.castAddBody?.text || '',
        createdAt: Date.now(),
      }));
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromLens(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
  const result = await reliableBridgePublish(
    'lens',
    async () => {
      const res = await fetch(lensApi, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `{ publications(request: { where: { commentOn: { id: "${nativeId}" } }, limit: 25 }) { items { id metadata { content } createdAt } } }`,
        }),
      });
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        data?: {
          publications?: {
            items?: Array<{ id: string; metadata?: { content?: string }; createdAt?: string }>;
          };
        };
      };
      return (data.data?.publications?.items ?? []).map((pub) => ({
        parentUri: `df://lens:${nativeId}`,
        sourceProtocol: 'lens',
        replyNativeId: pub.id,
        text: pub.metadata?.content || '',
        createdAt: pub.createdAt ? new Date(pub.createdAt).getTime() : Date.now(),
      }));
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromTelegram(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const botToken = auth.telegram_bot_token || env.TELEGRAM_BOT_TOKEN;
  const chatId = auth.telegram_chat_id || auth.chat_id;
  if (!botToken || !chatId) return [];
  const result = await reliableBridgePublish(
    'telegram',
    async () => {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?chat_id=${chatId}&limit=50`,
      );
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        result?: Array<{
          message?: {
            message_id: number;
            text?: string;
            from?: { first_name?: string; username?: string };
            date?: number;
          };
        }>;
      };
      return (data.result ?? [])
        .filter((u) => u.message)
        .map((u) => ({
          parentUri: `df://telegram:${nativeId}`,
          sourceProtocol: 'telegram',
          replyNativeId: String(u.message?.message_id ?? ''),
          text: u.message?.text ?? '',
          authorName: u.message?.from?.first_name ?? u.message?.from?.username,
          createdAt: (u.message?.date ?? 0) * 1000,
        }));
    },
    env,
  );
  return result ?? [];
}
