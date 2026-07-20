import { type Env, jsonResponse, noCacheJsonResponse } from "../index";
import { isValidSolanaAddress, sanitizeString } from "../sanitize";
import { requireSession } from "../session";

export type SubscriptionTier = "pro" | "platinum";

interface SubscriptionRecord {
	tier: SubscriptionTier;
	identityId: string;
	expiresAt: number;
	startedAt: number;
	txSignature?: string;
}

/** Platform premium subscription record stored in KV under `premium:${address}` */
export interface PlatformPremiumRecord {
	tier: SubscriptionTier;
	identityId: string;
	expiresAt: number;
	startedAt: number;
	status: "active" | "cancelled";
	firstMonthPromo: boolean;
	nextBillingAmount: number; // in cents
	paymentMethod: string;
	txHash?: string;
}

const TIER_PRICES: Record<SubscriptionTier, number> = {
	pro: 10,
	platinum: 25,
};

const TIER_PRICES_CENTS: Record<SubscriptionTier, number> = {
	pro: 1000,
	platinum: 2500,
};

const PREMIUM_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function buildBlinkUrl(origin: string, tier: SubscriptionTier): string {
	return `${origin}/api/billing/checkout?tier=${tier}`;
}

export async function handleBillingCheckout(
	request: Request,
	_env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const tier = sanitizeString(
		url.searchParams.get("tier"),
		16,
	) as SubscriptionTier;
	if (!tier || !(tier in TIER_PRICES)) {
		return jsonResponse({ error: "Invalid tier. Use pro or creator." }, 400);
	}
	const origin = `${url.protocol}//${url.host}`;
	const amount = TIER_PRICES[tier];
	const blinkUrl = buildBlinkUrl(origin, tier);

	return jsonResponse({
		tier,
		amount,
		currency: "SOL",
		blinkUrl,
		action: {
			title: `DegenFeed ${tier === "pro" ? "Pro" : "Platinum"}`,
			icon: `${origin}/favicon.ico`,
			description: `Subscribe to DegenFeed ${tier} for ${amount} SOL/month`,
			label: `Pay ${amount} SOL`,
			links: {
				actions: [
					{
						label: `Pay ${amount} SOL`,
						href: `${origin}/api/billing/verify?tier=${tier}`,
					},
				],
			},
		},
	});
}

interface VerifyBody {
	account?: string;
	signature?: string;
	transaction?: string;
}

async function verifySolanaTransaction(
	signature: string,
	rpcUrl: string,
): Promise<boolean> {
	try {
		const res = await fetch(rpcUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "getSignatureStatuses",
				params: [[signature], { searchTransactionHistory: true }],
			}),
		});
		if (!res.ok) return false;
		const data = (await res.json()) as {
			result?: {
				value?: Array<{ confirmationStatus?: string; err?: unknown } | null>;
			};
		};
		const status = data?.result?.value?.[0];
		return (
			status?.confirmationStatus === "confirmed" ||
			status?.confirmationStatus === "finalized"
		);
	} catch {
		return false;
	}
}

export async function handleBillingVerify(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const tier = sanitizeString(
		url.searchParams.get("tier"),
		16,
	) as SubscriptionTier;
	if (!tier || !(tier in TIER_PRICES)) {
		return jsonResponse({ error: "Invalid tier" }, 400);
	}

	let body: VerifyBody = {};
	try {
		body = (await request.json()) as VerifyBody;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const account = sanitizeString(body.account, 128);
	const signature = sanitizeString(body.signature, 128);
	if (!account || !isValidSolanaAddress(account)) {
		return jsonResponse({ error: "Valid Solana account required" }, 400);
	}
	if (!signature) {
		return jsonResponse({ error: "Transaction signature required" }, 400);
	}

	// Verify the transaction on-chain before granting subscription.
	const rpcUrl = env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
	const confirmed = await verifySolanaTransaction(signature, rpcUrl);
	if (!confirmed) {
		return jsonResponse(
			{
				error:
					"Transaction not confirmed on-chain. Wait for confirmation and try again.",
			},
			402,
		);
	}

	const identityId = `solana:${account}`;
	const now = Date.now();
	const record: SubscriptionRecord = {
		tier,
		identityId,
		startedAt: now,
		expiresAt: now + 30 * 24 * 60 * 60 * 1000,
		txSignature: signature,
	};

	try {
		await env.SUBSCRIPTIONS?.put(identityId, JSON.stringify(record));
	} catch {
		/* ignore KV errors */
	}

	return jsonResponse({
		ok: true,
		tier,
		identityId,
		expiresAt: record.expiresAt,
	});
}

export async function handleBillingStatus(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const identityId = sanitizeString(url.searchParams.get("identityId"), 128);
	if (!identityId) return jsonResponse({ error: "identityId required" }, 400);

	let record: SubscriptionRecord | undefined;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(identityId);
		if (raw) record = JSON.parse(raw) as SubscriptionRecord;
	} catch {
		/* KV operation failed -- non-critical, continue */
	}

	const active = Boolean(record && record.expiresAt > Date.now());
	const tier = active && record ? record.tier : "free";
	return jsonResponse({
		identityId,
		tier,
		active,
		expiresAt: record?.expiresAt,
	});
}

