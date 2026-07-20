/**
 * @degenfeed/api-worker — Lemmy Federated Community Discovery
 *
 * Returns communities discovered across the Lemmy fediverse with
 * live subscriber counts. Filterable by category, instance, and
 * subscriber threshold.
 *
 * Endpoints:
 *   GET /api/lemmy/discover — Discover federated communities
 *
 * Query params:
 *   category    — Filter by niche category (crypto, defi, nft, tech, trading,
 *                 security, privacy, gaming, art, science, etc.)
 *   instance    — Filter by instance domain (partial match)
 *   search      — Search communities by name
 *   min_subs    — Minimum subscriber count (default 0)
 *   sort        — Sort by: subscribers (default), active, posts, new
 *   limit       — Max results (default 50, max 100)
 */

import { discoverCommunities } from "@degenfeed/feed-providers";
import { type Env, jsonResponse } from "../index";

export async function handleLemmyDiscover(
	request: Request,
	_env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const category = url.searchParams.get("category") ?? undefined;
	const instance = url.searchParams.get("instance") ?? undefined;
	const search = url.searchParams.get("search") ?? undefined;
	const minSubs = parseInt(url.searchParams.get("min_subs") ?? "0", 10);
	const sortParam = url.searchParams.get("sort") ?? "subscribers";
	const limit = Math.min(
		parseInt(url.searchParams.get("limit") ?? "50", 10),
		100,
	);

	// Validate sort
	const sort = ["subscribers", "active", "posts", "new"].includes(sortParam)
		? (sortParam as "subscribers" | "active" | "posts" | "new")
		: "subscribers";

	try {
		const communities = await discoverCommunities({
			category,
			instance,
			search,
			minSubs,
			sort,
			limit,
		});

		// Compute category breakdown for response meta
		const categoryCounts: Record<string, number> = {};
		for (const c of communities) {
			categoryCounts[c.niche] = (categoryCounts[c.niche] ?? 0) + 1;
		}

		return jsonResponse({
			data: communities,
			meta: {
				total: communities.length,
				category,
				sort,
				minSubs,
				categoryCounts,
				fetchedAt: Date.now(),
			},
		});
	} catch (err) {
		return jsonResponse(
			{
				error: "Discovery failed",
				message: err instanceof Error ? err.message : "unknown",
			},
			500,
		);
	}
}
