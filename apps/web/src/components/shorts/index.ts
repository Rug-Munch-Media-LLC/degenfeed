/**
 * @components/shorts — Barrel export for all shorts components.
 */

// Re-export unified types
export type {
  CrossChainTip,
  ShortSource,
  UnifiedShortItem,
  UnifiedShortsResponse,
  UseUnifiedShortsOptions,
  UseUnifiedShortsResult,
  ZoraNftInfo,
} from '../../hooks/useUnifiedShorts';
export { CreateShortModal } from './CreateShortModal';
export type { PublishResult } from './PublishProgress';
export { PublishProgress } from './PublishProgress';
export type { ShortProtocol } from './protocolMeta';
export { buildShareUrl, PROTOCOL_META } from './protocolMeta';
export { ShortsActions } from './ShortsActions';
export { ShortsCreatorInfo } from './ShortsCreatorInfo';
export { ShortsFeed } from './ShortsFeed';
export { ShortsOverlay } from './ShortsOverlay';
export { ShortsProgress } from './ShortsProgress';
export type { SourceBadgeData } from './ShortsSourceBadge';
export { ShortsSourceBadge, sourceBadgeData } from './ShortsSourceBadge';
export type { SourceCountItem } from './ShortsSourceBar';
export { ShortsSourceBar } from './ShortsSourceBar';
export type { ShortsResponse, UseShortsOptions, UseShortsResult } from './useShorts';
export { useShorts } from './useShorts';
