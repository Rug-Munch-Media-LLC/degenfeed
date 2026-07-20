/**
 * @degenfeed/api-worker — Tier management routes
 *
 * GET    /api/tiers        — Get all tier definitions with features and limits
 * GET    /api/tiers/me     — Current user's tier + usage + limits
 * POST   /api/tiers/upgrade — Initiate tier upgrade (redirects to billing checkout)
 *
 * These endpoints power the /premium page and the tier gate middleware.
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import {
	TIER_LIMITS as RAW_TIER_LIMITS,
	TIER_NAMES,
	FEATURE_TIER_REQUIREMENTS,
	TOKEN_GENERATION_FEE_USD,
	checkPremiumStatus,
	hasTierAccess,
	type PremiumTier,
} from "../premium";

const TIER_LIMITS = RAW_TIER_LIMITS as {
	basic: { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number };
	pro: { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number };
	platinum: { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number };
	enterprise: { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number };
};
import { requireSession } from "../session";
import { getCurrentUsage, getRecommendedTier } from "../lib/tier-gate";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TierFeature {
	name: string;
	key: string;
	included: boolean;
}

interface TierDefinition {
	id: string;
	name: string;
	price: string;
	popular: boolean;
	description: string;
	features: TierFeature[];
	limits: { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number };
}

// ─── Tier definitions ───────────────────────────────────────────────────────

const ALL_TIERS: TierDefinition[] = [
	{
		id: "basic",
		name: "Basic",
		price: "$0",
		popular: false,
		description: "Browse everything, join communities, tip creators — free forever.",
		features: [
			{ name: "Verified badge", key: "verified_badge", included: true },
			{ name: "Post to 3 protocols", key: "post_3_protocols", included: true },
			{ name: "Browse all content", key: "browse_all", included: true },
			{ name: "Join communities", key: "join_communities", included: true },
			{ name: "Tip creators (free)", key: "free_tipping", included: true },
			{ name: "Basic profile", key: "basic_profile", included: true },
			{ name: "Creator coins", key: "creator_coins", included: false },
			{ name: "Live streaming", key: "live_streaming", included: false },
			{ name: "Cross-post scheduling", key: "scheduling", included: false },
			{ name: "Analytics", key: "analytics", included: false },
		],
		limits: TIER_LIMITS.basic,
	},
	{
		id: "pro",
		name: "Pro",
		price: "$10/mo",
		popular: true,
		description: "Full creator toolkit. Post everywhere, launch coins, livestream.",
		features: [
			{ name: "Everything in Basic", key: "everything_basic", included: true },
			{ name: "Post to ALL protocols (12+)", key: "post_all_protocols", included: true },
			{
				name: "Creator coins (1 free, $20 each additional)",
				key: "creator_coins",
				included: true,
			},
			{ name: "Live streaming (solo, spaces)", key: "live_streaming", included: true },
			{ name: "Basic analytics", key: "analytics_basic", included: true },
			{ name: "Scheduled posts", key: "scheduled_posts", included: true },
			{ name: "Feddy Communities (create 3)", key: "create_communities", included: true },
			{ name: "Token-gated content", key: "token_gated_content", included: true },
			{ name: "Custom profile", key: "custom_profile", included: true },
		],
		limits: TIER_LIMITS.pro,
	},
	{
		id: "platinum",
		name: "Platinum",
		price: "$25/mo",
		popular: false,
		description:
			"Power user. Unlimited coins, advanced analytics, cross-network scheduling.",
		features: [
			{ name: "Everything in Pro", key: "everything_pro", included: true },
			{ name: "UNLIMITED creator coins", key: "unlimited_creator_coins", included: true },
			{ name: "Multi-creator collab streams", key: "multi_creator_collab", included: true },
			{
				name: "Advanced analytics dashboard",
				key: "analytics_advanced",
				included: true,
			},
			{
				name: "Cross-network posting (X, YouTube, Reddit)",
				key: "cross_network_posting",
				included: true,
			},
			{
				name: "Buffer-style scheduling (queue, calendar)",
				key: "buffer_scheduling",
				included: true,
			},
			{
				name: "Telegram/Discord community integration",
				key: "telegram_discord_integration",
				included: true,
			},
			{
				name: "UNLIMITED Feddy Communities",
				key: "unlimited_communities",
				included: true,
			},
			{ name: "Custom community domain", key: "custom_domain", included: true },
			{ name: "Priority support", key: "priority_support", included: true },
			{ name: "API access", key: "api_access", included: true },
			{ name: "Early protocol access", key: "early_protocol_access", included: true },
		],
		limits: TIER_LIMITS.platinum,
	},
	{
		id: "enterprise",
		name: "Enterprise",
		price: "Custom",
		popular: false,
		description:
			"Self-host, white-label, dedicated infrastructure for organizations.",
		features: [
			{ name: "Everything in Platinum", key: "everything_platinum", included: true },
			{ name: "Self-host option", key: "self_host", included: true },
			{ name: "White-label", key: "white_label", included: true },
			{ name: "Custom protocol integrations", key: "custom_integrations", included: true },
			{ name: "Dedicated infrastructure", key: "dedicated_infra", included: true },
			{ name: "SLA guarantee", key: "sla_guarantee", included: true },
			{ name: "Team management", key: "team_management", included: true },
			{ name: "SSO / SAML", key: "sso_saml", included: true },
			{ name: "Custom contract & pricing", key: "custom_contract", included: true },
		],
		limits: TIER_LIMITS.enterprise,
	},
];

// ─── Hono router ────────────────────────────────────────────────────────────

const tiers = new Hono<{ Bindings: Env }>();

// GET /api/tiers — Get all tier definitions
tiers.get("/", async (c) => {
	return c.json({
		tiers: ALL_TIERS,
		tokenGenerationFee: {
			amount: TOKEN_GENERATION_FEE_USD,
			currency: "USD",
			description:
				"One-time fee per creator coin deployment. Covers gas + platform costs.",
		},
	});
});

// GET /api/tiers/me — Current user's tier + usage + limits
tiers.get("/me", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const walletAddress = session.address;
	const status = await checkPremiumStatus(walletAddress, c.env);
	const tier: PremiumTier = status?.tier || "basic";
	const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.basic;
	const usage = await getCurrentUsage(c.env, walletAddress);

	return noCacheJsonResponse({
		tier,
		tierName: TIER_NAMES[tier] || "Basic",
		isPremium: tier !== "basic",
		expiresAt: status?.expiresAt
			? new Date(status.expiresAt).toISOString()
			: null,
		limits,
		usage,
		canUpgrade: tier !== "enterprise",
		recommendedTier: getRecommendedTier(usage),
		features: Object.entries(FEATURE_TIER_REQUIREMENTS).map(
			([key, requiredTier]) => ({
				key,
				accessible: hasTierAccess(tier, requiredTier),
				requiredTier,
			}),
		),
	});
});

// POST /api/tiers/upgrade — Upgrade tier (redirects to billing checkout)
tiers.post("/upgrade", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	let body: { tier?: string };
	try {
		body = (await c.req.json()) as { tier?: string };
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	const targetTier = body.tier;
	const validTiers = ["pro", "platinum", "enterprise"];
	if (!targetTier || !validTiers.includes(targetTier)) {
		return jsonResponse(
			{ error: "Invalid tier. Use pro, platinum, or enterprise." },
			400,
		);
	}

	// Check if already on this tier or higher
	const current = await checkPremiumStatus(session.address, c.env);
	if (
		current &&
		hasTierAccess(current.tier, targetTier as PremiumTier)
	) {
		return jsonResponse(
			{
				error: `Already on ${TIER_NAMES[current.tier as PremiumTier] || current.tier} tier or higher`,
				currentTier: current.tier,
			},
			409,
		);
	}

	// Redirect to billing checkout
	const url = new URL(c.req.url);
	const origin = `${url.protocol}//${url.host}`;
	return jsonResponse({
		redirectUrl: `${origin}/api/billing/checkout?tier=${targetTier}`,
		tier: targetTier,
		message: `Redirecting to checkout for ${TIER_NAMES[targetTier as PremiumTier] || targetTier} plan.`,
	});
});

export default tiers;
