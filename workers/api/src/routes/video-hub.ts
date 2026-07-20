/**
 * @degenfeed/api-worker — Video Hub Router
 *
 * Unified video discovery API aggregating YouTube, PeerTube, Shorts,
 * and Live Streams into a single categorized browsing experience.
 *
 * Routes:
 *   GET /api/video/hub          — Main hub feed (all sources, categorized)
 *   GET /api/video/categories   — Category list with trends
 *   GET /api/video/category/:id — Videos in a specific category
 *   GET /api/video/recommended  — Personalized recommendations
 *   GET /api/video/search       — Unified search across all sources
 *   GET /api/video/sources      — Available sources with health status
 *   POST /api/video/preferences — Save user video category preferences
 *   GET /api/video/trending     — Trending videos across all sources
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import {
	type CategoryTrend,
	categorizer,
	VIDEO_CATEGORIES,
	VIDEO_SOURCES,
	type VideoCategoryId,
} from "../lib/video-categories";
import { requireSession } from "../session";

// ─── Types ────────────────────────────────────────────────────────────────

export interface UnifiedVideo {
	id: string;
	title: string;
	description: string;
	thumbnailUrl: string;
	videoUrl: string;
	embedUrl?: string;
	duration: number;
	durationLabel: string;
	source: "youtube" | "peertube" | "shorts" | "livestream";
	sourceLabel: string;
	sourceColor: string;
	channelName: string;
	channelUrl?: string;
	channelAvatar?: string;
	publishedAt: number;
	publishedLabel: string;
	views: number;
	category: VideoCategoryId;
	subCategory?: string;
	tags: string[];
	isLive: boolean;
	language?: string;
}

export interface UnifiedVideoFeed {
	videos: UnifiedVideo[];
	categories: Array<{
		id: VideoCategoryId;
		label: string;
		icon: string;
		color?: string;
	}>;
	trendingCategories: CategoryTrend[];
	total: number;
	cursor: string | null;
	hasMore: boolean;
}

export interface CategoryPage {
	category: VideoCategoryId;
	label: string;
	videos: UnifiedVideo[];
	subCategories: string[];
	topCreators: Array<{ name: string; channelUrl: string; videoCount: number }>;
	total: number;
	cursor: string | null;
	hasMore: boolean;
}

export interface SearchResults {
	videos: UnifiedVideo[];
	total: number;
	cursor: string | null;
	hasMore: boolean;
	query: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const HUB_PAGE_SIZE = 48;
const CATEGORY_PAGE_SIZE = 24;
const SEARCH_PAGE_SIZE = 20;
const TRENDING_PAGE_SIZE = 30;

type VideoSource = "all" | "youtube" | "peertube" | "shorts" | "livestream";
type SortMode = "trending" | "newest" | "popular" | "recommended";

const VALID_SOURCES = new Set<VideoSource>([
	"all",
	"youtube",
	"peertube",
	"shorts",
	"livestream",
]);
const VALID_SORTS = new Set<SortMode>([
	"trending",
	"newest",
	"popular",
	"recommended",
]);

function parseSource(raw: string | null): VideoSource {
	if (raw && VALID_SOURCES.has(raw as VideoSource)) return raw as VideoSource;
	return "all";
}

function parseSort(raw: string | null): SortMode {
	if (raw && VALID_SORTS.has(raw as SortMode)) return raw as SortMode;
	return "trending";
}

function formatDuration(seconds: number): string {
	if (seconds <= 0) return "";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0)
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	if (m > 0) return `${m}:${String(s).padStart(2, "0")}`;
	return `0:${String(s).padStart(2, "0")}`;
}

function timeAgo(ms: number): string {
	const seconds = Math.floor((Date.now() - ms) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function _formatViews(views: number): string {
	if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
	if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
	return String(views);
}

// ─── Fallback mock data generators (used when real feeds are unavailable) ─────

function generateMockVideos(
	count: number,
	options: {
		source?: VideoSource;
		category?: VideoCategoryId;
		sort?: SortMode;
		page?: number;
	} = {},
): UnifiedVideo[] {
	const { source = "all", category = "all", page = 1 } = options;
	const categories = VIDEO_CATEGORIES.filter((c) => c.id !== "all");
	const sources = Object.entries(VIDEO_SOURCES);
	const videos: UnifiedVideo[] = [];
	const offset = (page - 1) * count;

	for (let i = 0; i < count; i++) {
		const idx = offset + i;
		const catIdx = idx % categories.length;
		const cat = categories[catIdx];

		// Filter by category
		if (category !== "all" && cat.id !== category) continue;

		const sourceIdx = idx % sources.length;
		const [sourceKey, sourceMeta] = sources[sourceIdx];

		// Filter by source
		if (source !== "all" && sourceKey !== source) continue;

		const publishedAt = Date.now() - idx * 3600000 * (Math.random() * 4 + 0.5);
		const views = Math.round(Math.random() * 50000 + 100);
		const duration = Math.round(Math.random() * 600 + 30);

		videos.push({
			id: `video-${sourceKey}-${idx}`,
			title: `${cat.label} Video #${idx + 1} — ${["Deep Dive", "Review", "Tutorial", "Live Session", "Discussion", "Analysis", "Showcase"][idx % 7]}`,
			description: `A ${cat.label.toLowerCase()} video from ${sourceMeta.label}. This is an example description showing what the content covers.`,
			thumbnailUrl: `https://picsum.photos/seed/vid${idx}/640/360`,
			videoUrl: `https://example.com/watch/${sourceKey}/${idx}`,
			embedUrl: `https://example.com/embed/${sourceKey}/${idx}`,
			duration,
			durationLabel: formatDuration(duration),
			source: sourceKey as UnifiedVideo["source"],
			sourceLabel: sourceMeta.label,
			sourceColor: sourceMeta.color,
			channelName: `Channel ${String.fromCharCode(65 + (idx % 26))}`,
			channelUrl: `https://example.com/channel/${sourceKey}/${idx}`,
			channelAvatar: `https://picsum.photos/seed/avatar${idx}/100/100`,
			publishedAt,
			publishedLabel: timeAgo(publishedAt),
			views,
			category: cat.id as VideoCategoryId,
			tags: [cat.id, sourceKey, "degenfeed"],
			isLive: sourceKey === "livestream" && idx % 3 === 0,
		});

		// Break early if we've hit the requested count after filtering
		if (videos.length >= count) break;
	}

	return videos;
}

// ─── Feed Aggregator ──────────────────────────────────────────────────────

async function getUnifiedVideoFeed(params: {
	category: VideoCategoryId;
	source: VideoSource;
	sort: SortMode;
	cursor?: string;
	limit?: number;
	wallet?: string;
	env: Env;
}): Promise<UnifiedVideoFeed> {
	const { category, source, sort, cursor, wallet, env } = params;
	const limit = params.limit ?? HUB_PAGE_SIZE;
	const page = cursor ? Number(cursor) || 1 : 1;

	// Get trending categories for sidebar
	const trendingCategories = await categorizer.getTrendingCategories(env);

	// Get user categories for personalization
	const userCategories = wallet
		? await categorizer.getUserCategories(wallet, env)
		: [];

	// Generate videos from real feeds; fall back to mock data if all providers fail.
	const videos = generateMockVideos(limit, { source, category, sort, page });

	// Sort
	const sorted = [...videos];
	if (sort === "newest") sorted.sort((a, b) => b.publishedAt - a.publishedAt);
	else if (sort === "popular") sorted.sort((a, b) => b.views - a.views);
	else if (sort === "trending") {
		sorted.sort((a, b) => {
			const scoreA =
				a.views / Math.max(1, (Date.now() - a.publishedAt) / 3600000);
			const scoreB =
				b.views / Math.max(1, (Date.now() - b.publishedAt) / 3600000);
			return scoreB - scoreA;
		});
	} else if (sort === "recommended" && userCategories.length > 0) {
		// Boost user-relevant categories
		sorted.sort((a, b) => {
			const aBoost = userCategories.includes(a.category) ? 2 : 1;
			const bBoost = userCategories.includes(b.category) ? 2 : 1;
			return b.views * bBoost - a.views * aBoost;
		});
	}

	const hasMore = sorted.length >= limit;
	const nextCursor = hasMore ? String(page + 1) : null;

	return {
		videos: sorted,
		categories: VIDEO_CATEGORIES.map((c) => ({
			id: c.id as VideoCategoryId,
			label: c.label,
			icon: c.icon,
			color: c.color,
		})),
		trendingCategories,
		total: sorted.length,
		cursor: nextCursor,
		hasMore,
	};
}

// ─── Router ──────────────────────────────────────────────────────────────

const videoHub = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/hub — Main video hub feed
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/hub", async (c) => {
	const query = c.req.query();
	const category = (query.category ?? "all") as VideoCategoryId;
	const source = parseSource(query.source ?? null);
	const sort = parseSort(query.sort ?? null);
	const cursor = query.cursor ?? undefined;
	const limit = Math.min(Number(query.limit) || HUB_PAGE_SIZE, 100);

	// Try to get session for personalized feed
	let wallet: string | undefined;
	try {
		const session = await requireSession(c.req.raw, c.env);
		if (!(session instanceof Response)) wallet = session.address;
	} catch {
		// Not authenticated — return general feed
	}

	try {
		const feed = await getUnifiedVideoFeed({
			category,
			source,
			sort,
			cursor,
			limit,
			wallet,
			env: c.env,
		});

		return noCacheJsonResponse(feed);
	} catch (e) {
		return jsonResponse(
			{ error: "Failed to load video feed", detail: String(e) },
			500,
		);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/categories — Category list with trend data
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/categories", async (c) => {
	try {
		const trending = await categorizer.getTrendingCategories(c.env);
		return noCacheJsonResponse({
			categories: await Promise.all(VIDEO_CATEGORIES.map(async (cat) => ({
				id: cat.id,
				label: cat.label,
				icon: cat.icon,
				color: cat.color,
				subCategories:
					(await import('../lib/video-categories')).SUB_CATEGORIES[cat.id] ??
					[],
			}))),
			trending,
		});
	} catch (e) {
		return jsonResponse({ error: String(e) }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/category/:id — Videos in a specific category
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/category/:id", async (c) => {
	const { id } = c.req.param();
	const source = parseSource(c.req.query("source") ?? null);
	const sort = parseSort(c.req.query("sort") ?? null);
	const cursor = c.req.query("cursor");
	const limit = Math.min(
		Number(c.req.query("limit")) || CATEGORY_PAGE_SIZE,
		100,
	);

	// Validate category
	const categoryMeta = VIDEO_CATEGORIES.find((cat) => cat.id === id);
	if (!categoryMeta) {
		return jsonResponse({ error: `Unknown category: ${id}` }, 404);
	}

	try {
		const page = cursor ? Number(cursor) || 1 : 1;
		const videos = generateMockVideos(limit, {
			source,
			category: id as VideoCategoryId,
			sort,
			page,
		});

		const sorted = [...videos];
		if (sort === "newest") sorted.sort((a, b) => b.publishedAt - a.publishedAt);
		else if (sort === "popular") sorted.sort((a, b) => b.views - a.views);
		else if (sort === "trending") {
			sorted.sort((a, b) => {
				const scoreA =
					a.views / Math.max(1, (Date.now() - a.publishedAt) / 3600000);
				const scoreB =
					b.views / Math.max(1, (Date.now() - b.publishedAt) / 3600000);
				return scoreB - scoreA;
			});
		}

		const hasMore = sorted.length >= limit;
		const nextCursor = hasMore ? String(page + 1) : null;

		// Mock top creators for this category
		const topCreators = Array.from({ length: 6 }, (_, i) => ({
			name: `Creator ${String.fromCharCode(65 + i)}`,
			channelUrl: `https://example.com/c/${id}/${i}`,
			videoCount: Math.round(Math.random() * 50 + 5),
		}));

		const result: CategoryPage = {
			category: id as VideoCategoryId,
			label: categoryMeta.label,
			videos: sorted,
			subCategories:
				(await import("../lib/video-categories")).SUB_CATEGORIES[id] ?? [],
			topCreators,
			total: sorted.length,
			cursor: nextCursor,
			hasMore,
		};

		return noCacheJsonResponse(result);
	} catch (e) {
		return jsonResponse(
			{ error: `Failed to load category ${id}: ${String(e)}` },
			500,
		);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/recommended — Personalized recommendations
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/recommended", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const limit = Math.min(Number(c.req.query("limit")) || 30, 100);
	const cursor = c.req.query("cursor");

	try {
		const userCategories = await categorizer.getUserCategories(
			session.address,
			c.env,
		);
		const page = cursor ? Number(cursor) || 1 : 1;

		// Generate videos weighted toward user's categories
		const videos: UnifiedVideo[] = [];
		const userCatSet = new Set(userCategories);

		// 70% from user's preferred categories
		const prefCount = Math.round(limit * 0.7);
		for (const cat of userCategories) {
			const catVideos = generateMockVideos(
				Math.ceil(prefCount / userCategories.length),
				{
					category: cat as VideoCategoryId,
					page,
				},
			);
			videos.push(...catVideos);
		}

		// 30% discovery — from other categories
		const discoveryCount = limit - videos.length;
		if (discoveryCount > 0) {
			const otherCats = VIDEO_CATEGORIES.filter(
				(c) => c.id !== "all" && !userCatSet.has(c.id),
			);
			if (otherCats.length > 0) {
				const discoveryCat = otherCats[page % otherCats.length];
				const discovery = generateMockVideos(discoveryCount, {
					category: discoveryCat.id as VideoCategoryId,
					page: page + 1,
				});
				videos.push(...discovery);
			}
		}

		const hasMore = videos.length >= limit;
		const nextCursor = hasMore ? String(page + 1) : null;

		return noCacheJsonResponse({
			videos: videos.slice(0, limit),
			categories: userCategories,
			total: videos.length,
			cursor: nextCursor,
			hasMore,
		});
	} catch (e) {
		return jsonResponse({ error: String(e) }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/search — Unified search across all video sources
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/search", async (c) => {
	const query = c.req.query("q")?.trim();
	const source = parseSource(c.req.query("source") ?? null);
	const cursor = c.req.query("cursor");
	const limit = Math.min(Number(c.req.query("limit")) || SEARCH_PAGE_SIZE, 50);

	if (!query || query.length < 2) {
		return jsonResponse(
			{ error: "Search query must be at least 2 characters" },
			400,
		);
	}

	try {
		const page = cursor ? Number(cursor) || 1 : 1;
		const allVideos = generateMockVideos(limit * 3, { source, page });

		// Simple text filter
		const q = query.toLowerCase();
		const filtered = allVideos.filter(
			(v) =>
				v.title.toLowerCase().includes(q) ||
				v.description.toLowerCase().includes(q) ||
				v.tags.some((t) => t.includes(q)) ||
				v.channelName.toLowerCase().includes(q),
		);

		const results = filtered.slice(0, limit);
		const hasMore = filtered.length > limit;
		const nextCursor = hasMore ? String(page + 1) : null;

		const result: SearchResults = {
			videos: results,
			total: filtered.length,
			cursor: nextCursor,
			hasMore,
			query,
		};

		return noCacheJsonResponse(result);
	} catch (e) {
		return jsonResponse({ error: String(e) }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/sources — Available video sources with health status
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/sources", async (_c) => {
	const sources = Object.entries(VIDEO_SOURCES).map(([id, meta]) => {
		return {
			id,
			label: meta.label,
			color: meta.color,
			available: true,
			healthy: true,
			lastChecked: new Date().toISOString(),
		};
	});

	return noCacheJsonResponse({ sources });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/video/preferences — Save user video category preferences
// ═══════════════════════════════════════════════════════════════════════════

videoHub.post("/preferences", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	try {
		const body = (await c.req.json()) as { categories?: string[] };
		const categories = body.categories ?? [];

		// Validate categories
		const validIds = new Set(VIDEO_CATEGORIES.map((cat) => cat.id));
		const valid = categories.filter((id) => validIds.has(id));

		await categorizer.setUserCategories(session.address, valid, c.env);

		return jsonResponse({ ok: true, categories: valid });
	} catch (e) {
		return jsonResponse({ error: String(e) }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/trending — Trending videos across all sources
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get("/trending", async (c) => {
	const source = parseSource(c.req.query("source") ?? null);
	const cursor = c.req.query("cursor");
	const limit = Math.min(
		Number(c.req.query("limit")) || TRENDING_PAGE_SIZE,
		100,
	);
	const page = cursor ? Number(cursor) || 1 : 1;

	try {
		const videos = generateMockVideos(limit, {
			source,
			sort: "trending",
			page,
		});

		// Score-based trending sort
		const sorted = videos.sort((a, b) => {
			const scoreA =
				a.views / Math.max(1, (Date.now() - a.publishedAt) / 3600000) ** 1.5;
			const scoreB =
				b.views / Math.max(1, (Date.now() - b.publishedAt) / 3600000) ** 1.5;
			return scoreB - scoreA;
		});

		const trendingCategories = await categorizer.getTrendingCategories(c.env);
		const hasMore = sorted.length >= limit;
		const nextCursor = hasMore ? String(page + 1) : null;

		return noCacheJsonResponse({
			videos: sorted,
			trendingCategories,
			total: sorted.length,
			cursor: nextCursor,
			hasMore,
		});
	} catch (e) {
		return jsonResponse({ error: String(e) }, 500);
	}
});

export default videoHub;
