/**
 * @degenfeed/api-worker — Unified Multi-Protocol Shorts Pipeline
 *
 * The holy grail of short video distribution. A creator posts once,
 * and their short appears on EVERY protocol simultaneously:
 *
 *   ActivityPub (Mastodon/GoToSocial/Loops/Pixelfed/PeerTube)
 *   AT Protocol (Bluesky/Flashes)
 *   Nostr
 *   Farcaster
 *   Lens
 *   Zora (as a video NFT — mint once, tradeable anywhere)
 *   PeerTube (federated video hosting)
 *   DegenFeed (our own swipe feed)
 *
 * Key design principle: fail-open. If any protocol is unreachable,
 * the others still succeed. Partial success is success.
 *
 * @see orchestratePublish in publish-orchestrator.ts for the text-publish engine
 * @see ZoraVideoIntegration in zora-video.ts for NFT minting
 */

import type { Protocol } from "@degenfeed/types";
import type { Env } from "../index";
import { orchestratePublish, type PublishReport } from "./publish-orchestrator";
import { ZoraVideoIntegration } from "./zora-video";

// ─── Types ────────────────────────────────────────────────────────────────

export type ShortProtocol =
	| "activitypub"
	| "atproto"
	| "nostr"
	| "farcaster"
	| "lens"
	| "zora"
	| "peertube"
	| "degenfeed";

export type Chain = "base" | "ethereum" | "optimism" | "arbitrum" | "solana";

export interface ShortVideo {
	id: string;
	title: string;
	caption: string;
	videoUrl: string;
	thumbnailUrl: string;
	duration: number;
	hashtags: string[];
	creator: {
		address: string;
		handle: string;
		avatar?: string;
	};
	creatorCoin?: {
		symbol: string;
		address: string;
		chain: Chain;
	};
	publishedAt: number;
	protocols: Partial<Record<ShortProtocol, string>>; // URL on each protocol
	zoraTokenId?: string;
	zoraContractAddress?: string;
	zoraUrl?: string;
	engagement: {
		likes: number;
		views: number;
		tips: number;
	};
	contentHash: string; // IPFS CID or SHA256 of the video
}

export interface PublishShortOptions {
	videoFile?: File; // Only used when uploading from browser
	videoUrl: string; // Must be provided if no videoFile
	thumbnailUrl: string;
	title: string;
	caption: string;
	hashtags: string[];
	protocols: ShortProtocol[];
	mintOnZora: boolean;
	creatorAddress: string;
	creatorHandle: string;
	creatorAvatar?: string;
	creatorCoin?: { symbol: string; address: string; chain: Chain };
	/** Auth tokens per protocol (keys match ShortProtocol values) */
	auth?: Partial<Record<ShortProtocol, string>>;
	/** Duration in seconds */
	duration?: number;
}

export interface UnifiedShortResult {
	id: string;
	success: boolean;
	urls: Partial<Record<ShortProtocol, string>>;
	zoraTokenId?: string;
	zoraContractAddress?: string;
	zoraUrl?: string;
	degenfeedUrl: string;
	tipLink: string;
	publishReport?: PublishReport;
	errors: Partial<Record<ShortProtocol, string>>;
}

export interface TipResult {
	success: boolean;
	txHash?: string;
	protocol: ShortProtocol;
	amount: string;
	error?: string;
}

// ─── Internal state tracking ─────────────────────────────────────────────

interface ProtocolState {
	protocol: ShortProtocol;
	url?: string;
	error?: string;
}

// ─── Source protocol map (colors, labels for UI) ─────────────────────────

export const PROTOCOL_META: Record<
	ShortProtocol,
	{
		label: string;
		color: string;
		icon: string;
		shortLabel: string;
	}
