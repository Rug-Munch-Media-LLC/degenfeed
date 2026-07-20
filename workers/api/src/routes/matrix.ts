/**
 * /api/matrix — Matrix Protocol Integration
 *
 * Bridge DegenFeed to Matrix rooms for federated messaging.
 *
 * Endpoints:
 *   POST   /api/matrix/connect     { homeserverUrl, accessToken, roomId }
 *   POST   /api/matrix/send        { roomId, content, msgType? }
 *   GET    /api/matrix/rooms       → list connected rooms
 *   DELETE /api/matrix/disconnect  { roomId? }
 *   POST   /api/matrix/bridge      { roomId, streamId }
 */

import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";

function safeKey(s: string): string {
	return s.replace(/[^a-zA-Z0-9:_@./-]/g, "_").toLowerCase();
}

function getUserId(request: Request, env: Env): string | null {
	const cookie = request.headers.get("cookie") ?? "";
	const m = cookie.match(/session=([^;]+)/);
	if (m?.[1] && env.AUTH_SECRET) return m[1];
	return null;
}

// ─── POST /api/matrix/connect ────────────────────────────────

export async function handleMatrixConnect(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST")
		return jsonResponse({ error: "Method not allowed" }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: "Session required" }, 401);

	let body: { homeserverUrl: string; accessToken: string; roomId: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	if (!body.homeserverUrl || !body.roomId) {
		return jsonResponse({ error: "homeserverUrl and roomId required" }, 400);
	}

	const record = {
		homeserverUrl: body.homeserverUrl,
		accessToken: body.accessToken ?? null,
		roomId: body.roomId,
		connectedAt: Date.now(),
	};

	const key = `matrix:connect:${safeKey(userId)}:${safeKey(body.roomId)}`;
	try {
		await env.CACHE?.put(key, JSON.stringify(record), {
			expirationTtl: 60 * 60 * 24 * 365,
		});
	} catch {
		return jsonResponse({ error: "Storage failed" }, 500);
	}

	// Index
	const listKey = `matrix:user:${safeKey(userId)}`;
	try {
		const raw = (await env.CACHE?.get(listKey)) ?? "[]";
		const list = JSON.parse(raw) as string[];
		if (!list.includes(body.roomId)) {
			list.push(body.roomId);
			await env.CACHE?.put(listKey, JSON.stringify(list), {
				expirationTtl: 60 * 60 * 24 * 365,
			});
		}
	} catch {
		/* best-effort */
	}

	return jsonResponse({ ok: true, roomId: body.roomId }, 201);
}

// ─── POST /api/matrix/send ───────────────────────────────────

export async function handleMatrixSendMessage(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST")
		return jsonResponse({ error: "Method not allowed" }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: "Session required" }, 401);

	let body: { roomId: string; content: string; msgType?: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	if (!body.roomId || !body.content) {
		return jsonResponse({ error: "roomId and content required" }, 400);
	}

	// Load connection record
	const key = `matrix:connect:${safeKey(userId)}:${safeKey(body.roomId)}`;
	let record: { homeserverUrl: string; accessToken?: string } | null = null;
	try {
		const raw = await env.CACHE?.get(key);
		if (raw) record = JSON.parse(raw);
	} catch {
		/* ignore */
	}
	if (!record)
		return jsonResponse({ error: "No Matrix connection for this room" }, 400);

	// Send via Matrix API
	try {
		const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const url = `${record.homeserverUrl.replace(/\/$/, "")}/_matrix/client/v3/rooms/${encodeURIComponent(body.roomId)}/send/m.room.message/${txnId}`;
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		if (record.accessToken)
			headers.authorization = `Bearer ${record.accessToken}`;

		const res = await fetch(url, {
			method: "PUT",
			headers,
			body: JSON.stringify({
				body: body.content,
				msgtype: body.msgType ?? "m.text",
			}),
		});
		if (!res.ok) {
			const err = await res.text().catch(() => "unknown");
			return jsonResponse(
				{ error: `Matrix API error ${res.status}: ${err}` },
				502,
			);
		}
		const result = await res.json();
		return jsonResponse({
			ok: true,
			eventId: (result as Record<string, unknown>).event_id ?? null,
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return jsonResponse({ error: `Matrix request failed: ${msg}` }, 502);
	}
}

// ─── GET /api/matrix/rooms ───────────────────────────────────

export async function handleMatrixRoomsList(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET")
		return jsonResponse({ error: "Method not allowed" }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: "Session required" }, 401);

	const listKey = `matrix:user:${safeKey(userId)}`;
	try {
		const raw = await env.CACHE?.get(listKey);
		const roomIds: string[] = raw ? (JSON.parse(raw) as string[]) : [];

		const rooms = await Promise.all(
			roomIds.map(async (rid) => {
				const rec = await env.CACHE?.get(
					`matrix:connect:${safeKey(userId)}:${safeKey(rid)}`,
				);
				return rec ? (JSON.parse(rec) as Record<string, unknown>) : null;
			}),
		);

		return noCacheJsonResponse({ rooms: rooms.filter(Boolean) });
	} catch {
		return jsonResponse({ rooms: [] });
	}
}

// ─── DELETE /api/matrix/disconnect ───────────────────────────

export async function handleMatrixDisconnect(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "DELETE")
		return jsonResponse({ error: "Method not allowed" }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: "Session required" }, 401);

	let body: { roomId?: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	if (body.roomId) {
		const key = `matrix:connect:${safeKey(userId)}:${safeKey(body.roomId)}`;
		try {
			await env.CACHE?.delete(key);
		} catch {
			/* ignore */
		}
		const listKey = `matrix:user:${safeKey(userId)}`;
		try {
			const raw = (await env.CACHE?.get(listKey)) ?? "[]";
			const list = JSON.parse(raw) as string[];
			const updated = list.filter((r) => r !== body.roomId);
			await env.CACHE?.put(listKey, JSON.stringify(updated), {
				expirationTtl: 60 * 60 * 24 * 365,
			});
		} catch {
			/* ignore */
		}
	} else {
		try {
			const listKey = `matrix:user:${safeKey(userId)}`;
			const raw = (await env.CACHE?.get(listKey)) ?? "[]";
			const list = JSON.parse(raw) as string[];
			for (const rid of list) {
				await env.CACHE?.delete(
					`matrix:connect:${safeKey(userId)}:${safeKey(rid)}`,
				);
			}
			await env.CACHE?.delete(listKey);
		} catch {
			/* ignore */
		}
	}

	return jsonResponse({ ok: true });
}

// ─── POST /api/matrix/bridge ─────────────────────────────────

export async function handleMatrixBridgeMessages(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST")
		return jsonResponse({ error: "Method not allowed" }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: "Session required" }, 401);

	let body: { roomId: string; streamId: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	if (!body.roomId || !body.streamId) {
		return jsonResponse({ error: "roomId and streamId required" }, 400);
	}

	const bridgeKey = `matrix:bridge:stream:${body.streamId}`;
	try {
		const raw = (await env.CACHE?.get(bridgeKey)) ?? "[]";
		const mappings = JSON.parse(raw) as Array<{ roomId: string }>;
		mappings.push({ roomId: body.roomId });
		await env.CACHE?.put(bridgeKey, JSON.stringify(mappings), {
			expirationTtl: 60 * 60 * 24 * 7,
		});
	} catch {
		return jsonResponse({ error: "Storage failed" }, 500);
	}

	return jsonResponse({ ok: true, streamId: body.streamId });
}
