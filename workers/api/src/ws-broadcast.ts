/**
 * @degenfeed/api-worker — WebSocket broadcast helpers
 *
 * These functions send events to the WebSocket Durable Object server
 * so connected clients receive real-time updates instead of relying on polling.
 *
 * All functions are fire-and-forget — they never block the API response.
 */

import type { ChannelName } from "./ws-channels";

const WS_WORKER_URL = "https://realtime.degenfeed.xyz/broadcast";

/**
 * Broadcast an event to all connected clients.
 */
export function broadcastToAll(channel: ChannelName, data: unknown): void {
	_send({ channel, data });
}

/**
 * Broadcast an event to a specific user.
 */
export function broadcastToUser(
	userId: string,
	channel: ChannelName,
	data: unknown,
): void {
	_send({ channel, data, userId });
}

function _send(payload: {
	channel: ChannelName;
	data: unknown;
	userId?: string;
}): void {
	// Fire-and-forget — use waitUntil if available, otherwise background
	const promise = fetch(WS_WORKER_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	}).catch(() => {
		// WebSocket worker may not be deployed yet — silently ignore
	});

	// In Cloudflare Workers, we must use waitUntil to keep the fetch alive
	// after the response is sent. In non-CF environments, just let it run.
	if (
		typeof (
			globalThis as unknown as { waitUntil?: (p: Promise<unknown>) => void }
		).waitUntil === "function"
	) {
		(
			globalThis as unknown as { waitUntil: (p: Promise<unknown>) => void }
		).waitUntil(promise);
	}
}
