/**
 * @degenfeed/api-worker — Live chat KV key builders
 *
 * The key layout is the storage contract between the engine, the poll
 * bridges, and the analytics module. Polling cursors live under
 * `livechat:last:<streamId>:<protocol>` — every bridge reads and advances
 * exactly this key, so the builders are shared rather than re-derived.
 */

import type { ChatProtocol } from './unified-chat';

export function chatMessagesKey(streamId: string): string {
  return `livechat:msgs:${streamId}`;
}

export function chatConfigKey(streamId: string): string {
  return `livechat:config:${streamId}`;
}

export function chatPinnedKey(streamId: string): string {
  return `livechat:pinned:${streamId}`;
}

export function chatBannedKey(streamId: string): string {
  return `livechat:banned:${streamId}`;
}

export function chatTimedOutKey(streamId: string): string {
  return `livechat:timeout:${streamId}`;
}

export function chatRateKey(streamId: string, userId: string): string {
  return `livechat:rate:${streamId}:${userId}`;
}

export function chatLastKey(streamId: string, protocol: ChatProtocol): string {
  return `livechat:last:${streamId}:${protocol}`;
}

export function chatSeenKey(streamId: string): string {
  return `livechat:seen:${streamId}`;
}
