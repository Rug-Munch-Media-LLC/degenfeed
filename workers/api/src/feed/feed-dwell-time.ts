/**
 * feed-dwell-time — TikTok-style dwell time / watch time tracking.
 *
 * Tracks how long users view each post via KV persistence. Posts with
 * high dwell time get boosted for similar content. Quick-scrolled posts
 * get demoted. Signals used:
 *   - dwell_ms: raw milliseconds viewed
 *   - completion_rate: for video/text posts, how much was consumed (0-1)
 *   - shares: whether the user shared it
 *   - profile_visits: whether the user visited the author's profile after
 *
 * Dwell buckets: skipped (<800ms), glanced (800ms-3s), read (3s-15s),
 * engaged (15s-60s), deep (60s+).
 */

import type { UnifiedPost } from "@degenfeed/types";
import type { Env } from "../index";

export const DWELL_KEY_PREFIX = "user:dwell:";
export const DWELL_TTL = 60 * 60 * 24 * 14; // 14 days

export type DwellBucket = "skipped" | "glanced" | "read" | "engaged" | "deep";

export interface DwellEntry {
	postId: string;
	category: string;
	niches: string[];
	creatorId: string;
	contentType: string;
	dwellMs: number;
	completionRate: number;
	shared: boolean;
	profileVisit: boolean;
	timestamp: number;
}

export interface DwellProfile {
	entries: DwellEntry[];
	lastUpdated: number;
}

export interface DwellSignals {
	totalDwellMs: number;
	avgDwellMs: number;
	bucket: DwellBucket;
	completionRate: number;
	shared: boolean;
	profileVisit: boolean;
}

export interface DwellBoostResult {
	multiplier: number;
	bucket: DwellBucket;
	factors: string[];
}

export function classifyDwell(dwellMs: number): DwellBucket {
	if (dwellMs < 800) return "skipped";
	if (dwellMs < 3000) return "glanced";
	if (dwellMs < 15000) return "read";
	if (dwellMs < 60000) return "engaged";
	return "deep";
}

export function dwellBoostMultiplier(
	bucket: DwellBucket,
	completionRate: number,
): number {
	switch (bucket) {
		case "skipped":
			return 0.3;
		case "glanced":
			return 0.6;
		case "read":
			return 1.0 + completionRate * 0.5;
		case "engaged":
			return 1.5 + completionRate;
		case "deep":
			return 2.0 + completionRate * 1.5;
	}
}

export function emptyDwellProfile(): DwellProfile {
	return { entries: [], lastUpdated: Date.now() };
}

function dwellKey(userId: string): string {
	return `${DWELL_KEY_PREFIX}${userId.toLowerCase()}`;
}

export async function loadDwellProfile(
	env: Env,
	userId: string,
): Promise<DwellProfile> {
	if (!env.CACHE || !userId) return emptyDwellProfile();
	try {
		const raw = await env.CACHE.get(dwellKey(userId));
		if (!raw) return emptyDwellProfile();
		return JSON.parse(raw) as DwellProfile;
	} catch {
		return emptyDwellProfile();
	}
}

export async function recordDwellEvent(
	env: Env,
	userId: string,
	post: UnifiedPost,
	dwellMs: number,
	completionRate: number,
	shared: boolean,
	profileVisit: boolean,
): Promise<DwellProfile> {
	const profile = await loadDwellProfile(env, userId);
	const category =
		((post as unknown as Record<string, unknown>).category as string) ??
		"unknown";

	const entry: DwellEntry = {
		postId: post.id,
		category,
		niches: post.niches,
		creatorId: post.author.id,
		contentType: post.contentType ?? "text",
		dwellMs,
		completionRate,
		shared,
		profileVisit,
		timestamp: Date.now(),
	};

	profile.entries.push(entry);
	if (profile.entries.length > 500) {
		profile.entries = profile.entries.slice(-500);
	}
	profile.lastUpdated = Date.now();

	if (env.CACHE) {
		try {
			await env.CACHE.put(dwellKey(userId), JSON.stringify(profile), {
				expirationTtl: DWELL_TTL,
			});
		} catch {
			/* non-critical */
		}
	}

	return profile;
}

/**
 * Computes how much a candidate post should be boosted based on the user's
 * past dwell behavior. If the user spent significant time on similar content
 * (same niches, same creator, same content type), the new post gets boosted.
 *
 * Normalization: dwell scores are normalized per-user so a power user who
 * spends 30s on every post doesn't get 10x the dwell signal of a casual user.
 */
