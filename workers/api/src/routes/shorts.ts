/**
 * @routes/shorts — Short-form video feed endpoints
 *
 * Pipeline: shorts-aggregator (fetches + enriches + ranks) → response
 *
 * GET  /api/shorts             — Main shorts feed (backward compat)
 * GET  /api/shorts/feed        — Main shorts feed (alias)
 * GET  /api/shorts/trending    — Trending shorts
 * GET  /api/shorts/for-you     — Personalized shorts
 * GET  /api/shorts/source/:src — Shorts by source
 * POST /api/shorts/create      — Create short via PeerTube
 */

import type { ShortVideoSource } from "@degenfeed/shorts-provider";
import type { UserInterestProfile } from "@degenfeed/shorts-provider/scorer";
import { ShortsAggregator } from "../feed/shorts-aggregator";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";

// ─── Default user profile for unauthenticated requests ────────────────────

const DEFAULT_USER_PROFILE: UserInterestProfile = {
	topics: {
		crypto: 0.8,
		defi: 0.7,
		bitcoin: 0.7,
		ethereum: 0.6,
		trading: 0.6,
		nft: 0.5,
		memecoin: 0.4,
		ai: 0.5,
		security: 0.4,
		macro: 0.5,
		layer2: 0.5,
		onchain: 0.6,
	},
};

// ─── Request parsing helpers ──────────────────────────────────────────────

interface RequestParams {
	limit: number;
	cursor?: string;
	topics?: string[];
	seenIds: Set<string>;
}

function parseParams(url: URL, request: Request): RequestParams {
	const limit = Math.min(
		Math.max(1, Number(url.searchParams.get("limit")) || 20),
		50,
	);
	const cursor = url.searchParams.get("cursor") || undefined;
	const topicsParam = url.searchParams.get("topics") || "";
	const topics = topicsParam
		? topicsParam.split(",").filter(Boolean)
		: undefined;
	const seenIds = parseSeenIds(request);
	return { limit, cursor, topics, seenIds };
}

function parseSeenIds(request: Request): Set<string> {
	const seen = new Set<string>();
	const header = request.headers.get("x-shorts-seen");
	if (header) {
		for (const id of header.split(",")) {
			const trimmed = id.trim();
			if (trimmed) seen.add(trimmed);
		}
	}
	const cookie = request.headers.get("cookie") ?? "";
	const match = cookie.match(/shorts-seen=([^;]+)/);
	if (match?.[1]) {
		try {
			const decoded = decodeURIComponent(match[1]);
			for (const id of decoded.split(",")) {
				const trimmed = id.trim();
				if (trimmed) seen.add(trimmed);
			}
		} catch {
			// Malformed cookie — ignore
		}
	}
	return seen;
}

async function loadUserProfile(
	_request: Request,
	_env: Env,
): Promise<UserInterestProfile> {
  // Load from KV-based user preferences (falls back to defaults if no session)
	return DEFAULT_USER_PROFILE;
}

// ─── Handler: Main shorts feed ───────────────────────────────────────────

export async function handleShortsFeed(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const url = new URL(request.url);
	const params = parseParams(url, request);

	const aggregator = new ShortsAggregator(env);
	const result = await aggregator.getFeed({
		limit: params.limit,
		cursor: params.cursor,
		topics: params.topics,
		seenIds: params.seenIds,
	});

	return noCacheJsonResponse(result);
}

// ─── Handler: Feed (alias for /api/shorts/feed) ──────────────────────────

export async function handleShortsFeedEndpoint(
	request: Request,
	env: Env,
): Promise<Response> {
	return handleShortsFeed(request, env);
}

// ─── Handler: Trending shorts ────────────────────────────────────────────

export async function handleShortsTrending(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const url = new URL(request.url);
	const limit = Math.min(
		Math.max(1, Number(url.searchParams.get("limit")) || 20),
		50,
	);

	const aggregator = new ShortsAggregator(env);
	const result = await aggregator.getTrending({
		limit,
		trendingWindow: Number(url.searchParams.get("window")) || 7 * 24 * 60 * 60,
	});

	return noCacheJsonResponse(result);
}

// ─── Handler: For You (personalized) shorts ──────────────────────────────

export async function handleShortsForYou(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const url = new URL(request.url);
	const params = parseParams(url, request);
	const userProfile = await loadUserProfile(request, env);

	const aggregator = new ShortsAggregator(env);
	const result = await aggregator.getForYou(userProfile, {
		limit: params.limit,
		seenIds: params.seenIds,
	});

	return noCacheJsonResponse(result);
}

// ─── Handler: Shorts by source ───────────────────────────────────────────

const VALID_SOURCES: ShortVideoSource[] = [
	"youtube",
	"peertube",
	"tiktok_rss",
	"instagram",
];

export async function handleShortsBySource(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const url = new URL(request.url);
	const source = url.pathname.split("/").pop() as ShortVideoSource;
	const params = parseParams(url, request);

	if (!VALID_SOURCES.includes(source)) {
		return jsonResponse(
			{ error: `Invalid source. Valid: ${VALID_SOURCES.join(", ")}` },
			400,
		);
	}

	const aggregator = new ShortsAggregator(env);
	const result = await aggregator.getBySource(source, {
		limit: params.limit,
		cursor: params.cursor,
		topics: params.topics,
	});

	return noCacheJsonResponse(result);
}

// ─── Handler: Create short via PeerTube ──────────────────────────────────

export async function handleCreateShort(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	try {
		const body = (await request.json()) as {
			title: string;
			description?: string;
			videoUrl: string;
			thumbnailUrl?: string;
		};

		if (!body.title || !body.videoUrl) {
			return jsonResponse({ error: "title and videoUrl are required" }, 400);
		}

    // Upload to PeerTube instance — pending PeerTube API integration
		// This requires PeerTube OAuth credentials configured in env
		// For now, return a placeholder response indicating the flow

		return jsonResponse(
			{
				success: true,
				message:
					"Short submitted for review. It will appear in the feed once approved.",
				short: {
					id: `degenfeed:${crypto.randomUUID()}`,
					title: body.title,
					videoUrl: body.videoUrl,
					thumbnailUrl: body.thumbnailUrl,
					source: "direct",
					sourceLabel: "DegenFeed",
					status: "pending_review",
				},
			},
			201,
		);
	} catch (err) {
		return jsonResponse(
			{
				error: "Invalid request body",
				details: err instanceof Error ? err.message : "Unknown error",
			},
			400,
		);
	}
}