export function isPremiumTier(tier?: string): boolean {
	return tier === "pro" || tier === "platinum" || tier === "enterprise";
}

export function isPlatinumTier(tier?: string): boolean {
	return tier === "platinum" || tier === "enterprise";
}

// ─── KV key helpers ────────────────────────────────────────────────────

function premiumKey(address: string): string {
	return `premium:${address.toLowerCase()}`;
}

// ─── NEW: POST /api/billing/subscribe — Create platform subscription ───

export async function handleBillingSubscribe(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	let body: { tier?: string; paymentMethod?: string; firstMonth?: boolean } =
		{};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const tier = sanitizeString(body.tier, 16) as SubscriptionTier;
	if (!tier || !(tier in TIER_PRICES)) {
		return jsonResponse({ error: "Invalid tier. Use pro or creator." }, 400);
	}

	const paymentMethod = sanitizeString(body.paymentMethod, 32) || "eth-base";
	const firstMonth = Boolean(body.firstMonth);

	const address = session.address.toLowerCase();
	const identityId = session.chain
		? `${session.chain}:${address}`
		: `evm:${address}`;
	const now = Date.now();
	const expiresAt = now + PREMIUM_TTL_MS;
	const txHash = `sim_${now}_${address.slice(0, 8)}`;

	// Check for existing active subscription
	try {
		const existingRaw = await env.SUBSCRIPTIONS?.get(premiumKey(address));
		if (existingRaw) {
			const existing = JSON.parse(existingRaw) as PlatformPremiumRecord;
			if (existing.status === "active" && existing.expiresAt > now) {
				// Extend by one period rather than error
				// (existing.expiresAt already > now, so add to that)
				const record: PlatformPremiumRecord = {
					...existing,
					expiresAt: existing.expiresAt + PREMIUM_TTL_MS,
					status: "active",
					firstMonthPromo: firstMonth,
					paymentMethod,
					txHash,
				};
				await env.SUBSCRIPTIONS?.put(
					premiumKey(address),
					JSON.stringify(record),
				);
				return noCacheJsonResponse({
					success: true,
					tier,
					expiresAt: record.expiresAt,
					txHash,
					status: "active",
				});
			}
		}
	} catch {
		/* KV operation failed -- non-critical, continue */
	}

	const amountCents =
		firstMonth && tier === "pro" ? 1000 : TIER_PRICES_CENTS[tier];

	const record: PlatformPremiumRecord = {
		tier,
		identityId,
		expiresAt,
		startedAt: now,
		status: "active",
		firstMonthPromo: firstMonth && tier === "pro",
		nextBillingAmount: amountCents,
		paymentMethod,
		txHash,
	};

	try {
		await env.SUBSCRIPTIONS?.put(premiumKey(address), JSON.stringify(record), {
			expirationTtl: Math.ceil(PREMIUM_TTL_MS / 1000) + 86400, // 31 days
		});
	} catch {
		return jsonResponse({ error: "Storage unavailable" }, 500);
	}

	return noCacheJsonResponse({
		success: true,
		tier,
		expiresAt,
		txHash,
		status: "active",
	});
}

// ─── NEW: POST /api/billing/cancel — Cancel platform subscription ──────

export async function handleBillingCancel(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const address = session.address.toLowerCase();
	const key = premiumKey(address);

	let record: PlatformPremiumRecord | null = null;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(key);
		if (raw) record = JSON.parse(raw) as PlatformPremiumRecord;
	} catch {
		/* KV operation failed -- non-critical, continue */
	}

	if (!record) {
		return jsonResponse({ error: "No active subscription found" }, 404);
	}

	if (record.status === "cancelled") {
		return jsonResponse({ error: "Subscription already cancelled" }, 409);
	}

	record.status = "cancelled";

	try {
		await env.SUBSCRIPTIONS?.put(key, JSON.stringify(record));
	} catch {
		return jsonResponse({ error: "Storage unavailable" }, 500);
	}

	return noCacheJsonResponse({ success: true, status: "cancelled" });
}

// ─── NEW: GET /api/billing/my-status — Get current user's premium status ─

export async function handleBillingMyStatus(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const address = session.address.toLowerCase();
	const key = premiumKey(address);

	let record: PlatformPremiumRecord | null = null;
	try {
		const raw = await env.SUBSCRIPTIONS?.get(key);
		if (raw) record = JSON.parse(raw) as PlatformPremiumRecord;
	} catch {
		/* KV operation failed -- non-critical, continue */
	}

	if (record?.status !== "active" || record.expiresAt <= Date.now()) {
		return jsonResponse({
			tier: "free",
			isPremium: false,
			expiresAt: null,
			firstMonthPromo: false,
			nextBillingAmount: null,
			daysRemaining: null,
		});
	}

	const daysRemaining = Math.ceil(
		(record.expiresAt - Date.now()) / (1000 * 60 * 60 * 24),
	);

	return jsonResponse({
		tier: record.tier,
		isPremium: true,
		expiresAt: new Date(record.expiresAt).toISOString(),
		firstMonthPromo: record.firstMonthPromo,
		nextBillingAmount: record.nextBillingAmount,
		daysRemaining,
	});
}
