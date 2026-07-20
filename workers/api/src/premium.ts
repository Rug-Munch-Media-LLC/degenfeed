/**
 * @degenfeed/api-worker — Premium tier helpers
 *
 * Shared utilities for premium-gating features.
 * Exports:
 *   checkPremiumStatus() — returns tier + expiry or null
 *   requirePremiumTier() — returns blocking Response or null
 *   addPremiumHeader() — attaches X-Premium-Required to a response
 *   TIER_RANK, PremiumTier types
 */

import type { Env } from "./index";
import { jsonResponse } from "./index";

export type PremiumTier = "pro" | "creator";

export interface PremiumStatus {
	tier: string;
	expiresAt: number;
}

/** Higher rank = more access. Used to compare tiers. */
export const TIER_RANK: Record<string, number> = {
	free: 0,
	pro: 1,
	creator: 2,
};

/**
 * Look up the premium subscription status for a wallet address.
 * Checks both legacy (solana:/ethereum: prefix) and current (premium: prefix)
 * SUBSCRIPTIONS KV schemas.
 *
 * Returns null when the user has no active subscription.
 */
export async function checkPremiumStatus(
	walletAddress: string,
	env: Env,
): Promise<PremiumStatus | null> {
	if (!env.SUBSCRIPTIONS) return null;

	const address = walletAddress.toLowerCase();
	const now = Date.now();

	try {
		// ── Legacy schema: identity-prefixed keys (from handleBillingVerify) ──
		for (const prefix of ["solana:", "ethereum:"]) {
			const raw = await env.SUBSCRIPTIONS.get(`${prefix}${address}`);
			if (raw) {
				const record = JSON.parse(raw) as { tier: string; expiresAt: number };
				if (record.expiresAt > now) {
					return { tier: record.tier, expiresAt: record.expiresAt };
				}
			}
		}

		// ── Current schema: premium: prefix (from handleBillingSubscribe) ──
		const premRaw = await env.SUBSCRIPTIONS.get(`premium:${address}`);
		if (premRaw) {
			const record = JSON.parse(premRaw) as {
				tier: string;
				expiresAt: number;
				status?: string;
			};
			if (record.status !== "cancelled" && record.expiresAt > now) {
				return { tier: record.tier, expiresAt: record.expiresAt };
			}
		}
	} catch {
		// KV or parse error — treat as not premium
	}

	return null;
}

/**
 * Premium gate helper.
 *
 * Returns a 402 Response with `X-Premium-Required` header when the user
 * does NOT meet the required tier. Returns `null` when the check passes
 * and the request should proceed.
 *
 * Usage in a handler:
 *   const gate = await requirePremiumTier(walletAddress, env, 'pro');
 *   if (gate) return gate;
 */
export async function requirePremiumTier(
	walletAddress: string,
	env: Env,
	minTier: PremiumTier = "pro",
): Promise<Response | null> {
	const status = await checkPremiumStatus(walletAddress, env);

	// ── No subscription at all ────────────────────────────────────────
	if (!status) {
		const label = minTier === "creator" ? "Creator" : "Pro";
		return jsonResponse(
			{
				error: `${label} subscription required. Upgrade at /premium to unlock this feature.`,
				upgrade: true,
				requiredTier: minTier,
			},
			402,
			{ "X-Premium-Required": label },
		);
	}

	// ── Tier too low ──────────────────────────────────────────────────
	const userRank = TIER_RANK[status.tier] ?? 0;
	const requiredRank = TIER_RANK[minTier] ?? 1;

	if (userRank < requiredRank) {
		const label = minTier === "creator" ? "Creator" : "Pro";
		return jsonResponse(
			{
				error: `This feature requires ${label} tier or higher (current: ${status.tier}). Upgrade at /premium.`,
				upgrade: true,
				requiredTier: minTier,
				currentTier: status.tier,
			},
			402,
			{ "X-Premium-Required": label },
		);
	}

	// ── Allowed ───────────────────────────────────────────────────────
	return null;
}

/**
 * Attach the `X-Premium-Required` header to an existing Response.
 * Use when blocking a request inline (outside requirePremiumTier).
 */
export function addPremiumHeader(response: Response, tier: string): Response {
	const headers = new Headers(response.headers);
	headers.set("X-Premium-Required", tier);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
