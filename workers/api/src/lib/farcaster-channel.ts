/**
 * @degenfeed/api-worker — Farcaster Channel Announcement Integration
 *
 * Posts stream/space announcements to relevant Farcaster channels
 * using the Neynar API for publishing casts with embeds.
 *
 * Channel discovery maps stream categories/tags to known Farcaster channels.
 * Announcements are posted as casts with the stream URL embedded so the
 * frame renders inline in the channel feed.
 *
 * @see https://docs.neynar.com/reference/publish-cast
 */

import type { Env } from "../index";
import { jsonResponse } from "../index";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FarcasterChannel {
	id: string;
	name: string;
	description?: string;
	/** Parent URL for the channel (used for casting to channels) */
	parentUrl: string;
	/** Relevance score for category matching */
	relevance: number;
}

export interface ChannelAnnouncement {
	channelId: string;
	castHash?: string;
	error?: string;
}

// ─── Channel Registry ──────────────────────────────────────────────────────
// Maps stream categories and tags to known Farcaster channels.

const CHANNEL_REGISTRY: Array<{
	keywords: string[];
	channel: FarcasterChannel;
}> = [
	{
		keywords: ["live", "streaming", "irl"],
		channel: {
			id: "fc-live",
			name: "/fc-live",
			description: "Live streaming on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 10,
		},
	},
	{
		keywords: ["music", "concert", "dj"],
		channel: {
			id: "music",
			name: "/music",
			description: "Music on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 8,
		},
	},
	{
		keywords: ["art", "nft", "digital-art"],
		channel: {
			id: "art",
			name: "/art",
			description: "Art on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 8,
		},
	},
	{
		keywords: ["gaming", "games", "play"],
		channel: {
			id: "gaming",
			name: "/gaming",
			description: "Gaming on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 7,
		},
	},
	{
		keywords: ["tech", "coding", "dev", "programming", "build"],
		channel: {
			id: "tech",
			name: "/tech",
			description: "Technology on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 7,
		},
	},
	{
		keywords: ["news", "current-events", "journalism"],
		channel: {
			id: "news",
			name: "/news",
			description: "News on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 7,
		},
	},
	{
		keywords: ["sports", "sport", "esports"],
		channel: {
			id: "sports",
			name: "/sports",
			description: "Sports on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 7,
		},
	},
	{
		keywords: ["talk", "discussion", "podcast", "space", "audio"],
		channel: {
			id: "audio",
			name: "/audio",
			description: "Audio spaces and podcasts on Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 9,
		},
	},
	{
		keywords: ["defi", "crypto", "trading", "token", "coin"],
		channel: {
			id: "degen",
			name: "/degen",
			description: "Degens of Farcaster",
			parentUrl:
				"chain://eip155:7777777/erc721:0x84257a52c85bd6fbd3c091b4cb3d5100b09630a2",
			relevance: 6,
		},
	},
];

// ─── Channel Discovery ──────────────────────────────────────────────────────

/**
 * Find relevant Farcaster channels for a given set of tags/categories.
 *
 * Matches against the channel registry by keyword overlap.
 * Returns channels sorted by relevance (highest first), max 3.
 */
export function getRelevantChannels(
	category?: string,
	tags?: string[],
): FarcasterChannel[] {
	const allTerms = [
		category?.toLowerCase() ?? "",
		...(tags ?? []).map((t) => t.toLowerCase()),
	].filter(Boolean);

	if (allTerms.length === 0) {
		// Default: suggest the general live channel
		return [CHANNEL_REGISTRY[0]!.channel];
	}

	const scored = CHANNEL_REGISTRY.map((entry) => {
		const matchCount = entry.keywords.filter((kw) =>
			allTerms.some((term) => term.includes(kw) || kw.includes(term)),
		).length;
		return {
			channel: entry.channel,
			score: matchCount * entry.channel.relevance,
		};
	})
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3);

	if (scored.length === 0) {
		return [CHANNEL_REGISTRY[0]!.channel];
	}

	return scored.map((s) => s.channel);
}

// ─── Channel Announcement ───────────────────────────────────────────────────

