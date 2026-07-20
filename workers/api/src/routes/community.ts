/**
 * @degenfeed/api-worker — Cross-Protocol Community API
 *
 * Create, read, and join communities that span Lemmy, Nostr, Farcaster,
 * Mastodon, and Bluesky. Community records live in KV under `community:{id}`.
 *
 * Endpoints:
 *   POST /api/community          — Create a community
 *   GET  /api/community/:name    — Get community details
 *   GET  /api/community/:name/feed — Get cross-protocol feed for a community
 *   POST /api/community/:name/join — Join a community
 *   GET  /api/communities        — List all communities
 */

import type { CrossProtocolCommunity } from "@degenfeed/utils";
import {
	COMMUNITY_INDEX_KEY,
	COMMUNITY_KV_PREFIX,
	communityFeedKey,
	communityKey,
	communityMembersKey,
	slugifyCommunity,
} from "@degenfeed/utils";
import type { Env } from "../index";
import { jsonResponse } from "../index";
import type { SessionPayload } from "../session";
import { parseSessionCookie, verifySessionCookie } from "../session";

// ─── Helpers ───────────────────────────────────────────────────────────

async function getSession(
	request: Request,
	env: Env,
): Promise<SessionPayload | null> {
	const secret = env.AUTH_SECRET;
	if (!secret) return null;
	const cookieValue = parseSessionCookie(request.headers.get("cookie"));
	if (!cookieValue) return null;
	try {
		return await verifySessionCookie(cookieValue, secret);
	} catch {
		return null;
	}
}

function validateCommunitySlug(slug: string): string | null {
	if (!/^[a-z0-9][a-z0-9_-]{1,47}$/.test(slug)) return null;
	return slug;
}

// ─── POST /api/community — Create ────────────────────────────────────

export async function handleCommunityCreate(
	request: Request,
	env: Env,
): Promise<Response> {
	// Require authentication
	const session = await getSession(request, env);
	if (!session) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const name = typeof body.name === "string" ? body.name.trim() : "";
	const displayName =
		typeof body.displayName === "string" ? body.displayName.trim() : name;
	const description =
		typeof body.description === "string" ? body.description.trim() : "";

	if (!name || name.length < 2) {
		return jsonResponse({ error: "Name must be at least 2 characters" }, 400);
	}
	if (name.length > 48) {
		return jsonResponse({ error: "Name must be 48 characters or fewer" }, 400);
	}

	const slug = slugifyCommunity(name);
	if (!validateCommunitySlug(slug)) {
		return jsonResponse(
			{ error: "Invalid community name (use letters, numbers, hyphens)" },
			400,
		);
	}

	// Check for duplicate
	const existingKey = communityKey(slug);
	const existing = await env.COMMUNITIES?.get(existingKey).catch(() => null);
	if (existing) {
		return jsonResponse({ error: "Community already exists", slug }, 409);
	}

	// Build protocol configs from body
	const protocols: CrossProtocolCommunity["protocols"] = {};

	if (body.lemmy && typeof body.lemmy === "object") {
		const l = body.lemmy as Record<string, unknown>;
		protocols.lemmy = {
			communityUrl:
				typeof l.communityUrl === "string"
					? l.communityUrl
					: `https://community.degenfeed.xyz/c/${slug}`,
			communityId: typeof l.communityId === "number" ? l.communityId : 0,
			members: typeof l.members === "number" ? l.members : 0,
		};
	}

	if (body.nostr && typeof body.nostr === "object") {
		const n = body.nostr as Record<string, unknown>;
		protocols.nostr = {
			relayUrl:
				typeof n.relayUrl === "string"
					? n.relayUrl
					: "wss://relay.degenfeed.xyz",
			topicTag: typeof n.topicTag === "string" ? n.topicTag : slug,
		};
	}

	if (body.farcaster && typeof body.farcaster === "object") {
		const f = body.farcaster as Record<string, unknown>;
		protocols.farcaster = {
			channelId: typeof f.channelId === "string" ? f.channelId : slug,
			channelUrl:
				typeof f.channelUrl === "string"
					? f.channelUrl
					: `https://warpcast.com/~/channel/${slug}`,
		};
	}

	if (body.mastodon && typeof body.mastodon === "object") {
		const m = body.mastodon as Record<string, unknown>;
		protocols.mastodon = {
			hashtag: typeof m.hashtag === "string" ? m.hashtag : slug,
			groupHandle:
				typeof m.groupHandle === "string" ? m.groupHandle : undefined,
		};
	}

	if (body.bluesky && typeof body.bluesky === "object") {
		const b = body.bluesky as Record<string, unknown>;
		protocols.bluesky = {
			feedUri: typeof b.feedUri === "string" ? b.feedUri : `at://feed/${slug}`,
			feedName: typeof b.feedName === "string" ? b.feedName : displayName,
		};
	}

	if (body.lens && typeof body.lens === "object") {
		const l2 = body.lens as Record<string, unknown>;
		protocols.lens = {
			profileId: typeof l2.profileId === "string" ? l2.profileId : "",
		};
	}

	const community: CrossProtocolCommunity = {
		id: slug,
		name: slug,
		displayName,
		description,
		icon: typeof body.icon === "string" ? body.icon : undefined,
		banner: typeof body.banner === "string" ? body.banner : undefined,
		createdAt: Date.now(),
		creator: {
			walletAddress: session.address.toLowerCase(),
			identities:
				typeof body.identities === "object"
					? (body.identities as Record<string, string>)
					: {},
		},
		protocols,
		memberCount: 1, // The creator
		postCount: 0,
		tags: Array.isArray(body.tags)
			? (body.tags as string[]).filter(
					(t): t is string => typeof t === "string",
				)
			: undefined,
	};

	// Persist to KV
	const kv = env.COMMUNITIES;
	if (!kv) {
		return jsonResponse({ error: "Communities KV not configured" }, 500);
	}

	await Promise.all([
		kv.put(existingKey, JSON.stringify(community)),
		// Add to index
		kv
			.put(COMMUNITY_INDEX_KEY, slug, { metadata: { method: "append" } })
			.catch(() => {}),
		// Seed members list with creator
		kv.put(
			communityMembersKey(slug),
			JSON.stringify([session.address.toLowerCase()]),
		),
		// Initialize empty feed
		kv.put(communityFeedKey(slug), JSON.stringify([])),
	]);

	return jsonResponse({ success: true, community }, 201);
}

