/**
 * @degenfeed/api-worker — Video Aggregator Routes
 *
 * "Follow creators, not platforms" — API endpoints for the intelligent
 * cross-platform video aggregator. Users follow creators ONCE and get
 * content from every platform that creator is on.
 *
 * Routes:
 *   GET    /api/video/aggregator/creator/:id    — All videos from a creator (all platforms)
 *   GET    /api/video/aggregator/trending/:category — Trending in category (all platforms)
 *   GET    /api/video/aggregator/feed           — Personalized feed (follows across platforms)
 *   GET    /api/video/aggregator/search         — Search across all video platforms
 *   POST   /api/video/aggregator/follow         — Follow creator across all platforms
 *
 * KV schema:
 *   video:agg:creator:{id}:{limit}    → UnifiedVideo[]
 *   video:agg:trending:{cat}:{limit}  → UnifiedVideo[]
 *   video:agg:feed:{wallet}:{limit}   → UnifiedVideo[]
 *   video:agg:search:{q}:{limit}      → UnifiedVideo[]
 *   follow:{wallet}                   → string[] (creator IDs)
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import { requireSession } from "../session";
import { VideoAggregator } from "../feed/video-aggregator";
import { CreatorResolver } from "../lib/creator-resolver";
import type { VideoPlatform } from "../lib/creator-resolver";

// ─── Badge colors for all supported platforms ──────────────────────────────

export const PLATFORM_BADGES: Record<string, { label: string; color: string }> = {
	youtube: { label: "YouTube", color: "#FF0000" },
	twitch: { label: "Twitch", color: "#9146FF" },
	rumble: { label: "Rumble", color: "#85C742" },
	peertube: { label: "PeerTube", color: "#F1680D" },
	tiktok: { label: "TikTok", color: "#010101" },
	instagram: { label: "Instagram", color: "#E1306C" },
	odysee: { label: "Odysee", color: "#FF6A00" },
	zora: { label: "Zora", color: "#0052FF" },
};

// ─── Router ────────────────────────────────────────────────────────────────

const videoAggregator = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/creator/:id — All videos from a creator
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/creator/:id", async (c) => {
	const creatorId = c.req.param("id");
	const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
	const sort = (c.req.query("sort") || "recent") as "recent" | "trending" | "popular";

	if (!creatorId || creatorId.length < 2) {
		return jsonResponse({ error: "Invalid creator identifier" }, 400);
	}

	try {
		const aggregator = new VideoAggregator(c.env);

		// First resolve the creator to find all platform IDs
		const resolver = new CreatorResolver(c.env);
		const creator = await resolver.resolveCreator(creatorId);

		// Fetch videos from all resolved platforms
		const allVideos = await aggregator.getCreatorVideos(creatorId, { limit, sort });

		return noCacheJsonResponse({
			creator: {
				name: creator.name,
				avatar: creator.avatar,
				platforms: creator.platforms,
				unifiedFollowerCount: creator.unifiedFollowerCount,
			},
			videos: allVideos,
			total: allVideos.length,
			sourceBreakdown: countByPlatform(allVideos),
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to fetch creator videos: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/trending/:category — Trending in category
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/trending/:category", async (c) => {
	const category = c.req.param("category") || "all";
	const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
	const platformFilter = c.req.query("platforms");

	const platforms: VideoPlatform[] | undefined = platformFilter
		? (platformFilter.split(",") as VideoPlatform[])
		: undefined;

	try {
		const aggregator = new VideoAggregator(c.env);
		const videos = await aggregator.getTrendingVideos(category, {
			limit,
			platforms,
		});

		const feed = await aggregator.buildFeed(videos, { limit });

		return noCacheJsonResponse({
			category,
			...feed,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to fetch trending: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/feed — Personalized feed
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/feed", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const wallet = session.address?.toLowerCase();
	if (!wallet) {
		return jsonResponse({ error: "Wallet required for personalized feed" }, 401);
	}

	const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
	const sort = (c.req.query("sort") || "recent") as "recent" | "trending" | "popular";

	try {
		const aggregator = new VideoAggregator(c.env);
		const videos = await aggregator.getPersonalizedFeed(wallet, { limit, sort });
		const feed = await aggregator.buildFeed(videos, { limit });

		return noCacheJsonResponse(feed);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to fetch feed: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/search — Search across all platforms
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/search", async (c) => {
	const query = c.req.query("q")?.trim();
	if (!query || query.length < 2) {
		return jsonResponse({ error: "Search query is required (min 2 chars)" }, 400);
	}

	const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);

	try {
		const aggregator = new VideoAggregator(c.env);
		const videos = await aggregator.searchVideos(query, { limit });
		const feed = await aggregator.buildFeed(videos, { limit });

		return noCacheJsonResponse({
			query,
			...feed,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Search failed: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/video/aggregator/follow — Follow creator across all platforms
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.post("/follow", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const wallet = session.address?.toLowerCase();
	if (!wallet) {
		return jsonResponse({ error: "Wallet required" }, 401);
	}

	try {
		const body = (await c.req.json()) as {
			creatorId: string;
			name?: string;
			platforms?: string[];
		};
		const creatorId = body.creatorId?.trim();
		if (!creatorId || creatorId.length < 2) {
			return jsonResponse({ error: "creatorId is required" }, 400);
		}

		// Resolve creator to verify they exist
		const resolver = new CreatorResolver(c.env);
		const creator = await resolver.resolveCreator(creatorId);

		// Store in follows KV list
		const followKey = `follow:${wallet}`;
		const existingRaw = await c.env.CACHE?.get(followKey);
		const existing: string[] = existingRaw ? (JSON.parse(existingRaw) as string[]) : [];

		if (!existing.includes(creatorId)) {
			existing.push(creatorId);
			await c.env.CACHE?.put(followKey, JSON.stringify(existing), {
				expirationTtl: 86400 * 365, // 1 year
			});
		}

		// Store creator presence in cache for quick resolution
		const resolveKey = `creator:resolve:${creatorId.toLowerCase()}`;
		await c.env.CACHE?.put(resolveKey, JSON.stringify(creator), {
			expirationTtl: 86400,
		});

		return noCacheJsonResponse({
			ok: true,
			creator: {
				name: creator.name,
				platformsFound: creator.platforms.length,
				platforms: creator.platforms.map((p) => ({
					platform: p.platform,
					channelName: p.channelName,
					url: p.url,
					followerCount: p.followerCount,
				})),
			},
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to follow creator: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/following — List followed creators
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/following", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const wallet = session.address?.toLowerCase();
	if (!wallet) {
		return jsonResponse({ error: "Wallet required" }, 401);
	}

	try {
		const followKey = `follow:${wallet}`;
		const raw = await c.env.CACHE?.get(followKey);
		const creatorIds: string[] = raw ? (JSON.parse(raw) as string[]) : [];

		// Resolve each followed creator's current presence
		const resolver = new CreatorResolver(c.env);
		const creators = await Promise.all(
			creatorIds.map(async (id) => {
				try {
					const presence = await resolver.resolveCreator(id);
					return {
						identifier: id,
						name: presence.name,
						avatar: presence.avatar,
						platforms: presence.platforms.length,
						unifiedFollowerCount: presence.unifiedFollowerCount,
					};
				} catch {
					return { identifier: id, name: id, avatar: "", platforms: 0, unifiedFollowerCount: 0 };
				}
			}),
		);

		return noCacheJsonResponse({ creators, total: creators.length });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to list follows: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/resolve/:id — Resolve a creator
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/resolve/:id", async (c) => {
	const creatorId = c.req.param("id");
	if (!creatorId || creatorId.length < 2) {
		return jsonResponse({ error: "Invalid creator identifier" }, 400);
	}

	try {
		const resolver = new CreatorResolver(c.env);
		const creator = await resolver.resolveCreator(creatorId);

		return noCacheJsonResponse({
			creator: {
				name: creator.name,
				avatar: creator.avatar,
				bio: creator.bio,
				degenfeedHandle: creator.degenfeedHandle,
				wallet: creator.wallet,
				unifiedFollowerCount: creator.unifiedFollowerCount,
				platforms: creator.platforms.map((p) => ({
					platform: p.platform,
					channelName: p.channelName,
					followerCount: p.followerCount,
					isLive: p.isLive,
					verified: p.verified,
					url: p.url,
					badge: PLATFORM_BADGES[p.platform] ?? { label: p.platform, color: "#666" },
				})),
			},
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to resolve creator: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/aggregator/badges — Get platform badge definitions
// ═══════════════════════════════════════════════════════════════════════════

videoAggregator.get("/badges", (_c) => {
	return noCacheJsonResponse({ badges: PLATFORM_BADGES });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function countByPlatform(videos: Array<{ platform: string }>): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const v of videos) {
		counts[v.platform] = (counts[v.platform] ?? 0) + 1;
	}
	return counts;
}

// ─── Export ────────────────────────────────────────────────────────────────

export { videoAggregator };
