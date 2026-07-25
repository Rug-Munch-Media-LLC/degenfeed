/**
 * @degenfeed/api-worker — Universal Inbox Barrel
 *
 * Public API surface for the universal inbox module.
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
} from './types';

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
} from './constants';

export {
  stripHtml,
  formatProtocol,
  getInboxItems,
  saveInboxItems,
  getUserLinkedProtocols,
  paginateInbox,
} from './utils';

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
} from './core';

export {
  handleInboxUnified,
  handleInboxDms,
  handleInboxComments,
  handleInboxActivity,
  handleInboxReply,
  handleInboxMarkRead,
  handleInboxStatus,
  handleInboxShare,
} from './routes';
