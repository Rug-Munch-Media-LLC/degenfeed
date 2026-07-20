/**
 * @degenfeed/api-worker — WebSocket handler for real-time token page updates
 *
 * wss://api.degenfeed.xyz/ws/token/:address
 *
 * Subscribes to: comments, trades, stream events, milestone updates.
 * Uses a WebSocketPair for each connection, subscribes to token events,
 * and keeps an online heartbeat per wallet.
 *
 * Connection lifecycle:
 *   1. Client connects to wss://api.degenfeed.xyz/ws/token/{address}
 *   2. Server validates origin + rate limits IP
 *   3. Server accepts, subscribes to token event stream
 *   4. Client sends { type: "ping", wallet?: "0x..." } every 30s
 *   5. Server responds { type: "pong" } + updates online presence
 *   6. Server pushes events: comment, trade, stream_started, stream_ended,
 *      milestone_reached, online_count
 *   7. Server auto-disconnects after 5 min idle
 *   8. On close, subscription is cleaned up
 *
 * Security:
 *   - Origin validation against allowed domains
 *   - Per-IP connection rate limiting
 *   - Max 5 concurrent connections per token
 *   - 5-minute idle timeout
 */

import type { Env } from "../index";
import { getOnlineCount, updateOnlineHeartbeat } from "../lib/community-store";

// ─── In-memory subscription registry ───────────────────────────────────
// Tracks active WebSocket connections per token address so we can
// broadcast events to all connected clients.

interface TokenSubscription {
	id: string;
	tokenAddress: string;
	server: WebSocket;
	wallet?: string;
	createdAt: number;
}

const subscriptions = new Map<string, TokenSubscription[]>();

// ─── Security Constants ──────────────────────────────────────────────

const ALLOWED_WS_ORIGINS = new Set([
	"https://degenfeed.xyz",
	"https://app.degenfeed.xyz",
	"https://www.degenfeed.xyz",
	"http://localhost:3000",
	"http://localhost:5173",
]);

const IP_RATE_LIMIT_WS = 10; // max WS connections per IP per minute
const IP_RATE_WINDOW_MS = 60_000;
const MAX_CONNS_PER_TOKEN = 5; // max concurrent connections per token
const IDLE_TIMEOUT_MS = 300_000; // 5 min idle disconnect

const ipWsTimestamps = new Map<string, number[]>();

function shouldRateLimitIp(ip: string): boolean {
	const now = Date.now();
	const windowStart = now - IP_RATE_WINDOW_MS;
	let timestamps = ipWsTimestamps.get(ip);
	if (!timestamps) {
		timestamps = [];
		ipWsTimestamps.set(ip, timestamps);
	}
	const active = timestamps.filter((t) => t > windowStart);
	active.push(now);
	ipWsTimestamps.set(ip, active);
	return active.length > IP_RATE_LIMIT_WS;
}

function isValidWsOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return true; // allow non-browser clients
	return ALLOWED_WS_ORIGINS.has(origin);
}

function getClientIp(request: Request): string {
	return (
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"0.0.0.0"
	);
}

function countTokenConns(tokenAddress: string): number {
	return (subscriptions.get(tokenAddress.toLowerCase()) || []).length;
}

// Cleanup idle connections periodically
function setupIdleTimeout(
	server: WebSocket,
	subId: string,
	tokenAddress: string,
	env: Env,
): void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const resetTimer = () => {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			try {
				server.close(1001, "Idle timeout");
			} catch { /* KV operation failed -- non-critical, continue */ }
		}, IDLE_TIMEOUT_MS);
	};

	resetTimer();

	server.addEventListener("message", () => resetTimer());
	server.addEventListener("close", () => {
		if (timeoutId) clearTimeout(timeoutId);
	});
	server.addEventListener("error", () => {
		if (timeoutId) clearTimeout(timeoutId);
	});
}

function generateId(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	for (let i = 0; i < 16; i++) {
		result += chars[(arr[i] ?? 0) % chars.length]!;
	}
	return result;
}

// ─── Subscribe to token events ─────────────────────────────────────────

export async function subscribeToTokenEvents(
	env: Env,
	tokenAddress: string,
	server: WebSocket,
): Promise<string> {
	const id = generateId();
	const sub: TokenSubscription = {
		id,
		tokenAddress: tokenAddress.toLowerCase(),
		server,
		createdAt: Date.now(),
	};

	const key = sub.tokenAddress;
	const existing = subscriptions.get(key) || [];
	existing.push(sub);
	subscriptions.set(key, existing);

	// Broadcast current online count to the new subscriber
	const onlineCount = await getOnlineCount(env, tokenAddress);
	try {
		server.send(JSON.stringify({ type: "online_count", count: onlineCount }));
	} catch {
		// Client may have disconnected already
	}

	return id;
}

// ─── Unsubscribe ───────────────────────────────────────────────────────

export async function unsubscribeFromTokenEvents(
	env: Env,
	tokenAddress: string,
	subId: string,
): Promise<void> {
	const key = tokenAddress.toLowerCase();
	const existing = subscriptions.get(key);
	if (!existing) return;

	const filtered = existing.filter((s) => s.id !== subId);
	if (filtered.length === 0) {
		subscriptions.delete(key);
	} else {
		subscriptions.set(key, filtered);
	}

	// Broadcast updated online count
	const onlineCount = await getOnlineCount(env, tokenAddress);
	broadcastToToken(env, tokenAddress, {
		type: "online_count",
		count: onlineCount,
	});
}

// ─── Broadcast to all subscribers of a token ──────────────────────────

