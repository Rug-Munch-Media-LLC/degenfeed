/**
 * @recommendation-engine — Multi-signal content recommendation engine
 *
 * Combines 10 signals to surface the best content from all sources:
 *   1. Watch history       6. Session context (current watching)
 *   2. Engagement          7. Trending signals
 *   3. Followed creators   8. Source diversity
 *   4. Held coins          9. Freshness
 *   5. Category pref       10. Creator quality
 *
 * Stores interaction data in KV namespaces and builds interest profiles
 * that improve with every user action.
 */

import type { Protocol, UnifiedIdentity, UnifiedPost } from "@degenfeed/types";
import type { Env } from "../index";

// ─── Public types ────────────────────────────────────────────────────────

export type ContentSource =
	| "youtube"
	| "peertube"
	| "tiktok"
	| "instagram"
	| "twitch"
	| "kick"
	| "rumble"
	| "odysee";

export type InteractionAction =
	| "watch"
	| "like"
	| "share"
	| "skip"
	| "complete"
	| "tip";

export interface InteractionMetadata {
	/** Milliseconds of content consumed (for watch actions) */
	dwellMs?: number;
	/** 0-1 completion rate */
	completionRate?: number;
	/** Content category at time of interaction */
	category?: string;
	/** Content tags at time of interaction */
	tags?: string[];
	/** Creator/author ID */
	creatorId?: string;
	/** Source platform */
	source?: ContentSource;
	/** Video duration in seconds (for watch actions) */
	duration?: number;
	/** Wallet address if user held a token (for held-coin signal) */
	heldTokenMint?: string;
	/** Timestamp of interaction */
	timestamp?: number;
}

export interface ContentItem {
	/** Unique content ID (e.g. youtube:abc123) */
	id: string;
	/** Source platform */
	source: ContentSource;
	/** Content title */
	title: string;
	/** Content description / summary */
	description?: string;
	/** Creator/author identifier (protocol:id format) */
	creatorId: string;
	/** Creator display name */
	creatorName: string;
	/** Creator avatar URL */
	creatorAvatar?: string;
	/** Thumbnail URL */
	thumbnailUrl?: string;
	/** Content URL */
	url: string;
	/** Duration in seconds (0 for non-video) */
	duration: number;
	/** Categories / niches */
	categories: string[];
	/** Content tags */
	tags: string[];
	/** Unix timestamp of publish date (ms) */
	publishedAt: number;
	/** Engagement metrics */
	metrics: {
		views: number;
		likes: number;
		shares?: number;
		comments?: number;
	};
	/** Creator quality score 0-100 (computed externally) */
	creatorQuality: number;
	/** Language code */
	language?: string;
	/** Whether this is a short-form video (<60s) */
	isShort: boolean;
	/** Whether this is a live stream */
	isLive: boolean;
	/** Protocol this content was discovered through */
	protocol?: Protocol;
	/** Original post if sourced from a social protocol */
	sourcePost?: UnifiedPost;
}

export interface RankedContent extends ContentItem {
	/** Composite recommendation score 0-100 */
	score: number;
	/** Human-readable breakdown of why this was recommended */
	signals: SignalBreakdown;
}

export interface SignalBreakdown {
	total: number;
	watchHistory: number;
	engagement: number;
	followedCreator: number;
	heldCoin: number;
	categoryMatch: number;
	trending: number;
	sourceDiversity: number;
	freshness: number;
	creatorQuality: number;
	sessionContext: number;
	reasons: string[];
}

export interface UserInterestProfile {
	/** Category → interaction weight (0-100) */
	topCategories: { category: string; weight: number }[];
	/** Tag → interaction weight (0-100) */
	topTags: { tag: string; weight: number }[];
	/** Creator → interaction weight (0-100) */
	topCreators: { creator: string; weight: number }[];
	/** Source → preference weight (0-100) */
	preferredSources: { source: ContentSource; weight: number }[];
	/** Duration range preference */
	preferredDurations: { range: string; weight: number }[];
	/** Total watch time per category (ms) */
	watchTimeByCategory: Record<string, number>;
	/** Overall engagement rate (interactions per content item) */
	engagementRate: number;
	/** Unix ms of last activity */
	lastActive: number;
	/** Set of recently watched content IDs (avoid re-recommending) */
	recentWatched: string[];
	/** Set of skipped content IDs */
	skippedContent: string[];
	/** Set of liked content IDs */
	likedContent: string[];
	/** Creator IDs the user follows */
	followedCreators: string[];
	/** Token mints the user holds */
	heldTokenMints: string[];
}

