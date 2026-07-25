/**
 * @degenfeed/api-worker — Centralized KV key patterns
 *
 * Every KV operation MUST use these factory functions instead of
 * constructing key strings inline. This ensures consistency, prevents
 * key collisions, and centralizes TTL defaults.
 *
 * NAMING CONVENTION:  {namespace}:{scope}:{identifier}
 *
 * Examples:
 *   post:v1:0x1234              — cached post response
 *   bookmarks:0xabcd            — user bookmarks
 *   spaces:abc123               — space details
 *   csrf:<sessionCookie>        — CSRF token
 *   revoked:session:<nonce>     — revoked session nonce
 *   error-log:v2:...            — structured error log
 *
 * ADDING A NEW PATTERN:
 *   1. Add a factory function below with JSDoc stating the KV namespace and TTL.
 *   2. Use it in the route handler — never construct keys inline.
 *   3. If the value is stored in a non-default KV namespace (e.g., BOOKMARKS
 *      instead of CACHE), call that out in the JSDoc.
 */

// ─── Generic → specific ───────────────────────────────────────────

/** Base key for a cached single post. NS: CACHE. TTL: 5 min (300s). */
export function cachedPostKey(postId: string): string {
  return `post:v1:${encodeURIComponent(postId)}`;
}

/** Raw post data key (populated by feed pipeline). NS: CACHE. TTL: variable. */
export function rawPostKey(postId: string): string {
  return `post:${encodeURIComponent(postId)}`;
}

/** Feed cache entry for a given feed type + user. NS: CACHE. TTL: 2 min (120s). */
export function feedCacheKey(feedType: string, userId?: string): string {
  return userId ? `feed:${feedType}:${userId}` : `feed:${feedType}`;
}

/** User preferences. NS: CACHE. TTL: 10 min (600s). */
export function userPreferencesKey(address: string): string {
  return `prefs:${address.toLowerCase()}`;
}

/** Bookmark list for a wallet. NS: BOOKMARKS. No TTL (persistent). */
export function bookmarksKey(address: string): string {
  return `bookmarks:${address.toLowerCase()}`;
}

/** Following list for a wallet. NS: CACHE. TTL: 5 min (300s). */
export function followingKey(address: string): string {
  return `following:${address.toLowerCase()}`;
}

/** Follower list for a wallet. NS: CACHE. TTL: 5 min (300s). */
export function followersKey(address: string): string {
  return `followers:${address.toLowerCase()}`;
}

/** Session revocation blocklist entry. NS: CACHE. TTL: remaining session lifetime. */
export function revokedSessionKey(nonce: string): string {
  return `revoked:session:${nonce}`;
}

/** Address-wide revocation marker. NS: CACHE. TTL: 7 days. */
export function revokedAddressKey(address: string): string {
  return `revoked:address:${address.toLowerCase()}`;
}

/** CSRF token storage. NS: CACHE. TTL: 1 hour (3600s). */
export function csrfTokenKey(sessionCookieValue: string): string {
  return `csrf:${sessionCookieValue}`;
}

/** OAuth state nonce. NS: CACHE. TTL: 10 min (600s). */
export function oauthStateKey(state: string): string {
  return `oauth:state:${state}`;
}

/** Space detail. NS: SPACES. TTL: 5 min (300s). */
export function spaceKey(id: string): string {
  return `spaces:${id}`;
}

/** Live spaces index. NS: CACHE. TTL: 1 min (60s). */
export function liveSpacesIndexKey(): string {
  return 'spaces:live';
}

/** Upcoming spaces index. NS: CACHE. TTL: 5 min (300s). */
export function upcomingSpacesIndexKey(): string {
  return 'spaces:upcoming';
}

/** Trending content cache. NS: CACHE. TTL: 5 min (300s). */
export function trendingCacheKey(): string {
  return 'trending:v1';
}

/** Discover page cache. NS: CACHE. TTL: 5 min (300s). */
export function discoverCacheKey(): string {
  return 'discover:v1';
}

/** Protocol health cache key. NS: CACHE. TTL: 30s. */
export function protocolHealthCacheKey(): string {
  return 'health:protocols:v1';
}

