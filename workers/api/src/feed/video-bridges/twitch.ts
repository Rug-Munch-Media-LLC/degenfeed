/**
 * @degenfeed/api-worker — Twitch Video Bridge
 *
 * Fetches video content from Twitch.
 * Sources:
 *   - ivr.fi API (public Twitch data, no OAuth needed)
 *   - Twitch embed endpoints for live status
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { UnifiedVideo } from "../video-aggregator";
import type { VideoPlatform } from "../../lib/creator-resolver";

const PLATFORM: VideoPlatform = "twitch";
const PLATFORM_LABEL = "Twitch";
const PLATFORM_COLOR = "#9146FF";

const IVR_API = "https://api.ivr.fi";

// ─── Fetch channel live status ─────────────────────────────────────────────

export async function fetchTwitchChannelVideos(
	channelName: string,
	_limit: number = 10,
): Promise<UnifiedVideo[]> {
	try {
		const name = channelName.replace(/^@/, "").toLowerCase();
		const videos: UnifiedVideo[] = [];

		// Resolve channel info
		const resolveUrl = `${IVR_API}/twitch/resolve/${name}`;
		const resolveRes = await fetch(resolveUrl, {
			headers: { accept: "application/json", "user-agent": "DegenFeed/1.0" },
		});
		if (!resolveRes.ok) return [];

		const channel = (await resolveRes.json()) as {
			id: string;
			login: string;
			displayName: string;
			description?: string;
			avatar?: string;
			banner?: string;
		};

		// Check if channel is live
		try {
			const liveUrl = `${IVR_API}/twitch/live/${name}`;
			const liveRes = await fetch(liveUrl);
			if (liveRes.ok) {
				const liveData = (await liveRes.json()) as {
					live: boolean;
					title?: string;
					game?: string;
					viewers?: number;
					thumbnail?: string;
				};
				if (liveData.live) {
					videos.push({
						id: `twitch:live:${name}:${Date.now()}`,
						title: liveData.title ?? `${channel.displayName} is live!`,
						description: `Live on Twitch — ${liveData.game ?? ""}`,
						thumbnail:
							liveData.thumbnail ??
							channel.avatar ??
							`https://static-cdn.jtvnw.net/previews-ttv/live_user_${name}-440x248.jpg`,
						url: `https://twitch.tv/${name}`,
						duration: 0,
						platform: PLATFORM,
						platformLabel: PLATFORM_LABEL,
						platformColor: PLATFORM_COLOR,
						creatorName: channel.displayName ?? name,
						creatorId: channel.id ?? name,
						creatorAvatar: channel.avatar ?? "",
						creatorUrl: `https://twitch.tv/${name}`,
						viewCount: liveData.viewers ?? 0,
						likeCount: 0,
						publishedAt: new Date().toISOString(),
						publishedMs: Date.now(),
						category: inferCategory(
							liveData.title ?? "",
							liveData.game ?? "",
						),
						tags: [],
						isShort: false,
						isLive: true,
						qualityScore: 50,
					});
				}
			}
		} catch {
			// Live check failed
		}

		return videos;
	} catch {
		return [];
	}
}

// ─── Fetch trending (Twitch directory) ─────────────────────────────────────

export async function fetchTwitchTrending(
	_category: string = "",
	_limit: number = 20,
): Promise<UnifiedVideo[]> {
	// Twitch has no public trending API without OAuth.
	// Return empty for now; can use scraping if needed.
	return [];
}

// ─── Search Twitch channels ────────────────────────────────────────────────

export async function searchTwitch(
	query: string,
	limit: number = 10,
): Promise<UnifiedVideo[]> {
	try {
		// Search for channels via ivr.fi
		const url = `${IVR_API}/twitch/search?query=${encodeURIComponent(query)}`;
		const res = await fetch(url, {
			headers: { accept: "application/json", "user-agent": "DegenFeed/1.0" },
		});
		if (!res.ok) return [];

		const data = (await res.json()) as Array<{
			id: string;
			login: string;
			displayName: string;
			followers?: number;
			avatar?: string;
		}>;

		return (data ?? []).slice(0, limit).map((channel) => ({
			id: `twitch:channel:${channel.id}`,
			title: channel.displayName,
			description: `Twitch channel: ${channel.displayName}`,
			thumbnail:
				channel.avatar ??
				`https://placehold.co/640x360/9146FF/FFFFFF?text=Twitch`,
			url: `https://twitch.tv/${channel.login}`,
			duration: 0,
			platform: PLATFORM,
			platformLabel: PLATFORM_LABEL,
			platformColor: PLATFORM_COLOR,
			creatorName: channel.displayName ?? channel.login,
			creatorId: channel.id ?? channel.login,
			creatorAvatar: channel.avatar ?? "",
			creatorUrl: `https://twitch.tv/${channel.login}`,
			viewCount: channel.followers ?? 0,
			likeCount: 0,
			publishedAt: new Date().toISOString(),
			publishedMs: Date.now(),
			category: "gaming",
			tags: ["twitch"],
			isShort: false,
			isLive: false,
			qualityScore: 30,
		}));
	} catch {
		return [];
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function inferCategory(title: string, description: string): string {
	const text = `${title} ${description}`.toLowerCase();
	const map: Array<[string, string]> = [
		["gaming", "gaming"],
		["gameplay", "gaming"],
		["irl", "irl"],
		["music", "music"],
		["talk", "talk"],
		["podcast", "talk"],
		["art", "art"],
	];
	for (const [kw, cat] of map) {
		if (text.includes(kw)) return cat;
	}
	return "gaming";
}
