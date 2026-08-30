/**
 * @degenfeed/web — Hooks barrel
 */

// Re-export existing hooks
export { useAuth } from '../components/AuthProvider';
export type { FeedFilterState, UseFeedFiltersResult } from './feed/useFeedFilters';
export { useFeedFilters } from './feed/useFeedFilters';
export { useCopyToClipboard } from './useCopyToClipboard';
export { useDebounce } from './useDebounce';
export { useDoubleTap } from './useDoubleTap';
export { useEdgeSwipeBack } from './useEdgeSwipeBack';
export { useEngage } from './useEngage';
export { useFeedLayout } from './useFeedLayout';
export { useFeedPosition } from './useFeedPosition';
export { useHapticFeedback } from './useHapticFeedback';
export { useHoverPrefetch } from './useHoverPrefetch';
export { useLongPress } from './useLongPress';
export { useNotifications } from './useNotifications';
export { useOfflineQueue } from './useOfflineQueue';
export { usePreferences } from './usePreferences';
export { usePremium } from './usePremium';
export { useReturningUser } from './useReturningUser';
export { useScrollVelocity } from './useScrollVelocity';
export { useSwipeTabs } from './useSwipeTabs';
export { useTip } from './useTip';
export { useViewportPrefetch } from './useViewportPrefetch';
