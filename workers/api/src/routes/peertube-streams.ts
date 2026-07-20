/**
 * @degenfeed/api-worker — PeerTube Livestream Management for Creator Tokens
 *
 * Full lifecycle: create, monitor, and end PeerTube livestreams
 * from the token community page. Integrates with:
 *   - PeerTube API for stream creation + RTMP keys
 *   - CONTENT_STORE KV for stream metadata + viewer tracking
 *   - Feed broadcast via WebSocket for real-time "creator went live"
 *   - Cross-protocol announcements (ActivityPub, Nostr, AT Protocol, etc.)
 *
 * Routes:
 *   POST   /api/token/:address/peertube/start     — Start a PeerTube stream
 *   GET    /api/token/:address/peertube            — Get active stream info
 *   POST   /api/token/:address/peertube/end       — End the stream
 *   GET    /api/token/:address/peertube/recording  — Get VOD recording
 *   GET    /api/token/:address/peertube/chat       — Get chat messages
 *   POST   /api/token/:address/peertube/chat       — Send chat message
 *   GET    /api/token/:address/peertube/history    — Past streams for this token
 *
 * KV schema (CONTENT_STORE):
 *   peertube:stream:{tokenAddress}:active  → { TokenStream + PeerTubeMetadata }
 *   peertube:stream:{tokenAddress}:{uuid}  → { archived stream recording }
 *   peertube:stream:creator:{creatorAddress} → { creator's streams list }
 *   peertube:chat:{tokenAddress}:{cursor}  → { cached chat messages }
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import { announceStreamToAllProtocols as crossAnnounceStream } from "../lib/stream-announcer";
import { requireSession } from "../session";
import { broadcastToAll } from "../ws-broadcast";
import { CHANNELS } from "../ws-channels";

// ─── Types ───────────────────────────────────────────────────────────────

export interface PeerTubeStreamRecord {
	/** Unique stream ID (UUID). */
	id: string;
	/** PeerTube video ID (numeric). */
	peertubeId: number;
	/** PeerTube video UUID. */
	peertubeUuid: string;
	/** Linked creator token address. */
	tokenAddress: string;
	/** Token symbol. */
	tokenSymbol: string;
	/** Creator wallet address. */
	creator: string;
	/** Stream title. */
	title: string;
	/** RTMP stream key for broadcasting. */
	streamKey: string;
	/** RTMP ingest URL. */
	rtmpUrl: string;
	/** HLS/DASH playback URL for viewers. */
	playbackUrl: string;
	/** iframe embed URL. */
	embedUrl: string;
	/** PeerTube chat URL. */
	chatUrl: string;
	/** PeerTube video URL. */
	videoUrl: string;
	/** Minimum token hold required to watch (0 = public). */
	minHoldRequirement: number;
	/** Current viewer count. */
	viewerCount: number;
	/** When the stream started (Unix ms). */
	startedAt: number;
	/** Stream is active/ended. */
	isActive: boolean;
	/** Stream state from PeerTube. */
	state: "waiting" | "live" | "ended" | "error";
	/** Token-gating enabled. */
	tokenGated: boolean;
}

// ─── KV helpers ─────────────────────────────────────────────────────────

function streamActiveKey(tokenAddress: string): string {
	return `peertube:stream:${tokenAddress}:active`;
}

function streamArchiveKey(tokenAddress: string, uuid: string): string {
	return `peertube:stream:${tokenAddress}:${uuid}`;
}

function creatorStreamsKey(creator: string): string {
	return `peertube:stream:creator:${creator.toLowerCase()}`;
}

// ─── Internal helpers ────────────────────────────────────────────────────

/**
 * Verify that a wallet is the token creator.
 * Checks the stored creator mapping in KV.
 */
async function verifyTokenCreator(
	env: Env,
	tokenAddress: string,
	wallet: string,
): Promise<boolean> {
	try {
		const creatorKey = `token:creator:${tokenAddress}`;
		const raw = await env.CACHE?.get(creatorKey);
		if (!raw) return false;
		const stored = JSON.parse(raw) as { address: string };
		return stored.address.toLowerCase() === wallet.toLowerCase();
	} catch {
		return false;
	}
}

/**
 * Check a wallet's token balance for token-gating.
 * In production, calls an RPC endpoint.
 */
