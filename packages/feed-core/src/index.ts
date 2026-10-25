// ─── User-Controlled Feed Algorithm (deprecated) ───────────────────
export type {
  AlgorithmAuditEntry,
  AlgorithmContext,
  AlgorithmMode,
  AlgorithmScoreBreakdown,
  AlgorithmWeights,
  NicheSelection,
  ProtocolWeights,
  ReasonEntry,
  UserAlgorithmPreferences,
} from './algorithm';
export {
  ALL_NICHES,
  DEFAULT_WEIGHTS,
  FeedAlgorithm,
  globalAuditLog,
  MODE_LABELS,
  NICHE_LABELS,
} from './algorithm';

// FeedAlgorithm class and helper scorers removed in consolidation.
// Use scorePost() from @degenfeed/ranking instead.

// ─── Keyword + weight data ──────────────────────────────────────────────
export { BOOST_TERMS } from './boost-terms';
// ─── Content Categorization V3 — Multi-label with confidence ─────────
export type {
  CategorizationFeedback,
  CategorizationV3Options,
  CategorizationV3Result,
  CategoryAssignment,
  CategoryDef,
  CategorySlug,
  TrendingCategory,
} from './categorization-v3';
export {
  ALL_CATEGORIES,
  CATEGORIES,
  CategorizationFeedbackStore,
  classifyPost,
  computeTrendingCategories,
} from './categorization-v3';
export type { CircuitState } from './circuit-breaker';
export { CircuitBreaker, CircuitBreakerError } from './circuit-breaker';
export { isCrossPost, isFromAggregator } from './cross-post';
export type {
  CrossProtocolLink,
  CrossProtocolReply,
  CrossProtocolThread,
} from './cross-protocol';
export {
  assembleCrossProtocolReplies,
  buildAlsoPostedIndicator,
  clearThreadStore,
  getAlsoPostedOn,
  getCrossPostLinks,
  getThread,
  getThreadMeta,
  pruneThreads,
  registerCrossPostLink,
  registerReply,
} from './cross-protocol';
// ─── Deduplication ──────────────────────────────────────────────────────
export { deduplicatePosts } from './dedup';
// ─── Diversity Algorithm — Category/creator/protocol rotation ─────────
export type {
  DiversityConfig,
  DiversityResult,
  DiversityState,
  ScoredItem,
} from './diversity';
export {
  DEFAULT_DIVERSITY_CONFIG,
  diversifyFeed,
  interleaveProtocols,
  isOpposingViewpoint,
  isSerendipitous,
  rankWithDiversity,
} from './diversity';
// ─── Unified post construction ──────────────────────────────────────────
export { emptyIdentity } from './empty-identity';
// ─── Unified Identity Resolver ──────────────────────────────────────────
export type {
  IdentityResolutionStrategy,
  ProtocolHandle,
  UnifiedProfile,
} from './identity-resolver';
export {
  formatCrossProtocolFollowers,
  globalIdentityResolver,
  IdentityResolver,
  linkIdentities,
  resolveIdentity,
} from './identity-resolver';
export { imagePerceptualFingerprint } from './image-hash';
export { isEnglishPost } from './language';
export type { ModerationCheckResult, ModerationThresholds } from './moderation';
// ─── Auto-moderation configuration ────────────────────────────────
export {
  checkText,
  DEFAULT_THRESHOLDS,
  isUserBanned,
  SCAM_KEYWORDS,
  SPAM_PATTERN_REGEXES,
} from './moderation';
export { NICHE_KEYWORDS } from './niche-keywords';
export type { CommunityQualityInput, CommunityQualityScore } from './niches';
// ─── Community niche mapping and quality scoring ──────────────────
export {
  COMMUNITY_DESCRIPTIONS,
  LEMMY_COMMUNITY_NICHES,
  RESERVED_COMMUNITY_NAMES,
  scoreCommunityQuality,
  subscriberTier,
} from './niches';
// ─── Personalization V2 — Implicit/explicit/temporal/session ──────────
export type {
  CreatorAffinity,
  ExplicitSignal,
  ImplicitSignal,
  PersonalizationV2Profile,
  PersonalizationV2Result,
  SessionEntry,
  TemporalPreference,
} from './personalization-v2';
export {
  computeSessionBoost,
  deserializePersonalizationV2,
  emptyPersonalizationV2Profile,
  learnFromExplicitSignal,
  learnFromImplicitSignal,
  learnTemporalPreference,
  recordSessionView,
  scorePersonalizationV2,
  serializePersonalizationV2,
} from './personalization-v2';
export { buildUnifiedPost, emptyMetrics, mediaFromEmbeds } from './post-build';
export { extractDomain } from './post-domain';
export { detectContentType, enrichPostNiches } from './post-enrich';
export { isRelevantPost } from './post-relevance';
export { postTitle } from './post-title';
export type { TopicPreference, UserBehaviorProfile } from './preferences';
// ─── AI-powered preference learning + personalization ─────────────
export {
  adjustTopicWeight,
  clearTopic,
  emptyBehaviorProfile,
  getLearnedTopics,
  INTERACTION_WEIGHTS,
  isOnboardingMode,
  learnFromInteraction,
  personalizeScore,
} from './preferences';
export type { ProtocolQualityContext, ProtocolQualityResult } from './protocol-quality';
// ─── Per-protocol quality scoring (protocol pages) ────────────────
export {
  computeProtocolQuality,
  KNOWN_MASTODON_INSTANCES,
  QUALITY_BADGE_THRESHOLD,
} from './protocol-quality';
export type {
  AuthorProfile,
  QualityContext,
} from './quality';
// ─── Content quality scoring v2 ──────────────────────────────────
export {
  buildQualityAuthorProfile,
  computeAuthorQuality,
  computeEngagementDensity,
  computeQualityScore,
  computeUniqueness,
  estimateViews,
  hasMedia,
} from './quality';
export type {
  PresetName,
  PresetProfile,
  ProtocolQualityPreset,
  QualityFilterResult,
  ResolvedPreset,
} from './quality-presets';
// ─── Protocol quality presets ─────────────────────────────────────
export {
  applyQualityFilters,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  PRESET_NAMES,
  PRESET_PROFILES,
  PROTOCOL_PRESETS,
  presetKvKey,
  resolvePreset,
} from './quality-presets';
// ─── Content Quality V3 — Enhanced scoring ────────────────────────────
export type {
  QualityV3Context,
  QualityV3Options,
  QualityV3Signals,
} from './quality-v3';
export {
  computeCreatorQuality,
  computeEngagementVelocity,
  computeFreshnessV3,
  computeLanguageQuality,
  computeSourceDiversity,
  detectEvergreen,
  enrichWithQualityV3,
  PROTOCOL_QUALITY_WEIGHTS,
  scoreQualityV3,
} from './quality-v3';
// ─── Relevance, niches, language gate ───────────────────────────────────
export type { SignalScores } from './relevance';
export { detectNiches, extractEmbeds, keywordRelevance } from './relevance';
export type { SpamContext, SpamResult, SpamTier } from './spam';
// ─── Advanced spam detection (continuous scoring) ──────────────────
export {
  contentQualityScore,
  isSpamPost,
  spamScore,
  spamTier,
} from './spam';
export { levenshteinDistance, normalizedLevenshtein } from './text-similarity';
export { PLATFORM_TIER_WEIGHTS } from './tier-weights';
export { extractCanonicalUrl, primaryUrl } from './url-identity';
