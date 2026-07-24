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

// Re-export all types
export type {
  FeddyCategory,
  FederationStatus,
  MemberRole,
  FeddyCommunity,
  CommunityMember,
  CommunityPost,
  CommunityStats,
  DirectoryEntry,
  DirectoryResult,
  CommunityEvent,
  EventRSVP,
  PollOption,
  CommunityPoll,
  PollVote,
  WikiPage,
  BadgeDefinition,
  TreasuryState,
  TreasuryTx,
  CommunityTokenConfig,
  TokenGate,
  ModLogEntry,
  ReportCategory,
  Report,
  Appeal,
  KeywordFilter,
  FedBlocklistEntry,
  WebhookConfig,
  WebhookEvent,
  BotApiKey,
  BotScope,
  FederationHealth,
  RemoteCommunity,
  TrendingScore,
  AutocompleteResult,
} from './feddy-types';

export type { SortOption } from './feddy-constants';

// Constants
export {
  VALID_CATEGORIES,
  VALID_CATEGORIES_SET,
  CATEGORY_META,
  REPORT_CATEGORIES,
  VALID_SORT_OPTIONS,
  PREMIUM_FEATURES,
  ROLE_HIERARCHY,
  ROLE_BADGE_LABELS,
  ROLE_BADGE_COLORS,
  k,
  getStore,
  generateCommunityId,
  validateCommunityName,
  buildGtsHandle,
  generateSecret,
  hashKey,
} from './feddy-constants';

// Community CRUD + members
export {
  createCommunity,
  getCommunityById,
  getCommunityByName,
  updateCommunity,
  deleteCommunity,
  reserveName,
  releaseName,
  getCommunityMembers,
  getAllCommunityMembers,
  addCommunityMember,
  removeCommunityMember,
  isCommunityMember,
  getMemberRole,
  setMemberRole,
  updateMemberBadges,
  updateMemberTokenBalance,
  isOwnerOrMod,
  hasMinRole,
} from './feddy-community';

// Posts + content
export {
  addCommunityPost,
  getCommunityPosts,
  pinPost,
  unpinPost,
  getPinnedPosts,
  createEvent,
  getCommunityEvents,
  getUpcomingEvents,
  rsvpEvent,
  getEventRSVPs,
  createPoll,
  getCommunityPolls,
  votePoll,
  getPollVotes,
  setWikiPages,
  getWikiPages,
  createBadge,
  getBadges,
} from './feddy-content';

// Moderation
export {
  banMember,
  unbanMember,
  isBanned,
  addModLogEntry,
  getModLog,
  createReport,
  getReports,
  updateReportStatus,
  createAppeal,
  getAppeals,
  resolveAppeal,
  setKeywordFilters,
  getKeywordFilters,
  checkKeywordFilters,
  setLinkBlocklist,
  getLinkBlocklist,
  addFedBlocklistEntry,
  removeFedBlocklistEntry,
  getFedBlocklist,
} from './feddy-moderation';

// Treasury + token + integrations
export {
  setTreasury,
  getTreasury,
  addTreasuryTx,
  getTreasuryTxs,
  setTokenConfig,
  getTokenConfig,
  setTokenGates,
  getTokenGates,
  checkTokenGate,
  createWebhook,
  getWebhooks,
  deleteWebhook,
  createBotKey,
  getBotKeys,
  deleteBotKey,
  verifyBotKey,
  setFederationHealth,
  getFederationHealth,
  addDiscoveredRemoteCommunity,
  getDiscoveredRemoteCommunities,
  trackFollowerCommunity,
} from './feddy-treasury';

// Directory + discovery
export {
  listDirectory,
  autocompleteSearch,
  getTrendingCommunities,
  getSimilarCommunities,
  getFollowerCommunities,
  getCommunityStats,
} from './feddy-directory';