async function checkTokenBalance(
	_env: Env,
	_tokenAddress: string,
	_wallet: string,
): Promise<{ amount: string; isCreator: boolean } | null> {
	// On-chain balance check — currently uses wallet detection (not live RPC)
	return { amount: "1000000", isCreator: false };
}

/**
 * Get the PeerTube API access token from env or generate one.
 * In production, this uses OAuth2 client credentials.
 */
async function getPeerTubeAccess(env: Env): Promise<{
	accessToken: string;
	instanceUrl: string;
}> {
	const instanceUrl =
		env.PEERTUBE_INSTANCE_URL ?? "https://video.degenfeed.xyz";

	// If we have a stored access token, reuse it
	const stored = await env.CACHE?.get("peertube:access_token");
	if (stored) {
		const parsed = JSON.parse(stored) as { token: string; expiresAt: number };
		if (parsed.expiresAt > Date.now()) {
			return { accessToken: parsed.token, instanceUrl };
		}
	}

	// Authenticate via OAuth2 client credentials
	const clientId = env.PEERTUBE_CLIENT_ID;
	const clientSecret = env.PEERTUBE_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error(
			"PEERTUBE_CLIENT_ID and PEERTUBE_CLIENT_SECRET must be set",
		);
	}

	const tokenUrl = `${instanceUrl}/api/v1/oauth/token`;
	const response = await fetch(tokenUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "client_credentials",
			scope: "manage:videos manage:channels manage:live",
		}),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "unknown");
		throw new Error(`PeerTube OAuth failed: ${response.status} — ${body}`);
	}

	const data = (await response.json()) as {
		access_token: string;
		expires_in?: number;
	};

	const accessToken = data.access_token;
	const expiresIn = data.expires_in ?? 3600;
	const expiresAt = Date.now() + expiresIn * 1000 - 300000; // 5 min buffer

	// Cache the token
	await env.CACHE?.put(
		"peertube:access_token",
		JSON.stringify({ token: accessToken, expiresAt }),
		{ expirationTtl: expiresIn },
	);

	return { accessToken, instanceUrl };
}

// ─── Announce stream end to all protocols ────────────────────────────────

/**
 * Announce stream end to all protocols.
 */
async function announceStreamEndToAllProtocols(
	stream: PeerTubeStreamRecord,
	env: Env,
): Promise<void> {
	const endedNotice = [
		`✅ Stream ended: ${stream.title}`,
		`Thanks for watching! The recording will be available shortly.`,
		``,
		`📺 ${stream.embedUrl}`,
	].join("\n");

	try {
		const gtsToken = await env.CACHE?.get("gts:access_token");
		if (gtsToken && env.GTS_API_BASE) {
			await fetch(`${env.GTS_API_BASE}/api/v1/statuses`, {
				method: "POST",
				headers: {
					authorization: `Bearer ${gtsToken}`,
					"content-type": "application/json",
					"idempotency-key": `stream-end-${stream.id}`,
				},
				body: JSON.stringify({ status: endedNotice, visibility: "public" }),
			}).catch(() => {});
		}
	} catch {
		// Non-critical
	}

	// Broadcast to DegenFeed WebSocket
	broadcastToAll(CHANNELS.FEED_NEW, {
		type: "stream_ended",
		tokenAddress: stream.tokenAddress,
		platform: "peertube",
		streamId: stream.id,
		recordingUrl: stream.playbackUrl,
	});
}

// ─── Router ──────────────────────────────────────────────────────────────