/** Newsletter subscriber list. NS: CACHE. TTL: 10 min (600s). */
export function newsletterSubscribersKey(): string {
  return 'newsletter:subscribers';
}

/** API key record. NS: API_KEYS. Persistent. */
export function apiKeyRecordKey(keyHash: string): string {
  return `apikey:${keyHash}`;
}

/** API key metadata by user. NS: API_KEYS. Persistent. */
export function userApiKeysKey(userId: string): string {
  return `user:apikeys:${userId}`;
}

/** Deployment request. NS: DEPLOYMENTS. TTL: 24h. */
export function deploymentKey(id: string): string {
  return `deploy:${id}`;
}

/** Moderation report. NS: REPORTS. TTL: 90 days. */
export function reportKey(id: string): string {
  return `report:${id}`;
}

/** Moderation ban record. NS: REPORTS. TTL: indefinite. */
export function banKey(address: string): string {
  return `ban:${address.toLowerCase()}`;
}

/** Cross-protocol community record. NS: COMMUNITIES. Persistent. */
export function communityKey(name: string): string {
  return `community:${name.toLowerCase()}`;
}

/** Community members list. NS: CACHE. TTL: 5 min (300s). */
export function communityMembersKey(name: string): string {
  return `community:${name.toLowerCase()}:members`;
}

/** DAO governance proposal. NS: GOVERNANCE. Persistent. */
export function proposalKey(communityName: string, proposalId: string): string {
  return `proposal:${communityName.toLowerCase()}:${proposalId}`;
}

/** DAO proposals index for a community. NS: GOVERNANCE. Persistent. */
export function communityProposalsKey(communityName: string): string {
  return `proposal:${communityName.toLowerCase()}:list`;
}

/** Reputation score. NS: REPUTATION. TTL: 1 hour. */
export function reputationKey(userId: string): string {
  return `reputation:${userId}`;
}

/** DAO badge award record. NS: CACHE. Persistent. */
export function badgeKey(userId: string, badgeId: string): string {
  return `badge:${userId}:${badgeId}`;
}

/** User badge list. NS: CACHE. Persistent. */
export function userBadgesKey(userId: string): string {
  return `badges:${userId}`;
}

/** DAO activity feed. NS: CACHE. TTL: 1 hour. */
export function daoActivityFeedKey(daoId: string): string {
  return `dao:activity:${daoId}`;
}

/** DAO activity stream (WebSocket broadcast buffer). NS: CACHE. TTL: 5 min. */
export function daoRealtimeKey(daoId: string): string {
  return `dao:realtime:${daoId}`;
}

/** Quadratic voting power snapshot. NS: CACHE. TTL: 10 min. */
export function quadraticVotingKey(userId: string, daoId: string): string {
  return `quadratic:${daoId}:${userId}`;
}

/** Quadratic vote tally for a proposal. NS: GOVERNANCE. Persistent. */
export function quadraticTallyKey(proposalId: string): string {
  return `quadratic:tally:${proposalId}`;
}

/** DAO participation challenge state. NS: CACHE. TTL: 7 days. */
export function daoChallengeKey(userId: string, daoId: string, date: string): string {
  return `dao:challenge:${daoId}:${userId}:${date}`;
}

/** DAO participation leaderboard. NS: REPUTATION. TTL: 10 min. */
export function daoLeaderboardKey(daoId: string, period: string): string {
  return `dao:leaderboard:${daoId}:${period}`;
}

/** Reputation leaderboard. NS: REPUTATION. TTL: 10 min. */
export function reputationLeaderboardKey(): string {
  return 'reputation:leaderboard';
}

/** Subscription tier config for a creator. NS: CACHE. TTL: 5 min. */
export function subscriptionTiersKey(creator: string): string {
  return `sub:tiers:${creator.toLowerCase()}`;
}

/** User subscription record. NS: CACHE. TTL: 5 min. */
export function userSubscriptionKey(userId: string): string {
  return `sub:user:${userId.toLowerCase()}`;
}

/** Moderation stats cache. NS: CACHE. TTL: 5 min (300s). */
export function moderationStatsKey(): string {
  return 'moderation:stats';
}