> = {
	activitypub: {
		label: "ActivityPub",
		color: "#6364ff",
		icon: "Mastodon",
		shortLabel: "AP",
	},
	atproto: {
		label: "AT Protocol",
		color: "#0085ff",
		icon: "Bluesky",
		shortLabel: "AT",
	},
	nostr: {
		label: "Nostr",
		color: "#7c3aed",
		icon: "Nostr",
		shortLabel: "Nostr",
	},
	farcaster: {
		label: "Farcaster",
		color: "#8b5cf6",
		icon: "Farcaster",
		shortLabel: "FC",
	},
	lens: {
		label: "Lens",
		color: "#00501e",
		icon: "Lens",
		shortLabel: "Lens",
	},
	zora: {
		label: "Zora",
		color: "#f5a623",
		icon: "Zora",
		shortLabel: "Zora",
	},
	peertube: {
		label: "PeerTube",
		color: "#f1680d",
		icon: "PeerTube",
		shortLabel: "PT",
	},
	degenfeed: {
		label: "DegenFeed",
		color: "#00ff41",
		icon: "DegenFeed",
		shortLabel: "DF",
	},
};

// ─── Unified Pipeline ────────────────────────────────────────────────────

export class UnifiedShortsPipeline {
	private env: Env;
	private zoraIntegration: ZoraVideoIntegration;

	constructor(env: Env) {
		this.env = env;
		this.zoraIntegration = new ZoraVideoIntegration(env);
	}

	// ── Main: Publish a short to ALL selected protocols in one shot ────

	async publishShort(opts: PublishShortOptions): Promise<UnifiedShortResult> {
		const id = this.generateShortId();
		const _startedAt = Date.now();
		const protocolStates: ProtocolState[] = [];
		const errors: Partial<Record<ShortProtocol, string>> = {};

		// 1. Upload video to IPFS/Arweave if it's a File
		let videoUrl = opts.videoUrl;
		if (opts.videoFile) {
			try {
				videoUrl = await this.uploadToPermanentStorage(opts.videoFile);
			} catch (err) {
				return {
					id,
					success: false,
					urls: {},
					degenfeedUrl: "",
					tipLink: "",
					errors: {
						degenfeed: `Video upload failed: ${err instanceof Error ? err.message : String(err)}`,
					},
				};
			}
		}

		// 2. Upload thumbnail to permanent storage
		let thumbnailUrl = opts.thumbnailUrl;
		if (!thumbnailUrl.startsWith("http")) {
			thumbnailUrl = `${this.env.DEGENFEED_CDN_URL || "https://cdn.degenfeed.xyz"}/shorts/${id}/thumb.jpg`;
		}

		// 3. Generate content hash for dedup + NFT metadata
		const contentHash = await this.computeContentHash(videoUrl);

		// 4. Publish to each protocol in parallel, fail-open
		const publishPromises = opts.protocols.map(async (protocol) => {
			try {
				let url: string | undefined;

				switch (protocol) {
					case "activitypub":
					case "atproto":
					case "nostr":
					case "farcaster":
					case "lens": {
						const result = await this.publishToSocialProtocol(
							protocol,
							opts,
							videoUrl,
							thumbnailUrl,
							id,
						);
						url = result.url;
						break;
					}
					case "peertube":
						url = await this.publishToPeerTube(opts, videoUrl, id);
						break;
					case "zora":
						if (opts.mintOnZora) {
							const result = await this.publishToZora(
								opts,
								videoUrl,
								thumbnailUrl,
								contentHash,
								id,
							);
							url = result.url;
							protocolStates.push(result.state);
						}
						break;
					case "degenfeed":
						url = await this.publishToDegenFeed(
							opts,
							videoUrl,
							thumbnailUrl,
							id,
							contentHash,
						);
						break;
				}

				if (url) {
					protocolStates.push({ protocol, url });
				}
			} catch (err) {
				errors[protocol] = err instanceof Error ? err.message : String(err);
			}
		});

		await Promise.allSettled(publishPromises);

		// 5. Build Zora state if minted
		const zoraState = protocolStates.find((s) => s.protocol === "zora");
		const zoraTokenId = await this.zoraIntegration.resolveTokenId(contentHash);
		const zoraContractAddress = this.env.ZORA_VIDEO_CONTRACT || "";

		// 6. Build the result
		const urls = {} as Partial<Record<ShortProtocol, string>>;
		for (const s of protocolStates) {
			if (s.url) urls[s.protocol] = s.url;
		}

		const degenfeedUrl = `https://app.degenfeed.xyz/shorts/${id}`;
		const tipLink = this.buildUniversalTipLink(id, opts.creatorAddress);

		// 7. Store short metadata in KV for feed aggregation
		await this.storeShortMetadata({
			id,
			title: opts.title,
			caption: opts.caption,
			videoUrl,
			thumbnailUrl,
			duration: opts.duration ?? 30,
			hashtags: opts.hashtags,
			creator: {
				address: opts.creatorAddress,
				handle: opts.creatorHandle,
				avatar: opts.creatorAvatar,
			},
			creatorCoin: opts.creatorCoin,
			publishedAt: Date.now(),
			protocols: urls,
			zoraTokenId,
			zoraContractAddress,
			zoraUrl: zoraState?.url,
			engagement: { likes: 0, views: 0, tips: 0 },
			contentHash,
		});

		return {
			id,
			success: Object.keys(urls).length > 0,
			urls,
			zoraTokenId,
			zoraContractAddress,
			zoraUrl: zoraState?.url,
			degenfeedUrl,
			tipLink,
			errors,
		};
	}

