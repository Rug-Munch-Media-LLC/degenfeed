/**
 * @degenfeed/api-worker — Subscription routes
 *
 * Universal Creator Subscription system.
 * Supports Ethereum / Solana wallets, tiered subscriptions,
 * payment confirmation, content gating, and cancellation.
 *
 * KV keys:
 *   sub:config:{wallet}                  → Creator tier config (90d TTL)
 *   sub:{creator}:{subscriber}           → Subscription record (30d TTL active)
 *   sub:subscribers:{creator}            → Subscriber wallet index array
 *   sub:nonce:{creator}:{subscriber}     → Payment nonce (10min TTL)
 *   sub:tx:{txHash}                      → Used txHash dedup (90d TTL)
 *   sub:badge:{wallet}                   → Badge cache (24h TTL)
 */

import {
	type Env,
	jsonResponse,
	noCacheJsonResponse,
	rateLimit,
} from "../index";
import {
	isValidEvmAddress,
	isValidSolanaAddress,
	sanitizeString,
	validateBodySize,
} from "../sanitize";
import { requireSession } from "../session";

// ─── Tier definitions ──────────────────────────────────────────

export const SUBSCRIPTION_TIERS = {
	supporter: {
		name: "Supporter",
		price: 5,
		benefits: ["badge", "early_access"] as const,
	},
	member: {
		name: "Member",
		price: 15,
		benefits: [
			"badge",
			"early_access",
			"exclusive_content",
			"discord",
		] as const,
	},
	patron: {
		name: "Patron",
		price: 50,
		benefits: [
			"badge",
			"early_access",
			"exclusive_content",
			"discord",
			"1on1",
			"voting",
		] as const,
	},
};

export type TierId = keyof typeof SUBSCRIPTION_TIERS;

// ─── Constants ─────────────────────────────────────────────────

const VALID_TIER_IDS = new Set(Object.keys(SUBSCRIPTION_TIERS));
const NONCE_TTL_SEC = 600; // 10 minutes
const CONFIG_TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const ACTIVE_SUB_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const TX_DEDUP_TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const BADGE_TTL_SEC = 60 * 60 * 24; // 24 hours
const MAX_SUBSCRIBERS = 1000;

// ─── Interfaces ────────────────────────────────────────────────

interface TierConfig {
	tiers: string[];
	evmAddress?: string;
	solanaAddress?: string;
	updatedAt: number;
}

interface SubscriptionRecord {
	tier: string;
	amount: string;
	method: string;
	status: "pending" | "active" | "cancelled";
	txHash?: string;
	nonce: string;
	createdAt: number;
	startDate?: number;
	expiryDate?: number;
}

interface NonceRecord {
	nonce: string;
	amount: string;
}

// ─── KV key helpers ────────────────────────────────────────────

function kvConfigKey(wallet: string): string {
	return `sub:config:${wallet.toLowerCase()}`;
}

function kvSubKey(creator: string, subscriber: string): string {
	return `sub:${creator.toLowerCase()}:${subscriber.toLowerCase()}`;
}

function kvSubscribersKey(creator: string): string {
	return `sub:subscribers:${creator.toLowerCase()}`;
}

function kvNonceKey(creator: string, subscriber: string): string {
	return `sub:nonce:${creator.toLowerCase()}:${subscriber.toLowerCase()}`;
}

function kvTxKey(txHash: string): string {
	return `sub:tx:${txHash.toLowerCase()}`;
}

function _kvBadgeKey(wallet: string): string {
	return `sub:badge:${wallet.toLowerCase()}`;
}

// ─── Validators ────────────────────────────────────────────────

function validateWallet(value: string, chain: string): string | null {
	const cleaned = sanitizeString(value, 128).toLowerCase();
	if (!cleaned) return null;
	if (chain === "ethereum" && isValidEvmAddress(cleaned)) return cleaned;
	if (chain === "solana" && isValidSolanaAddress(cleaned)) return cleaned;
	return null;
}

function validateWalletEither(value: string): string | null {
	const cleaned = sanitizeString(value, 128).toLowerCase();
	if (!cleaned) return null;
	if (isValidEvmAddress(cleaned) || isValidSolanaAddress(cleaned))
		return cleaned;
	return null;
}

function generateNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return hex;
}

function tierPrice(tierId: string): number {
	const tier = SUBSCRIPTION_TIERS[tierId as TierId];
	return tier ? tier.price : 0;
}

function isValidTier(tierId: string): boolean {
	return VALID_TIER_IDS.has(tierId);
}

function getDefaultTiersList(): Array<{
	id: string;
	name: string;
	price: number;
	benefits: readonly string[];
}> {
	return Object.entries(SUBSCRIPTION_TIERS).map(([id, t]) => ({
		id,
		name: t.name,
		price: t.price,
		benefits: t.benefits,
	}));
}

// ─── A. GET /api/subscription/:creator — Public tiers ─────────

export async function handleSubscriptionTiers(
	_request: Request,
	env: Env,
	creator: string,
): Promise<Response> {
	const wallet = validateWalletEither(creator);
	if (!wallet) {
		return jsonResponse({ error: "Invalid creator address" }, 400);
	}

	const key = kvConfigKey(wallet);
	let config: TierConfig | null = null;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(key);
		if (raw) config = JSON.parse(raw) as TierConfig;
	} catch {
		/* ignore */
	}

	if (!config) {
		return jsonResponse({
			creator: wallet,
			tiers: getDefaultTiersList(),
			configured: false,
		});
	}

	const tiers = config.tiers
		.filter((t) => isValidTier(t))
		.map((t) => ({
			id: t,
			name: SUBSCRIPTION_TIERS[t as TierId].name,
			price: SUBSCRIPTION_TIERS[t as TierId].price,
			benefits: SUBSCRIPTION_TIERS[t as TierId].benefits,
		}));

	return jsonResponse({ creator: wallet, tiers, configured: true });
}

// ─── B. POST /api/subscription/create — Creator setup ─────────

export async function handleSubscriptionCreate(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const bodySizeCheck = validateBodySize(request, 10 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	let body: { wallet?: string; chain?: string; tiers?: string[] } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const wallet = body.wallet || session.address;
	const chain = sanitizeString(body.chain, 16) || session.chain || "ethereum";

	if (chain !== "ethereum" && chain !== "solana") {
		return jsonResponse(
			{ error: "Invalid chain. Use ethereum or solana." },
			400,
		);
	}

	const validatedWallet = validateWallet(wallet, chain);
	if (!validatedWallet) {
		return jsonResponse({ error: "Invalid wallet address" }, 400);
	}

	if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
		return jsonResponse({ error: "At least one tier required" }, 400);
	}

	const tiers = body.tiers
		.map((t) => sanitizeString(t, 32))
		.filter((t) => t.length > 0 && isValidTier(t));

	if (tiers.length === 0) {
		return jsonResponse({ error: "No valid tiers provided" }, 400);
	}

	const config: TierConfig = {
		tiers,
		updatedAt: Date.now(),
	};

	if (chain === "ethereum") {
		config.evmAddress = validatedWallet;
	} else {
		config.solanaAddress = validatedWallet;
	}

	try {
		await env.SUBSCRIPTIONS?.put(
			kvConfigKey(validatedWallet),
			JSON.stringify(config),
			{
				expirationTtl: CONFIG_TTL_SEC,
			},
		);
	} catch {
		return jsonResponse({ error: "Storage unavailable" }, 500);
	}

	return noCacheJsonResponse({ success: true, config });
}

// ─── C. POST /api/subscription/subscribe — Create pending sub ─

