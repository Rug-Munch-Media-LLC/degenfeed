/**
 * @degenfeed/web — Hooks barrel
 */

export { useFeedData } from './feed/useFeedData';
export type { UseFeedDataOptions, UseFeedDataResult } from './feed/useFeedData';

export { useFeedFilters } from './feed/useFeedFilters';
export type { FeedFilterState, UseFeedFiltersResult } from './feed/useFeedFilters';

// Re-export existing hooks
export { useAuth } from '../components/AuthProvider';
export { useNotifications } from './useNotifications';
export { useDebounce } from './useDebounce';
export { usePreferences } from './usePreferences';
export { useFeedLayout } from './useFeedLayout';
export { useFeedPosition } from './useFeedPosition';
export { useEdgeSwipeBack } from './useEdgeSwipeBack';
export { useHapticFeedback } from './useHapticFeedback';
export { useScrollVelocity } from './useScrollVelocity';
export { useSwipeTabs } from './useSwipeTabs';
export { useReturningUser } from './useReturningUser';
export { useHoverPrefetch } from './useHoverPrefetch';
export { useViewportPrefetch } from './useViewportPrefetch';
export { useCopyToClipboard } from './useCopyToClipboard';
export { useLongPress } from './useLongPress';
export { useDoubleTap } from './useDoubleTap';
export { useTip } from './useTip';
export { usePremium } from './usePremium';
export { useEngage } from './useEngage';
export { useOfflineQueue } from './useOfflineQueue';