// ─── GET /api/community/:name — Get community ────────────────────────

export async function handleCommunityGet(
	_request: Request,
	env: Env,
	name: string,
): Promise<Response> {
	const slug = slugifyCommunity(name);
	const key = communityKey(slug);
	const kv = env.COMMUNITIES;
	if (!kv) return jsonResponse({ error: "KV not configured" }, 500);

	const raw = await kv.get(key).catch(() => null);
	if (!raw) {
		return jsonResponse({ error: "Community not found" }, 404);
	}

	const community = JSON.parse(raw) as CrossProtocolCommunity;
	return jsonResponse({ community });
}

// ─── GET /api/community/:name/feed — Community feed ─────────────────

export async function handleCommunityFeed(
	_request: Request,
	env: Env,
	name: string,
): Promise<Response> {
	const slug = slugifyCommunity(name);
	const feedKey = communityFeedKey(slug);
	const kv = env.COMMUNITIES;
	if (!kv) return jsonResponse({ error: "KV not configured" }, 500);

	// Check community exists
	const communityRaw = await kv.get(communityKey(slug)).catch(() => null);
	if (!communityRaw) {
		return jsonResponse({ error: "Community not found" }, 404);
	}

	// Fetch the feed (array of post references from all protocols)
	const feedRaw = await kv.get(feedKey).catch(() => null);
	const feed: Array<{
		id: string;
		protocol: string;
		text: string;
		author: { displayName: string; handle: string; avatar?: string };
		createdAt: number;
		likes: number;
		replies: number;
	}> = feedRaw ? JSON.parse(feedRaw) : [];

	return jsonResponse({ data: feed, meta: { total: feed.length, name: slug } });
}

// ─── POST /api/community/:name/join — Join community ────────────────

export async function handleCommunityJoin(
	request: Request,
	env: Env,
	name: string,
): Promise<Response> {
	const session = await getSession(request, env);
	if (!session) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	const slug = slugifyCommunity(name);
	const kv = env.COMMUNITIES;
	if (!kv) return jsonResponse({ error: "KV not configured" }, 500);

	// Check community exists
	const communityRaw = await kv.get(communityKey(slug)).catch(() => null);
	if (!communityRaw) {
		return jsonResponse({ error: "Community not found" }, 404);
	}

	const community = JSON.parse(communityRaw) as CrossProtocolCommunity;
	const wallet = session.address.toLowerCase();

	// Read current members
	const membersRaw = await kv.get(communityMembersKey(slug)).catch(() => null);
	const members: string[] = membersRaw ? JSON.parse(membersRaw) : [];

	if (members.includes(wallet)) {
		return jsonResponse({ error: "Already a member", slug });
	}

	members.push(wallet);
	community.memberCount = members.length;

	// Persist
	await Promise.all([
		kv.put(communityMembersKey(slug), JSON.stringify(members)),
		kv.put(communityKey(slug), JSON.stringify(community)),
	]);

	return jsonResponse({ success: true, memberCount: community.memberCount });
}

// ─── GET /api/communities — List all communities ─────────────────────

export async function handleCommunitiesList(
	_request: Request,
	env: Env,
): Promise<Response> {
	const kv = env.COMMUNITIES;
	if (!kv) return jsonResponse({ error: "KV not configured" }, 500);

	// List all keys with the community: prefix
	const communities: CrossProtocolCommunity[] = [];

	// We use KV list to enumerate communities
	const prefix = COMMUNITY_KV_PREFIX;
	try {
		let cursor: string | undefined;
		do {
			const list = await kv.list({ prefix, cursor, limit: 100 });
			const values = await Promise.all(
				list.keys.map(async (key) => {
					const raw = await kv.get(key.name).catch(() => null);
					if (!raw) return null;
					try {
						return JSON.parse(raw) as CrossProtocolCommunity;
					} catch {
						return null;
					}
				}),
			);
			for (const v of values) {
				if (v) communities.push(v);
			}
			cursor = list.list_complete ? undefined : list.cursor;
		} while (cursor);
	} catch {
		// Fallback: try the index key
		try {
			const raw = await kv.get(COMMUNITY_INDEX_KEY).catch(() => null);
			if (raw) {
				const slugs = JSON.parse(raw) as string[];
				const values = await Promise.all(
					slugs.map(async (slug) => {
						const raw2 = await kv.get(communityKey(slug)).catch(() => null);
						if (!raw2) return null;
						try {
							return JSON.parse(raw2) as CrossProtocolCommunity;
						} catch {
							return null;
						}
					}),
				);
				for (const v of values) {
					if (v) communities.push(v);
				}
			}
		} catch {
			/* return what we have */
		}
	}

	communities.sort((a, b) => b.memberCount - a.memberCount);

	return jsonResponse({
		data: communities,
		meta: { total: communities.length },
	});
}
