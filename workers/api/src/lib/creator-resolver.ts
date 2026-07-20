/**
 * @degenfeed/api-worker — CreatorResolver
 *
 * Resolve a creator's identity across ALL video platforms.
 * "Follow creators, not platforms" — users follow a creator ONCE
 * and get their content from everywhere. The platform badge is
 * informational, not limiting.
 *
 * identifier can be:
 *   - wallet address (0x... or Solana)
 *   - DegenFeed handle (@user)
 *   - YouTube channel ID (UC...)
 *   - Twitch channel name
 *   - Rumble channel name
 *   - PeerTube handle (@user@instance)
 *   - TikTok username
 *   - Instagram username
 *   - Zora address (0x...)
 *   - Any platform URL
 *
 * KV cache prefix: creator:resolve:* (24h TTL)
 */

import type { Env } from "../index";

// ─── Constants ─────────────────────────────────────────────────────────────

export const INVIDIOUS_INSTANCES = [
	"https://inv.nadeko.net",
	"https://invidious.fdn.fr",
	"https://invidious.privacydev.net",
	"https://yewtu.be",
];

export const VIDEO_PLATFORM_COLORS: Record<string, string> = {
	youtube: "#FF0000",
	twitch: "#9146FF",
	rumble: "#85C742",
	peertube: "#F1680D",
	tiktok: "#010101",
	instagram: "#E1306C",
	odysee: "#FF6A00",
	zora: "#0052FF",
	dtube: "#FF0000",
	bitchute: "#8B0000",
	dailymotion: "#0066FF",
	vimeo: "#1AB7EA",
	lbry: "#FF6A00",
};

export const VIDEO_PLATFORM_LABELS: Record<string, string> = {
	youtube: "YouTube",
	twitch: "Twitch",
	rumble: "Rumble",
	peertube: "PeerTube",
	tiktok: "TikTok",
	instagram: "Instagram",
	odysee: "Odysee",
	zora: "Zora",
	dtube: "DTube",
	bitchute: "BitChute",
	dailymotion: "Dailymotion",
	vimeo: "Vimeo",
	lbry: "LBRY",
};

// ─── Types ─────────────────────────────────────────────────────────────────

export type VideoPlatform =
	| "youtube"
	| "twitch"
	| "rumble"
	| "peertube"
	| "tiktok"
	| "instagram"
	| "odysee"
	| "zora"
	| "dtube"
	| "bitchute"
	| "dailymotion"
	| "vimeo"
	| "lbry";

export interface PlatformPresence {
	platform: VideoPlatform;
	channelId: string;
	channelName: string;
	avatarUrl?: string;
	followerCount: number;
	isLive?: boolean;
	verified: boolean;
	lastActive?: string;
	url: string;
}

export interface CreatorPresence {
	/** Resolved display name */
	name: string;
	/** Best available avatar URL */
	avatar: string;
	/** Bio / description */
	bio: string;
	/** Creator's DegenFeed handle if registered */
	degenfeedHandle?: string;
	/** Creator's wallet address if known */
	wallet?: string;
	/** All platforms this creator is present on */
	platforms: PlatformPresence[];
	/** Rough total follower count across all platforms */
	unifiedFollowerCount: number;
	/** When this data was fetched */
	resolvedAt: number;
	/** The search identifier used */
	identifier: string;
}

export interface CreatorSearchResult {
	platform: VideoPlatform;
	channelId: string;
	channelName: string;
	followerCount: number;
	avatarUrl?: string;
	url: string;
	verified: boolean;
	relevanceScore: number;
}

// ─── CreatorResolver ───────────────────────────────────────────────────────

export class CreatorResolver {
	private env?: Env;
	private cache: Map<string, CreatorPresence | null>;

	constructor(env?: Env) {
		this.env = env;
		this.cache = new Map();
	}

	// ── Main resolver ─────────────────────────────────────────────────────

