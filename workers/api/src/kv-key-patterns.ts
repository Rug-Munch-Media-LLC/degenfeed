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
