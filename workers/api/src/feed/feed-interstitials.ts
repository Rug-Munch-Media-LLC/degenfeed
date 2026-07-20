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

import type { UnifiedPost } from "@degenfeed/types";
import {
	ALL_CATEGORIES,
	CATEGORIES,
	type CategorySlug,
	ensureCategory,
} from "./feed-categories";

export const EXPLORE_MORE_INTERVAL = 15;
export const YOU_MIGHT_ALSO_LIKE_INTERVAL = 10;
export const YOU_MIGHT_ALSO_LIKE_COUNT = 2;

export interface ExploreMoreCard {
	type: "explore-more";
	id: string;
	category: CategorySlug;
	label: string;
	emoji: string;
	linkUrl: string;
}

export interface YouMightAlsoLikeGroup {
	type: "you-might-also-like";
	id: string;
	posts: UnifiedPost[];
	sourceCategory: CategorySlug;
	targetCategory: CategorySlug;
	targetLabel: string;
	targetEmoji: string;
}

export type FeedInterstitial = ExploreMoreCard | YouMightAlsoLikeGroup;

export function isExploreMore(item: FeedInterstitial): item is ExploreMoreCard {
	return item.type === "explore-more";
}

export function isYouMightAlsoLike(
	item: FeedInterstitial,
): item is YouMightAlsoLikeGroup {
	return item.type === "you-might-also-like";
}

export type FeedItem = UnifiedPost | FeedInterstitial;

// ─── Related categories map ──────────────────────────────────────
// Categories that naturally pair well for discovery purposes.

const RELATED_CATEGORIES: Record<CategorySlug, CategorySlug[]> = {
	defi: ["stablecoin", "layer2", "ethereum"],
	nft: ["gaming", "ethereum", "solana"],
	trading: ["bitcoin", "ethereum", "memecoin"],
	ai: ["gaming", "news", "defi"],
	memecoin: ["solana", "trading", "memes"],
	security: ["regulation", "defi", "bitcoin"],
	news: ["regulation", "bitcoin", "ethereum"],
	memes: ["memecoin", "gaming", "solana"],
	bitcoin: ["trading", "layer2", "news"],
	ethereum: ["defi", "layer2", "nft"],
	solana: ["memecoin", "defi", "nft"],
	layer2: ["ethereum", "defi", "stablecoin"],
	stablecoin: ["defi", "regulation", "layer2"],
	regulation: ["news", "security", "stablecoin"],
	gaming: ["nft", "solana", "ai"],
	general: ["news", "bitcoin", "ethereum"],
};

// ─── Explore more cards ──────────────────────────────────────────

function generateExploreMoreId(category: CategorySlug, index: number): string {
	return `explore-more:${category}:${index}`;
}

export function insertExploreMoreCards(
	posts: UnifiedPost[],
	interval: number = EXPLORE_MORE_INTERVAL,
): FeedItem[] {
	if (posts.length < interval) return posts;

	const result: FeedItem[] = [];
	const seenCategories = new Set<CategorySlug>();

	for (let i = 0; i < posts.length; i++) {
		const post = posts[i];
		if (post) {
			result.push(post);
			const cat = ensureCategory(post);
			seenCategories.add(cat);
		}

		if ((i + 1) % interval === 0 && i + 1 < posts.length) {
			const unseen = ALL_CATEGORIES.filter((c) => !seenCategories.has(c));
			const targetCat: CategorySlug =
				unseen.length > 0
					? (unseen[Math.floor(Math.random() * unseen.length)] as CategorySlug)
					: (ALL_CATEGORIES[
							Math.floor(Math.random() * ALL_CATEGORIES.length)
						] as CategorySlug);

			const def = CATEGORIES[targetCat];
			result.push({
				type: "explore-more",
				id: generateExploreMoreId(targetCat, i),
				category: targetCat,
				label: def.label,
				emoji: def.emoji,
				linkUrl: `/category/${targetCat}`,
			});
			seenCategories.add(targetCat);
		}
	}

	return result;
}