	// ── Protocol-specific publishers ───────────────────────────────────

	async publishToActivityPub(
		short: ShortVideo,
		auth?: Record<string, string>,
	): Promise<{ url: string; nativeId: string }> {
		const report = await orchestratePublish(
			{
				text: this.formatShortCaption(short),
				title: short.title,
				targets: ["mastodon" as Protocol],
				images: short.thumbnailUrl
					? [
							{
								url: short.thumbnailUrl,
								alt: short.title,
								mimeType: "image/jpeg",
							},
						]
					: undefined,
				links: [short.videoUrl],
				hashtags: short.hashtags,
				auth: auth as Record<string, string>,
			},
			this.env,
		);

		const result = report.results.mastodon;
		if (!result?.ok || !result.nativeId) {
			throw new Error(result?.error || "ActivityPub publish failed silently");
		}

		const instanceBase =
			auth?.mastodon_instance ||
			this.env.GTS_INSTANCE_URL ||
			"https://social.degenfeed.xyz";
		return {
			url:
				result.nativeUri ||
				`${instanceBase}/@${short.creator.handle}/${result.nativeId}`,
			nativeId: result.nativeId,
		};
	}

	async publishToATProtocol(
		short: ShortVideo,
		auth?: Record<string, string>,
	): Promise<{ url: string; nativeId: string }> {
		// AT Protocol: post with a video embed (app.bsky.embed.video)
		const text = this.formatShortCaption(short);
		const _embedVideo = {
			$type: "app.bsky.embed.video",
			video: {
				$type: "blob",
				ref: { $link: short.videoUrl },
				mimeType: "video/mp4",
				size: 0,
			},
			captions: [],
		};

		const report = await orchestratePublish(
			{
				text,
				title: short.title,
				targets: ["bluesky" as Protocol],
				images: short.thumbnailUrl
					? [
							{
								url: short.thumbnailUrl,
								alt: short.title,
								mimeType: "image/jpeg",
							},
						]
					: undefined,
				links: [short.videoUrl],
				hashtags: short.hashtags,
				auth: auth as Record<string, string>,
			},
			this.env,
		);

		const result = report.results.bluesky;
		if (!result?.ok || !result.nativeId) {
			throw new Error(result?.error || "AT Protocol publish failed silently");
		}

		return {
			url: `https://bsky.app/profile/${auth?.bluesky_did || ""}/post/${result.nativeId.split("/").pop()}`,
			nativeId: result.nativeId,
		};
	}

