/**
 * @degenfeed/api-worker — Feed Explainer
 *
 * Server-side utility that produces structured, human-readable explanations
 * for why a post appeared in the user's feed. Integrates with the unified
 * scorer from @degenfeed/ranking and the FeedWhyCard UI component.
 *
 * Used by /api/algo/explain/:postId to power the "Why am I seeing this?" UI.
 *
 * Output format matches what the FeedWhyCard expects — main reason,
 * secondary signals, score breakdown, and actionable links to settings.
 */

import { type ScoringWeights, scorePost } from '@degenfeed/ranking';
import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export type ExplainerContext = {}
