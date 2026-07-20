/**
 * @degenfeed/api-worker — Discovery Engine
 *
 * Multi-endpoint discovery: trending, communities, people, topics, featured, new.
 * All endpoints cache in KV for 5 minutes (300s).
 *
 * Endpoints:
 *   GET /api/discover                — Legacy: Mastodon directory proxy
 *   GET /api/discover/trending       — Top posts by engagement velocity
 *   GET /api/discover/communities    — Suggested cross-protocol communities
 *   GET /api/discover/people         — People to follow by engagement
 *   GET /api/discover/topics         — Trending niche/topic aggregates
 *   GET /api/discover/featured       — Live spaces + trending topics
 *   GET /api/discover/new            — Recently created communities & active people
 */

import type { TrendingTopic } from "@degenfeed/feed-core";
import { isSpamPost } from "@degenfeed/feed-core";
import type { UnifiedPost } from "@degenfeed/types";
import {
	COMMUNITY_KV_PREFIX,
	type CrossProtocolCommunity,
} from "@degenfeed/utils";
import { type Env, jsonResponse } from "../index";
import { isValidInstanceUrl } from "../sanitize";

// ─── Types ────────────────────────────────────────────────────────────────

interface DiscoverPerson {
	id: string;
	displayName: string;
	handle: string;
	avatarUrl: string;
	protocol: string;
	protocols: string[];
	postCount: number;
	totalEngagement: number;
	topNiches: string[];
}

interface DiscoverCommunity {
	id: string;
	name: string;
	displayName?: string;
	description?: string;
	icon?: string;
	memberCount: number;
	postCount: number;
	protocols: string[];
	tags?: string[];
	activityLevel: "high" | "medium" | "low";
}

interface FeaturedSpace {
	id: string;
	title: string;
	description?: string;
	hostName: string;
	hostAvatarUrl?: string;
	status: "live" | "scheduled" | "ended";
	listeners: number;
	speakers: Array<{ id: string; displayName: string; avatarUrl?: string }>;
	scheduledAt?: string;
}

import { liveIndexKey, spaceKey, upcomingIndexKey } from "../kv-helpers";

// ─── Feed helpers ══════════════════════════════════════════════════════

/**
 * Fetch recent posts from the home feed pipeline.
 */
async function fetchRecentPosts(
	_env: Env,
	limit = 100,
): Promise<UnifiedPost[]> {
	try {
		const feedReq = new Request(
			`http://localhost/api/feed/home?limit=${limit}&sort=hot&protocols=nostr,farcaster,lens,bluesky,mastodon,threads,reddit,rss`,
		);
		const feedRes = await fetch(feedReq);
		if (!feedRes.ok) return [];
		const body = (await feedRes.json()) as { data?: UnifiedPost[] };
		return body.data ?? [];
	} catch {
		return [];
	}
}

// ─── Legacy: Mastodon directory proxy ─────────────────────────────────

export async function handleDiscover(
	request: Request,
	_env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const instance =
		url.searchParams.get("instance") || "https://bitcoinhackers.org";
	if (!isValidInstanceUrl(instance))
		return jsonResponse({ error: "Invalid instance URL" }, 400);
	const limit = 20;

	try {
		const res = await fetch(
			`${instance}/api/v1/directory?limit=${limit}&order=active&local=true`,
			{
				headers: { "user-agent": "DegenFeed/0.1 (+https://degenfeed.xyz)" },
			},
		);
		if (!res.ok) return jsonResponse({ error: "Instance unavailable" }, 502);
		const data = (await res.json()) as Array<{
			id: string;
			username: string;
			acct: string;
			display_name: string;
			avatar: string;
			note: string;
			followers_count: number;
		}>;
		const result = data.map((a) => ({
			...a,
			instance: new URL(instance).hostname,
		}));
		return jsonResponse(result);
	} catch {
		return jsonResponse({ error: "Discovery failed" }, 500);
	}
}