/** Content permanence proof. NS: CACHE. TTL: indefinite. */
export function permanenceKey(hash: string): string {
  return `permanence:${hash}`;
}

/** Notification feed for a user. NS: CACHE. TTL: 5 min (300s). */
export function notificationsKey(address: string): string {
  return `notifications:${address.toLowerCase()}`;
}

/** Custom feed definition. NS: CACHE. TTL: 10 min (600s). */
export function customFeedKey(id: string): string {
  return `custom-feed:${id}`;
}

/** Feddy community record. NS: FEDDY. Persistent. */
export function feddyCommunityKey(name: string): string {
  return `feddy:${name.toLowerCase()}`;
}

/** Draft post content. NS: CACHE. TTL: 7 days. */
export function draftKey(address: string, draftId: string): string {
  return `draft:${address.toLowerCase()}:${draftId}`;
}

/** User draft list index. NS: CACHE. TTL: 7 days. */
export function userDraftsKey(address: string): string {
  return `drafts:${address.toLowerCase()}`;
}

/** Token community content. NS: CONTENT_STORE. Persistent. */
export function tokenCommunityContentKey(communityId: string): string {
  return `tc:content:${communityId}`;
}

/** Cross-reply sync status. NS: CACHE. TTL: 1 hour. */
export function crossReplyKey(postId: string): string {
  return `cross-reply:${postId}`;
}

/** Blink tip transaction record. NS: CACHE. TTL: 1 hour (3600s). */
export function blinkTipKey(txId: string): string {
  return `blink:tip:${txId}`;
}

/** Feature flags cache. NS: CACHE. TTL: 5 min (300s). */
export function featureFlagsKey(): string {
  return 'features:v1';
}

/** Recommended content cache. NS: CACHE. TTL: 10 min (600s). */
export function recommendationsKey(userId?: string): string {
  return userId ? `recs:${userId}` : 'recs:default';
}

/** Leaderboard cache. NS: CACHE. TTL: 10 min (600s). */
export function leaderboardKey(type: string): string {
  return `leaderboard:${type}`;
}

/** Unified tip activity feed. NS: CACHE. TTL: 5 min (300s). */
export function tipActivityKey(): string {
  return 'tip:activity';
}

/** Scheduled post record. NS: CACHE. TTL: until scheduled time. */
export function scheduledPostKey(id: string): string {
  return `scheduled:${id}`;
}

/** User's scheduled posts index. NS: CACHE. TTL: until last scheduled post. */
export function userScheduledPostsKey(address: string): string {
  return `scheduled:user:${address.toLowerCase()}`;
}

/** Cross-protocol bridge sync state. NS: CACHE. TTL: 5 min (300s). */
export function bridgeSyncKey(protocol: string): string {
  return `bridge:sync:${protocol}`;
}

/** User mute list. NS: CACHE. TTL: 10 min (600s). */
export function mutedUsersKey(address: string): string {
  return `muted:${address.toLowerCase()}`;
}

/** User block list. NS: CACHE. TTL: 10 min (600s). */
export function blockedUsersKey(address: string): string {
  return `blocked:${address.toLowerCase()}`;
}

/** WebAuthn challenge nonce. NS: CACHE. TTL: 5 min (300s). */
export function webauthnChallengeKey(wallet: string): string {
  return `webauthn:challenge:${wallet.toLowerCase()}`;
}

/** WebAuthn credentials list for a wallet. NS: CACHE. Persistent. */
export function webauthnCredentialsKey(wallet: string): string {
  return `webauthn:credentials:${wallet.toLowerCase()}`;
}

// ─── Hardware Wallet 2FA ───────────────────────────────────────────

/** Hardware wallet 2FA challenge. NS: CACHE. TTL: 5 min (300s). */
export function hwWalletChallengeKey(address: string, nonce: string): string {
  return `hw2fa:challenge:${address.toLowerCase()}:${nonce}`;
}

/** Hardware wallet 2FA status for a user. NS: CACHE. TTL: indefinite (no expiry). */
export function hwWallet2FAStatusKey(address: string): string {
  return `hw2fa:status:${address.toLowerCase()}`;
}

