/**
 * @degenfeed/api-worker — WebSocket + Webhook Route for RealTime Sync
 *
 * Two entry points:
 *   1. GET /ws/realtime — WebSocket upgrade for client connections
 *      wss://api.degenfeed.xyz/ws/realtime?topics=posts,likes,tips
 *      Keeps browsers, mobile apps, and servers in sync with all protocol
 *      activity in real-time.
 *
 *   2. POST /api/webhook/realtime/:protocol — Webhook receivers for
 *      protocol event callbacks (Nostr, Bluesky JetStream, Farcaster, etc.)
 *
 * WebSocket Protocol:
 *   Client sends:  { type: "ping" }  (every 30s to keep alive)
 *   Server sends:  { type: "pong" }
 *   Server sends:  { type: "sync_event", eventType, sourceProtocol, dfUri, ... }
 *
 * Security:
 *   - Origin validation against allowed domains
 *   - Per-IP connection rate limiting (20/min)
 *   - 5-minute idle timeout
 *   - Max 100 concurrent connections total
 */

import type { Protocol } from "@degenfeed/types";
import { type Env, jsonResponse } from "../index";
import { processSyncAction } from "../lib/realtime-sync";
import { processQueue } from "../lib/sync-queue";
import type { SyncTopic } from "../ws-channels";
import { SYNC_TOPICS } from "../ws-channels";

// ─── Constants ────────────────────────────────────────────────────────────

const ALLOWED_WS_ORIGINS = new Set([
	"https://degenfeed.xyz",
	"https://app.degenfeed.xyz",
	"https://www.degenfeed.xyz",
	"http://localhost:3000",
	"http://localhost:5173",
	"https://api.degenfeed.xyz",
]);

const _WS_IDLE_TIMEOUT_MS = 300_000; // 5 min
const PING_INTERVAL_MS = 30_000; // 30s
const MAX_CONCURRENT_CONNS = 100;
const IP_RATE_LIMIT = 20; // connections per minute per IP
const IP_RATE_WINDOW_MS = 60_000;

// ─── In-memory State ─────────────────────────────────────────────────────

interface ClientConnection {
	id: string;
	server: WebSocket;
	topics: Set<SyncTopic>;
	ip: string;
	connectedAt: number;
	lastActivity: number;
	userId?: string;
	/** Per-client ping interval handle */
	pingInterval?: ReturnType<typeof setInterval>;
}

const connections = new Map<string, ClientConnection>();
const ipCounters = new Map<string, number[]>();

// ─── Origin / Rate Limit Checks ──────────────────────────────────────────

function isValidWsOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	return ALLOWED_WS_ORIGINS.has(origin);
}

function checkIpRateLimit(ip: string): boolean {
	const now = Date.now();
	const windowStart = now - IP_RATE_WINDOW_MS;
	let timestamps = ipCounters.get(ip);
	if (!timestamps) {
		timestamps = [];
		ipCounters.set(ip, timestamps);
	}
	const active = timestamps.filter((t) => t > windowStart);
	active.push(now);
	ipCounters.set(ip, active);
	return active.length <= IP_RATE_LIMIT;
}

