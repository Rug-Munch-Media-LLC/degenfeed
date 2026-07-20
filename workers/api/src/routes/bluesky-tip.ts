/**
 * @degenfeed/api-worker — Bluesky Tipping Routes
 *
 * Tipping for Bluesky posts (AT Protocol).
 * Supports all 6 DegenFeed methods via the unified resolution pipeline.
 *
 * KV schema:
 *   bluesky:tip:{postId} → { totalUsd, totalCount, tips: [...], lastTippedAt }
 *   bluesky:tip:leaderboard → [ { postId, authorDid, totalUsd, totalCount }, ... ]
 *
 * Every recorded tip is also written to the unified cross-platform ledger
 * (see unified-tip.ts) via recordUnifiedTip().
 */

import { type Env, jsonResponse } from "../index";
import {
	hasSuspiciousPayload,
	isValidAmount,
	sanitizeString,
	validateBodySize,
} from "../sanitize";
import { recordUnifiedTip } from "./unified-tip";

// ─── Types ───────────────────────────────────────────────────────────

interface BlueskyTipRecord {
	amount: number; // USD amount
	currency: string;
	method: string;
	from?: string;
	timestamp: number;
}

interface BlueskyTipAggregate {
	postId: string;
	authorDid: string;
	totalUsd: number;
	totalCount: number;
	tips: BlueskyTipRecord[];
	lastTippedAt: number;
}