// ─── GET /api/discover/trending ───────────────────────────────────────

export async function handleDiscoverTrending(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const period = url.searchParams.get("period") || "hour";
	const cacheKey = `discover:trending:${period}`;

	// Try cache
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	const windowHours = period === "week" ? 168 : period === "day" ? 24 : 1;
	const now = Date.now();
	const cutoff = now - windowHours * 3600000;

	const posts = await fetchRecentPosts(env, 200);
	const scored = posts
		.filter((p) => p.createdAt >= cutoff && !isSpamPost(p))
		.map((p) => {
			const ageHours = Math.max(0.1, (now - p.createdAt) / 3600000);
			const engagement =
				p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3;
			const velocity = engagement / ageHours;
			return { post: p, velocity };
		})
		.sort((a, b) => b.velocity - a.velocity)
		.slice(0, 50);

	const response = {
		data: scored.map((s) => s.post),
		meta: { total: scored.length, period, fetchedAt: now },
	};

	try {
		await env.CACHE?.put(cacheKey, JSON.stringify(response), {
			expirationTtl: 300,
		});
	} catch {
		/* ignore */
	}

	return jsonResponse(response);
}

// ─── GET /api/discover/communities ────────────────────────────────────

export async function handleDiscoverCommunities(
	_request: Request,
	env: Env,
): Promise<Response> {
	const cacheKey = "discover:communities:v1";

	// Try cache
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	const communities: DiscoverCommunity[] = [];

	// 1. Cross-protocol communities from KV
	const kv = env.COMMUNITIES;
	if (kv) {
		try {
			let cursor: string | undefined;
			do {
				const list = await kv.list({
					prefix: COMMUNITY_KV_PREFIX,
					cursor,
					limit: 100,
				});
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
					if (v) {
						const protoKeys = Object.keys(v.protocols).filter(
							(k) => v.protocols[k as keyof typeof v.protocols] !== undefined,
						);
						const activityLevel: DiscoverCommunity["activityLevel"] =
							v.postCount > 100 ? "high" : v.postCount > 10 ? "medium" : "low";
						communities.push({
							id: v.id,
							name: v.name,
							displayName: v.displayName,
							description: v.description,
							icon: v.icon,
							memberCount: v.memberCount,
							postCount: v.postCount,
							protocols: protoKeys,
							tags: v.tags,
							activityLevel,
						});
					}
				}
				cursor = list.list_complete ? undefined : list.cursor;
			} while (cursor);
		} catch {
			/* partial results ok */
		}
	}

	// 2. Reddit subreddits (from feed-providers)
	try {
		const { DEFAULT_SUBREDDITS } = await import("@degenfeed/feed-providers");
		const seenNames = new Set(communities.map((c) => c.name.toLowerCase()));
		for (const sub of DEFAULT_SUBREDDITS.slice(0, 20)) {
			const name = `r/${sub}`;
			if (seenNames.has(name.toLowerCase())) continue;
			seenNames.add(name.toLowerCase());
			communities.push({
				id: `reddit:r/${sub}`,
				name,
				displayName: name,
				description: `Reddit community for ${sub}`,
				memberCount: 0,
				postCount: 0,
				protocols: ["reddit"],
				activityLevel: "medium",
			});
		}
	} catch {
		/* ignore */
	}

	// 3. Lemmy communities from feed data
	try {
		const { LemmyProvider } = await import("@degenfeed/feed-providers");
		const lemmy = new LemmyProvider();
		const result = await lemmy.fetchFeed({ timeoutMs: 5000 });
		const seenNames = new Set(communities.map((c) => c.name.toLowerCase()));
		for (const post of result.posts) {
			const community = post.text.match(/\[(.+?)\]/)?.[1];
			if (community && !seenNames.has(community.toLowerCase())) {
				seenNames.add(community.toLowerCase());
				communities.push({
					id: `lemmy:${community.toLowerCase().replace(/\s+/g, "")}`,
					name: community,
					displayName: community,
					description: `Lemmy community: ${community}`,
					memberCount: 0,
					postCount: 1,
					protocols: ["lemmy"],
					activityLevel: "low",
				});
			}
		}
	} catch {
		/* ignore */
	}

	communities.sort((a, b) => b.memberCount - a.memberCount);

	const response = {
		data: communities.slice(0, 50),
		meta: { total: communities.length },
	};

	try {
		await env.CACHE?.put(cacheKey, JSON.stringify(response), {
			expirationTtl: 300,
		});
	} catch {
		/* ignore */
	}

	return jsonResponse(response);
}

