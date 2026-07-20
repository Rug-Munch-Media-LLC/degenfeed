/**
 * /api/feed/post/[id] — Fetch a single post by ID.
 *
 * Searches all enabled providers for the post. Returns the first match.
 * Cached for 5 minutes in KV.
 */

import { enrichPostNiches, isSpamPost } from "@degenfeed/feed-core";
import {
	BlueskyProvider,
	FarcasterProvider,
	LensProvider,
	MastodonProvider,
	NostrProvider,
	RedditProvider,
	RmiDataBusProvider,
	RssProvider,
	ThreadsProvider,
} from "@degenfeed/feed-providers";
import type { Protocol, UnifiedPost } from "@degenfeed/types";
import { rmiUrl } from "@degenfeed/utils";
import { type Env, jsonResponse } from "../index";

function providerFor(protocol: Protocol, env: Env) {
	switch (protocol) {
		case "rss":
			return new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
		case "reddit":
			return new RedditProvider();
		case "nostr":
			return new NostrProvider({
				relays: (env.RELAY_URLS ?? "").split(",").filter(Boolean),
			});
		case "farcaster":
			return new FarcasterProvider({ hubUrl: env.FARCASTER_HUB_URL });
		case "lens":
			return new LensProvider({ apiUrl: env.LENS_API_URL });
		case "bluesky":
			return new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
		case "mastodon":
			return new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
		case "threads":
			return new ThreadsProvider();
		default:
			return null;
	}
}

const ALL_PROTOCOLS: Protocol[] = [
	"rss",
	"reddit",
	"nostr",
	"farcaster",
	"lens",
	"bluesky",
	"mastodon",
];

export async function handlePostById(
	_request: Request,
	env: Env,
	postId: string,
): Promise<Response> {
	const decoded = decodeURIComponent(postId);
	const cacheKey = `post:v1:${decoded}`;
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}
	// Try the feed-level post KV store first (populated by handleHomeFeed).
	try {
		const stored = await env.CACHE?.get(`post:${decoded}`);
		if (stored) {
			const post = JSON.parse(stored) as UnifiedPost;
			const response = { data: post };
			try {
				await env.CACHE?.put(cacheKey, JSON.stringify(response), {
					expirationTtl: 300,
				});
			} catch {
				/* ignore */
			}
			return jsonResponse(response);
		}
	} catch {
		/* ignore */
	}

	for (const protocol of ALL_PROTOCOLS) {
		const provider = providerFor(protocol, env);
		if (!provider) continue;
		try {
			const result = await Promise.race([
				provider.fetchFeed({ timeoutMs: 4000 }),
				new Promise<{ posts: UnifiedPost[] }>((resolve) =>
					setTimeout(() => resolve({ posts: [] }), 4000),
				),
			]);
			if (!result?.posts) continue;
			const found = result.posts.find((p) => p.id === decoded);
			if (found && !isSpamPost(found)) {
				const enriched = enrichPostNiches(found);
				const response = { data: enriched };
				try {
					await env.CACHE?.put(cacheKey, JSON.stringify(response), {
						expirationTtl: 300,
					});
				} catch {
					/* ignore */
				}
				return jsonResponse(response);
			}
		} catch {
			/* try next protocol */
		}
	}

	try {
		const rss = new RssProvider({
			feeds: ["https://cointelegraph.com/rss", "https://decrypt.co/feed"],
		});
		const r = await rss.fetchFeed({ timeoutMs: 4000 });
		const found = r.posts.find((p) => p.id === decoded);
		if (found && !isSpamPost(found)) {
			const enriched = enrichPostNiches(found);
			const response = { data: enriched };
			try {
				await env.CACHE?.put(cacheKey, JSON.stringify(response), {
					expirationTtl: 300,
				});
			} catch {
				/* ignore */
			}
			return jsonResponse(response);
		}
	} catch {
		/* ignore */
	}

	return jsonResponse({ error: "Post not found", id: decoded }, 404);
}
