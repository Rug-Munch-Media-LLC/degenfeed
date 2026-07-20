/**
 * @components/shorts — Barrel export for all shorts components.
 */

export { ShortsFeed } from './ShortsFeed';
export { ShortsOverlay } from './ShortsOverlay';
export { ShortsSourceBadge, sourceBadgeData } from './ShortsSourceBadge';
export type { SourceBadgeData } from './ShortsSourceBadge';
export { ShortsSourceBar } from './ShortsSourceBar';
export type { SourceCountItem } from './ShortsSourceBar';
export { ShortsCreatorInfo } from './ShortsCreatorInfo';
export { ShortsActions } from './ShortsActions';
export { ShortsProgress } from './ShortsProgress';
export { CreateShortModal } from './CreateShortModal';
export { PublishProgress } from './PublishProgress';
export type { PublishResult } from './PublishProgress';
export { PROTOCOL_META, buildShareUrl } from './protocolMeta';
export type { ShortProtocol } from './protocolMeta';
export { useShorts } from './useShorts';
export type { UseShortsOptions, UseShortsResult, ShortsResponse } from './useShorts';

// Re-export unified types
export type {
  UnifiedShortItem,
  UnifiedShortsResponse,
  UseUnifiedShortsOptions,
  UseUnifiedShortsResult,
  ShortSource,
  ZoraNftInfo,
  CrossChainTip,
} from '../../hooks/useUnifiedShorts';
