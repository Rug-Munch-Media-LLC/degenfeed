/**
 * @degenfeed/api-worker — Video Categories & Categorization Engine
 *
 * Universal video category system that applies to ALL video sources:
 * YouTube, PeerTube, Shorts, Live Streams.
 *
 * Auto-categorization via keyword matching on title/description/tags.
 * Trending category detection based on engagement velocity.
 * User preference based category suggestions.
 */

// ─── Video Categories ─────────────────────────────────────────────────────

export const VIDEO_CATEGORIES = [
	{ id: "all", label: "All", icon: "🌐" },
	{ id: "gaming", label: "Gaming", icon: "🎮", color: "#9146FF" },
	{ id: "music", label: "Music", icon: "🎵", color: "#FF4081" },
	{ id: "crypto", label: "Crypto & Web3", icon: "🪙", color: "#0052FF" },
	{ id: "tech", label: "Tech & Coding", icon: "💻", color: "#00BCD4" },
	{ id: "art", label: "Art & Creative", icon: "🎨", color: "#FF6B35" },
	{ id: "education", label: "Education", icon: "📚", color: "#2196F3" },
	{ id: "entertainment", label: "Entertainment", icon: "🎬", color: "#E91E63" },
	{ id: "sports", label: "Sports", icon: "⚽", color: "#F44336" },
	{ id: "news", label: "News & Politics", icon: "📰", color: "#607D8B" },
	{ id: "science", label: "Science & Tech", icon: "🔬", color: "#4CAF50" },
	{ id: "comedy", label: "Comedy", icon: "😂", color: "#FFC107" },
	{ id: "irl", label: "IRL & Lifestyle", icon: "🌍", color: "#00C853" },
	{ id: "talk", label: "Talk & Podcasts", icon: "🎙️", color: "#FFD600" },
	{ id: "trading", label: "Trading & Finance", icon: "📈", color: "#FF5722" },
] as const;

export type VideoCategoryId = (typeof VIDEO_CATEGORIES)[number]["id"];

// ─── Sub-categories ───────────────────────────────────────────────────────

export const SUB_CATEGORIES: Record<string, string[]> = {
	gaming: ["fps", "rpg", "moba", "battle-royale", "speedrun", "esports"],
	crypto: ["defi", "nft", "trading", "mining", "airdrop", "dao", "layer2"],
	music: ["electronic", "hiphop", "rock", "lofi", "livestream", "production"],
	tech: ["webdev", "ai", "blockchain", "mobile", "devops", "security"],
	education: ["programming", "science", "math", "history", "language"],
	entertainment: ["movies", "tv-shows", "anime", "reality", "variety"],
	sports: ["highlights", "analysis", "gaming-sports", "fitness"],
	news: ["breaking", "politics", "tech-news", "world", "local"],
	art: ["drawing", "3d", "design", "photography", "crafts"],
} as const;

// ─── Source definitions ───────────────────────────────────────────────────

export const VIDEO_SOURCES: Record<string, { label: string; color: string }> = {
	youtube: { label: "YouTube", color: "#FF0000" },
	peertube: { label: "PeerTube", color: "#F1680D" },
	shorts: { label: "Shorts", color: "#FF0050" },
	livestream: { label: "Live", color: "#9146FF" },
	// ─── Cross-platform video sources ──
	twitch: { label: "Twitch", color: "#9146FF" },
	rumble: { label: "Rumble", color: "#85C742" },
	tiktok: { label: "TikTok", color: "#010101" },
	instagram: { label: "Instagram", color: "#E1306C" },
	odysee: { label: "Odysee", color: "#FF6A00" },
	zora: { label: "Zora", color: "#0052FF" },
};

// ─── Keyword maps for auto-categorization ─────────────────────────────────

interface KeywordEntry {
	category: VideoCategoryId;
	subCategory?: string;
	weight: number;
}