export async function handleSubscriptionSubscribe(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const bodySizeCheck = validateBodySize(request, 10 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	let body: {
		creator?: string;
		creatorChain?: string;
		tier?: string;
		amount?: string;
		method?: string;
	} = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const creator = sanitizeString(body.creator, 128);
	const creatorChain = sanitizeString(body.creatorChain, 16);
	const tier = sanitizeString(body.tier, 32);
	const amount = sanitizeString(body.amount, 64);
	const method = sanitizeString(body.method, 32);

	if (!creator || !tier || !amount || !creatorChain) {
		return jsonResponse(
			{ error: "creator, creatorChain, tier, and amount required" },
			400,
		);
	}

	if (creatorChain !== "ethereum" && creatorChain !== "solana") {
		return jsonResponse(
			{ error: "creatorChain must be ethereum or solana" },
			400,
		);
	}

	const creatorWallet = validateWallet(creator, creatorChain);
	if (!creatorWallet) {
		return jsonResponse({ error: "Invalid creator address" }, 400);
	}

	if (!isValidTier(tier)) {
		return jsonResponse(
			{ error: `Invalid tier. Use: ${[...VALID_TIER_IDS].join(", ")}` },
			400,
		);
	}

	const expectedPrice = tierPrice(tier);
	const parsedAmount = Number.parseFloat(amount);
	if (Number.isNaN(parsedAmount) || parsedAmount !== expectedPrice) {
		return jsonResponse(
			{ error: `Amount ${amount} does not match tier price ${expectedPrice}` },
			400,
		);
	}

	// Verify creator has configured this tier
	const configKey = kvConfigKey(creatorWallet);
	try {
		const configRaw = await env.SUBSCRIPTIONS?.get(configKey);
		if (configRaw) {
			const config = JSON.parse(configRaw) as TierConfig;
			if (!config.tiers.includes(tier)) {
				return jsonResponse(
					{ error: `Creator does not support tier: ${tier}` },
					400,
				);
			}
		}
	} catch {
		/* If we can't check, allow it */
	}

	const subscriber = session.address.toLowerCase();
	const nonce = generateNonce();
	const now = Date.now();

	const subRecord: SubscriptionRecord = {
		tier,
		amount,
		method: method || "ethereum",
		status: "pending",
		nonce,
		createdAt: now,
	};

	const subKey = kvSubKey(creatorWallet, subscriber);
	const nonceKey = kvNonceKey(creatorWallet, subscriber);
	const subscribersKey = kvSubscribersKey(creatorWallet);

	const nonceRecord: NonceRecord = { nonce, amount };

	try {
		await env.SUBSCRIPTIONS?.put(subKey, JSON.stringify(subRecord), {
			expirationTtl: NONCE_TTL_SEC,
		});
		await env.CACHE?.put(nonceKey, JSON.stringify(nonceRecord), {
			expirationTtl: NONCE_TTL_SEC,
		});

		// Read-modify-write subscriber index
		const existingRaw = await env.SUBSCRIPTIONS?.get(subscribersKey);
		const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
		if (!existing.includes(subscriber)) {
			existing.push(subscriber);
			await env.SUBSCRIPTIONS?.put(
				subscribersKey,
				JSON.stringify(existing.slice(0, MAX_SUBSCRIBERS)),
			);
		}
	} catch {
		return jsonResponse({ error: "Storage unavailable" }, 500);
	}

	// Return payment intent matching the tip.ts pattern
	return noCacheJsonResponse({
		success: true,
		status: "pending",
		paymentIntent: {
			to: creatorWallet,
			amount,
			chain: creatorChain,
			nonce,
		},
		instructions:
			"Complete the payment and POST the txHash to /api/subscription/confirm",
		nonce,
	});
}

// ─── D. POST /api/subscription/confirm — Verify payment ────

export async function handleSubscriptionConfirm(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const bodySizeCheck = validateBodySize(request, 10 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	let body: { creator?: string; txHash?: string; nonce?: string } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const creator = sanitizeString(body.creator, 128).toLowerCase();
	const txHash = sanitizeString(body.txHash, 256);
	const providedNonce = sanitizeString(body.nonce, 64);

	if (!creator || !txHash) {
		return jsonResponse({ error: "creator and txHash required" }, 400);
	}

	if (!isValidEvmAddress(creator) && !isValidSolanaAddress(creator)) {
		return jsonResponse({ error: "Invalid creator address" }, 400);
	}

	// Dedup txHash
	const txKey = kvTxKey(txHash);
	try {
		const existingTx = await env.SUBSCRIPTIONS?.get(txKey);
		if (existingTx) {
			return jsonResponse(
				{ error: "Transaction already used for a subscription" },
				409,
			);
		}
	} catch {
		/* continue */
	}

	const subscriber = session.address.toLowerCase();
	const subKey = kvSubKey(creator, subscriber);
	const nonceKey = kvNonceKey(creator, subscriber);

	let record: SubscriptionRecord;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(subKey);
		if (!raw) {
			return jsonResponse({ error: "No pending subscription found" }, 404);
		}
		record = JSON.parse(raw) as SubscriptionRecord;
	} catch {
		return jsonResponse({ error: "No pending subscription found" }, 404);
	}

	if (record.status !== "pending") {
		return jsonResponse({ error: "Subscription is not in pending state" }, 409);
	}

	// Verify nonce match
	if (providedNonce) {
		let nonceRec: NonceRecord | null = null;
		try {
			const nonceRaw = await env.CACHE?.get(nonceKey);
			if (nonceRaw) nonceRec = JSON.parse(nonceRaw) as NonceRecord;
		} catch {
			/* ignore */
		}
		if (nonceRec?.nonce !== record.nonce || nonceRec?.nonce !== providedNonce) {
			return jsonResponse({ error: "Invalid nonce" }, 400);
		}
	}

	const now = Date.now();
	const expiryDate = now + ACTIVE_SUB_TTL_SEC * 1000;

	record.status = "active";
	record.txHash = txHash;
	record.startDate = now;
	record.expiryDate = expiryDate;
	record.nonce = "";

	try {
		await env.SUBSCRIPTIONS?.put(subKey, JSON.stringify(record), {
			expirationTtl: ACTIVE_SUB_TTL_SEC,
		});
		await env.SUBSCRIPTIONS?.put(
			txKey,
			JSON.stringify({ usedAt: now, creator, subscriber }),
			{
				expirationTtl: TX_DEDUP_TTL_SEC,
			},
		);
		await env.CACHE?.delete(nonceKey);
	} catch {
		return jsonResponse({ error: "Storage unavailable" }, 500);
	}

	// Update subscriber's subscription list index
	try {
		const listKey = `sub:list:${subscriber}`;
		const listRaw = await env.SUBSCRIPTIONS?.get(listKey);
		const list: string[] = listRaw ? JSON.parse(listRaw) : [];
		if (!list.includes(creator)) {
			list.push(creator);
			await env.SUBSCRIPTIONS?.put(listKey, JSON.stringify(list), {
				expirationTtl: ACTIVE_SUB_TTL_SEC,
			});
		}
	} catch {
		/* best-effort */
	}

	// Invalidate badge cache (best-effort)
	try {
		await env.CACHE?.put(
			_kvBadgeKey(subscriber),
			JSON.stringify({ tier: record.tier, updatedAt: now }),
			{ expirationTtl: BADGE_TTL_SEC },
		);
	} catch {
		/* best-effort */
	}

	return noCacheJsonResponse({ success: true, expiryDate });
}

// ─── E. GET /api/subscription/status — Check sub status ────

export async function handleSubscriptionStatus(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const url = new URL(request.url);
	const creator = sanitizeString(url.searchParams.get("creator"), 128);

	if (!creator) {
		return jsonResponse({ error: "creator query parameter required" }, 400);
	}

	if (!isValidEvmAddress(creator) && !isValidSolanaAddress(creator)) {
		return jsonResponse({ error: "Invalid creator address" }, 400);
	}

	// Stricter rate limit: 10 req/60s
	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const rl = await rateLimit(env, ip, "/api/subscription/status", 10, 60_000);
	if (!rl.allowed) {
		return new Response(
			JSON.stringify({ error: "Rate limit", retryAfterMs: rl.retryAfter }),
			{
				status: 429,
				headers: {
					"content-type": "application/json",
					"retry-after": String(Math.ceil(rl.retryAfter / 1000)),
				},
			},
		);
	}

	const subscriber = session.address.toLowerCase();
	const subKey = kvSubKey(creator, subscriber);

	let record: SubscriptionRecord | null = null;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(subKey);
		if (raw) record = JSON.parse(raw) as SubscriptionRecord;
	} catch {
		/* ignore */
	}

	if (!record) {
		return jsonResponse({ error: "Not found" }, 404);
	}

	if (record.status !== "active" || !record.expiryDate) {
		return jsonResponse({ error: "Not found" }, 404);
	}

	const nowMs = Date.now();
	const active = record.expiryDate > nowMs;
	const daysRemaining = active
		? Math.ceil((record.expiryDate - nowMs) / (1000 * 60 * 60 * 24))
		: 0;

	if (!active) {
		return jsonResponse({ error: "Not found" }, 404);
	}

	return jsonResponse({
		active,
		creator,
		subscription: {
			tier: record.tier,
			amount: record.amount,
			method: record.method,
			startDate: record.startDate,
			expiryDate: record.expiryDate,
		},
		daysRemaining,
	});
}

