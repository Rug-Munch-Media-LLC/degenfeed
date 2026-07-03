/**
 * @degenfeed/ui
 *
 * Shared UI components used across apps/web and potentially apps/landing.
 * Minimal set of atoms — no component library, just thin wrappers over
 * Radix Primitives and Tailwind classes.
 *
 * Every component accepts className for extension. Every component has
 * proper dark mode support via Tailwind's dark: variant.
 *
 * TODO(v1):
 *   - Add PostCard component (the main feed item)
 *   - Add ComposeBox (text area + protocol picker + publish)
 *   - Add SignInModal (protocol picker + sign-in flow)
 *   - Add ProfileCard (identity display + follow button)
 *   - Add ProtocolBadge (colored badge per protocol)
 *   - Add LoadingSpinner / ErrorBoundary / EmptyState
 *   - Add Avatar component (with protocol indicator)
 *   - Add FeedList (virtualized feed with pull-to-refresh)
 */

export const UI_VERSION = '0.1.0';

// Re-export commonly used types for convenience
export type { UnifiedPost, UnifiedIdentity, Protocol } from '@degenfeed/types';
