/**
 * @degenfeed/api-worker — YouTube Content Routes
 *
 * Dedicated YouTube video discovery endpoints with algorithmic curation.
 * All YouTube content is clearly labeled as YouTube (not PeerTube).
 *
 * Cache: 15-minute KV cache for trending/channel/search responses.
 * Personalized recommendations bypass cache.
 *
 * Routes:
 *   GET /api/youtube/trending     — Trending videos in a category
 *   GET /api/youtube/recommended  — Personalized recommendations
 *   GET /api/youtube/search       — Search YouTube videos
 *   GET /api/youtube/channels/:id — Channel info + videos
 *   GET /api/youtube/shorts       — YouTube Shorts feed
 *   GET /api/youtube/categories   — Available categories
 */

import { Hono } from "hono";
import {
	DEFAULT_USER_PREFERENCES,
	type ShortsCategory,
	type YouTubeCategory,
	YouTubeFetcher,
} from "../feed/youtube-fetcher";
import type { Env } from "../index";

// ─── Router ───────────────────────────────────────────────────────────────

const youtube = new Hono<{ Bindings: Env }>();

// ─── Helpers ───────────────────────────────────────────────────────────

function getFetcher(c: { env: Env }): YouTubeFetcher {
	return new YouTubeFetcher(c.env.YOUTUBE_API_KEY ?? "");
}

function parseLimit(
	limitStr: string | undefined,
	defaultVal = 20,
	maxVal = 50,
): number {
	const n = Number(limitStr);
	return Number.isFinite(n) && n > 0 ? Math.min(n, maxVal) : defaultVal;
}

function parseCategory(
	cat: string | null,
	defaultVal: YouTubeCategory = "all",
): YouTubeCategory {
	const valid: YouTubeCategory[] = [
		"gaming",
		"music",
		"crypto",
		"tech",
		"education",
		"entertainment",
		"sports",
		"news",
		"science",
		"comedy",
		"all",
	];
	return valid.includes(cat as YouTubeCategory)
		? (cat as YouTubeCategory)
		: defaultVal;
}

// ─── GET /api/youtube/trending ──────────────────────────────────────────

/**
 * Fetch trending YouTube videos in a category.
 * Query params:
 *   - category (string, default 'all'): gaming, music, crypto, tech, etc.
 *   - limit    (number, default 20, max 50)
 *
 * Returns enriched videos with DegenFeed metadata.
 * Cached for 15 minutes.
 */
youtube.get("/trending", async (c) => {
	const url = new URL(c.req.url);
	const category = parseCategory(url.searchParams.get("category"));
	const limit = parseLimit(url.searchParams.get("limit"), 20, 50);

	try {
		const fetcher = getFetcher(c);
		const videos = await fetcher.getTrending(category, limit, c.env);
		const enriched = await fetcher.enrichWithDegenFeedData(videos, c.env);

		return c.json({
			data: enriched,
			meta: {
				category,
				count: enriched.length,
				source: "youtube",
				sourceLabel: "YouTube",
			},
		});
	} catch (err) {
		console.warn("[youtube] /trending error:", String(err));
		return c.json({ error: "Failed to fetch trending videos", data: [] }, 500);
	}
});

// ─── GET /api/youtube/recommended ──────────────────────────────────────

/**
 * Personalized YouTube recommendations based on user interests.
 * Query params:
 *   - limit (number, default 20, max 50)
 *
 * Body (optional JSON for authenticated users with preferences):
 *   { topics, followedChannels, watchHistory, likedVideos }
 *
 * Falls back to crypto-default preferences for anonymous users.
 * Not cached — always fresh per user.
 */
youtube.get("/recommended", async (c) => {
	const limit = parseLimit(
		new URL(c.req.url).searchParams.get("limit"),
		20,
		50,
	);

	// Try to load user preferences
	let userPrefs = DEFAULT_USER_PREFERENCES;

	try {
		// Attempt to read session for personalized preferences
		const session = await getOptionalSession(c.req.raw, c.env);
		if (session?.address && c.env.CACHE) {
			const prefKey = `user:youtube:prefs:${session.address}`;
			const raw = await c.env.CACHE.get(prefKey);
			if (raw) {
				userPrefs = { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(raw) };
			}
		}
	} catch {
		// Anonymous — use defaults
	}

	try {
		const fetcher = getFetcher(c);
		const videos = await fetcher.getRecommendations(userPrefs, limit, c.env);
		const enriched = await fetcher.enrichWithDegenFeedData(videos, c.env);

		return c.json({
			data: enriched,
			meta: {
				count: enriched.length,
				personalized: true,
				source: "youtube",
				sourceLabel: "YouTube",
			},
		});
	} catch (err) {
		console.warn("[youtube] /recommended error:", String(err));
		return c.json({ error: "Failed to fetch recommendations", data: [] }, 500);
	}
});

// ─── GET /api/youtube/search ───────────────────────────────────────────

/**
 * Search YouTube videos by keyword.
 * Query params:
 *   - q     (string, required): search query
 *   - limit (number, default 20, max 50)
 *
 * Searches across curated channel content. Results are cached.
 */