export interface RecommendationOptions {
	limit?: number;
	excludeWatched?: boolean;
	sourceFilter?: ContentSource[];
	categoryFilter?: string[];
	durationFilter?: { min?: number; max?: number };
	freshnessFilter?: "day" | "week" | "month" | "all";
}

// ─── Storage keys ────────────────────────────────────────────────────────

const INTERACTIONS_PREFIX = "rec:int:";
const PROFILE_PREFIX = "rec:profile:";
const SCORED_CACHE_PREFIX = "rec:scored:";
const RELATED_PREFIX = "rec:related:";

function interactionsKey(wallet: string): string {
	return `${INTERACTIONS_PREFIX}${wallet.toLowerCase()}`;
}

function profileKey(wallet: string): string {
	return `${PROFILE_PREFIX}${wallet.toLowerCase()}`;
}

function scoredCacheKey(group: string): string {
	return `${SCORED_CACHE_PREFIX}${group}`;
}

function relatedKey(source: ContentSource, contentId: string): string {
	return `${RELATED_PREFIX}${source}:${contentId}`;
}

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_INTERACTIONS = 500;
const PROFILE_TTL = 60 * 60 * 24 * 7; // 7 days
const SCORED_CACHE_TTL = 60 * 15; // 15 minutes
const RELATED_CACHE_TTL = 60 * 60; // 1 hour
const FRESHNESS_BOOST_HOURS = 48;
const DEFAULT_LIMIT = 20;

/** Weights for each signal in the composite score */
const SIGNAL_WEIGHTS = {
	watchHistory: 0.2,
	engagement: 0.15,
	followedCreator: 0.15,
	heldCoin: 0.05,
	categoryMatch: 0.12,
	trending: 0.1,
	sourceDiversity: 0.05,
	freshness: 0.08,
	creatorQuality: 0.07,
	sessionContext: 0.03,
} as const;

// ─── Interaction recording ──────────────────────────────────────────────

interface StoredInteraction {
	contentId: string;
	action: InteractionAction;
	category?: string;
	tags?: string[];
	creatorId?: string;
	source?: ContentSource;
	dwellMs?: number;
	completionRate?: number;
	duration?: number;
	heldTokenMint?: string;
	timestamp: number;
}

async function loadInteractions(
	env: Env,
	wallet: string,
): Promise<StoredInteraction[]> {
	try {
		const raw = await env.CACHE?.get(interactionsKey(wallet));
		if (raw) return JSON.parse(raw) as StoredInteraction[];
	} catch {
		/* ignore */
	}
	return [];
}

async function saveInteractions(
	env: Env,
	wallet: string,
	interactions: StoredInteraction[],
): Promise<void> {
	if (!env.CACHE) return;
	try {
		// Keep only the most recent interactions
		const trimmed = interactions.slice(-MAX_INTERACTIONS);
		await env.CACHE.put(interactionsKey(wallet), JSON.stringify(trimmed), {
			expirationTtl: PROFILE_TTL,
		});
	} catch {
		console.warn("[rec-engine] KV save failed for interactions");
	}
}

// ─── Public API ──────────────────────────────────────────────────────────

export class RecommendationEngine {
	private env: Env;

	constructor(env: Env) {
		this.env = env;
	}

	// ─── Get personalized video recommendations ─────────────────────────

	async getVideoRecommendations(
		wallet: string,
		opts: RecommendationOptions = {},
	): Promise<RankedContent[]> {
		const profile = await this.getUserProfile(wallet);
		const pool = await this.buildContentPool(profile, {
			...opts,
			shortFilter: false,
			liveFilter: false,
		});
		return this.scoreAndRank(pool, profile, opts);
	}

	// ─── Get personalized shorts recommendations ────────────────────────

	async getShortsRecommendations(
		wallet: string,
		opts: RecommendationOptions = {},
	): Promise<RankedContent[]> {
		const profile = await this.getUserProfile(wallet);
		const pool = await this.buildContentPool(profile, {
			...opts,
			shortFilter: true,
			liveFilter: false,
		});
		return this.scoreAndRank(pool, profile, opts);
	}

	// ─── Get personalized stream recommendations ────────────────────────

	async getStreamRecommendations(wallet: string): Promise<RankedContent[]> {
		const profile = await this.getUserProfile(wallet);
		const pool = await this.buildContentPool(profile, {
			liveFilter: true,
		});
		return this.scoreAndRank(pool, profile, { limit: 10 });
	}

