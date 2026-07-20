/**
 * /api/discord — Discord Bot Integration
 *
 * Connect Discord servers to DegenFeed for cross-posting stream
 * announcements, bridging chat messages, and creator coin alerts.
 *
 * Endpoints:
 *   POST   /api/discord/connect         { guildId?, channelId, webhookId?, webhookToken? }
 *   POST   /api/discord/channel/announce  { channelId, content, embeds? }
 *   GET    /api/discord/channels         → list connected channels
 *   DELETE /api/discord/disconnect       { channelId? }
 *   POST   /api/discord/bridge           { channelId, messageId, streamId }
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

function safeKey(s: string): string {
	return s.replace(/[^a-zA-Z0-9:_-]/g, '_').toLowerCase();
}

/** Discovers the session wallet from cookie. Falls back to 'anon'. */
function getUserId(request: Request, env: Env): string | null {
	const cookie = request.headers.get('cookie') ?? '';
	const m = cookie.match(/session=([^;]+)/);
	if (m?.[1] && env.AUTH_SECRET) return m[1];
	return null;
}

// ─── POST /api/discord/connect ────────────────────────────────

export async function handleDiscordConnect(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { guildId?: string; channelId: string; webhookId?: string; webhookToken?: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}
	if (!body.channelId) return jsonResponse({ error: 'channelId required' }, 400);

	const record = {
		guildId: body.guildId ?? null,
		channelId: body.channelId,
		webhookId: body.webhookId ?? null,
		webhookToken: body.webhookToken ?? null,
		connectedAt: Date.now(),
	};

	const key = `discord:connect:${safeKey(userId)}:${body.channelId}`;
	try {
		await env.CACHE?.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 365 });
	} catch {
		return jsonResponse({ error: 'Storage failed' }, 500);
	}

	// Index in user's channel list
	const listKey = `discord:user:${safeKey(userId)}`;
	try {
		const raw = (await env.CACHE?.get(listKey)) ?? '[]';
		const list = JSON.parse(raw) as string[];
		if (!list.includes(body.channelId)) {
			list.push(body.channelId);
			await env.CACHE?.put(listKey, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 365 });
		}
	} catch {
		/* best-effort index */
	}

	return jsonResponse({ ok: true, channelId: body.channelId }, 201);
}

// ─── POST /api/discord/channel/announce ──────────────────────

export async function handleDiscordChannelAnnounce(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { channelId: string; content: string; embeds?: unknown[] };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}
	if (!body.channelId || !body.content) {
		return jsonResponse({ error: 'channelId and content required' }, 400);
	}

	// Load connection record to get webhook credentials
	const key = `discord:connect:${safeKey(userId)}:${body.channelId}`;
	let record: { webhookId?: string; webhookToken?: string } | null = null;
	try {
		const raw = await env.CACHE?.get(key);
		if (raw) record = JSON.parse(raw);
	} catch {
		/* ignore */
	}

	if (!record?.webhookId || !record?.webhookToken) {
		return jsonResponse({ error: 'No webhook configured for this channel. Connect first.' }, 400);
	}

	// Execute the Discord webhook
	try {
		const payload: Record<string, unknown> = { content: body.content };
		if (body.embeds) payload.embeds = body.embeds;

		const res = await fetch(
			`https://discord.com/api/v10/webhooks/${record.webhookId}/${record.webhookToken}?wait=true`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload),
			},
		);
		if (!res.ok) {
			const err = await res.text().catch(() => 'unknown');
			return jsonResponse({ error: `Discord webhook failed: ${res.status} ${err}` }, 502);
		}
		const result = await res.json();
		return jsonResponse({ ok: true, messageId: (result as Record<string, unknown>).id ?? null });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return jsonResponse({ error: `Discord request failed: ${msg}` }, 502);
	}
}

// ─── GET /api/discord/channels ────────────────────────────────

export async function handleDiscordChannelsList(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	const listKey = `discord:user:${safeKey(userId)}`;
	try {
		const raw = await env.CACHE?.get(listKey);
		const channelIds: string[] = raw ? (JSON.parse(raw) as string[]) : [];

		const channels = await Promise.all(
			channelIds.map(async (cid) => {
				const rec = await env.CACHE?.get(`discord:connect:${safeKey(userId)}:${cid}`);
				return rec ? (JSON.parse(rec) as Record<string, unknown>) : null;
			}),
		);

		return noCacheJsonResponse({ channels: channels.filter(Boolean) });
	} catch {
		return jsonResponse({ channels: [] });
	}
}

// ─── DELETE /api/discord/disconnect ──────────────────────────

export async function handleDiscordDisconnect(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { channelId?: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}

	if (body.channelId) {
		// Remove specific channel
		const key = `discord:connect:${safeKey(userId)}:${body.channelId}`;
		try {
			await env.CACHE?.delete(key);
		} catch {
			/* ignore */
		}
		const listKey = `discord:user:${safeKey(userId)}`;
		try {
			const raw = await env.CACHE?.get(listKey) ?? '[]';
			const list = JSON.parse(raw) as string[];
			const updated = list.filter((c) => c !== body.channelId);
			await env.CACHE?.put(listKey, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 * 365 });
		} catch {
			/* ignore */
		}
	} else {
		// Remove all
		try {
			const listKey = `discord:user:${safeKey(userId)}`;
			const raw = await env.CACHE?.get(listKey) ?? '[]';
			const list = JSON.parse(raw) as string[];
			for (const cid of list) {
				await env.CACHE?.delete(`discord:connect:${safeKey(userId)}:${cid}`);
			}
			await env.CACHE?.delete(listKey);
		} catch {
			/* ignore */
		}
	}

	return jsonResponse({ ok: true });
}

// ─── POST /api/discord/bridge ────────────────────────────────

export async function handleDiscordBridgeMessage(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { channelId: string; messageId: string; streamId: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}
	if (!body.channelId || !body.streamId) {
		return jsonResponse({ error: 'channelId and streamId required' }, 400);
	}

	// Record bridge mapping in KV
	const bridgeKey = `discord:bridge:stream:${body.streamId}`;
	try {
		const raw = await env.CACHE?.get(bridgeKey) ?? '[]';
		const mappings = JSON.parse(raw) as Array<{ channelId: string; messageId?: string }>;
		mappings.push({ channelId: body.channelId, messageId: body.messageId });
		await env.CACHE?.put(bridgeKey, JSON.stringify(mappings), { expirationTtl: 60 * 60 * 24 * 7 });
	} catch {
		return jsonResponse({ error: 'Storage failed' }, 500);
	}

	return jsonResponse({ ok: true, streamId: body.streamId });
}
