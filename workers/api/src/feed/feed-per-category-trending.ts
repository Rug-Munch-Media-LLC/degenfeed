/**
 * feed-per-category-trending — Per-category trending sections showing
 * what's hot in each category right now.
 *
 * Computes trending topics/posts for each category independently,
 * using engagement velocity + recency signals weighted by category
 * relevance.
 */

import type { UnifiedPost } from "@degenfeed/types";
import {
	ALL_CATEGORIES,
	buildCategoryFeed,
	CATEGORIES,
	type CategorySlug,
} from "./feed-categories";

export interface CategoryTrendingItem {
	postId: string;
	title: string;
	topic: string;
	slug: string;
	category: CategorySlug;
	categoryLabel: string;
	categoryEmoji: string;
	score: number;
	engagementTotal: number;
	ageHours: number;
}

export interface CategoryTrendingResult {
	category: CategorySlug;
	label: string;
	emoji: string;
	trending: CategoryTrendingItem[];
	topTopic: string;
	totalPosts: number;
}

export function computeCategoryTrending(
	posts: UnifiedPost[],
	limit = 6,
	maxAgeHours = 48,
): Record<CategorySlug, CategoryTrendingResult> {
	const now = Date.now();
	const result: Record<string, CategoryTrendingResult> = {};

	for (const cat of ALL_CATEGORIES) {
		const def = CATEGORIES[cat];

		const catFeed = buildCategoryFeed(posts, {
			category: cat,
			minScore: 0.15,
			maxPerAuthor: 3,
			maxPerProtocol: 5,
			limit: 50,
		});

		const recentPosts = catFeed.posts.filter((p) => {
			const ageHours = (now - p.createdAt) / 3600000;
			return ageHours <= maxAgeHours;
		});

		const scored = recentPosts
			.map((p) => {
				const engTotal =
					p.metrics.likes +
					p.metrics.reposts * 2 +
					p.metrics.replies * 3 +
					(p.metrics.quotes ?? 0);
				const ageHours = (now - p.createdAt) / 3600000;
				const agePenalty = Math.max(0.2, 1 - ageHours / maxAgeHours);
				const trendScore = engTotal * agePenalty + p.categoryScore * 5;

				return {
					postId: p.id,
					title:
						(p as unknown as { title?: string }).title ?? p.text.slice(0, 80),
					topic: p.niches[0] ?? cat,
					slug: p.niches[0] ?? cat,
					category: cat,
					categoryLabel: def.label,
					categoryEmoji: def.emoji,
					score: Math.round(trendScore * 100) / 100,
					engagementTotal: engTotal,
					ageHours: Math.round(ageHours * 10) / 10,
				};
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);

		const topTopic =
			recentPosts.length > 0
				? (() => {
						const nicheCounts = new Map<string, number>();
						for (const p of recentPosts) {
							for (const niche of p.niches) {
								nicheCounts.set(niche, (nicheCounts.get(niche) ?? 0) + 1);
							}
						}
						let best: string = cat;
						let bestCount = 0;
						for (const [n, c] of nicheCounts) {
							if (c > bestCount) {
								bestCount = c;
								best = n;
							}
						}
						return best;
					})()
				: cat;

		result[cat] = {
			category: cat,
			label: def.label,
			emoji: def.emoji,
			trending: scored,
			topTopic,
			totalPosts: catFeed.posts.length,
		};
	}

	return result as Record<CategorySlug, CategoryTrendingResult>;
}

export function getTrendingSummary(
	trending: Record<CategorySlug, CategoryTrendingResult>,
	topN = 5,
): Array<{
	category: CategorySlug;
	label: string;
	emoji: string;
	topItem: CategoryTrendingItem | null;
	totalTrending: number;
}> {
	return ALL_CATEGORIES.map((cat) => {
		const data = trending[cat];
		return {
			category: cat,
			label: data.label,
			emoji: data.emoji,
			topItem: data.trending[0] ?? null,
			totalTrending: data.trending.length,
		};
	})
		.sort((a, b) => (b.topItem?.score ?? 0) - (a.topItem?.score ?? 0))
		.slice(0, topN);
}
