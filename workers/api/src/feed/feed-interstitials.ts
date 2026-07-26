/**
 * feed-interstitials — "Explore more" cards and "You might also like"
 * interleaved into the feed for category discovery and content abundance.
 *
 * Every 15 posts: insert an "Explore more in {category}" card linking to
 * that category's feed. The category is selected from categories the user
 * hasn't seen yet in this page.
 *
 * Every 10 posts: insert 2 posts from related categories the user hasn't
 * explored yet.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { ALL_CATEGORIES, CATEGORIES, type CategorySlug, ensureCategory } from './feed-categories';

export const EXPLORE_MORE_INTERVAL = 15;
export const YOU_MIGHT_ALSO_LIKE_INTERVAL = 10;
export const YOU_MIGHT_ALSO_LIKE_COUNT = 2;

export interface ExploreMoreCard {

export interface YouMightAlsoLikeGroup {

export type FeedInterstitial = ExploreMoreCard | YouMightAlsoLikeGroup;

export function isExploreMore(item: FeedInterstitial): item is ExploreMoreCard {

export function isYouMightAlsoLike(item: FeedInterstitial): item is YouMightAlsoLikeGroup {

export type FeedItem = UnifiedPost | FeedInterstitial;

// ─── Related categories map ──────────────────────────────────────
// Categories that naturally pair well for discovery purposes.

const RELATED_CATEGORIES: Record<CategorySlug, CategorySlug[]> = {

// ─── Explore more cards ──────────────────────────────────────────

function generateExploreMoreId(category: CategorySlug, index: number): string {

export function insertExploreMoreCards(
  posts: UnifiedPost[],
  interval: number = EXPLORE_MORE_INTERVAL,
): FeedItem[] {

// ─── You might also like ─────────────────────────────────────────

export function insertYouMightAlsoLike(
  posts: UnifiedPost[],
  categoryPosts: Record<CategorySlug, UnifiedPost[]>,
  interval: number = YOU_MIGHT_ALSO_LIKE_INTERVAL,
): FeedItem[] {

// ─── Full feed enrichment ────────────────────────────────────────

export interface InterstitialOptions {

export function applyInterstitials(
  posts: UnifiedPost[],
  categoryPosts: Record<CategorySlug, UnifiedPost[]>,
  opts: InterstitialOptions = {},
): FeedItem[] {

