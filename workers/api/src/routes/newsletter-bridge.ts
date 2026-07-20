/**
 * /api/newsletter/bridge — Substack / Ghost Newsletter Bridge
 *
 * Connect Substack or Ghost RSS feeds to auto-cross-post new articles
 * to all connected DegenFeed protocols.
 *
 * Endpoints:
 *   POST   /api/newsletter/bridge/connect    { type, url, apiKey?, autoCrossPost, targetProtocols[] }
 *   DELETE /api/newsletter/bridge/disconnect { id }
 *   GET    /api/newsletter/bridge/list       → list bridges
 *   POST   /api/newsletter/bridge/poll       { id } — poll a single bridge
 *   POST   /api/newsletter/bridge/auto-poll  — poll all (cron)
 *   GET    /api/newsletter/bridge/stats      → bridge stats
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

function safeKey(s: string): string {
	return s.replace(/[^a-zA-Z0-9_@.\/-]/g, '_').toLowerCase();
}

function generateId(): string {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getUserId(request: Request, env: Env): string | null {
	const cookie = request.headers.get('cookie') ?? '';
	const m = cookie.match(/session=([^;]+)/);
	if (m?.[1] && env.AUTH_SECRET) return m[1];
	return null;
}

const VALID_TARGETS = new Set(['discord', 'matrix', 'telegram', 'nostr', 'farcaster', 'bluesky', 'mastodon']);

// ─── POST /api/newsletter/bridge/connect ───────────────────

export async function handleNewsletterBridgeConnect(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { type: 'substack' | 'ghost'; url: string; apiKey?: string; autoCrossPost: boolean; targetProtocols: string[] };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}
	if (!body.type || !body.url) {
		return jsonResponse({ error: 'type (substack|ghost) and url required' }, 400);
	}
	if (!['substack', 'ghost'].includes(body.type)) {
		return jsonResponse({ error: 'type must be "substack" or "ghost"' }, 400);
	}
	try {
		new URL(body.url);
	} catch {
		return jsonResponse({ error: 'Invalid URL' }, 400);
	}

	if (body.targetProtocols?.length) {
		const invalid = body.targetProtocols.filter((t) => !VALID_TARGETS.has(t));
		if (invalid.length > 0) {
			return jsonResponse({ error: `Invalid targets: ${invalid.join(', ')}` }, 400);
		}
	}

	const bridgeId = generateId();
	const record = {
		id: bridgeId,
		type: body.type,
		url: body.url.replace(/\/$/, ''),
		apiKey: body.apiKey ?? null,
		autoCrossPost: body.autoCrossPost ?? true,
		targetProtocols: body.targetProtocols ?? ['discord', 'matrix'],
		lastPostId: null,
		lastPolledAt: null,
		createdAt: Date.now(),
		totalCrossPosts: 0,
	};

	try {
		const key = `newsletter:bridge:config:${bridgeId}`;
		await env.CACHE?.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 365 });

		const listKey = `newsletter:bridge:user:${safeKey(userId)}`;
		const raw = (await env.CACHE?.get(listKey)) ?? '[]';
		const list = JSON.parse(raw) as string[];
		list.push(bridgeId);
		await env.CACHE?.put(listKey, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 365 });

		// Global bridge index for auto-poll
		const globalKey = 'newsletter:bridge:all';
		const gRaw = await env.CACHE?.get(globalKey) ?? '[]';
		const gList = JSON.parse(gRaw) as string[];
		if (!gList.includes(bridgeId)) {
			gList.push(bridgeId);
			await env.CACHE?.put(globalKey, JSON.stringify(gList), { expirationTtl: 60 * 60 * 24 * 365 });
		}
	} catch {
		return jsonResponse({ error: 'Storage failed' }, 500);
	}

	return jsonResponse({ ok: true, bridge: { id: bridgeId, type: record.type, url: record.url } }, 201);
}

// ─── DELETE /api/newsletter/bridge/disconnect ──────────────

export async function handleNewsletterBridgeDisconnect(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { id: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}
	if (!body.id) return jsonResponse({ error: 'id required' }, 400);

	try {
		await env.CACHE?.delete(`newsletter:bridge:config:${body.id}`);

		const listKey = `newsletter:bridge:user:${safeKey(userId)}`;
		const raw = await env.CACHE?.get(listKey) ?? '[]';
		const list = JSON.parse(raw) as string[];
		const updated = list.filter((id) => id !== body.id);
		await env.CACHE?.put(listKey, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 * 365 });

		// Remove from global index
		const globalKey = 'newsletter:bridge:all';
		const gRaw = await env.CACHE?.get(globalKey) ?? '[]';
		const gList = JSON.parse(gRaw) as string[];
		const gUpdated = gList.filter((id) => id !== body.id);
		await env.CACHE?.put(globalKey, JSON.stringify(gUpdated), { expirationTtl: 60 * 60 * 24 * 365 });
	} catch {
		return jsonResponse({ error: 'Failed to disconnect' }, 500);
	}

	return jsonResponse({ ok: true });
}

// ─── GET /api/newsletter/bridge/list ───────────────────────

export async function handleNewsletterBridgeList(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	const listKey = `newsletter:bridge:user:${safeKey(userId)}`;
	try {
		const raw = await env.CACHE?.get(listKey);
		const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];

		const bridges = await Promise.all(
			ids.map(async (id) => {
				const rec = await env.CACHE?.get(`newsletter:bridge:config:${id}`);
				return rec ? (JSON.parse(rec) as Record<string, unknown>) : null;
			}),
		);

		return noCacheJsonResponse({ bridges: bridges.filter(Boolean) });
	} catch {
		return jsonResponse({ bridges: [] });
	}
}

// ─── POST /api/newsletter/bridge/poll ──────────────────────

export async function handleNewsletterBridgePoll(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
	const userId = getUserId(request, env);
	if (!userId) return jsonResponse({ error: 'Session required' }, 401);

	let body: { id: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}
	if (!body.id) return jsonResponse({ error: 'id required' }, 400);

	let record: Record<string, unknown> | null = null;
	try {
		const raw = await env.CACHE?.get(`newsletter:bridge:config:${body.id}`);
		if (raw) record = JSON.parse(raw);
	} catch {
		/* ignore */
	}
	if (!record) return jsonResponse({ error: 'Bridge not found' }, 404);

	// Fetch RSS feed
	const feedUrl = record.type === 'substack'
		? `${record.url}/feed`
		: record.type === 'ghost'
			? `${record.url}/ghost/api/content/posts/?key=${record.apiKey ?? ''}&limit=5`
			: `${record.url}/rss`;

	let newPosts: Array<{ guid: string; title: string; link: string; contentSnippet?: string }> = [];
	try {
		const res = await fetch(feedUrl, {
			headers: { 'user-agent': 'DegenFeed/1.0 (+https://degenfeed.xyz)' },
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) {
			return jsonResponse({ error: `Feed fetch failed: ${res.status}` }, 502);
		}
		const xml = await res.text();

		// Simple RSS XML parsing
		const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
		for (const itemXml of items) {
			const guid = itemXml.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1]
				?? itemXml.match(/<link[^>]*>([^<]+)<\/link>/)?.[1]
				?? '';
			const title = itemXml.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
				?? itemXml.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]
				?? 'Untitled';
			const link = itemXml.match(/<link[^>]*>([^<]+)<\/link>/)?.[1] ?? '';
			const contentSnippet = itemXml.match(/<description[^>]*><!\[CDATA\[([^\]]+)\]\]><\/description>/)?.[1]
				?? itemXml.match(/<description[^>]*>([^<]+)<\/description>/)?.[1]
				?? '';

			if (guid && (!record.lastPostId || guid !== record.lastPostId)) {
				newPosts.push({ guid, title, link, contentSnippet: contentSnippet.slice(0, 300) });
			}
		}

		// Update lastPostId
		if (newPosts.length > 0) {
			record.lastPostId = newPosts[0]!.guid;
			record.totalCrossPosts = (record.totalCrossPosts ?? 0) + newPosts.length;
			record.lastPolledAt = Date.now();
			await env.CACHE?.put(
				`newsletter:bridge:config:${body.id}`,
				JSON.stringify(record),
				{ expirationTtl: 60 * 60 * 24 * 365 },
			);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return jsonResponse({ error: `Poll failed: ${msg}` }, 502);
	}

	return jsonResponse({
		ok: true,
		newPosts: newPosts.length,
		posts: newPosts.slice(0, 10),
		crossPostTargets: record.autoCrossPost ? record.targetProtocols : [],
	});
}