	async publishToNostr(
		short: ShortVideo,
		auth?: Record<string, string>,
	): Promise<{ url: string; nativeId: string }> {
		// Nostr: Kind 1 with video in content + "i" tag for video URL
		const report = await orchestratePublish(
			{
				text: `${short.title}\n\n${short.caption}\n\n${short.videoUrl}`,
				title: short.title,
				targets: ["nostr" as Protocol],
				images: short.thumbnailUrl
					? [
							{
								url: short.thumbnailUrl,
								alt: short.title,
								mimeType: "image/jpeg",
							},
						]
					: undefined,
				links: [short.videoUrl],
				hashtags: short.hashtags,
				auth: auth as Record<string, string>,
			},
			this.env,
		);

		const result = report.results.nostr;
		if (!result?.ok || !result.nativeId) {
			throw new Error(result?.error || "Nostr publish failed silently");
		}

		return {
			url: result.nativeUri || `https://snort.social/e/${result.nativeId}`,
			nativeId: result.nativeId,
		};
	}

	async publishToFarcaster(
		short: ShortVideo,
		auth?: Record<string, string>,
	): Promise<{ url: string; nativeId: string }> {
		const report = await orchestratePublish(
			{
				text: this.formatShortCaption(short),
				targets: ["farcaster" as Protocol],
				links: [short.videoUrl, short.thumbnailUrl].filter(Boolean),
				hashtags: short.hashtags,
				auth: auth as Record<string, string>,
			},
			this.env,
		);

		const result = report.results.farcaster;
		if (!result?.ok || !result.nativeId) {
			throw new Error(result?.error || "Farcaster publish failed silently");
		}

		return {
			url: `https://warpcast.com/${auth?.farcaster_username || ""}/${result.nativeId}`,
			nativeId: result.nativeId,
		};
	}

	async publishToLens(
		short: ShortVideo,
		auth?: Record<string, string>,
	): Promise<{ url: string; nativeId: string }> {
		const report = await orchestratePublish(
			{
				text: this.formatShortCaption(short),
				title: short.title,
				targets: ["lens" as Protocol],
				images: short.thumbnailUrl
					? [
							{
								url: short.thumbnailUrl,
								alt: short.title,
								mimeType: "image/jpeg",
							},
						]
					: undefined,
				links: [short.videoUrl],
				hashtags: short.hashtags,
				auth: auth as Record<string, string>,
			},
			this.env,
		);

		const result = report.results.lens;
		if (!result?.ok || !result.nativeId) {
			throw new Error(result?.error || "Lens publish failed silently");
		}

		return {
			url: `https://hey.xyz/posts/${result.nativeId}`,
			nativeId: result.nativeId,
		};
	}

	async publishToZora(
		opts: PublishShortOptions,
		videoUrl: string,
		thumbnailUrl: string,
		contentHash: string,
		shortId: string,
	): Promise<{ url: string; state: ProtocolState }> {
		const nftResult = await this.zoraIntegration.mintVideoNFT({
			videoUrl,
			thumbnailUrl,
			title: opts.title,
			description: opts.caption,
			creator: opts.creatorAddress,
			creatorCoin: opts.creatorCoin?.address,
			editionSize: 1,
			contentHash,
		});

		if (!nftResult.ok || !nftResult.tokenId) {
			throw new Error(nftResult.error || "Zora mint failed");
		}

		const zoraUrl = `https://zora.co/collect/${nftResult.contractAddress || "base"}:${nftResult.tokenId}`;

		// Announce the NFT to all other protocols
		await this.zoraIntegration.announceNFTToAllProtocols(
			nftResult.tokenId,
			{
				tokenId: nftResult.tokenId,
				contractAddress:
					nftResult.contractAddress || this.env.ZORA_VIDEO_CONTRACT || "",
				name: opts.title,
				description: opts.caption,
				videoUrl,
				thumbnailUrl,
				creator: opts.creatorAddress,
				creatorCoin: opts.creatorCoin?.address,
				mintPrice: nftResult.mintPrice || "0.0001",
				editionSize: 1,
				editionsMinted: 1,
				zoraUrl,
			},
			shortId,
		);

		return {
			url: zoraUrl,
			state: { protocol: "zora", url: zoraUrl },
		};
	}