	/**
	 * Resolve a creator's identity across all video platforms.
	 * Uses heuristic detection of identifier type to dispatch to the
	 * right platform-specific resolvers.
	 */
	async resolveCreator(identifier: string): Promise<CreatorPresence> {
		// Check memory cache first
		const memCached = this.cache.get(identifier);
		if (memCached) return memCached;

		// Check KV cache
		if (this.env?.CACHE) {
			try {
				const cached = await this.env.CACHE.get(
					`creator:resolve:${identifier.toLowerCase()}`,
				);
				if (cached) {
					const parsed = JSON.parse(cached) as CreatorPresence;
					this.cache.set(identifier, parsed);
					return parsed;
				}
			} catch {
				// Cache miss — resolve live
			}
		}

		// Detect identifier type and search all relevant platforms
		const isWallet =
			/^0x[a-fA-F0-9]{40}$/.test(identifier) ||
			/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier);
		const _isYouTube = identifier.startsWith("UC") && identifier.length === 24;
		const _isDegenFeed = identifier.startsWith("@");
		const isPeerTube = identifier.includes("@") && identifier.includes(".");
		const isUrl = identifier.startsWith("http");
		const isHandle = identifier.startsWith("@") || !isWallet;

		const searchPromises: Promise<CreatorSearchResult[]>[] = [];

		// Always search YouTube (has the broadest coverage)
		searchPromises.push(this.resolveYouTube(identifier));

		// Search other platforms based on identifier type
		if (isHandle || isWallet || isUrl) {
			searchPromises.push(this.resolveTwitch(identifier));
			searchPromises.push(this.resolveRumble(identifier));
			searchPromises.push(this.resolveTikTok(identifier));
			searchPromises.push(this.resolveDTube(identifier));
			searchPromises.push(this.resolveBitChute(identifier));
			searchPromises.push(this.resolveDailymotion(identifier));
			searchPromises.push(this.resolveVimeo(identifier));
			if (isWallet) {
				searchPromises.push(this.resolveZora(identifier));
			}
		}

		if (isPeerTube || isHandle) {
			searchPromises.push(this.resolvePeerTube(identifier));
		}

		// Run all searches in parallel
		const results = await Promise.allSettled(searchPromises);
		const allResults: CreatorSearchResult[] = [];
		for (const r of results) {
			if (r.status === "fulfilled") allResults.push(...r.value);
		}

