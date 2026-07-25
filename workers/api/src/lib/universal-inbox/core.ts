/**
 * @degenfeed/api-worker — Universal Inbox Core Logic
 *
 * Aggregation engine, cross-network reply dispatching, activity feed,
 * sharing, network status, and mark-read operations.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../../index';
import { hasSuspiciousPayload } from '../../sanitize';
import {
  DEFAULT_PAGE_SIZE,
  INBOX_COMMENTS_KEY,
  INBOX_DMS_KEY,
  INBOX_STATUS_KEY,
  INBOX_UNIFIED_KEY,
  PROTOCOL_CAPABILITIES,
  PROTOCOL_MAX_LENGTH,
} from './constants';
import {
  fetchBlueskyDMs,
  fetchFarcasterDMs,
  fetchFarcasterReplies,
  fetchLemmyComments,
  fetchMastodonDMs,
  fetchMastodonNotifications,
  fetchMastodonReplies,
  fetchMatrixDMs,
  fetchNostrDMs,
  fetchNostrNotifications,
  fetchNostrReplies,
  fetchPeerTubeComments,
  fetchPixelfedComments,
} from './fetchers';
import {
  replyBluesky,
  replyFarcaster,
  replyLemmy,
  replyMastodon,
  replyMatrix,
  replyNostr,
  replyPeerTube,
  replyPixelfed,
} from './reply-handlers';
import type {
  ActivityFeedItem,
  CrossNetworkShareResult,
  InboxFeed,
  InboxItem,
  InboxItemKind,
  InboxReadRequest,
  InboxReplyRequest,
  InboxShareRequest,
  NetworkCapability,
  NetworkStatus,
  UserNetworkStatus,
} from './types';
import {
  formatProtocol,
  getInboxItems,
  getUserLinkedProtocols,
  paginateInbox,
  saveInboxItems,
} from './utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGGREGATION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function aggregateUnifiedInbox(
  walletAddress: string,
  env: Env,
  options?: {
    kind?: InboxItemKind;
    protocols?: Protocol[];
    limit?: number;
    cursor?: string;
    includeRead?: boolean;
  },
): Promise<InboxFeed> {
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const cached = await getInboxItems(env, INBOX_UNIFIED_KEY(walletAddress));

  if (cached.length > 0 && options?.cursor) {
    return paginateInbox(cached, limit, options.cursor, options.includeRead, options.kind);
  }

  const linkedProtocols = await getUserLinkedProtocols(walletAddress, env);
  const activeProtocols = options?.protocols ?? (Object.keys(linkedProtocols) as Protocol[]);

  const fetchPromises: Array<Promise<InboxItem[]>> = [];

  for (const protocol of activeProtocols) {
    const auth = linkedProtocols[protocol]?.auth ?? {};
    const userId = linkedProtocols[protocol]?.id ?? '';

    switch (protocol) {
      case 'nostr':
        fetchPromises.push(fetchNostrDMs(userId, auth));
        fetchPromises.push(fetchNostrReplies(userId, auth));
        fetchPromises.push(fetchNostrNotifications(userId, auth));
        break;
      case 'matrix':
        fetchPromises.push(fetchMatrixDMs(userId, auth, env));
        break;
      case 'mastodon':
        fetchPromises.push(fetchMastodonDMs(userId, auth));
        fetchPromises.push(fetchMastodonReplies(userId, auth));
        fetchPromises.push(fetchMastodonNotifications(userId, auth));
        break;
      case 'bluesky':
        fetchPromises.push(fetchBlueskyDMs(userId, auth));
        break;
      case 'farcaster':
        fetchPromises.push(fetchFarcasterDMs(userId, auth));
        fetchPromises.push(fetchFarcasterReplies(userId, auth));
        break;
      case 'peertube':
        fetchPromises.push(fetchPeerTubeComments(userId, auth));
        break;
      case 'lemmy':
        fetchPromises.push(fetchLemmyComments(userId, auth));
        break;
      case 'pixelfed':
        fetchPromises.push(fetchPixelfedComments(userId, auth));
        break;
      default:
        break;
    }
  }

  const settled = await Promise.allSettled(fetchPromises);
  const allItems: InboxItem[] = [...cached];

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const newItem of r.value) {
        const existing = allItems.find((i) => i.id === newItem.id);
        if (existing) {
          newItem.read = existing.read;
          newItem.seen = existing.seen;
          Object.assign(existing, newItem);
        } else {
          allItems.push(newItem);
        }
      }
    }
  }

  const seen = new Set<string>();
  const deduped = allItems.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
  deduped.sort((a, b) => b.createdAt - a.createdAt);

  await saveInboxItems(env, INBOX_UNIFIED_KEY(walletAddress), deduped);

  return paginateInbox(deduped, limit, options?.cursor, options?.includeRead, options?.kind);
}

export async function aggregateDMs(
  walletAddress: string,
  env: Env,
  options?: { limit?: number; cursor?: string; includeRead?: boolean },
): Promise<InboxFeed> {
  return aggregateUnifiedInbox(walletAddress, env, { ...options, kind: 'dm' });
}

export async function aggregateComments(
  walletAddress: string,
  env: Env,
  options?: { limit?: number; cursor?: string; includeRead?: boolean },
): Promise<InboxFeed> {
  return aggregateUnifiedInbox(walletAddress, env, { ...options, kind: 'comment' });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CROSS-NETWORK REPLY DISPATCHER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function replyToInboxItem(
  walletAddress: string,
  request: InboxReplyRequest,
  env: Env,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const { parentInboxId, content, auth, signedMessage } = request;

  if (!parentInboxId || !content) {
    return { ok: false, error: 'Missing required fields: parentInboxId, content' };
  }
  if (hasSuspiciousPayload(content)) {
    return { ok: false, error: 'Content contains suspicious patterns' };
  }

  const parts = parentInboxId.split(':');
  if (parts.length < 3) {
    return { ok: false, error: `Invalid inbox item ID format: ${parentInboxId}` };
  }
  const protocol = parts[0] as Protocol;
  const nativeId = parts.slice(2).join(':');

  const allItems = await getInboxItems(env, INBOX_UNIFIED_KEY(walletAddress));
  const parentItem = allItems.find((i) => i.id === parentInboxId);
  const parentNativeId = parentItem?.parentId ?? nativeId;
  const mergedAuth = { ...(parentItem?.replyAuth ?? {}), ...(auth ?? {}) };

  const maxLen = PROTOCOL_MAX_LENGTH[protocol] ?? 10000;
  const truncatedContent = content.length > maxLen ? `${content.slice(0, maxLen - 3)}...` : content;

  switch (protocol) {
    case 'mastodon':
      return replyMastodon(truncatedContent, nativeId, mergedAuth, env);
    case 'nostr':
      return replyNostr(truncatedContent, nativeId, mergedAuth, signedMessage);
    case 'farcaster':
      return replyFarcaster(truncatedContent, mergedAuth, signedMessage);
    case 'bluesky':
      return replyBluesky(truncatedContent, mergedAuth);
    case 'peertube':
      return replyPeerTube(truncatedContent, nativeId, mergedAuth, parentNativeId);
    case 'lemmy':
      return replyLemmy(truncatedContent, parentNativeId, mergedAuth);
    case 'pixelfed':
      return replyPixelfed(truncatedContent, nativeId, mergedAuth);
    case 'matrix':
      return replyMatrix(truncatedContent, mergedAuth);
    default:
      return { ok: false, error: `Reply to ${protocol} not yet supported` };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITY FEED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function buildActivityFeed(items: InboxItem[]): ActivityFeedItem[] {
  const activities: ActivityFeedItem[] = [];

  for (const item of items) {
    const actorLabel = item.actor.displayName ?? item.actor.handle;
    const protocolLabel = formatProtocol(item.protocol);
    let summary = '';
    let targetProtocol: Protocol | undefined;

    switch (item.kind) {
      case 'dm':
        summary = `${actorLabel} sent you a DM on ${protocolLabel}`;
        break;
      case 'comment':
        targetProtocol = item.parentProtocol;
        summary =
          item.parentProtocol && item.parentProtocol !== item.protocol
            ? `${actorLabel} commented on your ${formatProtocol(item.parentProtocol)} content via ${protocolLabel}`
            : `${actorLabel} commented on your ${protocolLabel} post`;
        break;
      case 'reply':
        targetProtocol = item.parentProtocol;
        summary =
          item.parentProtocol && item.parentProtocol !== item.protocol
            ? `${actorLabel} replied to your ${formatProtocol(item.parentProtocol)} post from ${protocolLabel}`
            : `${actorLabel} replied to your ${protocolLabel} post`;
        break;
      case 'mention':
        summary = `${actorLabel} mentioned you on ${protocolLabel}`;
        break;
      case 'like':
        targetProtocol = item.parentProtocol;
        summary =
          item.parentProtocol && item.parentProtocol !== item.protocol
            ? `${actorLabel} liked your ${formatProtocol(item.parentProtocol)} post from ${protocolLabel}`
            : `${actorLabel} liked your ${protocolLabel} post`;
        break;
      case 'repost':
        summary = `${actorLabel} reposted your ${protocolLabel} post`;
        break;
      case 'follow':
        summary = `${actorLabel} followed you on ${protocolLabel}`;
        break;
      case 'tip':
        summary = `${actorLabel} sent you ${item.amount ?? ''} ${item.currency ?? ''} on ${protocolLabel}`;
        break;
      default:
        summary = `${actorLabel} interacted on ${protocolLabel}`;
    }

    activities.push({
      id: `activity:${item.id}`,
      summary,
      kind: item.kind,
      sourceProtocol: item.protocol,
      targetProtocol,
      actor: item.actor,
      content: item.content.slice(0, 150),
      url: item.url,
      createdAt: item.createdAt,
    });
  }

  activities.sort((a, b) => b.createdAt - a.createdAt);
  return activities;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CROSS-NETWORK SHARING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function resolveSourceContent(
  uri: string,
  protocol: Protocol,
  _walletAddress: string,
  _env: Env,
): Promise<{ text: string; hashtags?: string[] } | null> {
  const cleanUri = uri.startsWith('df://') ? uri.slice(5) : uri;
  const parts = cleanUri.split(':');
  const _nativeId = parts.slice(1).join(':') || parts[0];
  return { text: `Cross-posted from ${formatProtocol(protocol)}` };
}

export async function shareCrossNetwork(
  walletAddress: string,
  request: InboxShareRequest,
  env: Env,
): Promise<{ results: CrossNetworkShareResult[]; totalOk: number; totalFail: number }> {
  const { sourceUri, sourceProtocol, targetProtocols, text, auth } = request;
  if (!sourceUri || targetProtocols.length === 0) return { results: [], totalOk: 0, totalFail: 0 };

  const results: CrossNetworkShareResult[] = [];
  const sourceContent = await resolveSourceContent(sourceUri, sourceProtocol, walletAddress, env);

  for (const target of targetProtocols) {
    if (target === sourceProtocol) continue;
    try {
      const shareText = text ?? sourceContent?.text ?? '';
      const { executeCrossPublish } = await import('../cross-publish-orchestrator');
      const publishResult = await executeCrossPublish(
        {
          masterPost: {
            text: shareText.slice(0, PROTOCOL_MAX_LENGTH[target] ?? 10000),
            hashtags: sourceContent?.hashtags,
          },
          protocols: [target as Protocol],
          auth: auth ?? {},
        },
        env,
      );
      const targetResult = publishResult.results.find(
        (r: { protocol: string }) => r.protocol === target,
      );
      results.push({
        protocol: target,
        ok: targetResult?.status === 'published',
        nativeId: targetResult?.postId,
        url: targetResult?.url,
        error: targetResult?.error,
      });
    } catch (e) {
      results.push({
        protocol: target,
        ok: false,
        error: `Share to ${target} failed: ${(e as Error).message}`,
      });
    }
  }

  return {
    results,
    totalOk: results.filter((r) => r.ok).length,
    totalFail: results.filter((r) => !r.ok).length,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NETWORK STATUS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getUserNetworkStatus(
  walletAddress: string,
  env: Env,
): Promise<UserNetworkStatus> {
  const linkedProtocols = await getUserLinkedProtocols(walletAddress, env);
  const cached = await getInboxItems(env, INBOX_STATUS_KEY(walletAddress));
  const cachedStatus =
    cached.length > 0
      ? (JSON.parse(JSON.stringify(cached[0])) as unknown as UserNetworkStatus)
      : null;
  if (cachedStatus && Date.now() - cachedStatus.checkedAt < 60_000) return cachedStatus;

  const status: UserNetworkStatus = {
    protocols: {},
    totalConnected: 0,
    totalAvailable: 0,
    checkedAt: Date.now(),
  };

  for (const [protocol, link] of Object.entries(linkedProtocols)) {
    const caps = PROTOCOL_CAPABILITIES[protocol] ?? ['post'];
    status.protocols[protocol as Protocol] = {
      connected: true,
      handle: link.handle,
      displayName: link.displayName,
      avatarUrl: link.avatarUrl,
      capabilities: caps as NetworkCapability[],
      lastVerified: link.linkedAt,
    };
    status.totalConnected++;
  }

  status.totalAvailable = Object.keys(PROTOCOL_CAPABILITIES).length;

  const statusItem: InboxItem = {
    id: `status:${walletAddress}`,
    kind: 'dm',
    protocol: 'nostr',
    actor: { id: walletAddress, handle: walletAddress, protocol: 'nostr' },
    content: JSON.stringify(status),
    createdAt: Date.now(),
    read: true,
    seen: true,
  };
  await saveInboxItems(env, INBOX_STATUS_KEY(walletAddress), [statusItem]);

  return status;
}

export function formatNetworkStatusReport(status: UserNetworkStatus): {
  connected: Array<{
    protocol: string;
    label: string;
    handle?: string;
    capabilities: NetworkCapability[];
  }>;
  disconnected: Array<{
    protocol: string;
    label: string;
    availableCapabilities: NetworkCapability[];
  }>;
  totalConnected: number;
  totalAvailable: number;
} {
  const connected: Array<{
    protocol: string;
    label: string;
    handle?: string;
    capabilities: NetworkCapability[];
  }> = [];
  const disconnected: Array<{
    protocol: string;
    label: string;
    availableCapabilities: NetworkCapability[];
  }> = [];

  for (const [protocol, caps] of Object.entries(PROTOCOL_CAPABILITIES)) {
    const ns = status.protocols[protocol as Protocol];
    if (ns?.connected) {
      connected.push({
        protocol,
        label: formatProtocol(protocol),
        handle: ns.handle,
        capabilities: caps as NetworkCapability[],
      });
    } else {
      disconnected.push({
        protocol,
        label: formatProtocol(protocol),
        availableCapabilities: caps as NetworkCapability[],
      });
    }
  }

  return {
    connected,
    disconnected,
    totalConnected: status.totalConnected,
    totalAvailable: status.totalAvailable,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARK AS READ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function markInboxItemsRead(
  walletAddress: string,
  itemIds: string[],
  env: Env,
): Promise<{ marked: number }> {
  let count = 0;

  for (const key of [INBOX_UNIFIED_KEY, INBOX_DMS_KEY, INBOX_COMMENTS_KEY]) {
    const items = await getInboxItems(env, key(walletAddress));
    let changed = false;
    for (const item of items) {
      if (itemIds.includes(item.id) && !item.read) {
        item.read = true;
        changed = true;
        count++;
      }
    }
    if (changed) await saveInboxItems(env, key(walletAddress), items);
  }

  return { marked: count };
}
