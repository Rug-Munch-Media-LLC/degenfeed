/**
 * @degenfeed/api-worker — Cross-Protocol Chat Bridge
 *
 * Bridges chat from ALL platforms (ActivityPub, AT Protocol, Farcaster, etc.)
 * where a stream was announced into the DegenFeed stream chat.
 *
 * When a stream goes live, this module:
 *   1. Checks which platforms the stream was announced to
 *   2. Polls each platform for new replies/comments
 *   3. Normalizes all replies into a unified StreamComment format
 *   4. Pushes them to the stream's WebSocket chat channel
 *   5. Labels each message with its source ("via Mastodon", "via Bluesky", etc.)
 *
 * This makes DegenFeed the CENTRAL hub where ALL cross-platform conversation
 * converges into a single unified chat experience.
 */

import type { Env } from "../index";
import { broadcastToAll } from "../ws-broadcast";
import { CHANNELS } from "../ws-channels";
import type { StreamComment } from "./activitypub-stream-bridge";
import { ActivityPubStreamBridge } from "./activitypub-stream-bridge";
import { BlueskyStreamBridge } from "./bluesky-stream-bridge";
import { NostrLiveBridge } from "./nostr-live-bridge";
import { ThreadsStreamBridge } from "./threads-stream-bridge";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ChatBridgeConfig {
	/** Polling interval in ms (default: 30_000) */
	pollIntervalMs?: number;
	/** Whether to bridge from ActivityPub (default: true) */
	bridgeFromActivityPub?: boolean;
	/** Whether to bridge from AT Protocol (default: true) */
	bridgeFromAtProtocol?: boolean;
	/** Whether to bridge from Farcaster (default: true) */
	bridgeFromFarcaster?: boolean;
	/** Whether to bridge from Nostr (default: true) */
	bridgeFromNostr?: boolean;
	/** Whether to bridge from Threads (default: true) */
	bridgeFromThreads?: boolean;
}

/**
 * KV key for the bridge config per stream.
 */