// ─── POST /api/newsletter/bridge/auto-poll (cron) ──────────

export async function handleNewsletterBridgeAutoPoll(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

	// API key auth only (for cron)
	const auth = request.headers.get('authorization') ?? '';
	if (!auth.startsWith('Bearer ') || (auth !== `Bearer ${env.ADMIN_API_KEY}` && auth !== `Bearer ${env.NEWSLETTER_API_KEY}`)) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const globalKey = 'newsletter:bridge:all';
	let ids: string[] = [];
	try {
		const raw = await env.CACHE?.get(globalKey);
		if (raw) ids = JSON.parse(raw) as string[];
	} catch {
		return jsonResponse({ error: 'No bridges found' }, 404);
	}

	if (ids.length === 0) {
		return jsonResponse({ ok: true, polled: 0 });
	}

	const results = await Promise.allSettled(
		ids.map(async (id) => {
			const fakeReq = new Request('http://internal/api/newsletter/bridge/poll', {
				method: 'POST',
				body: JSON.stringify({ id }),
				headers: { 'content-type': 'application/json' },
			});
			const resp = await handleNewsletterBridgePoll(fakeReq, env);
			const data = await resp.json() as { ok?: boolean; newPosts?: number };
			return { id, ok: resp.ok, newPosts: data.newPosts ?? 0 };
		}),
	);

	const polled = results.filter((r) => r.status === 'fulfilled').length;
	const newPosts = results
		.filter((r): r is PromiseFulfilledResult<{ id: string; ok: boolean; newPosts: number }> => r.status === 'fulfilled')
		.reduce((sum, r) => sum + r.value.newPosts, 0);

	return jsonResponse({ ok: true, polled, total: ids.length, newPosts });
}

// ─── GET /api/newsletter/bridge/stats ──────────────────────

export async function handleNewsletterBridgeStats(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

	const globalKey = 'newsletter:bridge:all';
	try {
		const raw = await env.CACHE?.get(globalKey);
		const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];

		let totalCrossPosts = 0;
		let activeCount = 0;
		for (const id of ids) {
			const rec = await env.CACHE?.get(`newsletter:bridge:config:${id}`);
			if (rec) {
				const config = JSON.parse(rec) as { totalCrossPosts?: number; lastPolledAt?: number };
				totalCrossPosts += config.totalCrossPosts ?? 0;
				if (config.lastPolledAt) activeCount++;
			}
		}

		return noCacheJsonResponse({
			totalBridges: ids.length,
			activeBridges: activeCount,
			totalCrossPosts,
			lastChecked: Date.now(),
		});
	} catch {
		return jsonResponse({ totalBridges: 0, activeBridges: 0, totalCrossPosts: 0 });
	}
}
