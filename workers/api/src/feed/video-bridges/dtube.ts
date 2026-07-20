/**
 * @degenfeed/api-worker — DTube Video Bridge
 *
 * Fetches video content from DTube (Steem blockchain + IPFS).
 * Sources:
 *   - Steem API: https://api.steemit.com
 *   - DTube tag-based queries on the Steem blockchain
 *
 * DTube stores video metadata on the Steem blockchain as posts tagged
 * with 'dtube'. Video content is hosted on IPFS.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { UnifiedVideo } from "../video-aggregator";
import type { VideoPlatform } from "../../lib/creator-resolver";

const PLATFORM: VideoPlatform = "dtube";
const PLATFORM_LABEL = "DTube";
const PLATFORM_COLOR = "#FF0000";

const STEEM_API = "https://api.steemit.com";
const IPFS_GATEWAY = "https://ipfs.io/ipfs";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SteemComment {
	author: string;
	permlink: string;
	title: string;
	body: string;
	json_metadata: string;
	created: string;
	last_update: string;
	net_rshares: number;
	children: number;
	active_votes: Array<{ voter: string; rshares: number }>;
	total_payout_value: string;
	curator_payout_value: string;
	pending_payout_value: string;
	url: string;
	stats?: { total_votes: number };
}

interface DTubeMetadata {
	video?: {
		content?: {
			title?: string;
			description?: string;
		};
		info?: {
			title?: string;
			snaphash?: string;
			duration?: number;
			thumbnail?: string;
			filesize?: number;
			ipfs?: string;
			sprite?: string;
			type?: string;
			isVideo?: boolean;
		};
	};
}

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchDTubeChannelVideos(
	channelName: string,
	limit: number = 10,
): Promise<UnifiedVideo[]> {
	try {
		const author = channelName.replace(/^@/, "").toLowerCase();
		const body = JSON.stringify({
			jsonrpc: "2.0",
			method: "condenser_api.get_discussions_by_blog",
			params: [{ tag: author, limit }],
			id: 1,
		});

		const res = await fetch(STEEM_API, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		});
		if (!res.ok) return [];

		const data = (await res.json()) as {
			result?: SteemComment[];
		};

		const posts = data.result ?? [];
		return posts
			.filter((post) => isDTubePost(post))
			.map((post) => convertSteemPost(post));
	} catch {
		return [];
	}
}

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchDTubeTrending(
	_category: string = "",
	limit: number = 20,
): Promise<UnifiedVideo[]> {
	try {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			method: "condenser_api.get_discussions_by_trending",
			params: [{ tag: "dtube", limit }],
			id: 1,
		});

		const res = await fetch(STEEM_API, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		});
		if (!res.ok) return [];

		const data = (await res.json()) as {
			result?: SteemComment[];
		};

		const posts = data.result ?? [];
		return posts
			.filter((post) => isDTubePost(post))
			.map((post) => convertSteemPost(post));
	} catch {
		return [];
	}
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchDTube(
	query: string,
	limit: number = 10,
): Promise<UnifiedVideo[]> {
	try {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			method: "condenser_api.get_discussions_by_created",
			params: [{ tag: "dtube", limit: limit * 2 }],
			id: 1,
		});

		const res = await fetch(STEEM_API, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		});
		if (!res.ok) return [];

		const data = (await res.json()) as {
			result?: SteemComment[];
		};

		const posts = data.result ?? [];
		const q = query.toLowerCase();
		return posts
			.filter((post) => isDTubePost(post))
			.filter(
				(post) =>
					post.title.toLowerCase().includes(q) ||
					post.body.toLowerCase().includes(q),
			)
			.slice(0, limit)
			.map((post) => convertSteemPost(post));
	} catch {
		return [];
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isDTubePost(post: SteemComment): boolean {
	try {
		const meta = JSON.parse(post.json_metadata) as DTubeMetadata;
		return (
			!!meta?.video?.info?.snaphash ||
			!!meta?.video?.info?.ipfs ||
			post.json_metadata.includes("dtube") ||
			post.json_metadata.includes("snaphash")
		);
	} catch {
		return post.json_metadata.includes("dtube");
	}
}

function convertSteemPost(post: SteemComment): UnifiedVideo {
	let meta: DTubeMetadata = {};
	try {
		meta = JSON.parse(post.json_metadata) as DTubeMetadata;
	} catch {
		// Use defaults
	}

	const info = meta?.video?.info;
	const content = meta?.video?.content;
	const title = content?.title ?? info?.title ?? (post.title || "Untitled");
	const description = content?.description ?? post.body.slice(0, 500);
	const duration = info?.duration ?? 0;
	const publishedMs = Date.parse(post.created);
	const thumbnail =
		info?.thumbnail ??
		(info?.sprite
			? `${IPFS_GATEWAY}/${info.sprite}`
			: `https://placehold.co/640x360/FF0000/FFFFFF?text=DTube`);
	const ipfsHash = info?.snaphash ?? info?.ipfs ?? "";

	return {
		id: `dtube:${post.author}/${post.permlink}`,
		title,
		description,
		thumbnail,
		url: `https://d.tube/#!/v/${post.author}/${post.permlink}`,
		duration,
		platform: PLATFORM,
		platformLabel: PLATFORM_LABEL,
		platformColor: PLATFORM_COLOR,
		creatorName: post.author,
		creatorId: `dtube:${post.author}`,
		creatorAvatar: `https://steemitimages.com/u/${post.author}/avatar`,
		creatorUrl: `https://d.tube/#!/c/${post.author}`,
		viewCount: post.net_rshares > 0 ? Math.floor(post.net_rshares / 1e6) : 0,
		likeCount: post.active_votes?.length ?? 0,
		publishedAt: new Date(publishedMs).toISOString(),
		publishedMs: Number.isNaN(publishedMs) ? Date.now() : publishedMs,
		category: inferCategory(title, description),
		tags: ["dtube", "steem"],
		isShort: duration > 0 && duration <= 90,
		isLive: false,
		qualityScore: 25,
	};
}

function inferCategory(title: string, description: string): string {
	const text = `${title} ${description}`.toLowerCase();
	const map: Array<[string, string]> = [
		["crypto", "crypto"],
		["bitcoin", "crypto"],
		["gaming", "gaming"],
		["music", "music"],
		["news", "news"],
		["politics", "news"],
		["tech", "tech"],
		["comedy", "comedy"],
	];
	for (const [kw, cat] of map) {
		if (text.includes(kw)) return cat;
	}
	return "entertainment";
}