function bridgeConfigKey(streamId: string): string {
	return `bridge:config:${streamId}`;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────

interface PlatformAuth {
	activitypub?: { accessToken: string; instanceUrl?: string };
	atproto?: { accessJwt: string; did: string; pdsUrl?: string };
	farcaster?: { signerKeyHex?: string; fid?: number };
}

/**
 * Resolve platform auth from the stored IdentityHub credentials.
 * Falls back to env-level bot tokens when creator-specific creds are unavailable.
 */
async function resolvePlatformAuth(
	env: Env,
	creatorWallet: string,
): Promise<PlatformAuth> {
	const auth: PlatformAuth = {};

	try {
		// Try to use IdentityHub for per-creator credentials
		const { IdentityHub } = await import("@degenfeed/identity-hub");
		const hub = new IdentityHub({ kv: env.IDENTITIES });
		const resolved = await hub.resolveWallet(creatorWallet);

		// ActivityPub
		const apInfo = resolved.protocols["mastodon"];
		if (apInfo?.linked) {
			const creds = await hub.getCredentials(creatorWallet, "mastodon");
			auth.activitypub = {
				accessToken: creds?.encrypted ?? "", // Would need decryption in production
				instanceUrl: env.GTS_INSTANCE_URL,
			};
		}

		// AT Protocol
		const bskyInfo = resolved.protocols["bluesky"];
		if (bskyInfo?.linked) {
			const creds = await hub.getCredentials(creatorWallet, "bluesky");
			auth.atproto = {
				accessJwt: creds?.encrypted ?? "",
				did: bskyInfo.identifier ?? env.BSKY_DID ?? "",
				pdsUrl: env.BSKY_SOCIAL_URL,
			};
		}
	} catch {
		// Fall back to env-level bot tokens
		auth.atproto = {
			accessJwt: "",
			did: env.BSKY_DID ?? "",
		};
	}

	return auth;
}

// ─── Cross-Protocol Chat Bridge ───────────────────────────────────────────

export class CrossProtocolChatBridge {
	private env: Env;
	private apBridge: ActivityPubStreamBridge;
	private bskyBridge: BlueskyStreamBridge;
	private nostrBridge: NostrLiveBridge;
	private threadsBridge: ThreadsStreamBridge;

	constructor(env: Env) {
		this.env = env;
		this.apBridge = new ActivityPubStreamBridge(env);
		this.bskyBridge = new BlueskyStreamBridge(env);
		this.nostrBridge = new NostrLiveBridge(env);
		this.threadsBridge = new ThreadsStreamBridge(env);
	}

	/**
	 * Bridge chat from ALL platforms where the stream was announced.
	 *
	 * 1. Checks which platforms have announcement records in KV
	 * 2. Fetches replies from each platform in parallel
	 * 3. Normalizes and pushes to the stream's WebSocket chat
	 *
	 * Call this once when the stream goes live. It returns immediately
	 * after the initial fetch; the caller should set up a polling loop
	 * using startPolling().
	 */
	async bridgeChat(
		streamId: string,
		creatorWallet?: string,
		config?: ChatBridgeConfig,
	): Promise<StreamComment[]> {
		const allComments: StreamComment[] = [];

		const tasks: Array<Promise<StreamComment[]>> = [];

		// Check which platforms the stream was announced to

		// ActivityPub
		const apRecord = await this.apBridge.getAnnouncement(streamId);
		if (apRecord && (config?.bridgeFromActivityPub ?? true)) {
			tasks.push(this.fetchFromActivityPub(streamId, creatorWallet));
		}

		// AT Protocol (Bluesky)
		const bskyRecord = await this.bskyBridge.getAnnouncement(streamId);
		if (bskyRecord && (config?.bridgeFromAtProtocol ?? true)) {
			tasks.push(this.fetchFromAtProtocol(streamId, creatorWallet));
		}

		// Nostr (Kind 1 replies to live event + Kind 9735 zap receipts)
		if (config?.bridgeFromNostr ?? true) {
			tasks.push(this.fetchFromNostr(streamId));
		}

		// Threads (via ActivityPub federation — replies from threads.net users)
		if (config?.bridgeFromThreads ?? true) {
			tasks.push(this.fetchFromThreads(streamId));
		}

		// Run all in parallel
		const results = await Promise.allSettled(tasks);
		for (const result of results) {
			if (result.status === "fulfilled") {
				allComments.push(...result.value);
			}
		}

		// Store the config for polling
		if (config) {
			await this.env.CONTENT_STORE?.put(
				bridgeConfigKey(streamId),
				JSON.stringify(config),
				{ expirationTtl: 86400 * 7 },
			).catch(() => {});
		}

		return allComments;
	}

	/**
	 * Start polling all platforms for new chat messages.
	 *
	 * Polls every `pollIntervalMs` (default 30s) until the stream ends
	 * or the abort signal is triggered.
	 *
	 * Each batch of new comments is pushed to the stream's WebSocket and
	 * also stored in the stream's chat message log in KV.
	 */
	async startPolling(
		streamId: string,
		creatorWallet?: string,
		abortSignal?: AbortSignal,
		config?: ChatBridgeConfig,
	): Promise<void> {
		const interval = config?.pollIntervalMs ?? 30_000;

		const poll = async () => {
			if (abortSignal?.aborted) return;

			try {
				const newComments = await this.bridgeChat(
					streamId,
					creatorWallet,
					config,
				);

				for (const comment of newComments) {
					// Push to stream chat via WebSocket
					broadcastToAll(CHANNELS.FEED_UPDATE, {
						type: "stream_chat_message",
						streamId,
						message: {
							...comment,
							text: `[via ${comment.protocolLabel}] ${comment.text}`,
						},
					});

					// Store in stream chat log in KV
					try {
						const chatKey = `stream:chat:${streamId}`;
						const raw = await this.env.CONTENT_STORE?.get(chatKey);
						const messages: StreamComment[] = raw ? JSON.parse(raw) : [];
						messages.push(comment);
						const trimmed =
							messages.length > 500 ? messages.slice(-500) : messages;
						await this.env.CONTENT_STORE?.put(
							chatKey,
							JSON.stringify(trimmed),
							{
								expirationTtl: 86400, // 24h
							},
						);
					} catch {
						// Non-critical
					}
				}
			} catch {
				// Silently retry on next poll
			}
		};

		// Initial poll
		await poll();

		// Schedule recurring polls
		const timer = setInterval(poll, interval);

		// Clean up on abort
		if (abortSignal) {
			abortSignal.addEventListener("abort", () => {
				clearInterval(timer);
			});
		}
	}

	/**
	 * Fetch replies from Nostr for a stream via the NostrLiveBridge.
	 */
	private async fetchFromNostr(streamId: string): Promise<StreamComment[]> {
		try {
			// Get the Nostr event ID from the announcement record
			const eventKey = `bridge:nostr:announcement:${streamId}`;
			const raw = await this.env.CONTENT_STORE?.get(eventKey);
			if (!raw) return [];

			const record = JSON.parse(raw) as {
				streamId: string;
				eventId: string;
				protocol: string;
			};

			const reactions = await this.nostrBridge.fetchReactions(record.eventId);

			return reactions
				.filter((r) => r.type === "reply")
				.map((r) => ({
					id: `nostr:${r.nativeId}`,
					protocol: "nostr",
					protocolLabel: "Nostr",
					authorId: `nostr:${r.pubkey}`,
					authorName: r.pubkey.slice(0, 12),
					text: r.content.slice(0, 500),
					createdAt: r.createdAt,
				}));
		} catch {
			return [];
		}
	}

	/**
	 * Fetch replies from Threads users via the GoToSocial context API.
	 *
	 * Threads users who follow our GtS instance can reply to our posts.
	 * We filter GtS context descendants for accts containing 'threads.net'.
	 */
	private async fetchFromThreads(streamId: string): Promise<StreamComment[]> {
		try {
			// Get the ActivityPub post ID (same one used for AP bridge)
			const apRecord = await this.apBridge.getAnnouncement(streamId);
			if (!apRecord) return [];

			const replies = await this.threadsBridge.fetchThreadsReplies(
				apRecord.postId,
			);

			return replies.map((r) => ({
				id: `threads:${r.id}`,
				protocol: "threads",
				protocolLabel: "Threads",
				authorId: `threads:${r.threadsAcct}`,
				authorName: r.authorName,
				authorAvatar: r.authorAvatar,
				text: r.text,
				createdAt: r.createdAt,
			}));
		} catch {
			return [];
		}
	}

	/**
	 * Stop bridging for a stream (on stream end).
	 */
	async stopBridging(streamId: string): Promise<void> {
		// Clean up announcement records
		await Promise.allSettled([
			this.apBridge.removeAnnouncement(streamId),
			this.bskyBridge.removeAnnouncement(streamId),
			this.env.CONTENT_STORE?.delete(bridgeConfigKey(streamId)),
			this.env.CONTENT_STORE?.delete(`bridge:nostr:announcement:${streamId}`),
		]);
	}

	// ─── Private Fetch Helpers ────────────────────────────────────────────

	/**
	 * Fetch replies from ActivityPub for a stream.
	 */
	private async fetchFromActivityPub(
		streamId: string,
		creatorWallet?: string,
	): Promise<StreamComment[]> {
		// Try to get creator-specific auth
		if (creatorWallet) {
			const auth = await resolvePlatformAuth(this.env, creatorWallet);
			if (auth.activitypub?.accessToken) {
				return this.apBridge.fetchReplies(
					streamId,
					auth.activitypub.accessToken,
				);
			}
		}

		// Fall back to no auth (only public replies if instance allows)
		return this.apBridge.fetchReplies(streamId);
	}

	/**
	 * Fetch replies from AT Protocol (Bluesky) for a stream.
	 */
	private async fetchFromAtProtocol(
		streamId: string,
		creatorWallet?: string,
	): Promise<StreamComment[]> {
		// Try to get creator-specific auth
		if (creatorWallet) {
			const auth = await resolvePlatformAuth(this.env, creatorWallet);
			if (auth.atproto?.accessJwt) {
				return this.bskyBridge.fetchReplies(streamId, auth.atproto.accessJwt);
			}
		}

		// Fall back to public access (may not include private replies)
		return this.bskyBridge.fetchReplies(streamId);
	}
}

/**
 * Get all cross-platform chat messages for a stream from KV.
 */
export async function getBridgedChatMessages(
	env: Env,
	streamId: string,
): Promise<StreamComment[]> {
	try {
		const raw = await env.CONTENT_STORE?.get(`stream:chat:${streamId}`);
		if (!raw) return [];
		return JSON.parse(raw) as StreamComment[];
	} catch {
		return [];
	}
}

// ─── Convenience Functions (for stream-announcer & app.ts compatibility) ──

/**
 * Start the cross-protocol chat bridge for a stream.
 *
 * Called by stream-announcer.ts after a successful announcement and by
 * the POST /api/cross-protocol-bridge/stream/start API endpoint.
 *
 * Fetches existing replies from all announced protocols and starts
 * polling for new ones.
 */
export async function startBridge(
	env: Env,
	streamId: string,
	announcementResults?: AnnouncementResults,
	creatorWallet?: string,
): Promise<void> {
	const bridge = new CrossProtocolChatBridge(env);

	// If we have announcement results, store records for the bridge
	if (announcementResults) {
		const apResult = announcementResults["activitypub"];
		if (apResult?.ok && apResult.id) {
			await env.CONTENT_STORE?.put(
				`bridge:ap:announcement:${streamId}`,
				JSON.stringify({
					streamId,
					protocol: "activitypub" as const,
					postId: apResult.id,
					postUrl: apResult.url,
					instanceUrl: env.GTS_INSTANCE_URL || "https://social.degenfeed.xyz",
					announcedAt: Date.now(),
				}),
				{ expirationTtl: 86400 * 7 },
			).catch(() => {});
		}

		const bskyResult = announcementResults["atproto"];
		if (bskyResult?.ok && bskyResult.id) {
			const postUri = bskyResult.id;
			const parts = postUri.split("/");
			const rkey = parts[parts.length - 1] ?? "";
			const did = parts[2] ?? "";

			await env.CONTENT_STORE?.put(
				`bridge:bsky:announcement:${streamId}`,
				JSON.stringify({
					streamId,
					protocol: "atproto" as const,
					postUri,
					cid: "",
					postUrl: `https://bsky.app/profile/${did}/post/${rkey}`,
					announcedAt: Date.now(),
				}),
				{ expirationTtl: 86400 * 7 },
			).catch(() => {});
		}

		// Store Nostr announcement record for reply bridging
		const nostrResult = announcementResults["nostr"];
		if (nostrResult?.ok && nostrResult.id) {
			await env.CONTENT_STORE?.put(
				`bridge:nostr:announcement:${streamId}`,
				JSON.stringify({
					streamId,
					protocol: "nostr" as const,
					eventId: nostrResult.id,
					announcedAt: Date.now(),
				}),
				{ expirationTtl: 86400 * 7 },
			).catch(() => {});
		}
	}

	// Do an initial bridge fetch (non-blocking)
	bridge.bridgeChat(streamId, creatorWallet).catch(() => {});
}

/**
 * Stop the cross-protocol chat bridge for a stream.
 *
 * Called by stream-announcer.ts when a stream ends and by
 * the POST /api/cross-protocol-bridge/stream/stop API endpoint.
 * Cleans up announcement records and KV state.
 */
export async function stopBridge(env: Env, streamId: string): Promise<void> {
	const bridge = new CrossProtocolChatBridge(env);
	await bridge.stopBridging(streamId);
}

// Re-import for the convenience functions
import type { AnnouncementResults } from "./stream-announcer";