	async publishToPeerTube(
		opts: PublishShortOptions,
		videoUrl: string,
		_shortId: string,
	): Promise<string> {
		const instanceUrl =
			this.env.PEERTUBE_INSTANCE_URL || "https://video.degenfeed.xyz";
		const clientId = this.env.PEERTUBE_CLIENT_ID;
		const clientSecret = this.env.PEERTUBE_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			throw new Error("PeerTube OAuth2 credentials not configured");
		}

		// PeerTube API: upload video via OAuth2
		const tokenRes = await fetch(`${instanceUrl}/api/v1/oauth/token`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: "client_credentials",
			}),
		});

		if (!tokenRes.ok) {
			throw new Error(`PeerTube auth failed: ${tokenRes.status}`);
		}

		const tokenData = (await tokenRes.json()) as { access_token: string };

		// Import the video from URL (don't re-upload if already on IPFS)
		const importRes = await fetch(`${instanceUrl}/api/v1/videos/imports`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${tokenData.access_token}`,
			},
			body: JSON.stringify({
				targetUrl: videoUrl,
				name: opts.title,
				description: opts.caption,
				tags: opts.hashtags.slice(0, 5),
				privacy: 1, // Public
				channelId: 1, // Default channel
			}),
		});

		if (!importRes.ok) {
			const errText = await importRes.text().catch(() => "");
			throw new Error(
				`PeerTube import failed: ${importRes.status} ${errText.slice(0, 200)}`,
			);
		}

		const importData = (await importRes.json()) as { video: { uuid: string } };
		return `${instanceUrl}/w/${importData.video.uuid}`;
	}

	async publishToDegenFeed(
		opts: PublishShortOptions,
		videoUrl: string,
		thumbnailUrl: string,
		shortId: string,
		contentHash: string,
	): Promise<string> {
		// Store in our KV for the feed to pick up
		const short: ShortVideo = {
			id: shortId,
			title: opts.title,
			caption: opts.caption,
			videoUrl,
			thumbnailUrl,
			duration: opts.duration ?? 30,
			hashtags: opts.hashtags,
			creator: {
				address: opts.creatorAddress,
				handle: opts.creatorHandle,
				avatar: opts.creatorAvatar,
			},
			creatorCoin: opts.creatorCoin,
			publishedAt: Date.now(),
			protocols: {},
			engagement: { likes: 0, views: 0, tips: 0 },
			contentHash,
		};

		await this.env.SHORTS?.put(`shorts:${shortId}`, JSON.stringify(short));
		return `https://app.degenfeed.xyz/shorts/${shortId}`;
	}

	// ── Cross-platform actions on existing shorts ──────────────────────

	async tipShort(
		shortId: string,
		amount: number,
		chain: Chain,
		protocol: ShortProtocol = "degenfeed",
	): Promise<TipResult> {
		// Route the tip through the appropriate protocol
		const short = await this.getShort(shortId);
		if (!short) {
			return {
				success: false,
				protocol,
				amount: String(amount),
				error: "Short not found",
			};
		}

		try {
			// If there's a Zora NFT, tipping means buying an edition
			if (short.zoraTokenId && short.zoraContractAddress) {
				const zoraTip = await this.zoraIntegration.tipVideoNFT(
					short.zoraTokenId,
					String(amount),
				);
				return {
					success: true,
					txHash: zoraTip.txHash,
					protocol: "zora",
					amount: String(amount),
				};
			}

			// Otherwise, use the universal tip link (x402 payment)
			const tipUrl = `https://api.degenfeed.xyz/shorts/${shortId}/tip`;
			const tipRes = await fetch(tipUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					amount: String(amount),
					chain,
					protocol,
					recipient: short.creator.address,
				}),
			});

			if (!tipRes.ok) {
				const errText = await tipRes.text().catch(() => "");
				return {
					success: false,
					protocol,
					amount: String(amount),
					error: errText,
				};
			}

			const tipData = (await tipRes.json()) as { txHash?: string };
			return {
				success: true,
				txHash: tipData.txHash,
				protocol,
				amount: String(amount),
			};
		} catch (err) {
			return {
				success: false,
				protocol,
				amount: String(amount),
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async likeShort(
		shortId: string,
		protocol: ShortProtocol = "degenfeed",
	): Promise<void> {
		// Record like in KV; cross-protocol sync handled by realtime-sync
		await this.env.SHORTS?.put(`shorts:${shortId}:likes`, String(Date.now()), {
			metadata: { protocol },
		});
	}

	async commentOnShort(
		shortId: string,
		text: string,
		protocol: ShortProtocol = "degenfeed",
	): Promise<void> {
		const comment = {
			id: crypto.randomUUID(),
			shortId,
			text,
			protocol,
			createdAt: Date.now(),
		};
		await this.env.SHORTS?.put(
			`shorts:${shortId}:comments:${comment.id}`,
			JSON.stringify(comment),
		);
	}

	async shareShort(
		shortId: string,
		targetProtocol: ShortProtocol,
	): Promise<{ url?: string }> {
		const short = await this.getShort(shortId);
		if (!short) throw new Error("Short not found");

		// If already published to that protocol, return existing URL
		if (short.protocols[targetProtocol]) {
			return { url: short.protocols[targetProtocol] };
		}

		// Otherwise, publish to the new protocol
		const auth = await this.getProtocolAuth(
			targetProtocol,
			short.creator.address,
		);
		let result: { url: string; nativeId: string };

		switch (targetProtocol) {
			case "activitypub":
				result = await this.publishToActivityPub(short, auth);
				break;
			case "atproto":
				result = await this.publishToATProtocol(short, auth);
				break;
			case "nostr":
				result = await this.publishToNostr(short, auth);
				break;
			case "farcaster":
				result = await this.publishToFarcaster(short, auth);
				break;
			case "lens":
				result = await this.publishToLens(short, auth);
				break;
			case "zora":
				throw new Error("Use mintZoraShort to mint an NFT after publishing");
			default:
				throw new Error(`Protocol ${targetProtocol} not supported for share`);
		}

		// Update the short's protocol URLs in KV
		short.protocols[targetProtocol] = result.url;
		await this.env.SHORTS?.put(`shorts:${shortId}`, JSON.stringify(short));

		return { url: result.url };
	}

	async mintZoraShort(
		shortId: string,
	): Promise<{ tokenId: string; zoraUrl: string }> {
		const short = await this.getShort(shortId);
		if (!short) throw new Error("Short not found");

		if (short.zoraTokenId) {
			return {
				tokenId: short.zoraTokenId,
				zoraUrl: short.zoraUrl || "",
			};
		}

		const nftResult = await this.zoraIntegration.mintVideoNFT({
			videoUrl: short.videoUrl,
			thumbnailUrl: short.thumbnailUrl,
			title: short.title,
			description: short.caption,
			creator: short.creator.address,
			creatorCoin: short.creatorCoin?.address,
			editionSize: 1,
			contentHash: short.contentHash,
		});

		if (!nftResult.ok || !nftResult.tokenId) {
			throw new Error(nftResult.error || "Zora mint failed");
		}

		const zoraUrl = `https://zora.co/collect/${nftResult.contractAddress || this.env.ZORA_VIDEO_CONTRACT || "base"}:${nftResult.tokenId}`;

		short.zoraTokenId = nftResult.tokenId;
		short.zoraContractAddress =
			nftResult.contractAddress || this.env.ZORA_VIDEO_CONTRACT || "";
		short.zoraUrl = zoraUrl;
		short.protocols.zora = zoraUrl;
		await this.env.SHORTS?.put(`shorts:${shortId}`, JSON.stringify(short));

		return { tokenId: nftResult.tokenId, zoraUrl };
	}

	// ── Internal helpers ───────────────────────────────────────────────

	private async publishToSocialProtocol(
		protocol: ShortProtocol,
		opts: PublishShortOptions,
		videoUrl: string,
		thumbnailUrl: string,
		shortId: string,
	): Promise<{ url: string; nativeId: string }> {
		const auth = opts.auth?.[protocol]
			? { [`${protocol}_token`]: opts.auth[protocol] }
			: {};

		const short: ShortVideo = {
			id: shortId,
			title: opts.title,
			caption: opts.caption,
			videoUrl,
			thumbnailUrl,
			duration: opts.duration ?? 30,
			hashtags: opts.hashtags,
			creator: {
				address: opts.creatorAddress,
				handle: opts.creatorHandle,
				avatar: opts.creatorAvatar,
			},
			creatorCoin: opts.creatorCoin,
			publishedAt: Date.now(),
			protocols: {},
			engagement: { likes: 0, views: 0, tips: 0 },
			contentHash: "",
		};

		switch (protocol) {
			case "activitypub":
				return this.publishToActivityPub(short, auth);
			case "atproto":
				return this.publishToATProtocol(short, auth);
			case "nostr":
				return this.publishToNostr(short, auth);
			case "farcaster":
				return this.publishToFarcaster(short, auth);
			case "lens":
				return this.publishToLens(short, auth);
			default:
				throw new Error(`Unsupported social protocol: ${protocol}`);
		}
	}

	private formatShortCaption(short: ShortVideo): string {
		let caption = short.title;
		if (short.caption) caption += `\n\n${short.caption}`;
		if (short.hashtags.length > 0) {
			const tags = short.hashtags.map((t) => `#${t}`).join(" ");
			caption += `\n\n${tags}`;
		}
		caption += `\n\n🎬 Watch on DegenFeed: https://app.degenfeed.xyz/shorts/${short.id}`;
		return caption;
	}

	private generateShortId(): string {
		// Short, URL-safe, unique: nanoid-style with DF prefix
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		let result = "df_";
		for (let i = 0; i < 14; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	private async uploadToPermanentStorage(_file: File): Promise<string> {
		// Upload to IPFS via web3.storage or Pinata, or to Arweave
		// For now, return placeholder — real upload requires SDK integration
		throw new Error(
			"Direct file upload not yet implemented — provide a videoUrl instead",
		);
	}

	private async computeContentHash(videoUrl: string): Promise<string> {
		// Compute SHA256 hash of the video content for dedup + NFT metadata
		const data = new TextEncoder().encode(videoUrl);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	private buildUniversalTipLink(
		shortId: string,
		_creatorAddress: string,
	): string {
		// x402 payment URL for tipping this short
		return `https://api.degenfeed.xyz/x402/shorts/${shortId}/tip`;
	}

	private async getShort(shortId: string): Promise<ShortVideo | null> {
		try {
			const raw = await this.env.SHORTS?.get(`shorts:${shortId}`);
			return raw ? (JSON.parse(raw) as ShortVideo) : null;
		} catch {
			return null;
		}
	}

	private async storeShortMetadata(short: ShortVideo): Promise<void> {
		await this.env.SHORTS?.put(`shorts:${short.id}`, JSON.stringify(short));
		// Also index for feed queries
		await this.env.SHORTS?.put(
			`shorts:by_creator:${short.creator.address}:${short.id}`,
			JSON.stringify({ id: short.id, publishedAt: short.publishedAt }),
		);
		// Index by hashtag for discovery
		for (const tag of short.hashtags) {
			await this.env.SHORTS?.put(
				`shorts:by_tag:${tag.toLowerCase()}:${short.id}`,
				JSON.stringify({ id: short.id }),
				{ expirationTtl: 86400 * 30 },
			);
		}
	}

	private async getProtocolAuth(
		protocol: ShortProtocol,
		creatorAddress: string,
	): Promise<Record<string, string>> {
		// Retrieve stored auth tokens for this creator from KV
		try {
			const raw = await this.env.IDENTITIES?.get(
				`auth:${creatorAddress}:${protocol}`,
			);
			return raw ? (JSON.parse(raw) as Record<string, string>) : {};
		} catch {
			return {};
		}
	}
}