// ─── You might also like ─────────────────────────────────────────

export function insertYouMightAlsoLike(
	posts: UnifiedPost[],
	categoryPosts: Record<CategorySlug, UnifiedPost[]>,
	interval: number = YOU_MIGHT_ALSO_LIKE_INTERVAL,
): FeedItem[] {
	if (posts.length < interval) return posts;

	const result: FeedItem[] = [];
	const exploredCategories = new Set<CategorySlug>();

	for (let i = 0; i < posts.length; i++) {
		const post = posts[i];
		if (post) {
			result.push(post);
			const cat = ensureCategory(post);
			exploredCategories.add(cat);
		}

		if ((i + 1) % interval === 0 && i + 1 < posts.length) {
			const sourceCat = ensureCategory(posts[i]!);
			const related =
				RELATED_CATEGORIES[sourceCat] ?? ALL_CATEGORIES.slice(0, 3);

			const targetCat = related.find(
				(c) =>
					!exploredCategories.has(c) && (categoryPosts[c]?.length ?? 0) >= 2,
			);

			if (targetCat) {
				const pool = categoryPosts[targetCat] ?? [];
				const suggestions = pool
					.filter((p) => !posts.some((fp) => fp.id === p.id))
					.slice(0, YOU_MIGHT_ALSO_LIKE_COUNT);

				if (suggestions.length > 0) {
					const def = CATEGORIES[targetCat];
					result.push({
						type: "you-might-also-like",
						id: `ymal:${targetCat}:${i}`,
						posts: suggestions,
						sourceCategory: sourceCat,
						targetCategory: targetCat,
						targetLabel: def.label,
						targetEmoji: def.emoji,
					});
					exploredCategories.add(targetCat);
				}
			}
		}
	}

	return result;
}

// ─── Full feed enrichment ────────────────────────────────────────

export interface InterstitialOptions {
	exploreInterval?: number;
	ymalInterval?: number;
}

export function applyInterstitials(
	posts: UnifiedPost[],
	categoryPosts: Record<CategorySlug, UnifiedPost[]>,
	opts: InterstitialOptions = {},
): FeedItem[] {
	const withYmal = insertYouMightAlsoLike(
		posts,
		categoryPosts,
		opts.ymalInterval ?? YOU_MIGHT_ALSO_LIKE_INTERVAL,
	);
	const withExplore = insertExploreMoreCards(
		withYmal.filter(
			(item) => !isYouMightAlsoLike(item as FeedInterstitial),
		) as UnifiedPost[],
		opts.exploreInterval ?? EXPLORE_MORE_INTERVAL,
	);

	// Re-insert YMAL groups at their correct positions
	const ymalItems = withYmal.filter((item) =>
		isYouMightAlsoLike(item as FeedInterstitial),
	) as YouMightAlsoLikeGroup[];

	// Simple merge: insert YMAL back approximately
	const final: FeedItem[] = [];
	let ymalIdx = 0;
	for (let i = 0; i < withExplore.length; i++) {
		final.push(withExplore[i]!);
		// Re-insert YMAL at original positions
		while (
			ymalIdx < ymalItems.length &&
			ymalItems[ymalIdx]?.id.includes(
				`:${Math.floor(i / (opts.ymalInterval ?? YOU_MIGHT_ALSO_LIKE_INTERVAL)) * (opts.ymalInterval ?? YOU_MIGHT_ALSO_LIKE_INTERVAL)}`,
			)
		) {
			if (
				!final.some(
					(f) =>
						isYouMightAlsoLike(f as FeedInterstitial) &&
						(f as YouMightAlsoLikeGroup).id === ymalItems[ymalIdx]?.id,
				)
			) {
				final.push(ymalItems[ymalIdx]!);
			}
			ymalIdx++;
		}
	}

	return final;
}