interface BlueskyLeaderboardEntry {
	postId: string;
	authorDid: string;
	totalUsd: number;
	totalCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const TIP_PREFIX = "bluesky:tip:";
const LEADERBOARD_KEY = "bluesky:tip:leaderboard";
const MAX_TIPS_STORED = 500;
const LEADERBOARD_MAX = 100;
const TTL_SECONDS = 60 * 60 * 24 * 365;

// ─── Helpers ─────────────────────────────────────────────────────────

function sanitizePostId(raw: unknown): string | null {
	const str = sanitizeString(raw, 256);
	if (!str || str.length < 3 || hasSuspiciousPayload(str)) return null;
	// AT Protocol URIs: at://did:plc:abc/app.bsky.feed.post/123
	if (!/^[a-zA-Z0-9\-_:./]+$/.test(str)) return null;
	return str;
}

function sanitizeCurrency(raw: unknown): string | null {
	const allowed = new Set(["eth", "sol", "btc", "usdc", "base", "matic"]);
	const val = sanitizeString(raw, 16);
	return val && allowed.has(val) ? val : null;
}

// ─── KV helpers ──────────────────────────────────────────────────────

async function getAggregate(
	env: Env,
	postId: string,
): Promise<BlueskyTipAggregate | null> {
	if (!env.CACHE) return null;
	try {
		const raw = await env.CACHE.get(`${TIP_PREFIX}${postId}`);
		if (!raw) return null;
		return JSON.parse(raw) as BlueskyTipAggregate;
	} catch {
		return null;
	}
}

async function saveAggregate(
	env: Env,
	agg: BlueskyTipAggregate,
): Promise<void> {
	if (!env.CACHE) return;
	try {
		await env.CACHE.put(`${TIP_PREFIX}${agg.postId}`, JSON.stringify(agg), {
			expirationTtl: TTL_SECONDS,
		});
	} catch (err) {
		console.warn(
			"[bluesky-tip] failed to save aggregate:",
			err instanceof Error ? err.message : err,
		);
	}
}

async function updateLeaderboard(
	env: Env,
	entry: BlueskyLeaderboardEntry,
): Promise<void> {
	if (!env.CACHE) return;
	try {
		const raw = await env.CACHE.get(LEADERBOARD_KEY);
		let board: BlueskyLeaderboardEntry[] = raw ? JSON.parse(raw) : [];
		const existingIdx = board.findIndex((e) => e.postId === entry.postId);
		if (existingIdx >= 0) {
			board[existingIdx] = entry;
		} else {
			board.push(entry);
		}
		board.sort((a, b) => b.totalUsd - a.totalUsd);
		board = board.slice(0, LEADERBOARD_MAX);
		await env.CACHE.put(LEADERBOARD_KEY, JSON.stringify(board), {
			expirationTtl: TTL_SECONDS,
		});
	} catch (err) {
		console.warn(
			"[bluesky-tip] leaderboard update failed:",
			err instanceof Error ? err.message : err,
		);
	}
}

// ─── Shared recording path ───────────────────────────────────────────

export interface RecordBlueskyTipInput {
	postId: string;
	authorDid: string;
	authorHandle?: string;
	/** USD value of the tip */
	amountUsd: number;
	currency: string;
	method: string;
	from?: string;
	fromLabel?: string;
	toLabel?: string;
	/** Unified ledger recipient id — falls back to authorDid */
	recipientUserId?: string;
}

export async function recordBlueskyTip(
	env: Env,
	input: RecordBlueskyTipInput,
): Promise<{ totalUsd: number; totalCount: number }> {
	const { postId, authorDid, amountUsd, currency, method, from } = input;

	const tipRecord: BlueskyTipRecord = {
		amount: amountUsd,
		currency,
		method,
		from: from || undefined,
		timestamp: Date.now(),
	};

	const existing = await getAggregate(env, postId);
	const aggregate: BlueskyTipAggregate = existing ?? {
		postId,
		authorDid,
		totalUsd: 0,
		totalCount: 0,
		tips: [],
		lastTippedAt: 0,
	};

	aggregate.totalUsd += amountUsd;
	aggregate.totalCount += 1;
	aggregate.tips.push(tipRecord);
	aggregate.lastTippedAt = Date.now();

	if (aggregate.tips.length > MAX_TIPS_STORED) {
		aggregate.tips = aggregate.tips.slice(-MAX_TIPS_STORED);
	}

	await saveAggregate(env, aggregate);
	await updateLeaderboard(env, {
		postId,
		authorDid,
		totalUsd: aggregate.totalUsd,
		totalCount: aggregate.totalCount,
	});

	// ─── Record in the unified cross-platform ledger ─────────────
	await recordUnifiedTip(env, {
		platform: "bluesky",
		entityId: postId,
		entityType: "post",
		amountUsd,
		fromUserId: from,
		toUserId: input.recipientUserId || authorDid,
		fromLabel: input.fromLabel,
		toLabel: input.toLabel || input.authorHandle || authorDid,
		method: currency,
	});

	// ─── Store notification ──────────────────────────────────────
	const notifRecipient = authorDid;
	if (notifRecipient) {
		try {
			const notifKey = `notifications:bluesky:${notifRecipient}`;
			const tipNotif = {
				id: `bluesky:tip:${postId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
				type: "tip" as const,
				protocol: "bluesky",
				sourceProtocol: `bluesky_${currency}`,
				actorName: from ? `${from.slice(0, 6)}...` : "Anonymous",
				actorHandle: from || "",
				postId,
				amount: String(amountUsd),
				currency,
				createdAt: Date.now(),
				read: false,
			};
			const existingRaw = await env.CACHE?.get(notifKey);
			const existingNotifs: unknown[] = existingRaw
				? JSON.parse(existingRaw)
				: [];
			await env.CACHE?.put(
				notifKey,
				JSON.stringify([tipNotif, ...existingNotifs].slice(0, 100)),
				{
					expirationTtl: 60 * 60 * 24 * 30,
				},
			);
		} catch (kvErr) {
			console.warn(
				"[bluesky-tip] failed to store notification:",
				String(kvErr),
			);
		}
	}

	return { totalUsd: aggregate.totalUsd, totalCount: aggregate.totalCount };
}

// ─── POST /api/bluesky/tip — Record a tip ─────────────────────────────

export async function handleBlueskyTipCreate(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 10 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	try {
		const body = (await request.json()) as {
			postId?: string;
			authorDid?: string;
			amount?: string;
			currency?: string;
			method?: string;
			from?: string;
		};

		const postId = sanitizePostId(body.postId);
		const authorDid = sanitizeString(body.authorDid, 256);
		const amount = sanitizeString(body.amount, 64);
		const currency = sanitizeCurrency(body.currency ?? body.method);
		const method = sanitizeString(body.method ?? body.currency, 32);
		const from = sanitizeString(body.from, 128);

		if (
			!postId ||
			!authorDid ||
			!amount ||
			!isValidAmount(amount) ||
			!currency
		) {
			return jsonResponse(
				{ error: "postId, authorDid, amount, and currency are required" },
				400,
			);
		}

		const amountNum = Number.parseFloat(amount);
		if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
			return jsonResponse(
				{ error: "Amount must be between 0.01 and 10,000" },
				400,
			);
		}

		const result = await recordBlueskyTip(env, {
			postId,
			authorDid,
			amountUsd: amountNum,
			currency,
			method,
			from: from || undefined,
		});

		return jsonResponse({
			success: true,
			postId,
			totalUsd: result.totalUsd,
			totalCount: result.totalCount,
		});
	} catch (err) {
		return jsonResponse({ error: String(err) }, 500);
	}
}

// ─── GET /api/bluesky/tip/stats?postId=... — Get tip stats ──────────

export async function handleBlueskyTipStats(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const postId = sanitizePostId(url.searchParams.get("postId"));

	if (!postId) {
		return jsonResponse({ error: "postId query parameter required" }, 400);
	}

	const agg = await getAggregate(env, postId);

	if (!agg) {
		return jsonResponse({
			postId,
			totalUsd: 0,
			totalCount: 0,
			tips: [],
			lastTippedAt: null,
		});
	}

	return jsonResponse({
		postId: agg.postId,
		authorDid: agg.authorDid,
		totalUsd: agg.totalUsd,
		totalCount: agg.totalCount,
		lastTippedAt: agg.lastTippedAt,
		recentTips: agg.tips.slice(-50).reverse(),
	});
}

// ─── GET /api/bluesky/tip/leaderboard — Top tipped content ─────────────

export async function handleBlueskyLeaderboard(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const limit = Math.min(
		Math.max(Number(url.searchParams.get("limit")) || 25, 1),
		100,
	);

	if (!env.CACHE) {
		return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
	}

	try {
		const raw = await env.CACHE.get(LEADERBOARD_KEY);
		if (!raw) {
			return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
		}
		let board: BlueskyLeaderboardEntry[] = JSON.parse(raw);
		board = board.slice(0, limit);
		return jsonResponse({
			leaderboard: board,
			meta: { total: board.length, limit },
		});
	} catch (err) {
		return jsonResponse({ error: String(err) }, 500);
	}
}