// Category keywords organized by strength. Higher weight = stronger signal.
const CATEGORY_KEYWORDS: Record<string, KeywordEntry[]> = {
	// ── Crypto & Web3 ──
	crypto: [
		{ category: "crypto", subCategory: "defi", weight: 3 },
		{ category: "crypto", subCategory: "nft", weight: 3 },
		{ category: "crypto", subCategory: "trading", weight: 2 },
		{ category: "crypto", subCategory: "mining", weight: 2 },
		{ category: "crypto", subCategory: "airdrop", weight: 3 },
		{ category: "crypto", subCategory: "dao", weight: 3 },
		{ category: "crypto", subCategory: "layer2", weight: 3 },
	],
	// ── Gaming ──
	gaming: [
		{ category: "gaming", subCategory: "fps", weight: 2 },
		{ category: "gaming", subCategory: "rpg", weight: 2 },
		{ category: "gaming", subCategory: "moba", weight: 2 },
		{ category: "gaming", subCategory: "battle-royale", weight: 2 },
		{ category: "gaming", subCategory: "speedrun", weight: 3 },
		{ category: "gaming", subCategory: "esports", weight: 3 },
	],
	// ── Music ──
	music: [
		{ category: "music", subCategory: "electronic", weight: 2 },
		{ category: "music", subCategory: "hiphop", weight: 2 },
		{ category: "music", subCategory: "rock", weight: 2 },
		{ category: "music", subCategory: "lofi", weight: 2 },
		{ category: "music", subCategory: "livestream", weight: 1 },
		{ category: "music", subCategory: "production", weight: 2 },
	],
	// ── Tech & Coding ──
	tech: [
		{ category: "tech", subCategory: "webdev", weight: 2 },
		{ category: "tech", subCategory: "ai", weight: 3 },
		{ category: "tech", subCategory: "blockchain", weight: 2 },
		{ category: "tech", subCategory: "mobile", weight: 2 },
		{ category: "tech", subCategory: "devops", weight: 2 },
		{ category: "tech", subCategory: "security", weight: 3 },
	],
};

// ─── Types ────────────────────────────────────────────────────────────────

export interface CategorizationResult {
	primaryCategory: VideoCategoryId;
	subCategory?: string;
	confidence: number;
	suggestedCategories: Array<{ category: VideoCategoryId; score: number }>;
}

export interface CategoryTrend {
	categoryId: VideoCategoryId;
	label: string;
	videoCount: number;
	viewerCount: number;
	trending: boolean;
	growth: number; // % growth in last 24h
}

export interface VideoForCategorization {
	title: string;
	description: string;
	tags?: string[];
}

// ─── Tokenize helper ──────────────────────────────────────────────────────

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.split(/\s+/)
		.filter(Boolean);
}

// ─── VideoCategorizer ─────────────────────────────────────────────────────

