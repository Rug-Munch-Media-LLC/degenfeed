/**
 * Who to follow — trending authors across protocols ranked by engagement.
 *
 * GET /api/discover/people
 */

import { isSpamPost } from "@degenfeed/feed-core";
import type { UnifiedPost } from "@degenfeed/types";
import { type Env, jsonResponse } from "../index";

export async function handleDiscoverPeople(
	request: Request,
	env: Env,
): Promise<Response> {
	const cacheKey = "people:v1:trending";
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	} catch {
		/* ignore */
	}

	// Reuse feed data to discover trending authors
	try {
		const feedReq = new Request(
			"https://degenfeed.xyz/api/feed/home?limit=200&sort=hot",
			{
				headers: request.headers,
			},
		);
		const feedRes = await fetch(feedReq);
		if (!feedRes.ok) return jsonResponse({ error: "Feed unavailable" }, 502);

		const { data: posts } = (await feedRes.json()) as { data: UnifiedPost[] };
		if (!posts?.length) return jsonResponse({ data: [], meta: { total: 0 } });

		const authorStats = new Map<
			string,
			{
				author: {
					id: string;
					displayName: string;
					handle: string;
					avatarUrl: string;
					protocol: string;
				};
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
			.slice(0, 20)
			.map((a) => ({
				...a.author,
				postCount: a.postCount,
				totalEngagement: a.totalEngagement,
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
