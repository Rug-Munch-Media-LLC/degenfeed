/**
 * @degenfeed/api-worker — Bluesky Feed Generator Endpoint
 *
 * Implements the AT Protocol feed generator endpoints needed for
 * the "DegenFeed Live" custom feed (did:web:live.degenfeed.xyz).
 *
 * Routes:
 *   GET  /.well-known/did.json                        — Feed generator DID document
 *   GET  /api/bsky-feed/xrpc/app.bsky.feed.describeFeedGenerator  — Feed metadata
 *   GET  /api/bsky-feed/xrpc/app.bsky.feed.getFeedSkeleton       — Live feed data
 *
 * AT Protocol Spec:
 *   https://atproto.com/guides/feed-generators
 *
 * The feed generator must be registered with Bluesky via:
 *   https://bsky.app/feed
 *   or programmatically via com.atproto.repo.putRecord
 */

import {
	buildFeedGeneratorDidDoc,
	describeFeedGenerator,
	FEED_GENERATOR_HANDLE,
	LiveFeedGenerator,
} from "@degenfeed/bluesky-sdk/feed-generator";
import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";

// ─── Router ───────────────────────────────────────────────────────────────

const feedGen = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════
// GET /.well-known/did.json — Feed Generator DID Document
//
// This tells the AT Protocol where to find our feed generator's
// service endpoint. Required for feed generator discovery.
// ═══════════════════════════════════════════════════════════════════════

feedGen.get("/.well-known/did.json", async (c) => {
	const didDoc = buildFeedGeneratorDidDoc();

	return new Response(JSON.stringify(didDoc), {
		headers: {
			"content-type": "application/json",
			"access-control-allow-origin": "*",
			"cache-control": "public, max-age=86400",
		},
	});
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/bsky-feed/xrpc/app.bsky.feed.describeFeedGenerator
//
// Returns metadata about our feed generator: its DID, display name,
// and the feeds it provides.
// ═══════════════════════════════════════════════════════════════════════

feedGen.get(
	"/api/bsky-feed/xrpc/app.bsky.feed.describeFeedGenerator",
	async (c) => {
		const description = describeFeedGenerator();

		// The AT Protocol expects feeds array — we provide one feed
		const response = {
			did: description.did,
			feeds: [
				{
					uri: `at://${FEED_GENERATOR_HANDLE}/app.bsky.feed.generator/degenfeed-live`,
					name: description.displayName,
					description: description.description,
				},
			],
			links: {
				privacyPolicy: "https://degenfeed.xyz/privacy",
				termsOfService: "https://degenfeed.xyz/terms",
			},
		};

		return noCacheJsonResponse(response);
	},
);

// ═══════════════════════════════════════════════════════════════════════
// GET /api/bsky-feed/xrpc/app.bsky.feed.getFeedSkeleton
//
// Returns the actual feed content — live stream announcement posts.
//
// Parameters (from Bluesky):
//   feed  — at:// URI identifying which feed (we only have one)
//   limit — max items to return (default 50, max 100)
//   cursor — pagination cursor
// ═══════════════════════════════════════════════════════════════════════

feedGen.get("/api/bsky-feed/xrpc/app.bsky.feed.getFeedSkeleton", async (c) => {
	try {
		const feedUri = c.req.query("feed") ?? "";
		const limitParam = c.req.query("limit");
		const cursor = c.req.query("cursor");

		// Validate that the requested feed is ours
		const expectedFeed = `at://${FEED_GENERATOR_HANDLE}/app.bsky.feed.generator/degenfeed-live`;
		if (feedUri && feedUri !== expectedFeed) {
			return jsonResponse(
				{
					error: "Unknown feed",
					message: `This feed generator only serves "${expectedFeed}"`,
				},
				400,
			);
		}

		const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100);

		// Get the live feed skeleton
		const liveFeed = new LiveFeedGenerator({
			get: async (key: string) => {
				try {
					return (await c.env.CONTENT_STORE?.get(key)) ?? null;
				} catch {
					return null;
				}
			},
			put: async (key: string, value: string) => {
				await c.env.CONTENT_STORE?.put(key, value, {
					expirationTtl: 86400 * 7,
				}).catch(() => {});
			},
			delete: async (key: string) => {
				await c.env.CONTENT_STORE?.delete(key).catch(() => {});
			},
		});

		const skeleton = await liveFeed.getFeedSkeleton(limit, cursor);

		return noCacheJsonResponse(skeleton);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return jsonResponse({ error: `Feed skeleton failed: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/bsky-feed/health — Feed generator health check
// ═══════════════════════════════════════════════════════════════════════

feedGen.get("/api/bsky-feed/health", async (c) => {
	return noCacheJsonResponse({
		ok: true,
		did: describeFeedGenerator().did,
		feeds: [
			`at://${FEED_GENERATOR_HANDLE}/app.bsky.feed.generator/degenfeed-live`,
		],
		updatedAt: new Date().toISOString(),
	});
});

export default feedGen;