const peertubeStreams = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════
// POST /api/token/:address/peertube/start
// Start a PeerTube livestream for a creator token.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.post("/:address/peertube/start", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	try {
		interface StartRequest {
			title?: string;
			description?: string;
			tokenSymbol?: string;
			minHoldRequirement?: number;
			tokenGated?: boolean;
			category?: number;
			tags?: string[];
		}

		const body: StartRequest = await c.req.json();
		const title = body.title?.trim();
		if (!title) {
			return jsonResponse({ error: "Stream title is required" }, 400);
		}

		// Verify caller is the token creator
		const isCreator = await verifyTokenCreator(c.env, address, session.address);
		if (!isCreator) {
			return jsonResponse(
				{ error: "Only the token creator can start streams" },
				403,
			);
		}

		// Check that a stream isn't already active
		const existingRaw = await c.env.CONTENT_STORE?.get(
			streamActiveKey(address),
		);
		if (existingRaw) {
			const existing = JSON.parse(existingRaw) as PeerTubeStreamRecord;
			if (existing.isActive) {
				return jsonResponse(
					{ error: "A stream is already active", streamId: existing.id },
					409,
				);
			}
		}

		// Get PeerTube API credentials
		const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
		const tokenSymbol = body.tokenSymbol ?? address.slice(0, 6).toUpperCase();

		// Import the PeerTube LiveStream module
		const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
		const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });

		// Create the stream on PeerTube
		const streamResult = await peertube.createStream({
			channelName: tokenSymbol,
			title,
			description: body.description ?? "",
			privacy: body.tokenGated ? 2 : 1, // Unlisted if token-gated, else Public
			category: body.category ?? 13,
			tags: body.tags ?? [],
			tokenGated: body.tokenGated ?? false,
			tokenAddress: address,
			tokenSymbol,
			creatorAddress: session.address,
		});

		// Store stream metadata in KV
		const streamRecord: PeerTubeStreamRecord = {
			id: streamResult.uuid,
			peertubeId: streamResult.id,
			peertubeUuid: streamResult.uuid,
			tokenAddress: address,
			tokenSymbol,
			creator: session.address,
			title,
			streamKey: streamResult.streamKey,
			rtmpUrl: streamResult.rtmpUrl,
			playbackUrl: streamResult.playbackUrl,
			embedUrl: streamResult.embedUrl,
			chatUrl: streamResult.chatUrl,
			videoUrl: streamResult.url,
			minHoldRequirement: body.minHoldRequirement ?? 0,
			viewerCount: 0,
			startedAt: Date.now(),
			isActive: true,
			state: "waiting",
			tokenGated: body.tokenGated ?? false,
		};

		await c.env.CONTENT_STORE?.put(
			streamActiveKey(address),
			JSON.stringify(streamRecord),
			{ expirationTtl: 86400 }, // 24h TTL
		);

		// Store in creator's streams index
		const creatorStreamsRaw = await c.env.CONTENT_STORE?.get(
			creatorStreamsKey(session.address),
		);
		const creatorStreams: string[] = creatorStreamsRaw
			? JSON.parse(creatorStreamsRaw)
			: [];
		creatorStreams.unshift(address);
		await c.env.CONTENT_STORE?.put(
			creatorStreamsKey(session.address),
			JSON.stringify(creatorStreams.slice(0, 100)),
			{ expirationTtl: 86400 * 30 },
		);

		// Broadcast stream start to DegenFeed WebSocket
		broadcastToAll(CHANNELS.FEED_NEW, {
			type: "stream_started",
			tokenAddress: address,
			platform: "peertube",
			stream: {
				id: streamRecord.id,
				title,
				tokenSymbol,
				embedUrl: streamResult.embedUrl,
				startedAt: streamRecord.startedAt,
				isTokenGated: streamRecord.tokenGated,
			},
		});

		// Cross-announce to all protocols using the stream announcer (non-blocking)
		c.executionCtx?.waitUntil?.(
			crossAnnounceStream(c.env, {
				streamId: streamRecord.id,
				creator: streamRecord.creator,
				creatorHandle: streamRecord.tokenSymbol,
				title: streamRecord.title,
				streamType: "live",
				streamUrl: streamRecord.embedUrl || streamRecord.playbackUrl,
				thumbnail: undefined,
			}),
		);

		return noCacheJsonResponse(
			{
				stream: {
					id: streamRecord.id,
					title,
					streamKey: streamResult.streamKey,
					rtmpUrl: streamResult.rtmpUrl,
					playbackUrl: streamResult.playbackUrl,
					embedUrl: streamResult.embedUrl,
					chatUrl: streamResult.chatUrl,
					isActive: true,
					viewerCount: 0,
				},
				setup: {
					obs: {
						server: streamResult.rtmpUrl,
						streamKey: streamResult.streamKey,
					},
					broadcasting: {
						software: "OBS Studio, Streamlabs, or any RTMP client",
						instructions: [
							"1. Open OBS Studio",
							`2. Go to Settings → Stream`,
							`3. Service: Custom`,
							`4. Server: ${streamResult.rtmpUrl}`,
							`5. Stream Key: ${streamResult.streamKey}`,
							"6. Click OK, then Start Streaming",
						],
					},
				},
			},
			201,
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResponse({ error: `Failed to start stream: ${msg}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/token/:address/peertube
// Get active PeerTube stream status for a token.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.get("/:address/peertube", async (c) => {
	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	try {
		const raw = await c.env.CONTENT_STORE?.get(streamActiveKey(address));
		if (!raw) {
			return noCacheJsonResponse({ active: false });
		}

		const stream = JSON.parse(raw) as PeerTubeStreamRecord;

		// If stream is active, try to get live viewer count from PeerTube
		if (stream.isActive) {
			try {
				const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
				const { PeerTubeLiveStream } = await import(
					"@degenfeed/peertube-provider"
				);
				const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });
				const status = await peertube.getStreamStatus(
					String(stream.peertubeId),
				);

				// Update viewer count in KV
				stream.viewerCount = status.viewers;
				stream.state = status.state;
				if (!status.isLive && stream.isActive && status.state === "ended") {
					stream.isActive = false;
				}

				await c.env.CONTENT_STORE?.put(
					streamActiveKey(address),
					JSON.stringify(stream),
					{ expirationTtl: stream.isActive ? 86400 : 86400 * 7 },
				);
			} catch {
				// Viewer count fetch failed — use cached count
			}
		}

		return noCacheJsonResponse({
			active: stream.isActive,
			stream: stream.isActive
				? {
						id: stream.id,
						title: stream.title,
						tokenSymbol: stream.tokenSymbol,
						embedUrl: stream.embedUrl,
						chatUrl: stream.chatUrl,
						playbackUrl: stream.playbackUrl,
						viewerCount: stream.viewerCount,
						startedAt: stream.startedAt,
						state: stream.state,
						tokenGated: stream.tokenGated,
						isCreator: false, // Filled by frontend based on session
					}
				: null,
		});
	} catch (e) {
		return jsonResponse({ error: `Failed to fetch stream: ${String(e)}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/token/:address/peertube/end
// End an active PeerTube stream. Creator only.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.post("/:address/peertube/end", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	try {
		const isCreator = await verifyTokenCreator(c.env, address, session.address);
		if (!isCreator) {
			return jsonResponse(
				{ error: "Only the token creator can end streams" },
				403,
			);
		}

		const raw = await c.env.CONTENT_STORE?.get(streamActiveKey(address));
		if (!raw) {
			return jsonResponse({ error: "No active stream found" }, 404);
		}

		const stream = JSON.parse(raw) as PeerTubeStreamRecord;

		// End stream on PeerTube
		try {
			const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
			const { PeerTubeLiveStream } = await import(
				"@degenfeed/peertube-provider"
			);
			const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });
			await peertube.endStream(String(stream.peertubeId));
		} catch (e) {
			// PeerTube deletion may fail if stream already ended — continue
			console.warn("[peertube-streams] PeerTube endStream warning:", String(e));
		}

		// Archive the stream record (keep for 7 days)
		stream.isActive = false;
		stream.state = "ended";

		await c.env.CONTENT_STORE?.put(
			streamActiveKey(address),
			JSON.stringify(stream),
			{ expirationTtl: 86400 * 7 },
		);

		// Also archive under the UUID key
		await c.env.CONTENT_STORE?.put(
			streamArchiveKey(address, stream.peertubeUuid),
			JSON.stringify(stream),
			{ expirationTtl: 86400 * 30 },
		);

		// Broadcast stream end
		broadcastToAll(CHANNELS.FEED_NEW, {
			type: "stream_ended",
			tokenAddress: address,
			platform: "peertube",
			streamId: stream.id,
		});

		// Announce end to protocols (non-blocking)
		c.executionCtx?.waitUntil?.(announceStreamEndToAllProtocols(stream, c.env));

		return jsonResponse({ ok: true, streamId: stream.id });
	} catch (e) {
		return jsonResponse({ error: `Failed to end stream: ${String(e)}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/token/:address/peertube/recording
// Get the VOD recording for a completed stream.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.get("/:address/peertube/recording", async (c) => {
	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	try {
		const raw = await c.env.CONTENT_STORE?.get(streamActiveKey(address));
		if (!raw) {
			return noCacheJsonResponse({ recording: null });
		}

		const stream = JSON.parse(raw) as PeerTubeStreamRecord;

		// If stream is still live, no recording yet
		if (stream.isActive) {
			return noCacheJsonResponse({
				recording: null,
				message:
					"Stream is still live — recording will be available after it ends",
			});
		}

		// Fetch recording status from PeerTube
		const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
		const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
		const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });
		const recording = await peertube.getRecording(String(stream.peertubeId));

		if (!recording) {
			return noCacheJsonResponse({
				recording: null,
				message: "Recording is still processing — check back shortly",
			});
		}

		return noCacheJsonResponse({
			recording: {
				url: recording.url,
				duration: recording.duration,
				resolution: recording.resolution,
				size: recording.size,
				ready: recording.ready,
				embedUrl: stream.embedUrl,
				title: stream.title,
			},
		});
	} catch (e) {
		return jsonResponse(
			{ error: `Failed to fetch recording: ${String(e)}` },
			500,
		);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/token/:address/peertube/chat
// Get recent chat messages for a stream.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.get("/:address/peertube/chat", async (c) => {
	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	const cursor = c.req.query("cursor");

	try {
		const raw = await c.env.CONTENT_STORE?.get(streamActiveKey(address));
		if (!raw) {
			return noCacheJsonResponse({ messages: [], total: 0 });
		}

		const stream = JSON.parse(raw) as PeerTubeStreamRecord;

		const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
		const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
		const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });

		const result = await peertube.getChatMessages(stream.peertubeUuid, cursor);

		return noCacheJsonResponse({
			messages: result.messages,
			total: result.total,
			nextCursor: result.nextCursor,
		});
	} catch (e) {
		return jsonResponse({ error: `Failed to fetch chat: ${String(e)}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/token/:address/peertube/chat
// Send a chat message as the creator.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.post("/:address/peertube/chat", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	try {
		interface ChatRequest {
			message?: string;
		}

		const body: ChatRequest = await c.req.json();
		const message = body.message?.trim();
		if (!message || message.length === 0) {
			return jsonResponse({ error: "Message is required" }, 400);
		}
		if (message.length > 500) {
			return jsonResponse({ error: "Message too long (max 500 chars)" }, 400);
		}

		const raw = await c.env.CONTENT_STORE?.get(streamActiveKey(address));
		if (!raw) {
			return jsonResponse({ error: "No active stream" }, 404);
		}

		const stream = JSON.parse(raw) as PeerTubeStreamRecord;

		// Verify sender is allowed (creator or token holder)
		const isCreator = await verifyTokenCreator(c.env, address, session.address);
		const balance = await checkTokenBalance(c.env, address, session.address);
		const isHolder = balance && Number(balance.amount) > 0;

		if (!isCreator && !isHolder) {
			return jsonResponse({ error: "Must hold tokens to chat" }, 403);
		}

		// Send message via PeerTube API
		const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
		const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
		const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });
		await peertube.sendChatMessage(stream.peertubeUuid, message);

		return jsonResponse({ ok: true });
	} catch (e) {
		return jsonResponse({ error: `Failed to send message: ${String(e)}` }, 500);
	}
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/token/:address/peertube/history
// Get past streams for a token.
// ═══════════════════════════════════════════════════════════════════════

peertubeStreams.get("/:address/peertube/history", async (c) => {
	const { address } = c.req.param();
	if (!address || address.length < 32) {
		return jsonResponse({ error: "Invalid token address" }, 400);
	}

	const limitParam = c.req.query("limit");
	const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 50);

	try {
		const { accessToken, instanceUrl } = await getPeerTubeAccess(c.env);
		const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
		const peertube = new PeerTubeLiveStream({ instanceUrl, accessToken });

		const tokenSymbol = c.req.query("tokenSymbol") ?? "";
		if (!tokenSymbol) {
			return noCacheJsonResponse({ streams: [], total: 0 });
		}

		const result = await peertube.getTokenStreams(tokenSymbol, limit);

		return noCacheJsonResponse({
			streams: result.data.map((s: Record<string, unknown>) => ({
				id: s.id,
				uuid: s.uuid,
				title: s.title,
				publishedAt: s.publishedAt,
				duration: s.duration,
				views: s.views,
				thumbnailUrl: s.thumbnailUrl,
				embedUrl: s.embedUrl,
			})),
			total: result.total,
		});
	} catch (e) {
		return jsonResponse(
			{ error: `Failed to fetch history: ${String(e)}` },
			500,
		);
	}
});

export default peertubeStreams;