export function computeDwellBoost(
	post: UnifiedPost,
	dwellProfile: DwellProfile,
): DwellBoostResult {
	if (dwellProfile.entries.length === 0) {
		return { multiplier: 1.0, bucket: "glanced" as DwellBucket, factors: [] };
	}

	// Compute per-user average dwell as normalization baseline
	const userAvgDwell =
		dwellProfile.entries.reduce((sum, e) => sum + e.dwellMs, 0) /
		Math.max(dwellProfile.entries.length, 1);

	const factors: string[] = [];
	let multiplier = 1.0;
	const nicheSet = new Set(post.niches.map((n) => n.toLowerCase()));
	const contentType = post.contentType ?? "text";

	// Count matching entries with their dwell buckets weighted by recency
	let totalWeight = 0;
	let weightedBoost = 0;

	for (const entry of dwellProfile.entries) {
		const ageDays = (Date.now() - entry.timestamp) / 86400000;
		const recencyWeight = Math.exp(-ageDays / 7); // 7-day half-life

		// Normalize: how much above/below user average was this dwell?
		const dwellRatio = userAvgDwell > 0 ? entry.dwellMs / userAvgDwell : 1.0;
		const baseBoost = dwellBoostMultiplier(
			classifyDwell(entry.dwellMs),
			entry.completionRate,
		);
		// Scale boost by normalized dwell: a 60s dwell for a 5s-avg user > 60s for a 60s-avg user
		const normalizedBoost = baseBoost * Math.min(dwellRatio, 3.0);

		const nicheMatch =
			entry.niches.filter((n) => nicheSet.has(n.toLowerCase())).length > 0;
		const creatorMatch = entry.creatorId === post.author.id;
		const typeMatch = entry.contentType === contentType;

		if (nicheMatch) {
			weightedBoost += normalizedBoost * recencyWeight * 2.0; // niche match = 2x weight
			totalWeight += recencyWeight * 2.0;
		}
		if (creatorMatch && !nicheMatch) {
			weightedBoost += normalizedBoost * recencyWeight * 1.5;
			totalWeight += recencyWeight * 1.5;
		}
		if (typeMatch && !nicheMatch && !creatorMatch) {
			weightedBoost += normalizedBoost * recencyWeight * 0.5;
			totalWeight += recencyWeight * 0.5;
		}
	}

	if (totalWeight > 0) {
		const avgBoost = weightedBoost / totalWeight;
		multiplier = avgBoost;

		if (multiplier > 1.3) factors.push("high-dwell-niche-match");
		else if (multiplier > 1.0) factors.push("dwell-niche-affinity");
		else if (multiplier < 0.7) factors.push("low-dwell-interest");
	}

	return { multiplier, bucket: "glanced" as DwellBucket, factors };
}

/**
 * Returns a map of creator IDs that the user has engaged with deeply,
 * weighted by dwell time and recency. Used to boost posts from creators
 * the user spends real time on (not just quick-like scrollers).
 */
export function getDwellWeightedCreators(
	dwellProfile: DwellProfile,
): Map<string, number> {
	const creators = new Map<string, number>();
	for (const entry of dwellProfile.entries) {
		if (entry.dwellMs < 2000) continue; // skip quick scrolls
		const ageDays = (Date.now() - entry.timestamp) / 86400000;
		const recencyWeight = Math.exp(-ageDays / 14); // 14-day half-life
		const boost = dwellBoostMultiplier(
			classifyDwell(entry.dwellMs),
			entry.completionRate,
		);
		const existing = creators.get(entry.creatorId) ?? 0;
		creators.set(entry.creatorId, existing + boost * recencyWeight);
	}
	return creators;
}

/**
 * Returns niches sorted by aggregate dwell engagement (not just view count).
 * High dwell + high completion = user genuinely interested in this topic.
 */
export function getDwellWeightedNiches(
	dwellProfile: DwellProfile,
): Map<string, number> {
	const niches = new Map<string, number>();
	for (const entry of dwellProfile.entries) {
		const ageDays = (Date.now() - entry.timestamp) / 86400000;
		const recencyWeight = Math.exp(-ageDays / 7);
		const boost = dwellBoostMultiplier(
			classifyDwell(entry.dwellMs),
			entry.completionRate,
		);
		for (const niche of entry.niches) {
			const lower = niche.toLowerCase();
			const existing = niches.get(lower) ?? 0;
			niches.set(lower, existing + boost * recencyWeight);
		}
	}
	return niches;
}