// ─── GET /api/discover/people ─────────────────────────────────────────

export async function handleDiscoverPeople(
	_request: Request,
	env: Env,
): Promise<Response> {
	const cacheKey = "discover:people:v1";

	// Try cache
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	try {
		const posts = await fetchRecentPosts(env, 200);
		if (!posts?.length)
			return jsonResponse({
				data: [],
				meta: { total: 0, fetchedAt: Date.now() },
			});

		const authorStats = new Map<
			string,
			{
				author: DiscoverPerson;
				postCount: number;
				totalEngagement: number;
				protocols: Set<string>;
				niches: Set<string>;
			}
		>();

		for (const p of posts) {
			if (isSpamPost(p)) continue;
			const key = p.author.id;
			const existing = authorStats.get(key);
			const eng =
				p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3;

			if (existing) {
				existing.postCount++;
				existing.totalEngagement += eng;
				existing.protocols.add(p.protocol);
				for (const n of p.niches) existing.niches.add(n);
			} else {
				authorStats.set(key, {
					author: {
						id: p.author.id,
						displayName: p.author.displayName,
						handle:
							Object.values(p.author.handles).find(Boolean) ||
							p.author.id.slice(0, 12),
						avatarUrl: p.author.avatarUrl,
						protocol: p.protocol,
						protocols: [p.protocol],
						postCount: 1,
						totalEngagement: eng,
						topNiches: [],
					},
					postCount: 1,
					totalEngagement: eng,
					protocols: new Set([p.protocol]),
					niches: new Set(p.niches),
				});
			}
		}

		const people = Array.from(authorStats.values())
			.filter((a) => a.postCount >= 2)
			.sort((a, b) => b.totalEngagement - a.totalEngagement)
			.slice(0, 30)
			.map((a) => ({
				...a.author,
				protocols: [...a.protocols],
				topNiches: [...a.niches].slice(0, 5),
			}));

		const response = {
			data: people,
			meta: { total: people.length, fetchedAt: Date.now() },
		};

		try {
			await env.CACHE?.put(cacheKey, JSON.stringify(response), {
				expirationTtl: 300,
			});
		} catch {
			/* ignore */
		}

		return jsonResponse(response);
	} catch {
		return jsonResponse({ error: "Discovery unavailable" }, 502);
	}
}

// ─── GET /api/discover/topics ─────────────────────────────────────────