youtube.get("/search", async (c) => {
	const url = new URL(c.req.url);
	const query = url.searchParams.get("q")?.trim();
	const limit = parseLimit(url.searchParams.get("limit"), 20, 50);

	if (!query || query.length < 2) {
		return c.json(
			{ error: "Query must be at least 2 characters", data: [] },
			400,
		);
	}

	try {
		const fetcher = getFetcher(c);
		const videos = await fetcher.search(query, limit, c.env);
		const enriched = await fetcher.enrichWithDegenFeedData(videos, c.env);

		return c.json({
			data: enriched,
			meta: {
				query,
				count: enriched.length,
				source: "youtube",
				sourceLabel: "YouTube",
			},
		});
	} catch (err) {
		console.warn("[youtube] /search error:", String(err));
		return c.json({ error: "Search failed", data: [] }, 500);
	}
});

// ─── GET /api/youtube/channels/:id ─────────────────────────────────────

/**
 * Get channel info and recent videos.
 * Path params:
 *   - id (string): YouTube channel ID
 *
 * Query params:
 *   - limit (number, default 20, max 50)
 *
 * Returns channel metadata + latest videos.
 */
youtube.get("/channels/:id", async (c) => {
	const channelId = c.req.param("id");
	const limit = parseLimit(
		new URL(c.req.url).searchParams.get("limit"),
		20,
		50,
	);

	if (!channelId) {
		return c.json({ error: "Channel ID required" }, 400);
	}

	try {
		const fetcher = getFetcher(c);
		const videos = await fetcher.getChannelVideos(channelId, limit, c.env);
		const enriched = await fetcher.enrichWithDegenFeedData(videos, c.env);

		// Channel metadata (from first video result or KV)
		const channelInfo =
			enriched.length > 0
				? {
						name: enriched[0]?.channelName ?? "Unknown",
						channelId,
						avatar: enriched[0]?.channelAvatar ?? "",
						subscriberCount: 0, // Would require YouTube Data API
						videoCount: enriched.length,
					}
				: {
						name: "Unknown",
						channelId,
						avatar: "",
						subscriberCount: 0,
						videoCount: 0,
					};

		return c.json({
			channel: channelInfo,
			videos: enriched,
			meta: {
				count: enriched.length,
				source: "youtube",
				sourceLabel: "YouTube",
			},
		});
	} catch (err) {
		console.warn(`[youtube] /channels/${channelId} error:`, String(err));
		return c.json(
			{ error: "Failed to fetch channel", data: [], channel: null },
			500,
		);
	}
});

// ─── GET /api/youtube/shorts ───────────────────────────────────────────

/**
 * Get YouTube Shorts (vertical short-form videos).
 * Query params:
 *   - category (string, default 'crypto'): trending, crypto, gaming, etc.
 *   - limit    (number, default 30, max 50)
 *
 * Returns YouTube Shorts, clearly labeled as YouTube content.
 */
youtube.get("/shorts", async (c) => {
	const url = new URL(c.req.url);
	const categoryRaw = url.searchParams.get("category") || "crypto";
	const limit = parseLimit(url.searchParams.get("limit"), 30, 50);

	const validCategories: ShortsCategory[] = [
		"trending",
		"crypto",
		"gaming",
		"music",
		"comedy",
		"education",
	];
	const category: ShortsCategory = validCategories.includes(
		categoryRaw as ShortsCategory,
	)
		? (categoryRaw as ShortsCategory)
		: "crypto";

	try {
		const fetcher = getFetcher(c);
		const shorts = await fetcher.getShorts(category, limit, c.env);

		return c.json({
			data: shorts,
			meta: {
				category,
				count: shorts.length,
				source: "youtube",
				sourceLabel: "YouTube Shorts",
			},
		});
	} catch (err) {
		console.warn("[youtube] /shorts error:", String(err));
		return c.json({ error: "Failed to fetch Shorts", data: [] }, 500);
	}
});

// ─── GET /api/youtube/categories ───────────────────────────────────────

/**
 * List available YouTube categories for filtering.
 * Static list — no external API call needed.
 */
youtube.get("/categories", async (c) => {
	return c.json({
		categories: [
			{ id: "gaming", label: "Gaming", icon: "\uD83C\uDFAE" },
			{ id: "music", label: "Music", icon: "\uD83C\uDFB5" },
			{ id: "crypto", label: "Crypto & Blockchain", icon: "\uD83E\uDE99" },
			{ id: "tech", label: "Technology", icon: "\uD83D\uDCBB" },
			{ id: "education", label: "Education", icon: "\uD83D\uDCDA" },
			{ id: "entertainment", label: "Entertainment", icon: "\uD83C\uDFAC" },
			{ id: "sports", label: "Sports", icon: "\u26BD" },
			{ id: "news", label: "News & Politics", icon: "\uD83D\uDCF0" },
			{ id: "science", label: "Science", icon: "\uD83D\uDD2C" },
			{ id: "comedy", label: "Comedy", icon: "\uD83D\uDE02" },
		],
	});
});

// ─── Session helper ──────────────────────────────────────────────────────

interface SessionInfo {
	address: string;
	[key: string]: unknown;
}

async function getOptionalSession(
	request: Request,
	env: Env,
): Promise<SessionInfo | null> {
	try {
		const cookie = request.headers.get("cookie") ?? "";
		const match = cookie.match(/session=([^;]+)/);
		if (!match?.[1]) return null;

		const sessionData = decodeURIComponent(match[1]);
		const parsed = JSON.parse(atob(sessionData)) as SessionInfo;
		return parsed?.address ? parsed : null;
	} catch {
		return null;
	}
}

export default youtube;