// ─── F. POST /api/subscription/cancel — Cancel sub ────────

export async function handleSubscriptionCancel(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const bodySizeCheck = validateBodySize(request, 10 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	let body: { creator?: string } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const creator = sanitizeString(body.creator, 128).toLowerCase();
	if (!creator) {
		return jsonResponse({ error: "creator required" }, 400);
	}

	if (!isValidEvmAddress(creator) && !isValidSolanaAddress(creator)) {
		return jsonResponse({ error: "Invalid creator address" }, 400);
	}

	const subscriber = session.address.toLowerCase();
	const subKey = kvSubKey(creator, subscriber);

	let record: SubscriptionRecord;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(subKey);
		if (!raw) {
			return jsonResponse({ error: "No subscription found" }, 404);
		}
		record = JSON.parse(raw) as SubscriptionRecord;
	} catch {
		return jsonResponse({ error: "No subscription found" }, 404);
	}

	if (record.status === "cancelled") {
		return jsonResponse({ error: "Subscription already cancelled" }, 409);
	}

	record.status = "cancelled";

	try {
		await env.SUBSCRIPTIONS?.put(subKey, JSON.stringify(record));
	} catch {
		return jsonResponse({ error: "Storage unavailable" }, 500);
	}

	return noCacheJsonResponse({ success: true, status: "cancelled" });
}