function getClientIp(request: Request): string {
	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

function getTopicsFromQuery(url: string): Set<SyncTopic> {
	const parsed = new URL(url);
	const topicsStr = parsed.searchParams.get("topics") ?? "all";
	const topics = new Set<SyncTopic>();

	for (const t of topicsStr.split(",")) {
		const trimmed = t.trim().toLowerCase() as SyncTopic;
		if (trimmed === "all") {
			return new Set(SYNC_TOPICS);
		}
		if ((SYNC_TOPICS as readonly string[]).includes(trimmed)) {
			topics.add(trimmed);
		}
	}

	// Default to all if none specified
	if (topics.size === 0) {
		return new Set(SYNC_TOPICS);
	}

	return topics;
}

// ─── WebSocket Handler ────────────────────────────────────────────────────

/**
 * Handle WebSocket upgrade for real-time client connections.
 *
 * GET /ws/realtime?topics=posts,likes,tips,coins,streams,replies
 */
export function handleRealtimeWebSocket(
	request: Request,
	_env: Env,
): Response | null {
	// Only handle WebSocket upgrades
	if (request.headers.get("upgrade") !== "websocket") {
		return null;
	}

	const url = new URL(request.url);
	if (url.pathname !== "/ws/realtime") {
		return null;
	}

	// Security checks
	if (!isValidWsOrigin(request)) {
		return new Response("Forbidden", { status: 403 });
	}

	const ip = getClientIp(request);
	if (!checkIpRateLimit(ip)) {
		return new Response("Rate limited", { status: 429 });
	}

	if (connections.size >= MAX_CONCURRENT_CONNS) {
		return new Response("Server busy", { status: 503 });
	}

	// Parse topics from query
	const topics = getTopicsFromQuery(url.href);

	// Extract user ID from query or headers (optional)
	const userId = url.searchParams.get("userId") ?? undefined;

	// Create WebSocket pair
	const pair = new WebSocketPair();
	const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

	// Accept the connection
	server.accept();

	// Create connection record
	const connId = crypto.randomUUID().slice(0, 12);
	const conn: ClientConnection = {
		id: connId,
		server,
		topics,
		ip,
		connectedAt: Date.now(),
		lastActivity: Date.now(),
		userId,
	};
	connections.set(connId, conn);

	// Send welcome message with subscribed topics
	try {
		server.send(
			JSON.stringify({
				type: "connected",
				connectionId: connId,
				topics: Array.from(topics),
				serverTime: Date.now(),
			}),
		);
	} catch {
		// Connection already closed
		connections.delete(connId);
		return new Response(null, { status: 101 });
	}

	// Set up ping interval
	const pingInterval = setInterval(() => {
		const c = connections.get(connId);
		if (!c) {
			clearInterval(pingInterval);
			return;
		}
		try {
			c.server.send(JSON.stringify({ type: "ping", serverTime: Date.now() }));
		} catch {
			clearInterval(pingInterval);
			cleanupConnection(connId);
		}
	}, PING_INTERVAL_MS);
	conn.pingInterval = pingInterval;

	// Handle incoming messages
	server.addEventListener("message", (event: MessageEvent) => {
		const c = connections.get(connId);
		if (!c) return;

		c.lastActivity = Date.now();

		try {
			const data = JSON.parse(event.data as string);

			switch (data.type) {
				case "pong":
					// Client responding to our ping — nothing to do
					break;

				case "ping":
					// Client ping — respond with pong
					c.server.send(
						JSON.stringify({ type: "pong", serverTime: Date.now() }),
					);
					break;

				case "subscribe":
					// Add topics
					if (Array.isArray(data.topics)) {
						for (const t of data.topics) {
							if ((SYNC_TOPICS as readonly string[]).includes(t)) {
								c.topics.add(t as SyncTopic);
							}
						}
						c.server.send(
							JSON.stringify({
								type: "subscribed",
								topics: Array.from(c.topics),
							}),
						);
					}
					break;

				case "unsubscribe":
					// Remove topics
					if (Array.isArray(data.topics)) {
						for (const t of data.topics) {
							c.topics.delete(t as SyncTopic);
						}
						c.server.send(
							JSON.stringify({
								type: "unsubscribed",
								topics: Array.from(c.topics),
							}),
						);
					}
					break;

				default:
					c.server.send(
						JSON.stringify({
							type: "error",
							message: `Unknown message type: ${data.type}`,
						}),
					);
			}
		} catch {
			// Non-JSON message — ignore
		}
	});

	// Handle close
	server.addEventListener("close", () => {
		cleanupConnection(connId);
	});

	// Handle error
	server.addEventListener("error", () => {
		cleanupConnection(connId);
	});

	return new Response(null, { status: 101, webSocket: client });
}

function cleanupConnection(connId: string): void {
	const conn = connections.get(connId);
	if (!conn) return;

	if (conn.pingInterval) {
		clearInterval(conn.pingInterval);
	}

	try {
		conn.server.close();
	} catch {
		// Already closed
	}

	connections.delete(connId);
}

// ─── Broadcast to Filtered Clients ───────────────────────────────────────

/**
 * Broadcast an event to all connected clients whose topic filter matches.
 * Call this from the sync engine after an event is processed.
 */
export function broadcastToTopic(
	topic: SyncTopic,
	data: Record<string, unknown>,
): number {
	let sentCount = 0;

	for (const conn of connections.values()) {
		if (conn.topics.has(topic) || conn.topics.has("all" as SyncTopic)) {
			try {
				conn.server.send(JSON.stringify(data));
				sentCount++;
			} catch {
				cleanupConnection(conn.id);
			}
		}
	}

	return sentCount;
}

/**
 * Get connection stats.
 */
export function getConnectionStats(): {
	total: number;
	byTopic: Record<string, number>;
	byProtocol: Record<string, number>;
} {
	const byTopic: Record<string, number> = {};
	const byProtocol: Record<string, number> = {};

	for (const conn of connections.values()) {
		for (const topic of conn.topics) {
			byTopic[topic] = (byTopic[topic] ?? 0) + 1;
		}
	}

	// Count by IP region (using first 3 octets as a rough proxy)
	for (const conn of connections.values()) {
		const ipPrefix = conn.ip.split(".").slice(0, 3).join(".");
		byProtocol[ipPrefix] = (byProtocol[ipPrefix] ?? 0) + 1;
	}

	return {
		total: connections.size,
		byTopic,
		byProtocol,
	};
}

// ─── Webhook Receivers ────────────────────────────────────────────────────

/**
 * POST /api/webhook/realtime/:protocol
 *
 * Generic webhook receiver for protocol event callbacks.
 * Normalizes the incoming payload and routes it to the sync engine.
 *
 * Supported protocols: nostr, bluesky, farcaster, mastodon, activitypub
 */
export async function handleWebhookReceiver(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const protocol = url.pathname.split("/").pop()?.toLowerCase() as
		| Protocol
		| undefined;

	if (!protocol) {
		return jsonResponse({ error: "Missing protocol in path" }, 400);
	}

	// Validate content type
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) {
		return jsonResponse(
			{ error: "Content-Type must be application/json" },
			415,
		);
	}

	// Parse body
	let body: Record<string, unknown>;
	try {
		const text = await request.text();
		if (text.length > 100_000) {
			return jsonResponse({ error: "Payload too large" }, 413);
		}
		body = JSON.parse(text);
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	// Validate webhook secret if configured
	const webhookSecret = env.AUTH_SECRET;
	const providedSecret = request.headers.get("x-webhook-secret");
	if (webhookSecret && providedSecret && providedSecret !== webhookSecret) {
		return jsonResponse({ error: "Invalid webhook secret" }, 401);
	}

	// Route to protocol-specific handler
	const {
		handleNostrWebhook,
		handleAtProtocolWebhook,
		handleFarcasterWebhook,
		handleActivityPubWebhook,
	} = await import("../lib/realtime-sync");

	try {
		let result: unknown;

		switch (protocol) {
			case "nostr": {
				result = await handleNostrWebhook(
					String(body.event_id ?? body.id ?? ""),
					String(body.pubkey ?? ""),
					String(body.content ?? ""),
					Number(body.kind ?? 1),
					(body.tags as string[][]) ?? [],
					env,
				);
				break;
			}

			case "bluesky":
			case "atproto": {
				// Expects: { did, collection, rkey, text, action }
				result = await handleAtProtocolWebhook(
					String(body.did ?? ""),
					String(body.collection ?? ""),
					String(body.rkey ?? ""),
					String(body.text ?? ""),
					env,
					(body.action as "create" | "delete") ?? "create",
				);
				break;
			}

			case "farcaster": {
				// Expects: { hash, fid, text, eventType, parentHash }
				result = await handleFarcasterWebhook(
					String(body.hash ?? ""),
					Number(body.fid ?? 0),
					String(body.text ?? ""),
					(body.eventType as "cast" | "like" | "recast" | "reply") ?? "cast",
					env,
					body.parentHash ? String(body.parentHash) : undefined,
				);
				break;
			}

			case "mastodon":
			case "activitypub": {
				// Expects: { statusId, accountId, content, eventType, inReplyToId }
				result = await handleActivityPubWebhook(
					String(body.status_id ?? body.statusId ?? ""),
					String(body.account_id ?? body.accountId ?? ""),
					String(body.content ?? ""),
					(body.event_type ?? body.eventType ?? "status") as
						| "status"
						| "favourite"
						| "reblog"
						| "reply",
					env,
					(body.in_reply_to_id ?? body.inReplyToId)
						? String(body.in_reply_to_id ?? body.inReplyToId)
						: undefined,
				);
				break;
			}

			default:
				return jsonResponse(
					{ error: `Unsupported protocol: ${protocol}` },
					400,
				);
		}

		if (result === null) {
			return jsonResponse({ message: "Event skipped (unsupported type)" }, 200);
		}

		return jsonResponse({ ok: true, result }, 200);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[realtime-webhook] ${protocol} error:`, msg);
		return jsonResponse({ error: msg }, 500);
	}
}

// ─── Queue Processing Trigger ─────────────────────────────────────────────

/**
 * POST /api/sync/process
 *
 * Manually trigger sync queue processing.
 * Also called by the cron trigger.
 */
export async function handleProcessSyncQueue(
	_request: Request,
	env: Env,
): Promise<Response> {
	const result = await processQueue(env, processSyncAction, 25);

	return jsonResponse({
		ok: true,
		processed: result.processed,
		succeeded: result.succeeded,
		failed: result.failed,
		timestamp: Date.now(),
	});
}

// ─── Sync Status ──────────────────────────────────────────────────────────

/**
 * GET /api/sync/status
 *
 * Returns current sync system status including queue stats,
 * connection stats, and subscription count.
 */
export async function handleSyncStatus(
	_request: Request,
	env: Env,
): Promise<Response> {
	const { getQueueStats } = await import("../lib/sync-queue");
	const { getSubscriptionCount } = await import("../lib/realtime-sync");

	const [queueStats, subsCount] = await Promise.all([
		getQueueStats(env),
		Promise.resolve(getSubscriptionCount()),
	]);

	const connStats = getConnectionStats();

	return jsonResponse({
		status: "ok",
		queue: queueStats,
		connections: connStats,
		subscriptions: subsCount,
		timestamp: Date.now(),
	});
}
