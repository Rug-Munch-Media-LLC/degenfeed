/**
 * @degenfeed/api-worker — Protocol bridge ingest seam
 *
 * Shared contract for every external protocol ingester (nostr, farcaster,
 * bluesky, activitypub, telegram). Bridges never call `sendChatMessage`
 * directly — they call `ingestFromProtocol` so the `protocol:userId`
 * namespacing, the bridge badge, and the send contract stay in one place.
 *
 * The sender is injected by the bridge barrel (`./bridges`) to keep this
 * module free of engine dependencies: the KV key builders, the config, the
 * rate limiter and the WebSocket broadcast all stay inside unified-chat.ts.
 */

import type { ChatProtocol, SendChatMessage } from './unified-chat';

/**
 * Extra metadata a bridge may attach to an ingested message.
 * Mirrors the optional fields of `SendMessageInput`.
 */
export interface IngestExtra {
  avatarUrl?: string;
  isCreator?: boolean;
  badges?: string[];
  gift?: { amount: string; symbol: string; chain?: string };
  platformMeta?: Record<string, unknown>;
}

/**
 * Ingest a message from an external protocol into the unified chat feed.
 *
 * The user id is namespaced as `${protocol}:${userId}` so a viewer present
 * on two protocols is tracked as two distinct participants.
 */
export async function ingestFromProtocol(
  send: SendChatMessage,
  env: Parameters<SendChatMessage>[0],
  streamId: string,
  protocol: ChatProtocol,
  userId: string,
  displayName: string,
  message: string,
  extra?: IngestExtra,
): Promise<void> {
  await send(env, {
    streamId,
    userId: `${protocol}:${userId}`,
    displayName,
    avatarUrl: extra?.avatarUrl,
    message,
    protocol,
    isCreator: extra?.isCreator,
    gift: extra?.gift,
    badges: extra?.badges,
  });
}