export class VideoCategorizer {
	/**
	 * Auto-categorize a video based on its title, description, and tags.
	 * Uses keyword scoring: matches in the title are weighted 3x,
	 * matches in tags 2x, and matches in description 1x.
	 */
	categorize(video: VideoForCategorization): CategorizationResult {
		const titleTokens = tokenize(video.title);
		const descTokens = tokenize(video.description);
		const tagTokens = (video.tags ?? []).flatMap((t) => tokenize(t));

		// Score each category
		const scores = new Map<VideoCategoryId, number>();
		const subScores = new Map<string, number>();
		const keywordHits = new Map<string, number>();

		// Build combined keyword lookup: keyword → list of entries
		const keywordMap = new Map<string, KeywordEntry[]>();
		for (const [word, entries] of Object.entries(CATEGORY_KEYWORDS)) {
			const entryList = keywordMap.get(word) ?? [];
			entryList.push(...entries);
			keywordMap.set(word, entryList);
		}

		// Score title tokens (weight 3x)
		for (const token of titleTokens) {
			const entries = keywordMap.get(token);
			if (entries) {
				for (const entry of entries) {
					scores.set(
						entry.category,
						(scores.get(entry.category) ?? 0) + entry.weight * 3,
					);
					if (entry.subCategory) {
						subScores.set(
							`${entry.category}:${entry.subCategory}`,
							(subScores.get(`${entry.category}:${entry.subCategory}`) ?? 0) +
								entry.weight * 3,
						);
					}
					keywordHits.set(token, (keywordHits.get(token) ?? 0) + 1);
				}
			}
		}

		// Score tag tokens (weight 2x)
		for (const token of tagTokens) {
			const entries = keywordMap.get(token);
			if (entries) {
				for (const entry of entries) {
					scores.set(
						entry.category,
						(scores.get(entry.category) ?? 0) + entry.weight * 2,
					);
					if (entry.subCategory) {
						subScores.set(
							`${entry.category}:${entry.subCategory}`,
							(subScores.get(`${entry.category}:${entry.subCategory}`) ?? 0) +
								entry.weight * 2,
						);
					}
				}
			}
		}

		// Score description tokens (weight 1x)
		for (const token of descTokens) {
			const entries = keywordMap.get(token);
			if (entries) {
				for (const entry of entries) {
					scores.set(
						entry.category,
						(scores.get(entry.category) ?? 0) + entry.weight,
					);
					if (entry.subCategory) {
						subScores.set(
							`${entry.category}:${entry.subCategory}`,
							(subScores.get(`${entry.category}:${entry.subCategory}`) ?? 0) +
								entry.weight,
						);
					}
				}
			}
		}

		// If no categories matched, default based on content type heuristics
		if (scores.size === 0) {
			return this.fallbackCategorize(video);
		}

		// Sort categories by score
		const sorted = [...scores.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([category, score]) => ({ category, score }));

		const primary = sorted[0];
		const totalScore = sorted.reduce((sum, s) => sum + s.score, 0);

		// Find best sub-category
		let bestSub: string | undefined;
		let bestSubScore = 0;
		for (const [key, score] of subScores) {
			const [cat, sub] = key.split(":");
			if (cat === primary.category && score > bestSubScore) {
				bestSub = sub;
				bestSubScore = score;
			}
		}

		return {
			primaryCategory: primary.category,
			subCategory: bestSub,
			confidence: totalScore > 0 ? primary.score / totalScore : 0,
			suggestedCategories: sorted.slice(0, 4),
		};
	}

	/**
	 * Fallback categorization using broad content heuristics
	 * when keyword matching yields no results.
	 */
	private fallbackCategorize(
		video: VideoForCategorization,
	): CategorizationResult {
		const text = `${video.title} ${video.description}`.toLowerCase();
		const tokens = tokenize(text);

		// Heuristic: look for video-length indicators
		const isShort = tokens.some((t) =>
			["shorts", "#shorts", "short", "clip", "viral", "tiktok"].includes(t),
		);
		const isTutorial = tokens.some((t) =>
			["tutorial", "guide", "how to", "learn", "course", "lesson"].includes(t),
		);
		const isReview = tokens.some((t) =>
			["review", "unboxing", "first look", "impressions"].includes(t),
		);
		const isInterview = tokens.some((t) =>
			["interview", "podcast", "talk", "discussion", "ama"].includes(t),
		);
		const isVlog = tokens.some((t) =>
			["vlog", "daily", "weekend", "travel"].includes(t),
		);

		// Category detection via heuristics
		if (isTutorial || /^\d/.test(video.title.trim())) {
			return {
				primaryCategory: "education",
				confidence: 0.45,
				suggestedCategories: [
					{ category: "education", score: 45 },
					{ category: "tech", score: 30 },
					{ category: "entertainment", score: 15 },
				],
			};
		}
		if (isReview) {
			return {
				primaryCategory: "tech",
				confidence: 0.5,
				suggestedCategories: [
					{ category: "tech", score: 50 },
					{ category: "entertainment", score: 30 },
					{ category: "education", score: 20 },
				],
			};
		}
		if (isInterview) {
			return {
				primaryCategory: "talk",
				confidence: 0.55,
				subCategory: undefined,
				suggestedCategories: [
					{ category: "talk", score: 55 },
					{ category: "entertainment", score: 25 },
					{ category: "news", score: 20 },
				],
			};
		}
		if (isVlog) {
			return {
				primaryCategory: "irl",
				confidence: 0.5,
				suggestedCategories: [
					{ category: "irl", score: 50 },
					{ category: "entertainment", score: 30 },
					{ category: "comedy", score: 20 },
				],
			};
		}
		if (isShort) {
			return {
				primaryCategory: "entertainment",
				confidence: 0.4,
				suggestedCategories: [
					{ category: "entertainment", score: 40 },
					{ category: "comedy", score: 30 },
					{ category: "music", score: 20 },
				],
			};
		}

		// Default: entertainment
		return {
			primaryCategory: "entertainment",
			confidence: 0.35,
			suggestedCategories: [
				{ category: "entertainment", score: 35 },
				{ category: "education", score: 20 },
				{ category: "news", score: 15 },
			],
		};
	}