/**
 * Post a stream/space announcement to a Farcaster channel.
 *
 * Uses the Neynar API to publish a cast with the stream URL embedded,
 * which renders the frame inline in the channel feed.
 *
 * @param env - Environment bindings
 * @param channelId - Farcaster channel ID (e.g., "fc-live")
 * @param text - Cast text (max 320 chars)
 * @param embedUrl - URL to embed (stream URL that serves Frame meta tags)
 * @param parentUrl - Channel parent URL for routing
 * @returns ChannelAnnouncement with cast hash on success
 */
export async function postToFarcasterChannel(
	env: Env,
	channelId: string,
	text: string,
	embedUrl: string,
	parentUrl: string,
): Promise<ChannelAnnouncement> {
	const apiKey = env.NEYNAR_API_KEY;
	if (!apiKey) {
		return {
			channelId,
			error: "NEYNAR_API_KEY not configured",
		};
	}

	// Ensure text is within Farcaster's 320-char limit
	const castText = text.length > 320 ? text.slice(0, 317) + "..." : text;

	try {
		const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				api_key: apiKey,
				"user-agent": "DegenFeed/1.0 (Farcaster Integration)",
			},
			body: JSON.stringify({
				text: castText,
				embeds: [{ url: embedUrl }],
				channel_id: channelId,
				parent_url: parentUrl,
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "unknown");
			return {
				channelId,
				error: `Neynar API error ${response.status}: ${errorBody}`,
			};
		}

		const data = (await response.json()) as { cast?: { hash?: string } };
		return {
			channelId,
			castHash: data.cast?.hash,
		};
	} catch (err) {
		return {
			channelId,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ─── Bulk Channel Announcement ──────────────────────────────────────────────

/**
 * Announce a stream/space to all relevant Farcaster channels.
 *
 * Discovers matching channels from category/tags, then posts to each
 * in parallel. One channel failure never blocks others.
 *
 * @param env - Environment bindings
 * @param embedUrl - URL to embed (must serve Frame meta tags)
 * @param title - Stream/space title
 * @param creatorHandle - Creator's Farcaster handle
 * @param category - Stream category for channel matching
 * @param tags - Stream tags for channel matching
 * @returns Array of announcement results
 */
export async function announceToRelevantChannels(
	env: Env,
	embedUrl: string,
	title: string,
	creatorHandle: string,
	category?: string,
	tags?: string[],
): Promise<ChannelAnnouncement[]> {
	const channels = getRelevantChannels(category, tags);

	if (channels.length === 0) return [];

	const text = `🔴 LIVE: ${title}\n\n${creatorHandle} is streaming on DegenFeed`;

	const results = await Promise.allSettled(
		channels.map((ch) =>
			postToFarcasterChannel(env, ch.id, text, embedUrl, ch.parentUrl),
		),
	);

	return results.map((r, i) => {
		if (r.status === "fulfilled") return r.value;
		return {
			channelId: channels[i]?.id ?? "unknown",
			error: r.reason instanceof Error ? r.reason.message : String(r.reason),
		};
	});
}

// ─── Neynar Cast Publishing (for posting frames as casts) ──────────────────

/**
 * Post a cast to Farcaster using the Neynar API.
 *
 * The cast can embed a URL (which serves Frame meta tags) to render
 * as an interactive frame in the feed.
 *
 * @param env - Environment bindings
 * @param signerUuid - Neynar signer UUID for the publishing user
 * @param text - Cast text (max 320 chars)
 * @param embedUrls - URLs to embed (max 2)
 * @param channelId - Optional Farcaster channel ID
 * @returns Cast hash on success
 */
export async function postCastToFarcaster(
	env: Env,
	signerUuid: string,
	text: string,
	embedUrls: string[] = [],
	channelId?: string,
): Promise<{ hash?: string; error?: string }> {
	const apiKey = env.NEYNAR_API_KEY;
	if (!apiKey) {
		return { error: "NEYNAR_API_KEY not configured" };
	}

	const castText = text.length > 320 ? text.slice(0, 317) + "..." : text;

	try {
		const body: Record<string, unknown> = {
			signer_uuid: signerUuid,
			text: castText,
			embeds: embedUrls.map((url) => ({ url })),
		};

		if (channelId) {
			body.channel_id = channelId;
		}

		const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				api_key: apiKey,
				"user-agent": "DegenFeed/1.0",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "unknown");
			return { error: `Neynar error ${response.status}: ${errorBody}` };
		}

		const data = (await response.json()) as { cast?: { hash?: string } };
		return { hash: data.cast?.hash };
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}
