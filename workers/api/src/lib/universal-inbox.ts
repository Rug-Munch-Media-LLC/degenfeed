/**
 * @degenfeed/api-worker — Universal Inbox
 *
 * Split into module at ./universal-inbox/ for maintainability.
 * This file re-exports the public API.
 *
 * @see ./universal-inbox/index.ts
 */

export type {
  InboxItemKind,
  InboxActor,
  InboxItem,
  InboxFeed,
  InboxReplyRequest,
  InboxShareRequest,
  NetworkStatus,
  NetworkCapability,
  UserNetworkStatus,
  InboxReadRequest,
  CrossNetworkShareResult,
  ActivityFeedItem,
} from './universal-inbox/types';

export {
  INBOX_KV_PREFIX,
  INBOX_UNIFIED_KEY,
  INBOX_DMS_KEY,
  INBOX_COMMENTS_KEY,
  INBOX_STATUS_KEY,
  MAX_INBOX_ITEMS,
  MAX_INBOX_AGE_MS,
  DEFAULT_PAGE_SIZE,
  PROTOCOL_MAX_LENGTH,
  PROTOCOL_LABELS,
} from './universal-inbox/constants';

export {
  stripHtml,
  formatProtocol,
  getInboxItems,
  saveInboxItems,
  getUserLinkedProtocols,
  paginateInbox,
} from './universal-inbox/utils';

export {
  fetchNostrDMs,
  fetchNostrReplies,
  fetchNostrNotifications,
  fetchMatrixDMs,
  fetchMastodonDMs,
  fetchMastodonReplies,
  fetchMastodonNotifications,
  fetchBlueskyDMs,
  fetchFarcasterDMs,
  fetchFarcasterReplies,
  fetchPeerTubeComments,
  fetchLemmyComments,
  fetchPixelfedComments,
} from './universal-inbox/fetchers';

export {
  replyMastodon,
  replyNostr,
  replyFarcaster,
  replyBluesky,
  replyPeerTube,
  replyLemmy,
  replyPixelfed,
  replyMatrix,
} from './universal-inbox/reply-handlers';

export {
  aggregateUnifiedInbox,
  aggregateDMs,
  aggregateComments,
  replyToInboxItem,
  buildActivityFeed,
  shareCrossNetwork,
  getUserNetworkStatus,
  formatNetworkStatusReport,
  markInboxItemsRead,
} from './universal-inbox/core';

export {
  handleInboxUnified,
  handleInboxDms,
  handleInboxComments,
  handleInboxActivity,
  handleInboxReply,
  handleInboxMarkRead,
  handleInboxStatus,
  handleInboxShare,
} from './universal-inbox/routes';
