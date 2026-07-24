/**
 * feed-category-coverage — Category coverage auditing, gap detection,
 * and content abundance enforcement.
 *
 * Ensures every category has sufficient content flowing through the feed.
 * Detects categories with fewer than `MIN_POSTS_THRESHOLD` posts and
 * provides recommendations for which sources/niches need more content.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { ALL_CATEGORIES, CATEGORIES, type CategorySlug, ensureCategory } from './feed-categories';

export const MIN_POSTS_THRESHOLD = 10;
export const COVERAGE_WARN_THRESHOLD = 5;

export interface CategoryCoverage {
  slug: CategorySlug;
  label: string;
  emoji: string;
  postCount: number;
  status: 'healthy' | 'thin' | 'empty';
  recommendedNiches: string[];
  recommendedKeywords: string[];
}

export interface CoverageReport {
  totalPosts: number;
  totalCategories: number;
  healthyCategories: number;
  thinCategories: number;
  emptyCategories: number;
  perCategory: Record<CategorySlug, CategoryCoverage>;
  summary: string;
}

export function getCategoryCounts(posts: UnifiedPost[]): Record<CategorySlug, number> {
  const counts: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) {
    counts[cat] = 0;
  }
  for (const post of posts) {
    const cat = ensureCategory(post);
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts as Record<CategorySlug, number>;
}

export function auditCategoryCoverage(posts: UnifiedPost[]): CoverageReport {
  const counts = getCategoryCounts(posts);
  const perCategory: Record<string, CategoryCoverage> = {};
  let healthy = 0;
  let thin = 0;
  let empty = 0;

  for (const cat of ALL_CATEGORIES) {
    const count = counts[cat] ?? 0;
    const def = CATEGORIES[cat];
    const status: CategoryCoverage['status'] =
      count >= MIN_POSTS_THRESHOLD ? 'healthy' : count >= 1 ? 'thin' : 'empty';

    if (status === 'healthy') healthy++;
    else if (status === 'thin') thin++;
    else empty++;

    perCategory[cat] = {
      slug: cat,
      label: def.label,
      emoji: def.emoji,
      postCount: count,
      status,
      recommendedNiches: def.niches,
      recommendedKeywords: def.keywords,
    };
  }

  const summary =
    empty > 0
      ? `${empty} categories have zero content. ${thin} have fewer than ${MIN_POSTS_THRESHOLD} posts.`
      : thin > 0
        ? `${thin} categories have fewer than ${MIN_POSTS_THRESHOLD} posts. All categories have some content.`
        : `All ${ALL_CATEGORIES.length} categories have healthy content coverage (≥${MIN_POSTS_THRESHOLD} posts).`;

  return {
    totalPosts: posts.length,
    totalCategories: ALL_CATEGORIES.length,
    healthyCategories: healthy,
    thinCategories: thin,
    emptyCategories: empty,
    perCategory: perCategory as Record<CategorySlug, CategoryCoverage>,
    summary,
  };
}

export function findUnderservedCategories(
  posts: UnifiedPost[],
  _minPosts = MIN_POSTS_THRESHOLD,
): CategoryCoverage[] {
  const report = auditCategoryCoverage(posts);
  return Object.values(report.perCategory).filter(
    (c) => c.status === 'empty' || c.status === 'thin',
  );
}

export function getCategoryDistributionPct(posts: UnifiedPost[]): Record<CategorySlug, number> {
  const counts = getCategoryCounts(posts);
  const total = posts.length;
  if (total === 0) {
    const empty: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) empty[cat] = 0;
    return empty as Record<CategorySlug, number>;
  }
  const pct: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) {
    pct[cat] = Math.round(((counts[cat] ?? 0) / total) * 100);
  }
  return pct as Record<CategorySlug, number>;
}

export function verifyDiversity(
  posts: UnifiedPost[],
  minCategories = 4,
  maxSinglePct = 40,
): {
  diverse: boolean;
  dominantCategory: CategorySlug | null;
  dominantPct: number;
  uniqueCategories: number;
} {
  const pct = getCategoryDistributionPct(posts);
  let dominant: CategorySlug | null = null;
  let dominantPct = 0;
  let unique = 0;

  for (const cat of ALL_CATEGORIES) {
    if (pct[cat] > 0) unique++;
    if (pct[cat] > dominantPct) {
      dominantPct = pct[cat];
      dominant = cat;
    }
  }

  return {
    diverse: unique >= minCategories && dominantPct <= maxSinglePct,
    dominantCategory: dominant,
    dominantPct,
    uniqueCategories: unique,
  };
}
