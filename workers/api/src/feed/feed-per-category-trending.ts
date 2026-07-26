/**
 * feed-per-category-trending — Per-category trending sections showing
 * what's hot in each category right now.
 *
 * Computes trending topics/posts for each category independently,
 * using engagement velocity + recency signals weighted by category
 * relevance.
 */

import type { UnifiedPost } from '@degenfeed/types';
import {

export interface CategoryTrendingItem {

export interface CategoryTrendingResult {

export function computeCategoryTrending(
  posts: UnifiedPost[],
  limit = 6,
  maxAgeHours = 48,
): Record<CategorySlug, CategoryTrendingResult> {

export function getTrendingSummary(
  trending: Record<CategorySlug, CategoryTrendingResult>,
  topN = 5,
): Array<{

