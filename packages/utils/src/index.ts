/**
 * @degenfeed/utils — Shared utilities used across the worker API, web app,
 * and provider packages. Keep this package dependency-free so it can be
 * imported from anywhere.
 *
 * This module is a BARREL ONLY: it re-exports single-purpose modules and
 * declares no logic of its own. Add behaviour to the owning module and
 * re-export it here.
 */

// ─── Cross-protocol communities ────────────────────────────────────────
export type { CrossProtocolCommunity } from './community';
export {
  COMMUNITY_INDEX_KEY,
  COMMUNITY_KV_PREFIX,
  communityFeedKey,
  communityKey,
  communityMembersKey,
  slugifyCommunity,
} from './community';
// ─── Concurrency control ──────────────────────────────────────────────
export { withConcurrencyLimit } from './concurrency';
// ─── Universal Content Addressing (df:// URIs) ─────────────────────────
export type { ProtocolSource } from './contentUri';
export { decodeContentUri, encodeContentUri, getPostContentUri } from './contentUri';
// ─── Cross-protocol identity resolution ────────────────────────────────
export type { CrossProtocolIdentity, ProtocolId } from './crossProtocolIdentity';
export { IDENTITY_KV_PREFIX, identityKey, PROTOCOL_ID_REGISTRY } from './crossProtocolIdentity';
// ─── Token detection ──────────────────────────────────────────────────
export type { TokenRef } from './detectTokens';
export { detectTokens } from './detectTokens';
// ─── Video detection ─────────────────────────────────────────────────────
export type {
  DirectVideoInfo,
  EmbedLike,
  PeerTubeInfo,
  PeerTubeVideoData,
  VideoInfo,
  YouTubeInfo,
} from './detectVideo';
export {
  detectVideoFromEmbeds,
  fetchPeerTubeVideo,
  isShortFormVideo,
  parseDirectVideoUrl,
  parsePeerTubeUrl,
  parseVideoUrl,
  parseYouTubeUrl,
} from './detectVideo';
// ─── HTML / XML entity handling ───────────────────────────────────────
export { decodeXmlEntities } from './entities';
// ─── Environment helpers ──────────────────────────────────────────────
export { rmiUrl } from './env';
// ─── Formatting ───────────────────────────────────────────────────────
export { formatCount, formatDate, formatDuration, formatTimeAgo, formatTimestamp } from './format';
// ─── Handle resolution ─────────────────────────────────────────────────
export type { HandleResolution } from './identity';
export { resolveFediverseHandle, resolveHandle } from './identity';
// ─── Media proxy (image-proxy URL helper) ─────────────────────────────
export { proxyMediaUrl, proxyUrl } from './mediaProxy';
// ─── Content parsing (shared adapter utilities) ────────────────────────
export { guessNiches } from './niches';

// ─── Profile URL generation ────────────────────────────────────────────
export {
  getAuthorProfileHref,
  getExternalProfileUrl,
  getInternalProfileId,
  getInternalProfilePath,
  getProfileUrlFromParts,
  getProtocolFeedPath,
} from './profileUrl';
// ─── Protocol → currency mapping for tipping ──────────────────────────
export {
  CURRENCY_META,
  type CurrencyKey,
  type CurrencyMeta,
  getCurrencyMeta,
  getDefaultCurrency,
  PROTOCOL_DEFAULT_CURRENCY,
} from './protocolCurrency';
// ─── Protocol parsing ─────────────────────────────────────────────────
export { parseProtocols } from './protocolParsing';
// ─── Protocol registry (canonical) ──────────────────────────────────
// Colors, labels, icons and metadata now live in ./protocols — the single
// source of truth for protocol config. Local maps in app/UI packages must
// derive from here instead of redefining protocol colors.
export type { ExtraProtocolConfig, ProtocolCategory, ProtocolConfig } from './protocols';
export {
  CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_PROTOCOLS,
  EXTRA_PROTOCOLS,
  getProtocolColor,
  getProtocolEmoji,
  getProtocolIcon,
  getProtocolLabel,
  PROTOCOL_COLORS,
  PROTOCOL_EMOJI,
  PROTOCOL_ICONS,
  PROTOCOL_LABELS,
  PROTOCOL_LIST,
  PROTOCOLS,
  SIDEBAR_ORDER,
} from './protocols';
// ─── Protocol content translation ─────────────────────────────────────
export type { TranslationResult } from './protocolTranslator';
export { estimateTranslationLoss, PROTOCOL_FORMATS, translateContent } from './protocolTranslator';
export type { RssItem } from './rss';
export { parseRssItems } from './rss';
// ─── Error reporting (lightweight Sentry) ─────────────────────────────
export { reportError } from './sentry';
// ─── String utilities ────────────────────────────────────────────────
export { safeKey, shortenAddress } from './strings';
export { stripHtml } from './stripHtml';
// ─── URL building ─────────────────────────────────────────────────────
export { buildUrl } from './url';
// ─── Validation ───────────────────────────────────────────────────────
export { isValidEmail } from './validation';
