/**
 * @degenfeed/feed-providers — Mastodon/Fediverse provider
 *
 * Barrel file — re-exports for backward compatibility.
 */

// Re-export data (values)
export {
  DEFAULT_GTS_INSTANCE,
  TRENDING_INSTANCES,
  PUBLIC_MASTODON_INSTANCES,
  CRYPTO_KEYWORDS,
  TECH_KEYWORDS,
  CRYPTO_HASHTAGS,
  TECH_HASHTAGS,
  FEDIVERSE_KEYWORDS,
  scoreFediverseRelevance,
  RELEVANCE_THRESHOLD,
} from './mastodon-data';

// Re-export types from data
export type { FediverseSoftware, FediverseInstance } from './mastodon-data';

// Re-export adapter (values)
export {
  stripHtml,
  accountToIdentity,
  statusToUnifiedPost,
  instanceHealth,
  recordInstanceSuccess,
  recordInstanceFailure,
  instanceHealthScore,
  getFediverseStats,
  misskeyNoteToGtS,
} from './mastodon-adapter';
export { MastodonProviderOptions } from './mastodon-adapter';

// Re-export types from adapter
export type {
  GtSAccount,
  GtSCard,
  GtSMediaAttachment,
  GtSStatus,
  InstanceHealth,
  MisskeyNote,
  MisskeyNotesResponse,
} from './mastodon-adapter';

// Provider class
export { MastodonProvider } from './mastodon-provider';