export async function handleDiscoverTopics(
	_request: Request,
	env: Env,
): Promise<Response> {
	const cacheKey = "discover:topics:v1";

	// Try cache
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	const posts = await fetchRecentPosts(env, 200);
	const now = Date.now();
	const cutoff = now - 24 * 3600000; // last 24h

	// Aggregate niches from recent posts
	const nicheMap = new Map<string, { count: number; score: number }>();

	for (const post of posts) {
		if (post.createdAt < cutoff || isSpamPost(post)) continue;
		const engagement =
			post.metrics.likes + post.metrics.reposts * 2 + post.metrics.replies * 3;
		const recency = Math.max(0.1, 1 - (now - post.createdAt) / (24 * 3600000));

		for (const niche of post.niches) {
			const cur = nicheMap.get(niche) ?? { count: 0, score: 0 };
			cur.count++;
			cur.score += engagement * recency;
			nicheMap.set(niche, cur);
		}
	}

	const topics: TrendingTopic[] = Array.from(nicheMap.entries())
		.map(([topic, data]) => ({
			topic,
			count: data.count,
			score: Math.round(data.score * 100) / 100,
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, 30);

	const response = {
		data: topics,
		meta: { total: topics.length, fetchedAt: now },
	};

	try {
		await env.CACHE?.put(cacheKey, JSON.stringify(response), {
			expirationTtl: 300,
		});
	} catch {
		/* ignore */
	}

	return jsonResponse(response);
}

// ─── GET /api/discover/featured ───────────────────────────────────────

export async function handleDiscoverFeatured(
	_request: Request,
	env: Env,
): Promise<Response> {
	const cacheKey = "discover:featured:v1";

	// Try cache
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	// Fetch live spaces
	const spaces: FeaturedSpace[] = [];
	const spacesKv = env.SPACES;
	if (spacesKv) {
		try {
			// Live spaces
			const liveRaw = await spacesKv.get(liveIndexKey()).catch(() => null);
			if (liveRaw) {
				const liveIds = JSON.parse(liveRaw) as string[];
				const spacePromises = liveIds.map((id) => spacesKv.get(spaceKey(id)));
				const spaceResults = await Promise.all(spacePromises);
				for (const raw of spaceResults) {
					if (!raw) continue;
					try {
						const s = JSON.parse(raw) as {
							id: string;
							title: string;
							description?: string;
							hostName: string;
							hostAvatarUrl?: string;
							status: string;
							listeners: number;
							speakers: Array<{
								id: string;
								displayName: string;
								avatarUrl?: string;
							}>;
							scheduledAt?: string;
						};
						if (s.status === "live") {
							spaces.push({
								id: s.id,
								title: s.title,
								description: s.description,
								hostName: s.hostName,
								hostAvatarUrl: s.hostAvatarUrl,
								status: "live",
								listeners: s.listeners,
								speakers: s.speakers || [],
							});
						}
					} catch {
						/* skip corrupt */
					}
				}
			}

			// Upcoming spaces
			const upcomingRaw = await spacesKv
				.get(upcomingIndexKey())
				.catch(() => null);
			if (upcomingRaw) {
				const upcomingIds = JSON.parse(upcomingRaw) as string[];
				const spacePromises = upcomingIds.map((id) =>
					spacesKv.get(spaceKey(id)),
				);
				const spaceResults = await Promise.all(spacePromises);
				for (const raw of spaceResults) {
					if (!raw) continue;
					try {
						const s = JSON.parse(raw) as {
							id: string;
							title: string;
							description?: string;
							hostName: string;
							hostAvatarUrl?: string;
							status: string;
							listeners: number;
							speakers: Array<{
								id: string;
								displayName: string;
								avatarUrl?: string;
							}>;
							scheduledAt?: string;
						};
						if (s.status === "scheduled") {
							spaces.push({
								id: s.id,
								title: s.title,
								description: s.description,
								hostName: s.hostName,
								hostAvatarUrl: s.hostAvatarUrl,
								status: "scheduled",
								listeners: s.listeners,
								speakers: s.speakers || [],
								scheduledAt: s.scheduledAt,
							});
						}
					} catch {
						/* skip corrupt */
					}
				}
			}
		} catch {
			/* partial results ok */
		}
	}

	// Sort: live first, then upcoming by scheduledAt
	spaces.sort((a, b) => {
		if (a.status === "live" && b.status !== "live") return -1;
		if (a.status !== "live" && b.status === "live") return 1;
		if (a.scheduledAt && b.scheduledAt) {
			return (
				new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
			);
		}
		return 0;
	});

	// Fetch trending topics for the featured response
	const posts = await fetchRecentPosts(env, 100);
	const now = Date.now();
	const cutoff = now - 24 * 3600000;
	const nicheMap = new Map<string, { count: number; score: number }>();

	for (const post of posts) {
		if (post.createdAt < cutoff || isSpamPost(post)) continue;
		const engagement =
			post.metrics.likes + post.metrics.reposts * 2 + post.metrics.replies * 3;
		const recency = Math.max(0.1, 1 - (now - post.createdAt) / (24 * 3600000));
		for (const niche of post.niches) {
			const cur = nicheMap.get(niche) ?? { count: 0, score: 0 };
			cur.count++;
			cur.score += engagement * recency;
			nicheMap.set(niche, cur);
		}
	}

	const trending: TrendingTopic[] = Array.from(nicheMap.entries())
		.map(([topic, data]) => ({
			topic,
			count: data.count,
			score: Math.round(data.score * 100) / 100,
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, 10);

	const response = { spaces, trending };

	try {
		await env.CACHE?.put(cacheKey, JSON.stringify(response), {
			expirationTtl: 300,
		});
	} catch {
		/* ignore */
	}

	return jsonResponse(response);
}

// ─── GET /api/discover/new ──────────────────────────────────────────

export async function handleDiscoverNew(
	_request: Request,
	env: Env,
): Promise<Response> {
	const cacheKey = "discover:new:v1";

	// Try cache
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	// 1. Recently created cross-protocol communities
	const newCommunities: DiscoverCommunity[] = [];
	const kv = env.COMMUNITIES;
	if (kv) {
		try {
			let cursor: string | undefined;
			const allCommunities: CrossProtocolCommunity[] = [];
			do {
				const list = await kv.list({
					prefix: COMMUNITY_KV_PREFIX,
					cursor,
					limit: 100,
				});
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
					if (v) allCommunities.push(v);
				}
				cursor = list.list_complete ? undefined : list.cursor;
			} while (cursor);

			allCommunities
				.sort((a, b) => b.createdAt - a.createdAt)
				.slice(0, 10)
				.forEach((v) => {
					const protoKeys = Object.keys(v.protocols).filter(
						(k) => v.protocols[k as keyof typeof v.protocols] !== undefined,
					);
					newCommunities.push({
						id: v.id,
						name: v.name,
						displayName: v.displayName,
						description: v.description,
						icon: v.icon,
						memberCount: v.memberCount,
						postCount: v.postCount,
						protocols: protoKeys,
						tags: v.tags,
						activityLevel:
							v.postCount > 100 ? "high" : v.postCount > 10 ? "medium" : "low",
					});
				});
		} catch {
			/* partial results ok */
		}
	}

	// 2. Recent active people
	const posts = await fetchRecentPosts(env, 150);
	const recentPeople: DiscoverPerson[] = [];
	const seenAuthors = new Set<string>();

	// Sort posts by createdAt desc, take distinct authors
	const sortedPosts = [...posts].sort((a, b) => b.createdAt - a.createdAt);
	for (const p of sortedPosts) {
		if (seenAuthors.size >= 15) break;
		if (seenAuthors.has(p.author.id) || isSpamPost(p)) continue;
		seenAuthors.add(p.author.id);
		recentPeople.push({
			id: p.author.id,
			displayName: p.author.displayName,
			handle:
				Object.values(p.author.handles).find(Boolean) ||
				p.author.id.slice(0, 12),
			avatarUrl: p.author.avatarUrl,
			protocol: p.protocol,
			protocols: [p.protocol],
			postCount: 1,
			totalEngagement:
				p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3,
			topNiches: p.niches.slice(0, 3),
		});
	}

	const response = {
		communities: newCommunities,
		people: recentPeople,
	};

	try {
		await env.CACHE?.put(cacheKey, JSON.stringify(response), {
			expirationTtl: 300,
		});
	} catch {
		/* ignore */
	}

	return jsonResponse(response);
}