	// ─── Get "because you watched" recommendations ──────────────────────

	async getRelatedContent(
		contentId: string,
		source: ContentSource,
	): Promise<RankedContent[]> {
		// Try cache first
		const cached = await this.getCachedRelated(source, contentId);
		if (cached) return cached;

		// In production, this would query a similarity service or
		// content graph. For now, derive from tags/categories:
		const content = await this.fetchContentById(source, contentId);
		if (!content) return [];

		const similar = await this.fetchSimilarContent(source, content, 20);
		const ranked: RankedContent[] = similar
			.map((c) => ({
				...c,
				score: this.computeRelatedScore(c, content),
				signals: this.buildRelatedSignals(c, content),
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, 10);

		// Cache the result
		await this.cacheRelated(source, contentId, ranked);
		return ranked;
	}

	// ─── Get personalized trending ──────────────────────────────────────

	async getPersonalizedTrending(
		wallet: string,
		category?: string,
	): Promise<RankedContent[]> {
		const profile = await this.getUserProfile(wallet);
		const trendingPool = await this.fetchTrendingContent(category, 50);

		// Apply personalization on top of trending
		const ranked = this.scoreAndRank(trendingPool, profile, { limit: 20 });

		// Boost trending signal weight for this endpoint
		return ranked.map((item) => ({
			...item,
			score: Math.min(100, item.score * 1.15),
			signals: {
				...item.signals,
				trending: Math.min(40, item.signals.trending * 1.5),
				reasons: [...item.signals.reasons, "Trending in your interests"],
			},
		}));
	}

	// ─── Get "discover new creators" ────────────────────────────────────

	async getDiscoverNew(wallet: string): Promise<RankedContent[]> {
		const profile = await this.getUserProfile(wallet);

		// Get creators the user already knows
		const knownCreators = new Set([
			...profile.topCreators.map((c) => c.creator),
			...profile.followedCreators,
		]);

		// Fetch fresh content from unknown creators, outside user's bubble
		const diversePool = await this.fetchDiverseContent({
			excludeCreators: knownCreators,
			excludeCategories: profile.topCategories
				.slice(0, 3)
				.map((c) => c.category),
			limit: 80,
		});

		const ranked = this.scoreAndRank(diversePool, profile, { limit: 20 });

		// Annotate as discovery picks
		return ranked.map((item) => ({
			...item,
			signals: {
				...item.signals,
				reasons: [...item.signals.reasons, "New creator discovery"],
			},
		}));
	}

	// ─── Record user interaction ────────────────────────────────────────

	async recordInteraction(
		wallet: string,
		contentId: string,
		action: InteractionAction,
		metadata?: InteractionMetadata,
	): Promise<void> {
		const interaction: StoredInteraction = {
			contentId,
			action,
			category: metadata?.category,
			tags: metadata?.tags,
			creatorId: metadata?.creatorId,
			source: metadata?.source,
			dwellMs: metadata?.dwellMs,
			completionRate: metadata?.completionRate,
			duration: metadata?.duration,
			heldTokenMint: metadata?.heldTokenMint,
			timestamp: metadata?.timestamp ?? Date.now(),
		};

		// Append to interaction history
		const interactions = await loadInteractions(this.env, wallet);
		interactions.push(interaction);
		await saveInteractions(this.env, wallet, interactions);

		// Invalidate profile cache so next request recomputes
		await this.invalidateProfileCache(wallet);
	}

	// ─── Build user interest profile from interactions ──────────────────

	async getUserProfile(wallet: string): Promise<UserInterestProfile> {
		// Check cache first
		const cached = await this.loadCachedProfile(wallet);
		if (cached) return cached;

		const interactions = await loadInteractions(this.env, wallet);
		const profile = this.buildProfileFromInteractions(interactions, wallet);
		await this.cacheProfile(wallet, profile);
		return profile;
	}

	// ─── Score content against user profile ─────────────────────────────

	private scoreContent(
		content: ContentItem,
		profile: UserInterestProfile,
	): SignalBreakdown {
		const now = Date.now();
		const reasons: string[] = [];

		// 1. Watch history signal — scored by category/tag affinity
		const watchHistoryScore = this.computeWatchHistoryScore(content, profile);
		if (watchHistoryScore > 0) reasons.push("Similar to what you watch");

		// 2. Engagement signal — content the user's profile would engage with
		const engagementScore = this.computeEngagementScore(content, profile);
		if (engagementScore > 0.3) reasons.push("High engagement match");

		// 3. Followed creator signal
		const followedScore = profile.followedCreators.includes(content.creatorId)
			? 1.0
			: profile.topCreators.some((c) => c.creator === content.creatorId)
				? 0.8
				: 0;
		if (followedScore > 0) reasons.push("From a creator you follow");

		// 4. Held coin signal — creator's token match
		const heldCoinScore = this.computeHeldCoinScore(content, profile);
		if (heldCoinScore > 0) reasons.push("From a creator whose coin you hold");

		// 5. Category preference signal
		const categoryScore = this.computeCategoryScore(content, profile);
		if (categoryScore > 0.5) reasons.push("Matches your interests");

		// 6. Trending signal
		const trendingScore = this.computeTrendingScore(content);
		if (trendingScore > 0.3) reasons.push("Trending now");

		// 7. Source diversity signal — boost underrepresented sources
		const sourceScore = this.computeSourceDiversityScore(content, profile);
		if (sourceScore > 0.3) reasons.push("From a different source");

		// 8. Freshness signal — prefer newer content
		const ageHours = (now - content.publishedAt) / (1000 * 60 * 60);
		const freshnessScore = Math.max(
			0,
			1 - ageHours / (FRESHNESS_BOOST_HOURS * 7),
		);
		if (freshnessScore > 0.7) reasons.push("Fresh content");

		// 9. Creator quality signal
		const qualityScore = content.creatorQuality / 100;
		if (qualityScore > 0.8) reasons.push("High-quality creator");

		// 10. Session context — match duration preferences
		const sessionScore = this.computeSessionContextScore(content, profile);
		if (sessionScore > 0) reasons.push("Right length for now");

		// Composite score (weighted sum, capped at 100)
		const total = Math.min(
			100,
			watchHistoryScore * SIGNAL_WEIGHTS.watchHistory * 100 +
				engagementScore * SIGNAL_WEIGHTS.engagement * 100 +
				followedScore * SIGNAL_WEIGHTS.followedCreator * 100 +
				heldCoinScore * SIGNAL_WEIGHTS.heldCoin * 100 +
				categoryScore * SIGNAL_WEIGHTS.categoryMatch * 100 +
				trendingScore * SIGNAL_WEIGHTS.trending * 100 +
				sourceScore * SIGNAL_WEIGHTS.sourceDiversity * 100 +
				freshnessScore * SIGNAL_WEIGHTS.freshness * 100 +
				qualityScore * SIGNAL_WEIGHTS.creatorQuality * 100 +
				sessionScore * SIGNAL_WEIGHTS.sessionContext * 100,
		);

		return {
			total,
			watchHistory: Math.round(watchHistoryScore * 100),
			engagement: Math.round(engagementScore * 100),
			followedCreator: Math.round(followedScore * 100),
			heldCoin: Math.round(heldCoinScore * 100),
			categoryMatch: Math.round(categoryScore * 100),
			trending: Math.round(trendingScore * 100),
			sourceDiversity: Math.round(sourceScore * 100),
			freshness: Math.round(freshnessScore * 100),
			creatorQuality: Math.round(qualityScore * 100),
			sessionContext: Math.round(sessionScore * 100),
			reasons: [...new Set(reasons)],
		};
	}

	// ─── Signal computation helpers ─────────────────────────────────────

	private computeWatchHistoryScore(
		content: ContentItem,
		profile: UserInterestProfile,
	): number {
		let score = 0;

		// Match categories against profile
		for (const cat of content.categories) {
			const match = profile.topCategories.find(
				(pc) => pc.category.toLowerCase() === cat.toLowerCase(),
			);
			if (match) score = Math.max(score, match.weight / 100);
		}

		// Match tags against profile
		for (const tag of content.tags) {
			const match = profile.topTags.find(
				(pt) => pt.tag.toLowerCase() === tag.toLowerCase(),
			);
			if (match) score = Math.max(score, match.weight / 100);
		}

		// Boost if user has watched similar content from this creator
		if (profile.topCreators.some((c) => c.creator === content.creatorId)) {
			score = Math.max(score, 0.6);
		}

		return Math.min(1, score);
	}

	private computeEngagementScore(
		content: ContentItem,
		profile: UserInterestProfile,
	): number {
		// A user with a high engagement rate is more likely to engage with new content
		const baseEngagement = profile.engagementRate;

		// Content with strong metrics gets a boost
		const contentEngagement =
			content.metrics.views > 0
				? (content.metrics.likes + (content.metrics.shares ?? 0) * 2) /
					content.metrics.views
				: 0;

		// Weighted combination
		return Math.min(1, baseEngagement * 0.4 + contentEngagement * 0.6);
	}

	private computeHeldCoinScore(
		content: ContentItem,
		profile: UserInterestProfile,
	): number {
		if (profile.heldTokenMints.length === 0) return 0;

		// Check if this creator is associated with any held token
		// In production, this would query a creator→token registry
		for (const creator of profile.topCreators) {
			if (creator.creator === content.creatorId && creator.weight > 50) {
				return 0.8;
			}
		}

		return 0;
	}

	private computeCategoryScore(
		content: ContentItem,
		profile: UserInterestProfile,
	): number {
		let maxScore = 0;
		for (const cat of content.categories) {
			for (const pc of profile.topCategories) {
				if (pc.category.toLowerCase() === cat.toLowerCase()) {
					maxScore = Math.max(maxScore, pc.weight / 100);
				}
			}
		}
		return maxScore;
	}

	private computeTrendingScore(content: ContentItem): number {
		// Simple velocity-based trending score
		const now = Date.now();
		const ageHours = (now - content.publishedAt) / (1000 * 60 * 60);

		// Avoid division by zero for brand new content
		if (ageHours < 1) return 1.0;

		const viewsPerHour = content.metrics.views / Math.max(1, ageHours);
		const likesPerHour = content.metrics.likes / Math.max(1, ageHours);

		// Normalize: 1000 views/hour = 0.5, 100 likes/hour = 0.5
		const viewTrend = Math.min(1, viewsPerHour / 2000);
		const likeTrend = Math.min(1, likesPerHour / 200);

		return viewTrend * 0.5 + likeTrend * 0.5;
	}

	private computeSourceDiversityScore(
		content: ContentItem,
		profile: UserInterestProfile,
	): number {
		// Find the dominant source in user's history and penalize it
		if (profile.preferredSources.length === 0) return 0.5; // neutral

		const dominant = profile.preferredSources[0];
		if (dominant && dominant.source === content.source) {
			// Penalize over-represented source
			return 1 - Math.min(1, dominant.weight / 100);
		}

		// Boost underrepresented sources
		return 0.5;
	}

	private computeSessionContextScore(
		content: ContentItem,
		profile: UserInterestProfile,
	): number {
		if (profile.preferredDurations.length === 0) return 0;

		const durationMin = content.duration / 60;

		for (const pref of profile.preferredDurations) {
			const [min, max] = pref.range.split("-").map(Number);
			if (!max && min) {
				// "60+" means 60 min or more
				if (durationMin >= min) return pref.weight / 100;
			} else if (min && max) {
				if (durationMin >= min && durationMin <= max) return pref.weight / 100;
			}
		}

		// Default: prefer medium-length content (5-20 min)
		if (durationMin >= 5 && durationMin <= 20) return 0.5;
		return 0.2;
	}

	// ─── Profile building ───────────────────────────────────────────────

	private buildProfileFromInteractions(
		interactions: StoredInteraction[],
		wallet: string,
	): UserInterestProfile {
		const categoryWeights = new Map<
			string,
			{ count: number; totalDwell: number }
		>();
		const tagWeights = new Map<string, number>();
		const creatorWeights = new Map<
			string,
			{ count: number; totalDwell: number }
		>();
		const sourceWeights = new Map<ContentSource, number>();
		const durationRanges = new Map<string, number>();
		const watchTimeByCategory: Record<string, number> = {};
		const recentWatched: string[] = [];
		const skippedContent: string[] = [];
		const likedContent: string[] = [];

		let totalInteractions = 0;
		let positiveInteractions = 0;

		for (const ix of interactions) {
			totalInteractions++;

			// Track positive vs negative actions
			if (
				ix.action === "like" ||
				ix.action === "complete" ||
				ix.action === "tip"
			) {
				positiveInteractions++;
			}

			// Recent watched (last 50)
			if (ix.action === "watch" || ix.action === "complete") {
				recentWatched.push(ix.contentId);
				if (recentWatched.length > 50) recentWatched.shift();
			}

			// Skipped
			if (ix.action === "skip") {
				skippedContent.push(ix.contentId);
				if (skippedContent.length > 50) skippedContent.shift();
			}

			// Liked
			if (ix.action === "like") {
				likedContent.push(ix.contentId);
				if (likedContent.length > 50) likedContent.shift();
			}

			// Category weights
			if (ix.category) {
				const current = categoryWeights.get(ix.category) ?? {
					count: 0,
					totalDwell: 0,
				};
				current.count++;
				current.totalDwell += ix.dwellMs ?? 0;
				categoryWeights.set(ix.category, current);
				watchTimeByCategory[ix.category] =
					(watchTimeByCategory[ix.category] ?? 0) + (ix.dwellMs ?? 0);
			}

			// Tag weights
			if (ix.tags) {
				for (const tag of ix.tags) {
					tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + 1);
				}
			}

			// Creator weights
			if (ix.creatorId) {
				const current = creatorWeights.get(ix.creatorId) ?? {
					count: 0,
					totalDwell: 0,
				};
				current.count++;
				current.totalDwell += ix.dwellMs ?? 0;
				creatorWeights.set(ix.creatorId, current);
			}

			// Source weights (boost for positive actions, penalize for skips)
			if (ix.source) {
				const delta =
					ix.action === "skip"
						? -0.5
						: ix.action === "like" || ix.action === "complete"
							? 1
							: 0.3;
				sourceWeights.set(
					ix.source,
					(sourceWeights.get(ix.source) ?? 0) + delta,
				);
			}

			// Duration preferences
			if (ix.duration && (ix.action === "watch" || ix.action === "complete")) {
				const min = ix.duration;
				const range = this.durationToRange(min);
				durationRanges.set(range, (durationRanges.get(range) ?? 0) + 1);
			}
		}

		// Build sorted top lists
		const topCategories = [...categoryWeights.entries()]
			.map(([category, data]) => ({
				category,
				weight: Math.min(
					100,
					Math.round(data.count * 20 + data.totalDwell / 60000),
				),
			}))
			.sort((a, b) => b.weight - a.weight)
			.slice(0, 10);

		const topTags = [...tagWeights.entries()]
			.map(([tag, count]) => ({ tag, weight: Math.min(100, count * 20) }))
			.sort((a, b) => b.weight - a.weight)
			.slice(0, 10);

		const topCreators = [...creatorWeights.entries()]
			.map(([creator, data]) => ({
				creator,
				weight: Math.min(
					100,
					Math.round(data.count * 15 + data.totalDwell / 60000),
				),
			}))
			.sort((a, b) => b.weight - a.weight)
			.slice(0, 20);

		const preferredSources = [...sourceWeights.entries()]
			.map(([source, weight]) => ({
				source,
				weight: Math.min(100, Math.max(0, Math.round(weight * 20))),
			}))
			.sort((a, b) => b.weight - a.weight);

		const preferredDurations = [...durationRanges.entries()]
			.map(([range, count]) => ({ range, weight: Math.min(100, count * 20) }))
			.sort((a, b) => b.weight - a.weight)
			.slice(0, 5);

		return {
			topCategories,
			topTags,
			topCreators,
			preferredSources,
			preferredDurations,
			watchTimeByCategory,
			engagementRate:
				totalInteractions > 0 ? positiveInteractions / totalInteractions : 0.1,
			lastActive:
				interactions.length > 0
					? interactions[interactions.length - 1]!.timestamp
					: Date.now(),
			recentWatched,
			skippedContent,
			likedContent,
			followedCreators: [], // Populated from follow graph
			heldTokenMints: [], // Populated from token holdings
		};
	}

	// ─── Content pool building ──────────────────────────────────────────

	private async buildContentPool(
		profile: UserInterestProfile,
		filters: {
			shortFilter?: boolean;
			liveFilter?: boolean;
			sourceFilter?: ContentSource[];
			categoryFilter?: string[];
			limit?: number;
		},
	): Promise<ContentItem[]> {
		// Group sources to fetch from in parallel
		const sources =
			filters.sourceFilter ?? (["youtube", "peertube"] as ContentSource[]);

		// Fetch from each source (in production, these would be real fetchers)
		const promises = sources.map((source) =>
			this.fetchFromSource(source, {
				categories: filters.categoryFilter,
				shortFilter: filters.shortFilter,
				liveFilter: filters.liveFilter,
				limit: filters.limit ?? DEFAULT_LIMIT * 2,
			}).catch(() => [] as ContentItem[]),
		);

		const results = await Promise.all(promises);
		const pool = results.flat();

		// Deduplicate by ID
		const seen = new Set<string>();
		const deduped: ContentItem[] = [];
		for (const item of pool) {
			if (!seen.has(item.id)) {
				seen.add(item.id);
				deduped.push(item);
			}
		}

		return deduped;
	}

	// ─── Scoring and ranking ────────────────────────────────────────────

	private scoreAndRank(
		pool: ContentItem[],
		profile: UserInterestProfile,
		opts: RecommendationOptions,
	): RankedContent[] {
		const now = Date.now();
		const limit = opts.limit ?? DEFAULT_LIMIT;
		const seenSet = new Set(profile.recentWatched);
		const skippedSet = new Set(profile.skippedContent);

		let candidates = pool.map((content) => {
			const signals = this.scoreContent(content, profile);
			return { ...content, score: signals.total, signals };
		});

		// Filter out watched content
		if (opts.excludeWatched !== false) {
			candidates = candidates.filter((c) => !seenSet.has(c.id));
		}

		// Filter out skipped content
		candidates = candidates.filter((c) => !skippedSet.has(c.id));

		// Source filter
		if (opts.sourceFilter && opts.sourceFilter.length > 0) {
			const allowed = new Set(opts.sourceFilter);
			candidates = candidates.filter((c) => allowed.has(c.source));
		}

		// Category filter
		if (opts.categoryFilter && opts.categoryFilter.length > 0) {
			const lowerCats = opts.categoryFilter.map((c) => c.toLowerCase());
			candidates = candidates.filter((c) =>
				c.categories.some((cat) => lowerCats.includes(cat.toLowerCase())),
			);
		}

		// Duration filter
		if (opts.durationFilter) {
			const { min, max } = opts.durationFilter;
			if (min !== undefined)
				candidates = candidates.filter((c) => c.duration >= min);
			if (max !== undefined)
				candidates = candidates.filter((c) => c.duration <= max);
		}

		// Freshness filter
		if (opts.freshnessFilter && opts.freshnessFilter !== "all") {
			const maxAge =
				opts.freshnessFilter === "day"
					? 24 * 60 * 60 * 1000
					: opts.freshnessFilter === "week"
						? 7 * 24 * 60 * 60 * 1000
						: 30 * 24 * 60 * 60 * 1000;
			candidates = candidates.filter((c) => now - c.publishedAt <= maxAge);
		}

		// Enforce source diversity: ensure at least 20% from non-dominant source
		const dominantSource = profile.preferredSources[0]?.source;
		if (dominantSource && candidates.length > 5) {
			const fromOtherSources = candidates.filter(
				(c) => c.source !== dominantSource,
			);
			const targetOther = Math.ceil(limit * 0.2);
			if (fromOtherSources.length < targetOther) {
				candidates = candidates
					.filter((c) => c.source === dominantSource)
					.slice(0, limit - targetOther);
				candidates.push(...fromOtherSources.slice(0, targetOther));
			}
		}

		// Sort by score descending
		candidates.sort((a, b) => b.score - a.score);

		return candidates.slice(0, limit);
	}

	// ─── Related content scoring ────────────────────────────────────────

	private computeRelatedScore(
		content: ContentItem,
		source: ContentItem,
	): number {
		let score = 0;
		const sharedCategories = content.categories.filter((c) =>
			source.categories.includes(c),
		);
		score +=
			(sharedCategories.length / Math.max(1, source.categories.length)) * 40;

		const sharedTags = content.tags.filter((t) => source.tags.includes(t));
		score += (sharedTags.length / Math.max(1, source.tags.length)) * 30;

		// Same creator gets a boost
		if (content.creatorId === source.creatorId) score += 15;

		// Quality bonus
		score += (content.creatorQuality / 100) * 15;

		return Math.min(100, score);
	}

	private buildRelatedSignals(
		content: ContentItem,
		source: ContentItem,
	): SignalBreakdown {
		const reasons: string[] = [];
		if (content.categories.some((c) => source.categories.includes(c))) {
			reasons.push("Same category");
		}
		if (content.creatorId === source.creatorId) {
			reasons.push("Same creator");
		}
		if (content.tags.some((t) => source.tags.includes(t))) {
			reasons.push("Related tags");
		}

		return {
			total: this.computeRelatedScore(content, source),
			watchHistory: 0,
			engagement: 0,
			followedCreator: content.creatorId === source.creatorId ? 15 : 0,
			heldCoin: 0,
			categoryMatch: 40,
			trending: 0,
			sourceDiversity: 0,
			freshness: 0,
			creatorQuality: 15,
			sessionContext: 0,
			reasons,
		};
	}

	// ─── Cache helpers ─────────────────────────────────────────────────

	private async loadCachedProfile(
		wallet: string,
	): Promise<UserInterestProfile | null> {
		try {
			const raw = await this.env.CACHE?.get(profileKey(wallet));
			if (raw) return JSON.parse(raw) as UserInterestProfile;
		} catch {
			/* ignore */
		}
		return null;
	}

	private async cacheProfile(
		wallet: string,
		profile: UserInterestProfile,
	): Promise<void> {
		if (!this.env.CACHE) return;
		try {
			await this.env.CACHE.put(profileKey(wallet), JSON.stringify(profile), {
				expirationTtl: PROFILE_TTL,
			});
		} catch {
			/* quiet */
		}
	}

	private async invalidateProfileCache(wallet: string): Promise<void> {
		if (!this.env.CACHE) return;
		try {
			await this.env.CACHE.delete(profileKey(wallet));
		} catch {
			/* quiet */
		}
	}

	private async getCachedRelated(
		source: ContentSource,
		contentId: string,
	): Promise<RankedContent[] | null> {
		try {
			const raw = await this.env.CACHE?.get(relatedKey(source, contentId));
			if (raw) return JSON.parse(raw) as RankedContent[];
		} catch {
			/* ignore */
		}
		return null;
	}

	private async cacheRelated(
		source: ContentSource,
		contentId: string,
		results: RankedContent[],
	): Promise<void> {
		if (!this.env.CACHE) return;
		try {
			await this.env.CACHE.put(
				relatedKey(source, contentId),
				JSON.stringify(results),
				{
					expirationTtl: RELATED_CACHE_TTL,
				},
			);
		} catch {
			/* quiet */
		}
	}

	// ─── Source fetchers (pluggable) ────────────────────────────────────

	/**
	 * Fetch content from a specific source.
	 * In production, these would call actual provider APIs or cached indices.
	 */
	private async fetchFromSource(
		source: ContentSource,
		filters: {
			categories?: string[];
			shortFilter?: boolean;
			liveFilter?: boolean;
			limit: number;
		},
	): Promise<ContentItem[]> {
		// This is a mock implementation that returns sample content.
		// In production, this would delegate to source-specific providers
		// (YouTube API, PeerTube API, TikTok API, etc.)
		const cacheKey = `rec:source:${source}:${JSON.stringify(filters)}`;
		try {
			const cached = await this.env.CACHE?.get(cacheKey);
			if (cached) return JSON.parse(cached) as ContentItem[];
		} catch {
			/* ignore */
		}

		// For now, return empty array — the actual content fetching is done
		// by the existing provider infrastructure. This engine scores
		// content passed to it from the route handlers which wire up
		// the real fetchers.
		return [];
	}

	/**
	 * Fetch a single content item by source and ID.
	 */
	private async fetchContentById(
		source: ContentSource,
		id: string,
	): Promise<ContentItem | null> {
		// In production, look up from KV cache or provider API
		try {
			const raw = await this.env.CACHE?.get(`rec:content:${source}:${id}`);
			if (raw) return JSON.parse(raw) as ContentItem;
		} catch {
			/* ignore */
		}
		return null;
	}

	/**
	 * Fetch similar content based on a reference item.
	 */
	private async fetchSimilarContent(
		source: ContentSource,
		content: ContentItem,
		limit: number,
	): Promise<ContentItem[]> {
		// In production, query a similarity index or tag-based search.
		// For now, return empty — the route handler provides the pool.
		return [];
	}

	/**
	 * Fetch trending content, optionally filtered by category.
	 */
	private async fetchTrendingContent(
		category?: string,
		limit: number = 50,
	): Promise<ContentItem[]> {
		// In production, query trending indices or provider APIs
		const cacheKey = `rec:trending:${category ?? "all"}`;
		try {
			const cached = await this.env.CACHE?.get(cacheKey);
			if (cached) return JSON.parse(cached) as ContentItem[];
		} catch {
			/* ignore */
		}
		return [];
	}

	/**
	 * Fetch diverse content outside user's bubble for discovery.
	 */
	private async fetchDiverseContent(opts: {
		excludeCreators: Set<string>;
		excludeCategories: string[];
		limit: number;
	}): Promise<ContentItem[]> {
		// In production, query from sources excluding known creators/categories
		return [];
	}

	// ─── Utility ────────────────────────────────────────────────────────

	private durationToRange(seconds: number): string {
		if (seconds < 60) return "0-1";
		if (seconds < 300) return "1-5";
		if (seconds < 600) return "5-10";
		if (seconds < 1200) return "10-20";
		if (seconds < 3600) return "20-60";
		return "60+";
	}
}