// ─── G. POST /api/subscription/check-content — Gate check ──

export async function handleSubscriptionContentCheck(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const bodySizeCheck = validateBodySize(request, 10 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	let body: { creator?: string } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const creator = sanitizeString(body.creator, 128).toLowerCase();
	if (!creator) {
		return jsonResponse({ error: "creator required" }, 400);
	}

	if (!isValidEvmAddress(creator) && !isValidSolanaAddress(creator)) {
		return jsonResponse({ error: "Invalid creator address" }, 400);
	}

	const subscriber = session.address.toLowerCase();
	const subKey = kvSubKey(creator, subscriber);

	let record: SubscriptionRecord | null = null;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(subKey);
		if (raw) record = JSON.parse(raw) as SubscriptionRecord;
	} catch {
		/* ignore */
	}

	if (record?.status !== "active" || !record.expiryDate) {
		return jsonResponse({ hasAccess: false });
	}

	const hasAccess = record.expiryDate > Date.now();
	return jsonResponse({
		hasAccess,
		...(hasAccess ? { tier: record.tier } : {}),
	});
}

// ─── H. GET /api/subscription/my — List user's subscriptions ──

export async function handleSubscriptionMy(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const subscriber = session.address.toLowerCase();
	const listKey = `sub:list:${subscriber}`;

	let creatorWallets: string[] = [];
	try {
		const raw = await env.SUBSCRIPTIONS?.get(listKey);
		if (raw) creatorWallets = JSON.parse(raw) as string[];
	} catch {
		/* ignore */
	}

	if (creatorWallets.length === 0) {
		return jsonResponse({ subscriptions: [] });
	}

	// Fetch each subscription record
	const subscriptions: Array<{
		creator: string;
		tier: string;
		amount: string;
		startDate: number;
		expiryDate: number;
		daysRemaining: number;
	}> = [];

	for (const creator of creatorWallets) {
		try {
			const raw = await env.SUBSCRIPTIONS?.get(kvSubKey(creator, subscriber));
			if (raw) {
				const record = JSON.parse(raw) as SubscriptionRecord;
				if (
					record.status === "active" &&
					record.expiryDate &&
					record.expiryDate > Date.now()
				) {
					subscriptions.push({
						creator,
						tier: record.tier,
						amount: record.amount,
						startDate: record.startDate ?? 0,
						expiryDate: record.expiryDate,
						daysRemaining: Math.ceil(
							(record.expiryDate - Date.now()) / (1000 * 60 * 60 * 24),
						),
					});
				}
			}
		} catch {
			/* skip */
		}
	}

	return jsonResponse({ subscriptions });
}