export async function broadcastToToken(
	_env: Env,
	tokenAddress: string,
	data: unknown,
): Promise<void> {
	const key = tokenAddress.toLowerCase();
	const subs = subscriptions.get(key);
	if (!subs || subs.length === 0) return;

	const message = JSON.stringify(data);
	const deadIds: string[] = [];

	for (const sub of subs) {
		try {
			sub.server.send(message);
		} catch {
			deadIds.push(sub.id);
		}
	}

	// Clean up dead connections
	if (deadIds.length > 0) {
		const alive = subs.filter((s) => !deadIds.includes(s.id));
		if (alive.length === 0) {
			subscriptions.delete(key);
		} else {
			subscriptions.set(key, alive);
		}
	}
}

// ─── WebSocket upgrade handler ─────────────────────────────────────────

export async function handleTokenWebSocket(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	// Path: /ws/token/{address}
	const pathParts = url.pathname.split("/").filter(Boolean);
	const tokenAddress = pathParts[pathParts.length - 1] ?? "";

	if (!tokenAddress || tokenAddress.length < 32) {
		return new Response(JSON.stringify({ error: "Invalid token address" }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	// Check for WebSocket upgrade header
	const upgradeHeader = request.headers.get("upgrade");
	if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
		return new Response(
			JSON.stringify({ error: "Expected WebSocket upgrade" }),
			{
				status: 426,
				headers: { "content-type": "application/json" },
			},
		);
	}

	// Origin validation
	if (!isValidWsOrigin(request)) {
		return new Response(JSON.stringify({ error: "Origin not allowed" }), {
			status: 403,
			headers: { "content-type": "application/json" },
		});
	}

	// IP rate limiting
	const clientIp = getClientIp(request);
	if (shouldRateLimitIp(clientIp)) {
		return new Response(
			JSON.stringify({ error: "Too many WebSocket connections from this IP" }),
			{
				status: 429,
				headers: { "content-type": "application/json" },
			},
		);
	}

	// Max connections per token
	if (countTokenConns(tokenAddress) >= MAX_CONNS_PER_TOKEN) {
		return new Response(
			JSON.stringify({ error: "Too many connections for this token" }),
			{
				status: 429,
				headers: { "content-type": "application/json" },
			},
		);
	}

	try {
		const pair = new WebSocketPair();
		const values = Object.values(pair);
		const client = values[0] as WebSocket | undefined;
		const server = values[1] as WebSocket | undefined;

		if (!server || !client) {
			return new Response(
				JSON.stringify({ error: "Failed to create WebSocket pair" }),
				{
					status: 500,
					headers: { "content-type": "application/json" },
				},
			);
		}

		// Accept the connection
		server.accept();

		// Subscribe to token events
		const subId = await subscribeToTokenEvents(env, tokenAddress, server);

		// Setup idle timeout (5 min)
		setupIdleTimeout(server, subId, tokenAddress, env);

		// Handle incoming messages (ping/pong for connection tracking)
		server.addEventListener("message", async (msg) => {
			try {
				const data = JSON.parse(msg.data as string) as {
					type: string;
					wallet?: string;
					ts?: number;
				};
				if (data.type === "ping") {
					server.send(JSON.stringify({ type: "pong", ts: Date.now() }));

					// Update online presence if wallet is provided
					if (data.wallet) {
						const existingSubs = getSubscriptionsForToken(tokenAddress);
						const sub = existingSubs.find((s) => s.id === subId);
						if (sub) {
							sub.wallet = data.wallet;
						}
						await updateOnlineHeartbeat(env, tokenAddress, data.wallet);
					}

					// Broadcast updated online count periodically
					const onlineCount = await getOnlineCount(env, tokenAddress);
					broadcastToToken(env, tokenAddress, {
						type: "online_count",
						count: onlineCount,
					});
				}
			} catch {
				// Ignore malformed messages
			}
		});

		// Handle close
		server.addEventListener("close", async () => {
			await unsubscribeFromTokenEvents(env, tokenAddress, subId);
		});

		server.addEventListener("error", async () => {
			await unsubscribeFromTokenEvents(env, tokenAddress, subId);
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	} catch (e) {
		return new Response(
			JSON.stringify({ error: `WebSocket upgrade failed: ${String(e)}` }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

// ─── Helper to get subscriptions for a token ──────────────────────────

function getSubscriptionsForToken(tokenAddress: string): TokenSubscription[] {
	return subscriptions.get(tokenAddress.toLowerCase()) || [];
}

// ─── SSE (Server-Sent Events) fallback handler ─────────────────────────
// For environments where WebSockets are unavailable.

export async function handleTokenSSE(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const pathParts = url.pathname.split("/").filter(Boolean);
	const tokenAddress = pathParts[pathParts.length - 1] ?? "";

	if (!tokenAddress || tokenAddress.length < 32) {
		return new Response(JSON.stringify({ error: "Invalid token address" }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	const encoder = new TextEncoder();

	// Subscribe to in-memory events and write SSE to the stream
	const subId = await subscribeToTokenEvents(env, tokenAddress, {
		send: (data: string) => {
			writer.write(encoder.encode(`data: ${data}\n\n`)).catch(() => {});
		},
		close: () => {
			writer.close().catch(() => {});
		},
		addEventListener: () => {},
		accept: () => {},
	} as unknown as WebSocket);

	// Clean up on disconnect
	request.signal?.addEventListener("abort", () => {
		unsubscribeFromTokenEvents(env, tokenAddress, subId).catch(() => {});
		writer.close().catch(() => {});
	});

	return new Response(readable, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			connection: "keep-alive",
		},
	});
}
