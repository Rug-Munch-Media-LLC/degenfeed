/**
 * @degenfeed/api-worker — Dailymotion Video Bridge
 *
 * Fetches video content from Dailymotion.
 * Sources:
 *   - Dailymotion API (v3): https://api.dailymotion.com
 *   - Channel RSS: https://www.dailymotion.com/{channel}/rss
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { UnifiedVideo } from "../video-aggregator";
import type { VideoPlatform } from "../../lib/creator-resolver";

const PLATFORM: VideoPlatform = "dailymotion";
const PLATFORM_LABEL = "Dailymotion";
const PLATFORM_COLOR = "#0066FF";

const DM_API = "https://api.dailymotion.com";

// ─── Types ─────────────────────────────────────────────────────────────────

interface DMVideo {
	id: string;
	title: string;
	description?: string;
	url?: string;
	thumbnail_url?: string;
	thumbnail_360_url?: string;
	duration?: number;
	views_total?: number;
	created_time?: number;
	owner?: {
		id: string;
		username: string;
		screenname: string;
		avatar_url?: string;
		url?: string;
	};
	channel?: { name: string };
}

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchDailymotionChannelVideos(
	channelName: string,
	limit: number = 10,
): Promise<UnifiedVideo[]> {
	try {
		const name = channelName.replace(/^@/, "").toLowerCase();
		const url = `${DM_API}/user/${encodeURIComponent(name)}/videos?fields=id,title,description,url,thumbnail_url,thumbnail_360_url,duration,views_total,created_time,owner.id,owner.username,owner.screenname,owner.avatar_url,owner.url&sort=created&limit=${limit}`;
		const res = await fetch(url, {
			headers: { accept: "application/json" },
		});
		if (!res.ok) return [];

		const data = (await res.json()) as {
			list: DMVideo[];
		};

		return (data.list ?? []).map(convertDMVideo);
	} catch {
		return [];
	}
}

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchDailymotionTrending(
	_category: string = "",
	limit: number = 20,
): Promise<UnifiedVideo[]> {
	try {
		const url = `${DM_API}/videos?fields=id,title,description,url,thumbnail_url,thumbnail_360_url,duration,views_total,created_time,owner.id,owner.username,owner.screenname,owner.avatar_url,owner.url&sort=visited&limit=${limit}`;
		const res = await fetch(url, {
			headers: { accept: "application/json" },
		});
		if (!res.ok) return [];

		const data = (await res.json()) as {
			list: DMVideo[];
		};

		return (data.list ?? []).map(convertDMVideo);
	} catch {
		return [];
	}
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchDailymotion(
	query: string,
	limit: number = 10,
): Promise<UnifiedVideo[]> {
	try {
		const url = `${DM_API}/videos?fields=id,title,description,url,thumbnail_url,thumbnail_360_url,duration,views_total,created_time,owner.id,owner.username,owner.screenname,owner.avatar_url,owner.url&search=${encodeURIComponent(query)}&limit=${limit}`;
		const res = await fetch(url, {
			headers: { accept: "application/json" },
		});
		if (!res.ok) return [];

		const data = (await res.json()) as {
			list: DMVideo[];
		};

		return (data.list ?? []).map(convertDMVideo);
	} catch {
		return [];
	}
}

// ─── Converter ─────────────────────────────────────────────────────────────

function convertDMVideo(v: DMVideo): UnifiedVideo {
	const owner = v.owner;
	const title = v.title || "Untitled";
	const description = v.description ?? "";
	const thumbnail = v.thumbnail_url ?? v.thumbnail_360_url ?? "";
	const publishedMs = (v.created_time ?? 0) * 1000;
	const duration = v.duration ?? 0;

	return {
		id: `dailymotion:${v.id}`,
		title,
		description,
		thumbnail:
			thumbnail ||
			`https://placehold.co/640x360/0066FF/FFFFFF?text=Dailymotion`,
		url: v.url ?? `https://www.dailymotion.com/video/${v.id}`,
		duration,
		platform: PLATFORM,
		platformLabel: PLATFORM_LABEL,
		platformColor: PLATFORM_COLOR,
		creatorName: owner?.screenname ?? owner?.username ?? "Dailymotion Creator",
		creatorId: `dailymotion:${owner?.id ?? v.id}`,
		creatorAvatar: owner?.avatar_url ?? "",
		creatorUrl:
			owner?.url ??
			`https://www.dailymotion.com/${owner?.username ?? v.id}`,
		viewCount: v.views_total ?? 0,
		likeCount: 0,
		publishedAt: new Date(publishedMs).toISOString(),
		publishedMs: publishedMs || Date.now(),
		category: inferCategory(title, description),
		tags: [],
		isShort: duration > 0 && duration <= 60,
		isLive: false,
		qualityScore: computeScore(v.views_total ?? 0, publishedMs),
	};
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeScore(views: number, publishedMs: number): number {
	const ageHours = Math.max(1, (Date.now() - publishedMs) / 3600000);
	const viewsPerHour = views / ageHours;
	return Math.min(viewsPerHour / 10, 100);
}

function inferCategory(title: string, description: string): string {
	const text = `${title} ${description}`.toLowerCase();
	const map: Array<[string, string]> = [
		["news", "news"],
		["sport", "sports"],
		["music", "music"],
		["gaming", "gaming"],
		["tech", "tech"],
		["comedy", "comedy"],
		["entertainment", "entertainment"],
	];
	for (const [kw, cat] of map) {
		if (text.includes(kw)) return cat;
	}
	return "entertainment";
}