// ─── TOTP 2FA ─────────────────────────────────────────────────
// These key patterns are used by the RFC 6238 TOTP implementation.
// TOTP secrets are stored encrypted at rest.

/** Temporary TOTP secret during setup flow. NS: CACHE. TTL: 10 min (600s). */
export function totpTempKey(address: string): string {
  return `totp:temp:${address.toLowerCase()}`;
}

/** Permanent encrypted TOTP secret. NS: CACHE. TTL: indefinite. */
export function totpSecretKey(address: string): string {
  return `totp:secret:${address.toLowerCase()}`;
}

/** Recovery code SHA-256 hash. NS: CACHE. TTL: indefinite (one-time use). */
export function recoveryCodeHashKey(address: string, hash: string): string {
  return `totp:recovery:${address.toLowerCase()}:${hash}`;
}

// ─── Multi-Sig Treasury ──────────────────────────────────────────────

/** Multi-sig transaction record. NS: TREASURY. Persistent. */
export function multisigTxKey(daoId: string, txId: string): string {
  return `multisig:tx:${daoId}:${txId}`;
}

/** Multi-sig signer vote. NS: TREASURY. Persistent. */
export function multisigSignatureKey(daoId: string, txId: string, signer: string): string {
  return `multisig:tx:${daoId}:${txId}:signatures:${signer.toLowerCase()}`;
}

/** Multi-sig index list for a DAO. NS: TREASURY. Persistent. */
export function multisigIndexKey(daoId: string): string {
  return `multisig:tx:${daoId}:list`;
}

/** Multi-sig configuration record. NS: TREASURY. Persistent. */
export function multisigConfigKey(daoId: string): string {
  return `multisig:config:${daoId}`;
}

// ─── Streaming Payments ──────────────────────────────────────────────

/** Streaming payment record. NS: TREASURY. Persistent. */
export function streamKey(daoId: string, streamId: string): string {
  return `stream:${daoId}:${streamId}`;
}

/** Stream index list for a DAO. NS: TREASURY. Persistent. */
export function streamIndexKey(daoId: string): string {
  return `stream:${daoId}:list`;
}

/** Stream payment event. NS: TREASURY. Persistent. */
export function streamEventKey(daoId: string, streamId: string, eventId: string): string {
  return `stream:${daoId}:${streamId}:event:${eventId}`;
}

/** Stream analytics aggregate. NS: TREASURY. TTL: 1 hour. */
export function streamAnalyticsKey(daoId: string): string {
  return `stream:${daoId}:analytics`;
}

// ─── Grant Programs ──────────────────────────────────────────────────

/** Grant program record. NS: TREASURY. Persistent. */
export function grantProgramKey(daoId: string, grantId: string): string {
  return `grant:program:${daoId}:${grantId}`;
}

/** Grant program index for a DAO. NS: TREASURY. Persistent. */
export function grantProgramIndexKey(daoId: string): string {
  return `grant:program:${daoId}:list`;
}

/** Grant application record. NS: TREASURY. Persistent. */
export function grantApplicationKey(daoId: string, appId: string): string {
  return `grant:app:${daoId}:${appId}`;
}

/** Grant application index for a DAO. NS: TREASURY. Persistent. */
export function grantApplicationIndexKey(daoId: string): string {
  return `grant:app:${daoId}:list`;
}

/** Grant vote record. NS: TREASURY. Persistent. */
export function grantVoteKey(daoId: string, appId: string, voter: string): string {
  return `grant:vote:${daoId}:${appId}:${voter.toLowerCase()}`;
}

/** Grant milestone completion record. NS: TREASURY. Persistent. */
export function grantMilestoneKey(daoId: string, appId: string, milestoneId: string): string {
  return `grant:milestone:${daoId}:${appId}:${milestoneId}`;
}

/** Grant analytics aggregate. NS: TREASURY. TTL: 1 hour. */
export function grantAnalyticsKey(daoId: string): string {
  return `grant:${daoId}:analytics`;
}

// ─── Investment Management ───────────────────────────────────────────

/** Investment position record. NS: TREASURY. Persistent. */
export function investmentKey(daoId: string, investmentId: string): string {
  return `investment:${daoId}:${investmentId}`;
}