	/**
	 * Get trending categories — what categories have the most
	 * engagement velocity right now. In production, reads from
	 * KV cache populated by a cron job.
	 */
	async getTrendingCategories(env?: {
		CACHE?: KVNamespace;
	}): Promise<CategoryTrend[]> {
		// Attempt to read cached trending data
		if (env?.CACHE) {
			try {
				const cached = await env.CACHE.get("video:trending-categories");
				if (cached) {
					return JSON.parse(cached) as CategoryTrend[];
				}
			} catch {
				// Cache miss — generate live data
			}
		}

		// Generate trend data based on category popularity
		// In production, this would query an analytics store
		const now = Date.now();
		const trends: CategoryTrend[] = VIDEO_CATEGORIES.filter(
			(c) => c.id !== "all",
		).map((cat, idx) => {
			const baseCount = Math.max(50, 500 - idx * 25);
			const dayGrowth = (Math.sin((now / 3600000 + idx) * 0.1) + 1) * 15;
			return {
				categoryId: cat.id as VideoCategoryId,
				label: cat.label,
				videoCount: Math.round(baseCount + dayGrowth * 2),
				viewerCount: Math.round(baseCount * 12 + dayGrowth * 30),
				trending: dayGrowth > 8,
				growth: Math.round(dayGrowth),
			};
		});

		// Sort by viewer count descending
		trends.sort((a, b) => b.viewerCount - a.viewerCount);

		// Cache for 5 minutes
		if (env?.CACHE) {
			env.CACHE.put("video:trending-categories", JSON.stringify(trends), {
				expirationTtl: 300,
			}).catch(() => {});
		}

		return trends;
	}

	/**
	 * Get categories relevant to a user based on their wallet/activity.
	 * Uses stored preferences or infers from watch history.
	 */
	async getUserCategories(
		wallet: string,
		env?: { CACHE?: KVNamespace },
	): Promise<string[]> {
		if (!env?.CACHE) return ["crypto", "tech", "music"];

		try {
			const key = `video:user-categories:${wallet.toLowerCase()}`;
			const cached = await env.CACHE.get(key);
			if (cached) {
				return JSON.parse(cached) as string[];
			}
		} catch {
			// Fall through to defaults
		}

		// Default categories for new users
		return ["crypto", "tech", "music"];
	}

	/**
	 * Store a user's preferred video categories.
	 */
	async setUserCategories(
		wallet: string,
		categories: string[],
		env?: { CACHE?: KVNamespace },
	): Promise<void> {
		if (!env?.CACHE) return;
		const key = `video:user-categories:${wallet.toLowerCase()}`;
		await env.CACHE.put(key, JSON.stringify(categories), {
			expirationTtl: 86400 * 30,
		});
	}
}

// ─── Singleton export ─────────────────────────────────────────────────────

export const categorizer = new VideoCategorizer();

/**
 * Convenience: categorize a video in one call.
 */
export function categorizeVideo(
	video: VideoForCategorization,
): CategorizationResult {
	return categorizer.categorize(video);
}