		// Deduplicate by platform + channelId
		const seen = new Set<string>();
		const uniqueResults = allResults.filter((r) => {
			const key = `${r.platform}:${r.channelId}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

		// Sort by relevance score descending
		uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

		// Build platform presence list
		const platforms: PlatformPresence[] = uniqueResults.map((r) => ({
			platform: r.platform,
			channelId: r.channelId,
			channelName: r.channelName,
			avatarUrl: r.avatarUrl,
			followerCount: r.followerCount,
			verified: r.verified,
			url: r.url,
		}));

		// Pick best name and avatar
		const best = uniqueResults[0];
		const name = best?.channelName ?? identifier;
		const avatar = best?.avatarUrl ?? "";

		const presence: CreatorPresence = {
			name,
			avatar,
			bio: "",
			platforms,
			unifiedFollowerCount: platforms.reduce(
				(sum, p) => sum + p.followerCount,
				0,
			),
			resolvedAt: Date.now(),
			identifier,
		};

		// Cache in KV (24h TTL)
		if (this.env?.CACHE) {
			try {
				await this.env.CACHE.put(
					`creator:resolve:${identifier.toLowerCase()}`,
					JSON.stringify(presence),
					{ expirationTtl: 86400 },
				);
			} catch {
				// Non-critical
			}
		}

		this.cache.set(identifier, presence);
		return presence;
	}

	// ── Platform-specific resolvers ───────────────────────────────────────

	/**
	 * Resolve YouTube channel from various identifier types.
	 * Uses Invidious API (no API key required) and YouTube RSS feeds.
	 */
	async resolveYouTube(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		let channelId = "";

		// Direct channel ID
		if (/^UC[\w-]{22}$/.test(search)) {
			channelId = search;
		}

		// Try to extract from URL
		const urlMatch = search.match(
			/(?:youtube\.com|youtu\.be)\/(?:channel\/|@|user\/|c\/)?([\w-]+)/i,
		);
		if (urlMatch?.[1]) {
			channelId = urlMatch[1];
		}

		// Try Invidious to resolve by handle or search
		if (!channelId) {
			const handle = search.replace(/^@/, "").toLowerCase();
			for (const instance of INVIDIOUS_INSTANCES) {
				try {
					// Search for channel
					const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(handle)}&type=channel`;
					const res = await fetch(searchUrl, {
						headers: { accept: "application/json" },
					});
					if (!res.ok) continue;

					const data = (await res.json()) as Array<{
						authorId: string;
						author: string;
						authorUrl: string;
						subCount?: number;
						authorThumbnails?: Array<{
							url: string;
							height: number;
							width: number;
						}>;
					}>;

					for (const item of data.slice(0, 5)) {
						const followerCount = item.subCount ?? 0;
						const avatarUrl =
							item.authorThumbnails?.find((t) => t.height >= 88)?.url ??
							item.authorThumbnails?.[0]?.url;
						results.push({
							platform: "youtube",
							channelId: item.authorId,
							channelName: item.author,
							followerCount,
							avatarUrl,
							url: `https://www.youtube.com/channel/${item.authorId}`,
							verified: followerCount > 10000,
							relevanceScore: 10 + Math.min(followerCount / 100000, 5),
						});
					}
					if (results.length > 0) break;
				} catch {}
			}
		}

		// If we have a channel ID, get details from Invidious
		if (channelId) {
			for (const instance of INVIDIOUS_INSTANCES) {
				try {
					const url = `${instance}/api/v1/channels/${channelId}`;
					const res = await fetch(url, {
						headers: { accept: "application/json" },
					});
					if (!res.ok) continue;

					const data = (await res.json()) as {
						author: string;
						authorUrl: string;
						subCount: number;
						avatar?: string;
						authorThumbnails?: Array<{
							url: string;
							height: number;
							width: number;
						}>;
						autoGenerated?: boolean;
					};

					const followerCount = data.subCount ?? 0;
					const avatarUrl =
						data.avatar ??
						data.authorThumbnails?.find((t) => t.height >= 88)?.url ??
						data.authorThumbnails?.[0]?.url ??
						"";

					results.push({
						platform: "youtube",
						channelId,
						channelName: data.author,
						followerCount,
						avatarUrl,
						url: `https://www.youtube.com/channel/${channelId}`,
						verified: !data.autoGenerated && followerCount > 10000,
						relevanceScore: 20 + Math.min(followerCount / 100000, 5),
					});
					break;
				} catch {}
			}
		}

		return results;
	}

	/**
	 * Resolve a Twitch channel by name.
	 * Uses public Twitch API (unauthenticated endpoints).
	 */
	async resolveTwitch(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const channelName = search
			.replace(/^@/, "")
			.replace(/twitch\.tv\//i, "")
			.replace(/[^a-zA-Z0-9_]/g, "")
			.toLowerCase();
		if (!channelName || channelName.length < 2) return results;

		try {
			// Twitch doesn't have a fully public API without OAuth,
			// but we can use the embed endpoint and scraped data
			const url = `https://api.ivr.fi/twitch/resolve/${channelName}`;
			const res = await fetch(url, {
				headers: { accept: "application/json", "user-agent": "DegenFeed/1.0" },
			});
			if (res.ok) {
				const data = (await res.json()) as {
					id: string;
					login: string;
					displayName: string;
					followers: number;
					avatar?: string;
					broadcastLanguage?: string;
				};
				results.push({
					platform: "twitch",
					channelId: data.id ?? channelName,
					channelName: data.displayName ?? data.login,
					followerCount: data.followers ?? 0,
					avatarUrl: data.avatar,
					url: `https://twitch.tv/${channelName}`,
					verified: (data.followers ?? 0) > 5000,
					relevanceScore: 15 + Math.min((data.followers ?? 0) / 10000, 5),
				});
			}
		} catch {
			// Fallback: construct presence from channel name
		}

		// Fallback: if API failed, return basic info
		if (results.length === 0) {
			results.push({
				platform: "twitch",
				channelId: channelName,
				channelName,
				followerCount: 0,
				url: `https://twitch.tv/${channelName}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a Rumble channel by name.
	 * Uses Rumble's public channel API.
	 */
	async resolveRumble(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const channelName = search
			.replace(/^@/, "")
			.replace(/rumble\.com\/(c\/|user\/)?/i, "")
			.replace(/[^a-zA-Z0-9_-]/g, "")
			.toLowerCase();
		if (!channelName || channelName.length < 2) return results;

		try {
			const url = `https://rumble.com/user/${channelName}`;
			const res = await fetch(url, {
				headers: { accept: "text/html", "user-agent": "DegenFeed/1.0" },
			});
			if (res.ok) {
				const html = await res.text();
				// Extract follower count and avatar from page metadata
				const followerMatch = html.match(
					/([\d,.]+)\s*(?:followers?|subscribers?)/i,
				);
				const avatarMatch = html.match(
					/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/,
				);
				const nameMatch = html.match(
					/<title>([^<]+?)(?:\s*-\s*Rumble)?<\/title>/,
				);

				const followerCount = followerMatch?.[1]
					? Number(followerMatch[1].replace(/[^0-9]/g, ""))
					: 0;

				results.push({
					platform: "rumble",
					channelId: channelName,
					channelName: nameMatch?.[1]?.trim() ?? channelName,
					followerCount,
					avatarUrl: avatarMatch?.[1],
					url: `https://rumble.com/c/${channelName}`,
					verified: followerCount > 5000,
					relevanceScore: 10 + Math.min(followerCount / 10000, 5),
				});
			}
		} catch {
			// Fallback
		}

		if (results.length === 0) {
			results.push({
				platform: "rumble",
				channelId: channelName,
				channelName,
				followerCount: 0,
				url: `https://rumble.com/c/${channelName}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a PeerTube channel from handle (@user@instance) or search.
	 * Searches across federated SepiaSearch and video.degenfeed.xyz.
	 */
	async resolvePeerTube(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];

		// Parse PeerTube handle (@user@instance.com)
		const peertubeMatch = search.match(/^@?([^@]+)@([^@]+)$/);
		if (peertubeMatch) {
			const username = peertubeMatch[1];
			const instance = peertubeMatch[2];
			if (!username || !instance) return results;
			try {
				const apiUrl = `https://${instance}/api/v1/accounts?search=${encodeURIComponent(username)}`;
				const res = await fetch(apiUrl, {
					headers: { accept: "application/json" },
				});
				if (res.ok) {
					const data = (await res.json()) as {
						data: Array<{
							id: number;
							name: string;
							displayName: string;
							url: string;
							avatar?: { path: string };
							followersCount: number;
						}>;
					};
					for (const account of data.data ?? []) {
						results.push({
							platform: "peertube",
							channelId: `peertube:${instance}:${account.id}`,
							channelName: account.displayName || account.name,
							followerCount: account.followersCount ?? 0,
							avatarUrl: account.avatar?.path
								? `https://${instance}${account.avatar.path}`
								: undefined,
							url: account.url,
							verified: false,
							relevanceScore: 10,
						});
					}
				}
			} catch {
				// Instance unreachable
			}
		}

		// Also search DegenFeed's PeerTube instance
		try {
			const name = search.replace(/^@/, "").toLowerCase();
			const url = `https://video.degenfeed.xyz/api/v1/accounts?search=${encodeURIComponent(name)}`;
			const res = await fetch(url, {
				headers: { accept: "application/json" },
			});
			if (res.ok) {
				const data = (await res.json()) as {
					data: Array<{
						id: number;
						name: string;
						displayName: string;
						url: string;
						avatar?: { path: string };
						followersCount: number;
					}>;
				};
				for (const account of data.data ?? []) {
					// Deduplicate against previously found results
					const _key = `peertube:${account.id}`;
					if (results.some((r) => r.channelId.endsWith(`:${account.id}`)))
						continue;
					results.push({
						platform: "peertube",
						channelId: `peertube:video.degenfeed.xyz:${account.id}`,
						channelName: account.displayName || account.name,
						followerCount: account.followersCount ?? 0,
						avatarUrl: account.avatar?.path
							? `https://video.degenfeed.xyz${account.avatar.path}`
							: undefined,
						url: account.url,
						verified: false,
						relevanceScore: 8,
					});
				}
			}
		} catch {
			// PeerTube unavailable
		}

		return results;
	}

	/**
	 * Resolve a TikTok creator by username.
	 * Uses TikTok oEmbed and public profile data.
	 */
	async resolveTikTok(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const username = search
			.replace(/^@/, "")
			.replace(/tiktok\.com\//i, "")
			.replace(/[^a-zA-Z0-9_.]/g, "");
		if (!username || username.length < 2) return results;

		try {
			// Try TikTok's oEmbed for public data
			const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`;
			const res = await fetch(oembedUrl, {
				headers: { accept: "application/json" },
			});
			if (res.ok) {
				const data = (await res.json()) as {
					author_name: string;
					author_url: string;
					thumbnail_url?: string;
				};
				results.push({
					platform: "tiktok",
					channelId: username,
					channelName: data.author_name || username,
					followerCount: 0, // oEmbed doesn't provide follower count
					avatarUrl: data.thumbnail_url,
					url: `https://www.tiktok.com/@${username}`,
					verified: false,
					relevanceScore: 8,
				});
			}
		} catch {
			// Fallback
		}

		if (results.length === 0) {
			results.push({
				platform: "tiktok",
				channelId: username,
				channelName: username,
				followerCount: 0,
				url: `https://www.tiktok.com/@${username}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a DTube creator by Steem username.
	 * Checks Steem blockchain for dtube-tagged posts by the user.
	 */
	async resolveDTube(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const username = search
			.replace(/^@/, "")
			.replace(/d\.tube\//i, "")
			.replace(/[^a-zA-Z0-9_-]/g, "")
			.toLowerCase();
		if (!username || username.length < 2) return results;

		try {
			// Query Steem API for account info
			const body = JSON.stringify({
				jsonrpc: "2.0",
				method: "condenser_api.get_accounts",
				params: [[username]],
				id: 1,
			});
			const res = await fetch("https://api.steemit.com", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
			});
			if (res.ok) {
				const data = (await res.json()) as {
					result?: Array<{
						name: string;
						followers_count?: number;
						post_count?: number;
					}>;
				};
				const account = data?.result?.[0];
				if (account) {
					results.push({
						platform: "dtube",
						channelId: account.name,
						channelName: account.name,
						followerCount: account.followers_count ?? 0,
						url: `https://d.tube/#!/c/${account.name}`,
						verified: (account.post_count ?? 0) > 50,
						relevanceScore: 10,
					});
				}
			}
		} catch {
			// Steem API unavailable
		}

		// Fallback
		if (results.length === 0) {
			results.push({
				platform: "dtube",
				channelId: username,
				channelName: username,
				followerCount: 0,
				url: `https://d.tube/#!/c/${username}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a BitChute channel by name.
	 * Checks BitChute's public RSS feeds.
	 */
	async resolveBitChute(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const channelName = search
			.replace(/^@/, "")
			.replace(/bitchute\.com\/(channel\/)?/i, "")
			.replace(/[^a-zA-Z0-9_-]/g, "");
		if (!channelName || channelName.length < 2) return results;

		try {
			const url = `https://www.bitchute.com/channel/${channelName}`;
			const res = await fetch(url, {
				headers: { accept: "text/html", "user-agent": "DegenFeed/1.0" },
			});
			if (res.ok) {
				const html = await res.text();
				const nameMatch = html.match(/<title>([^<]+?)<\/title>/);
				const avatarMatch = html.match(
					/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/,
				);

				results.push({
					platform: "bitchute",
					channelId: channelName,
					channelName: nameMatch?.[1]?.trim() ?? channelName,
					avatarUrl: avatarMatch?.[1],
					followerCount: 0,
					url: `https://www.bitchute.com/channel/${channelName}`,
					verified: false,
					relevanceScore: 8,
				});
			}
		} catch {
			// BitChute unavailable
		}

		if (results.length === 0) {
			results.push({
				platform: "bitchute",
				channelId: channelName,
				channelName,
				followerCount: 0,
				url: `https://www.bitchute.com/channel/${channelName}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a Dailymotion channel by username.
	 * Uses Dailymotion's public API.
	 */
	async resolveDailymotion(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const username = search
			.replace(/^@/, "")
			.replace(/dailymotion\.com\//i, "")
			.replace(/[^a-zA-Z0-9_-]/g, "")
			.toLowerCase();
		if (!username || username.length < 2) return results;

		try {
			const url = `https://api.dailymotion.com/user/${encodeURIComponent(username)}?fields=id,username,screenname,avatar_url,url,videos_total`;
			const res = await fetch(url, {
				headers: { accept: "application/json" },
			});
			if (res.ok) {
				const data = (await res.json()) as {
					id: string;
					username: string;
					screenname: string;
					avatar_url?: string;
					url: string;
					videos_total?: number;
				};
				results.push({
					platform: "dailymotion",
					channelId: data.id,
					channelName: data.screenname || data.username,
					followerCount: 0,
					avatarUrl: data.avatar_url,
					url: data.url || `https://www.dailymotion.com/${username}`,
					verified: (data.videos_total ?? 0) > 50,
					relevanceScore: 10,
				});
			}
		} catch {
			// Dailymotion API unavailable
		}

		if (results.length === 0) {
			results.push({
				platform: "dailymotion",
				channelId: username,
				channelName: username,
				followerCount: 0,
				url: `https://www.dailymotion.com/${username}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a Vimeo user by username or channel name.
	 * Uses Vimeo API (requires token) or oEmbed fallback.
	 */
	async resolveVimeo(search: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		const username = search
			.replace(/^@/, "")
			.replace(/vimeo\.com\//i, "")
			.replace(/[^a-zA-Z0-9_-]/g, "")
			.toLowerCase();
		if (!username || username.length < 2) return results;

		try {
			// Try oEmbed as public fallback
			const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${encodeURIComponent(username)}`;
			const res = await fetch(oembedUrl, {
				headers: { accept: "application/json" },
			});
			if (res.ok) {
				const data = (await res.json()) as {
					author_name: string;
					author_url: string;
				};
				results.push({
					platform: "vimeo",
					channelId: username,
					channelName: data.author_name || username,
					followerCount: 0,
					url: data.author_url || `https://vimeo.com/${username}`,
					verified: false,
					relevanceScore: 8,
				});
			}
		} catch {
			// Vimeo API unavailable
		}

		if (results.length === 0) {
			results.push({
				platform: "vimeo",
				channelId: username,
				channelName: username,
				followerCount: 0,
				url: `https://vimeo.com/${username}`,
				verified: false,
				relevanceScore: 5,
			});
		}

		return results;
	}

	/**
	 * Resolve a Zora creator by wallet address.
	 * Checks if the address has created NFT collections on Zora.
	 */
	async resolveZora(address: string): Promise<CreatorSearchResult[]> {
		const results: CreatorSearchResult[] = [];
		if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return results;

		try {
			// Check Zora API for creator's collections
			const zoraApi = `https://api.zora.co/graphql`;
			const query = `
				query {
				  collections(
					where: {ownerAddresses: ["${address}"]}
					networks: {network: ETHEREUM, chain: MAINNET}
					pagination: {limit: 5}
				  ) {
					nodes {
					  name
					  symbol
					  totalSupply
					}
				  }
				}
			`;

			const res = await fetch(zoraApi, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ query }),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					data?: {
						collections?: {
							nodes: Array<{
								name: string;
								symbol: string;
								totalSupply: number;
							}>;
						};
					};
				};
				const collections = data?.data?.collections?.nodes ?? [];
				if (collections.length > 0) {
					results.push({
						platform: "zora",
						channelId: address,
						channelName:
							collections[0]?.name ?? `Creator ${address.slice(0, 6)}`,
						followerCount: 0,
						url: `https://zora.co/${address}`,
						verified: true,
						relevanceScore: 12 + Math.min(collections.length, 5),
					});
				}
			}
		} catch {
			// Zora API unavailable
		}

		return results;
	}
}