/** Investment index for a DAO. NS: TREASURY. Persistent. */
export function investmentIndexKey(daoId: string): string {
  return `investment:${daoId}:list`;
}

/** Investment proposal record. NS: TREASURY. Persistent. */
export function investmentProposalKey(daoId: string, proposalId: string): string {
  return `investment:proposal:${daoId}:${proposalId}`;
}

/** Investment proposal index for a DAO. NS: TREASURY. Persistent. */
export function investmentProposalIndexKey(daoId: string): string {
  return `investment:proposal:${daoId}:list`;
}

/** Portfolio snapshot cache. NS: TREASURY. TTL: 5 min (300s). */
export function portfolioKey(daoId: string): string {
  return `portfolio:${daoId}`;
}

/** Yield opportunity cache. NS: TREASURY. TTL: 10 min (600s). */
export function yieldOpportunitiesKey(): string {
  return 'yield:opportunities';
}

// ─── External DAO Tooling Integrations (Snapshot) ──────────────────────

/** Snapshot space link for a DAO. NS: GOVERNANCE. Persistent. */
export function snapshotLinkedSpaceKey(daoId: string): string {
  return `snapshot:linked:${daoId}`;
}

/** Snapshot sync marker for a proposal. NS: GOVERNANCE. TTL: 30 days. */
export function snapshotSyncMarkerKey(daoId: string, proposalId: string): string {
  return `snapshot:sync:${daoId}:${proposalId}`;
}

/** Snapshot delegation record. NS: GOVERNANCE. Persistent. */
export function snapshotDelegationKey(daoId: string, voter: string): string {
  return `snapshot:delegation:${daoId}:${voter.toLowerCase()}`;
}

/** Snapshot strategy cache. NS: GOVERNANCE. TTL: 24h. */
export function snapshotStrategyCacheKey(daoId: string): string {
  return `snapshot:strategy:${daoId}`;
}

/** Snapshot imported votes for analytics. NS: GOVERNANCE. TTL: 30 days. */
export function snapshotImportedVotesKey(daoId: string, proposalId: string): string {
  return `snapshot:imported:${daoId}:${proposalId}`;
}

// ─── External DAO Tooling Integrations (Tally) ─────────────────────────

/** Tally link state for a DAO. NS: GOVERNANCE. Persistent. */
export function tallyLinkKey(daoId: string): string {
  return `tally:link:${daoId}`;
}

/** Tally compliance verification cache. NS: GOVERNANCE. TTL: 24h. */
export function tallyVerificationKey(daoId: string): string {
  return `tally:verified:${daoId}`;
}

// ─── External DAO Tooling Integrations (Defender) ─────────────────────

/** OpenZeppelin Defender integration state. NS: GOVERNANCE. Persistent. */
export function defenderStateKey(daoId: string): string {
  return `defender:state:${daoId}`;
}

/** Defender autotask code reference. NS: GOVERNANCE. TTL: 30 days. */
export function defenderAutotaskCodeKey(daoId: string): string {
  return `defender:autotask:${daoId}`;
}

// ─── External DAO Tooling Integrations (DAO Registry) ─────────────────

/** DAO registry index list. NS: GOVERNANCE. Persistent. */
export function daoRegistryIndexKey(): string {
  return 'dao:registry:list';
}

/** DAO registry entry. NS: GOVERNANCE. Persistent. */
export function daoRegistryEntryKey(daoId: string): string {
  return `dao:registry:${daoId}`;
}

/** Reverse lookup: Snapshot space → DegenFeed DAO ID. NS: GOVERNANCE. Persistent. */
export function daoSnapshotLookupKey(spaceId: string): string {
  return `dao:lookup:snapshot:${spaceId}`;
}

/** Reverse lookup: Tally governor → DegenFeed DAO ID. NS: GOVERNANCE. Persistent. */
export function daoTallyLookupKey(governorAddress: string): string {
  return `dao:lookup:tally:${governorAddress.toLowerCase()}`;
}

/** Reverse lookup: Realms realm → DegenFeed DAO ID. NS: GOVERNANCE. Persistent. */
export function daoRealmsLookupKey(realmId: string): string {
  return `dao:lookup:realms:${realmId}`;
}
