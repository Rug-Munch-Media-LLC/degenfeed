/**
 * @degenfeed/feed-providers — Mastodon/Fediverse provider
 *
 * Barrel file — re-exports for backward compatibility.
 */

// Re-export types from adapter
export type {
  GtSAccount,
  GtSCard,
  GtSMediaAttachment,
  GtSStatus,
  InstanceHealth,
  MastodonProviderOptions,
  MisskeyNote,
  MisskeyNotesResponse,
} from './mastodon-adapter';
// Re-export adapter (values)
export {
  accountToIdentity,
  getFediverseStats,
  instanceHealth,
  instanceHealthScore,
  misskeyNoteToGtS,
  recordInstanceFailure,
  recordInstanceSuccess,
  statusToUnifiedPost,
  stripHtml,
} from './mastodon-adapter';
// Re-export types from data
export type { FediverseInstance, FediverseSoftware } from './mastodon-data';
// Re-export data (values)
export {
  CRYPTO_HASHTAGS,
  CRYPTO_KEYWORDS,
  DEFAULT_GTS_INSTANCE,
  FEDIVERSE_KEYWORDS,
  PUBLIC_MASTODON_INSTANCES,
  RELEVANCE_THRESHOLD,
  scoreFediverseRelevance,
  TECH_HASHTAGS,
  TECH_KEYWORDS,
  TRENDING_INSTANCES,
} from './mastodon-data';

// Provider class
export { MastodonProvider } from './mastodon-provider';
