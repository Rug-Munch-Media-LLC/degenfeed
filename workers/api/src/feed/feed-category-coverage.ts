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

export interface CoverageReport {

export function getCategoryCounts(posts: UnifiedPost[]): Record<CategorySlug, number> {

export function auditCategoryCoverage(posts: UnifiedPost[]): CoverageReport {

export function findUnderservedCategories(
  posts: UnifiedPost[],
  _minPosts = MIN_POSTS_THRESHOLD,
): CategoryCoverage[] {

export function getCategoryDistributionPct(posts: UnifiedPost[]): Record<CategorySlug, number> {

export function verifyDiversity(
  posts: UnifiedPost[],
  minCategories = 4,
  maxSinglePct = 40,
): {

