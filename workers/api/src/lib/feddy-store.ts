/**
 * @degenfeed/api-worker — Feddy Communities KV data layer
 *
 * Barrel file — re-exports all feddy-* modules for backward compatibility.
 * See individual modules for documentation:
 *   feddy-types.ts       — Type definitions
 *   feddy-constants.ts   — Constants and KV helpers
 *   feddy-community.ts   — Community CRUD and member management
 *   feddy-content.ts     — Posts, events, polls, wiki, badges
 *   feddy-moderation.ts  — Bans, reports, appeals, filters, blocklists
 *   feddy-treasury.ts    — Treasury, token config, gates, webhooks, bot keys, federation
 *   feddy-directory.ts   — Directory, autocomplete, trending, stats
 */

// Community CRUD + members
export {
  addCommunityMember,
  createCommunity,
  deleteCommunity,
  getAllCommunityMembers,
  getCommunityById,
  getCommunityByName,
  getCommunityMembers,
  getMemberRole,
  hasMinRole,
  isCommunityMember,
  isOwnerOrMod,
  releaseName,
  removeCommunityMember,
  reserveName,
  setMemberRole,
  updateCommunity,
  updateMemberBadges,
  updateMemberTokenBalance,
} from './feddy-community';

export type { SortOption } from './feddy-constants';

// Constants
export {
  buildGtsHandle,
  CATEGORY_META,
  generateCommunityId,
  generateSecret,
  getStore,
  hashKey,
  k,
  PREMIUM_FEATURES,
  REPORT_CATEGORIES,
  ROLE_BADGE_COLORS,
  ROLE_BADGE_LABELS,
  ROLE_HIERARCHY,
  VALID_CATEGORIES,
  VALID_CATEGORIES_SET,
  VALID_SORT_OPTIONS,
  validateCommunityName,
} from './feddy-constants';
// Posts + content
export {
  addCommunityPost,
  createBadge,
  createEvent,
  createPoll,
  getBadges,
  getCommunityEvents,
  getCommunityPolls,
  getCommunityPosts,
  getEventRSVPs,
  getPinnedPosts,
  getPollVotes,
  getUpcomingEvents,
  getWikiPages,
  pinPost,
  rsvpEvent,
  setWikiPages,
  unpinPost,
  votePoll,
} from './feddy-content';
// Directory + discovery
export {
  autocompleteSearch,
  getCommunityStats,
  getFollowerCommunities,
  getSimilarCommunities,
  getTrendingCommunities,
  listDirectory,
} from './feddy-directory';

// Moderation
export {
  addFedBlocklistEntry,
  addModLogEntry,
  banMember,
  checkKeywordFilters,
  createAppeal,
  createReport,
  getAppeals,
  getFedBlocklist,
  getKeywordFilters,
  getLinkBlocklist,
  getModLog,
  getReports,
  isBanned,
  removeFedBlocklistEntry,
  resolveAppeal,
  setKeywordFilters,
  setLinkBlocklist,
  unbanMember,
  updateReportStatus,
} from './feddy-moderation';

// Treasury + token + integrations
export {
  addDiscoveredRemoteCommunity,
  addTreasuryTx,
  checkTokenGate,
  createBotKey,
  createWebhook,
  deleteBotKey,
  deleteWebhook,
  getBotKeys,
  getDiscoveredRemoteCommunities,
  getFederationHealth,
  getTokenConfig,
  getTokenGates,
  getTreasury,
  getTreasuryTxs,
  getWebhooks,
  setFederationHealth,
  setTokenConfig,
  setTokenGates,
  setTreasury,
  trackFollowerCommunity,
  verifyBotKey,
} from './feddy-treasury';
// Re-export all types
export type {
  Appeal,
  AutocompleteResult,
  BadgeDefinition,
  BotApiKey,
  BotScope,
  CommunityEvent,
  CommunityMember,
  CommunityPoll,
  CommunityPost,
  CommunityStats,
  CommunityTokenConfig,
  DirectoryEntry,
  DirectoryResult,
  EventRSVP,
  FedBlocklistEntry,
  FeddyCategory,
  FeddyCommunity,
  FederationHealth,
  FederationStatus,
  KeywordFilter,
  MemberRole,
  ModLogEntry,
  PollOption,
  PollVote,
  RemoteCommunity,
  Report,
  ReportCategory,
  TokenGate,
  TreasuryState,
  TreasuryTx,
  TrendingScore,
  WebhookConfig,
  WebhookEvent,
  WikiPage,
} from './feddy-types';
