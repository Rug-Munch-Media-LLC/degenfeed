/**
 * /api/digest — Personalized Daily Digest API
 *
 * Gives users a newsletter-style summary of what they missed, powered by
 * the same feed pipeline, ranked by the v2 algorithm, and cached per-user.
 *
 * Endpoints:
 *   GET   /api/digest/today                 → Personalized digest JSON
 *   GET   /api/digest/today?wallet=0x...    → Digest for a specific wallet
 *   POST  /api/digest/subscribe-email       → { email, timezone } opt-in
 *   POST  /api/digest/unsubscribe-email     → { email }
 *   GET   /api/digest/yesterday             → Yesterday's digest archive
 */

import {
	computeTrendingTopics,
	deduplicatePosts,
	enrichPostNiches,
	isRelevantPost,
	isSpamPost,
} from "@degenfeed/feed-core";
import type { Protocol, UnifiedPost } from "@degenfeed/types";
import { getProtocolColor, rmiUrl } from "@degenfeed/utils";
import { type Env, jsonResponse, noCacheJsonResponse } from "../index";
import { DEFAULT_PROTOCOLS, getProvider } from "./feed";

// ─── Constants ────────────────────────────────────────────────────────

const DIGEST_CACHE_PREFIX = "digest:v2:";
const DIGEST_CACHE_TTL = 3600; // 1 hour — regenerated hourly
const DIGEST_ARCHIVE_TTL = 60 * 60 * 24 * 7; // 7 days

const MARKET_COINS = "bitcoin,ethereum,solana";
const MARKET_CACHE_KEY = "digest:market";
const MARKET_CACHE_TTL = 60;

// ─── Helpers ───────────────────────────────────────────────────────────

function isValidEmail(s: string): boolean {
	if (typeof s !== "string") return false;
	if (s.length > 254) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function safeKey(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
}

function _formatTime(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 60) return `${mins}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

function stripTags(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function protocolEmoji(p: Protocol): string {
	const map: Record<string, string> = {
		nostr: "⚡",
		farcaster: "🟣",
		lens: "🌿",
		bluesky: "🦋",
		mastodon: "🐘",
		threads: "🧵",
		rss: "📡",
	};
	return map[p] ?? "●";
}

function _excerpt(text: string, max = 160): string {
	return text.length > max
		? `${text.slice(0, max).replace(/\s+\S*$/, "")}…`
		: text;
}

function readTime(text: string): number {
	const wpm = 200;
	const words = text.split(/\s+/).length;
	return Math.max(1, Math.ceil(words / wpm));
}

// ─── Market prices ─────────────────────────────────────────────────────

interface MarketPrice {
	usd: number;
	usd_24h_change: number;
}

async function fetchMarketPrices(
	env: Env,
): Promise<Record<string, MarketPrice>> {
	if (env.CACHE) {
		const cached = await env.CACHE.get(MARKET_CACHE_KEY);
		if (cached) return JSON.parse(cached) as Record<string, MarketPrice>;
	}
	try {
		const res = await fetch(
			`https://api.coingecko.com/api/v3/simple/price?ids=${MARKET_COINS}&vs_currencies=usd&include_24hr_change=true`,
			{ headers: { accept: "application/json" } },
		);
		if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
		const data = (await res.json()) as Record<string, MarketPrice>;
		if (env.CACHE) {
			await env.CACHE.put(MARKET_CACHE_KEY, JSON.stringify(data), {
				expirationTtl: MARKET_CACHE_TTL,
			});
		}
		return data;
	} catch {
		return {};
	}
}

// ─── Digest content builders ───────────────────────────────────────────────

export interface DigestSection {
	type:
		| "top-stories"
		| "videos"
		| "communities"
		| "market"
		| "trending"
		| "for-you"
		| "catch-up";
	title: string;
	items: DigestItem[];
}

export interface DigestItem {
	id: string;
	protocol: string;
	protocolColor: string;
	protocolEmoji: string;
	author: { displayName: string; avatarUrl?: string };
	title: string;
	excerpt: string;
	url: string;
	image?: string;
	niches: string[];
	createdAt: number;
	metrics: { likes: number; reposts: number; replies: number };
	readTime: number;
	score: number;
}

export interface DigestResponse {
	date: string;
	wallet: string | null;
	sections: DigestSection[];
	meta: {
		totalPosts: number;
		totalSections: number;
		fetchedAt: number;
		cachedAt?: number;
	};
}

// ─── Core digest assembly ──────────────────────────────────────────────

async function gatherDigestPosts(
	env: Env,
	protocols: Protocol[],
	niches: string[],
	_limit = 100,
): Promise<UnifiedPost[]> {
	const all: UnifiedPost[] = [];
	const timeoutMs = 5000;

	// RMI DataBus
	try {
		const rmiUrlValue = rmiUrl(env);
		const rmiConfigured =
			rmiUrlValue &&
			!rmiUrlValue.includes("127.0.0.1") &&
			!rmiUrlValue.includes("localhost");
		if (rmiConfigured) {
			const { RmiDataBusProvider } = await import("@degenfeed/feed-providers");
			const rmi = new RmiDataBusProvider({ backendUrl: rmiUrlValue });
			const r = await rmi.fetchFeed({ timeoutMs });
			if (r.posts.length > 0) all.push(...r.posts);
		}
	} catch {
		/* RMI unavailable from edge */
	}

	// Protocol providers
	const providerResults = await Promise.allSettled(
		protocols
			.filter((p) => p !== "rss")
			.map(async (protocol) => {
				try {
					const provider = getProvider(protocol, env);
					const result = await provider.fetchFeed({
						timeoutMs,
						concurrency: 4,
					});
					return result.posts;
				} catch {
					return [] as UnifiedPost[];
				}
			}),
	);
	for (const r of providerResults) {
		if (r.status === "fulfilled") all.push(...r.value);
	}

	// RSS
	if (protocols.includes("rss")) {
		const { RssProvider } = await import("@degenfeed/feed-providers");
		const fastFeeds = [
			"https://cointelegraph.com/rss",
			"https://decrypt.co/feed",
			"https://bitcoinmagazine.com/.rss/full/",
			"https://blog.ethereum.org/feed.xml",
			"https://bankless.substack.com/feed",
			"https://weekinethereumnews.com/feed",
		];
		const results = await Promise.allSettled(
			fastFeeds.map(async (url) => {
				try {
					const rss = new RssProvider({ feeds: [url] });
					const r = await rss.fetchFeed({ timeoutMs: 3000 });
					return r.posts;
				} catch {
					return [] as UnifiedPost[];
				}
			}),
		);
		for (const r of results) {
			if (r.status === "fulfilled") all.push(...r.value);
		}
	}

	// Videos from YouTube/PeerTube
	try {
		const { fetchYouTubeVideos } = await import("../feed/unified-fetchers");
		const { posts: ytPosts } = await fetchYouTubeVideos(10);
		all.push(
			...ytPosts.map((p) => ({ ...p, protocol: "youtube" as Protocol })),
		);
	} catch {
		/* YouTube unavailable */
	}

	try {
		const { fetchPeerTubeVideos } = await import("../feed/unified-fetchers");
		const ptPosts = await fetchPeerTubeVideos(10);
		all.push(
			...ptPosts.map((p) => ({ ...p, protocol: "peertube" as Protocol })),
		);
	} catch {
		/* PeerTube unavailable */
	}

	let filtered = all.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
	if (niches.length > 0) {
		filtered = filtered.filter((p) => p.niches.some((n) => niches.includes(n)));
	}
	const deduped = deduplicatePosts(filtered);
	return deduped.filter(isRelevantPost);
}

function buildDigestSections(
	posts: UnifiedPost[],
	_niches: string[],
	followed: Set<string>,
	_engagedCreators: Set<string>,
	preferredNiches: Set<string>,
	marketPrices: Record<string, MarketPrice>,
): DigestSection[] {
	const sections: DigestSection[] = [];
	const now = Date.now();

	// Score every post for ranking
	const scored = posts.map((p) => {
		const ageHours = (now - p.createdAt) / 3600000;
		const recency = Math.max(0, 1 - ageHours / 48);
		const likes = p.metrics.likes ?? 0;
		const reposts = p.metrics.reposts ?? 0;
		const replies = p.metrics.replies ?? 0;
		const engagementScore = likes * 1 + reposts * 2 + replies * 3;
		const nicheBoost = p.niches.some((n) =>
			preferredNiches.has(n.toLowerCase()),
		)
			? 3
			: 0;
		const total =
			Math.round((recency * 3 + engagementScore + nicheBoost) * 10) / 10;
		return { post: p, score: total };
	});

	scored.sort((a, b) => b.score - a.score);

	// ── 1. Top Stories (top 5 across all protocols, your interests) ──
	const topStories = scored.slice(0, 15).filter((s) => {
		const nicheMatch = s.post.niches.some((n) =>
			preferredNiches.has(n.toLowerCase()),
		);
		const followedMatch = s.post.author && followed.has(s.post.author.id);
		return nicheMatch || followedMatch || s.score > 5;
	});
	const topItems: DigestItem[] = topStories.slice(0, 5).map(toDigestItem);
	if (topItems.length > 0) {
		sections.push({
			type: "top-stories",
			title: "📰 Top Stories",
			items: topItems,
		});
	}

	// ── 2. Videos (top 3 from YouTube/PeerTube) ──
	const videos = scored
		.filter(
			(s) => s.post.protocol === "youtube" || s.post.protocol === "peertube",
		)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3);
	const videoItems = videos.map(toDigestItem);
	if (videoItems.length > 0) {
		sections.push({
			type: "videos",
			title: "🎬 Top Videos",
			items: videoItems,
		});
	}

	// ── 3. Trending Topics ──
	const trending = computeTrendingTopics(posts, Date.now(), 12, 24 * 3600000);
	const trendingItems: DigestItem[] = trending.slice(0, 5).map((t) => ({
		id: `trending:${t.topic}`,
		protocol: "trending",
		protocolColor: "#10b981",
		protocolEmoji: "🔥",
		author: { displayName: "Trending Topic" },
		title: `#${t.topic}`,
		excerpt: `${t.count} posts in the last 24h`,
		url: `/search?q=${encodeURIComponent(t.topic)}`,
		niches: [t.topic],
		createdAt: now,
		metrics: { likes: 0, reposts: 0, replies: 0 },
		readTime: 1,
		score: t.score,
	}));
	if (trendingItems.length > 0) {
		sections.push({
			type: "trending",
			title: "🔥 Trending Topics",
			items: trendingItems,
		});
	}

	// ── 4. Market Summary ──
	const marketItems: DigestItem[] = Object.entries(marketPrices).map(
		([coin, price]) => {
			const symbol =
				{ bitcoin: "BTC", ethereum: "ETH", solana: "SOL" }[coin] ??
				coin.toUpperCase();
			const change = price.usd_24h_change ?? 0;
			const changeStr = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
			return {
				id: `market:${coin}`,
				protocol: "market",
				protocolColor: change >= 0 ? "#22c55e" : "#ef4444",
				protocolEmoji: change >= 0 ? "📈" : "📉",
				author: { displayName: symbol },
				title: `$${price.usd.toLocaleString()}`,
				excerpt: `24h change: ${changeStr}`,
				url: `/search?q=${coin}`,
				niches: [coin],
				createdAt: now,
				metrics: { likes: 0, reposts: 0, replies: 0 },
				readTime: 1,
				score: price.usd,
			};
		},
	);
	if (marketItems.length > 0) {
		sections.push({
			type: "market",
			title: "💹 Market Summary",
			items: marketItems,
		});
	}

	// ── 5. For You (3 posts the algo predicts you'll like) ──
	const forYou = scored
		.filter((s) => {
			const nicheMatch = s.post.niches.some((n) =>
				preferredNiches.has(n.toLowerCase()),
			);
			const followedMatch = s.post.author && followed.has(s.post.author.id);
			return nicheMatch && !followedMatch && s.score > 3;
		})
		.slice(0, 3);
	const forYouItems = forYou.map(toDigestItem);
	if (forYouItems.length > 0) {
		sections.push({ type: "for-you", title: "🎯 For You", items: forYouItems });
	}

	// ── 6. Catch Up (posts from creators you follow, that you missed) ──
	const catchUp = scored
		.filter((s) => {
			if (!s.post.author) return false;
			return followed.has(s.post.author.id);
		})
		.slice(0, 7);
	const catchUpItems = catchUp.map(toDigestItem);
	if (catchUpItems.length > 0) {
		sections.push({
			type: "catch-up",
			title: "👋 Catch Up",
			items: catchUpItems,
		});
	}

	return sections;
}

function toDigestItem(s: { post: UnifiedPost; score: number }): DigestItem {
	const p = s.post;
	const link =
		p.embeds?.find((e) => e.kind === "link")?.url ||
		`https://degenfeed.xyz/post/${encodeURIComponent(p.id)}`;
	const title =
		p.text.slice(0, 140).replace(/\s+/g, " ").trim() ||
		`Post by ${p.author?.displayName ?? "unknown"}`;
	const desc = stripTags(p.html || p.text).slice(0, 200);
	const img = p.embeds?.find((e) => e.kind === "image")?.url;
	return {
		id: p.id,
		protocol: p.protocol,
		protocolColor: getProtocolColor(p.protocol),
		protocolEmoji: protocolEmoji(p.protocol as Protocol),
		author: {
			displayName: p.author?.displayName ?? "unknown",
			avatarUrl: p.author?.avatarUrl,
		},
		title,
		excerpt: desc,
		url: link,
		image: img,
		niches: p.niches ?? [],
		createdAt: p.createdAt,
		metrics: {
			likes: p.metrics?.likes ?? 0,
			reposts: p.metrics?.reposts ?? 0,
			replies: p.metrics?.replies ?? 0,
		},
		readTime: readTime(p.text),
		score: s.score,
	};
}

// ─── KV caching ─────────────────────────────────────────────────────---

export async function getCachedDigest(
	env: Env,
	date: string,
	wallet: string,
): Promise<DigestResponse | null> {
	if (!env.CACHE || !wallet) return null;
	try {
		const raw = await env.CACHE.get(
			`${DIGEST_CACHE_PREFIX}${date}:${wallet.toLowerCase()}`,
		);
		if (!raw) return null;
		return JSON.parse(raw) as DigestResponse;
	} catch {
		return null;
	}
}

export async function setCachedDigest(
	env: Env,
	date: string,
	wallet: string,
	digest: DigestResponse,
): Promise<void> {
	if (!env.CACHE || !wallet) return;
	try {
		const key = `${DIGEST_CACHE_PREFIX}${date}:${wallet.toLowerCase()}`;
		await env.CACHE.put(key, JSON.stringify(digest), {
			expirationTtl: DIGEST_CACHE_TTL,
		});
		// Also store archive copy
		const archiveKey = `${DIGEST_CACHE_PREFIX}archive:${date}:${wallet.toLowerCase()}`;
		await env.CACHE.put(archiveKey, JSON.stringify(digest), {
			expirationTtl: DIGEST_ARCHIVE_TTL,
		});
	} catch {
		/* non-critical */
	}
}

// ─── Route handlers ─────────────────────────────────────────────────────

/**
 * GET /api/digest/today
 * Returns a personalized digest for the authenticated user (or anonymous).
 */
export async function handleDigestToday(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const wallet = url.searchParams.get("wallet");
	const cookies = request.headers.get("cookie") ?? "";

	// Resolve wallet from session if not in query
	let resolvedWallet = wallet;
	if (!resolvedWallet) {
		const cookieMatch = cookies
			.split(";")
			.map((s) => s.trim())
			.find((s) => s.startsWith("__Host-dfid="));
		if (cookieMatch) {
			try {
				const { verifySessionCookie } = await import("../session");
				const payload = await verifySessionCookie(
					cookieMatch.slice("__Host-dfid=".length),
					env.AUTH_SECRET ?? "",
				);
				resolvedWallet = payload?.address ?? null;
			} catch {
				/* session verify failed */
			}
		}
	}

	const today = new Date().toISOString().slice(0, 10);

	// Check KV cache first
	if (resolvedWallet) {
		const cached = await getCachedDigest(env, today, resolvedWallet);
		if (cached) {
			return noCacheJsonResponse({
				...cached,
				meta: { ...cached.meta, cachedAt: cached.meta.fetchedAt },
			});
		}
	}

	// Build the digest
	const nichesParam = url.searchParams.get("niches") ?? "";
	const protocolsParam = url.searchParams.get("protocols") ?? "";
	const niches = nichesParam
		? nichesParam
				.split(",")
				.map((n) => n.trim().toLowerCase())
				.filter(Boolean)
		: [];
	const protocols: Protocol[] = protocolsParam
		? protocolsParam
				.split(",")
				.map((p) => p.trim())
				.filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
		: DEFAULT_PROTOCOLS;

	// Load user context if authenticated
	let followed = new Set<string>();
	let engagedCreators = new Set<string>();
	const preferredNiches = new Set(niches);
	const userCtxKey = `user:follows:${resolvedWallet?.toLowerCase() ?? ""}`;
	if (resolvedWallet && env.CACHE) {
		try {
			const [followsRaw, prefsRaw, creatorsRaw] = await Promise.all([
				env.CACHE.get(userCtxKey),
				env.CACHE.get(`user:prefs:${resolvedWallet.toLowerCase()}`),
				env.CACHE.get(`user:engaged_creators:${resolvedWallet.toLowerCase()}`),
			]);
			if (followsRaw) followed = new Set(JSON.parse(followsRaw) as string[]);
			if (creatorsRaw)
				engagedCreators = new Set(JSON.parse(creatorsRaw) as string[]);
			if (prefsRaw) {
				const prefs = JSON.parse(prefsRaw) as { preferredNiches?: string[] };
				if (prefs.preferredNiches?.length) {
					for (const n of prefs.preferredNiches)
						preferredNiches.add(n.toLowerCase());
				}
			}
		} catch {
			/* non-critical */
		}
	}

	// Fetch posts
	const posts = await gatherDigestPosts(
		env,
		protocols,
		Array.from(preferredNiches),
		150,
	);
	const marketPrices = await fetchMarketPrices(env);

	// Build sections
	const sections = buildDigestSections(
		posts,
		niches,
		followed,
		engagedCreators,
		preferredNiches,
		marketPrices,
	);

	const digest: DigestResponse = {
		date: today,
		wallet: resolvedWallet,
		sections,
		meta: {
			totalPosts: posts.length,
			totalSections: sections.length,
			fetchedAt: Date.now(),
		},
	};

	// Cache in KV (fire-and-forget)
	if (resolvedWallet) {
		void setCachedDigest(env, today, resolvedWallet, digest);
	}

	return noCacheJsonResponse(digest);
}

/**
 * GET /api/digest/yesterday
 * Returns yesterday's cached digest if available.
 */
export async function handleDigestYesterday(
	request: Request,
	env: Env,
): Promise<Response> {
	const wallet = new URL(request.url).searchParams.get("wallet");
	if (!wallet || !env.CACHE) {
		return jsonResponse({ error: "Wallet required" }, 400);
	}
	const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
	const cached = await getCachedDigest(env, yesterday, wallet);
	if (!cached) {
		return jsonResponse(
			{ error: "No digest available for yesterday", date: yesterday },
			404,
		);
	}
	return noCacheJsonResponse(cached);
}

/**
 * POST /api/digest/subscribe-email
 * { email, timezone?: string, niches?: string[], protocols?: string[] }
 * Opts the user into daily email digest delivery (sent at 8am their timezone).
 */
export async function handleDigestSubscribeEmail(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}
	let body: {
		email?: string;
		timezone?: string;
		niches?: string[];
		protocols?: string[];
	} = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	const email = (body.email ?? "").trim().toLowerCase();
	if (!isValidEmail(email)) {
		return jsonResponse({ error: "Invalid email" }, 400);
	}

	const record = {
		email,
		timezone: body.timezone ?? "UTC",
		niches: Array.isArray(body.niches)
			? body.niches.map((n) => n.toLowerCase())
			: [],
		protocols: Array.isArray(body.protocols)
			? body.protocols.filter((p): p is Protocol =>
					DEFAULT_PROTOCOLS.includes(p as Protocol),
				)
			: DEFAULT_PROTOCOLS,
		subscribedAt: Date.now(),
	};

	const key = `digest:sub:${safeKey(email)}`;
	const listKey = "digest:subscribers";

	try {
		await env.CACHE?.put(key, JSON.stringify(record), {
			expirationTtl: 60 * 60 * 24 * 400,
		});
		const idx = (await env.CACHE?.get(listKey)) ?? "";
		const set = new Set(idx.split("\n").filter(Boolean));
		set.add(safeKey(email));
		await env.CACHE?.put(listKey, [...set].join("\n"), {
			expirationTtl: 60 * 60 * 24 * 400,
		});
	} catch {
		/* non-critical */
	}

	return jsonResponse({
		ok: true,
		email,
		action: "subscribed",
		timezone: record.timezone,
	});
}

/**
 * POST /api/digest/unsubscribe-email
 * { email } — removes the email from the digest subscriber list.
 */
export async function handleDigestUnsubscribeEmail(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}
	let body: { email?: string } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	const email = (body.email ?? "").trim().toLowerCase();
	if (!isValidEmail(email)) {
		return jsonResponse({ error: "Invalid email" }, 400);
	}

	try {
		await env.CACHE?.delete(`digest:sub:${safeKey(email)}`);
		const idx = (await env.CACHE?.get("digest:subscribers")) ?? "";
		const set = new Set(idx.split("\n").filter(Boolean));
		set.delete(safeKey(email));
		await env.CACHE?.put("digest:subscribers", [...set].join("\n"), {
			expirationTtl: 60 * 60 * 24 * 400,
		});
	} catch {
		/* KV operation failed -- non-critical, continue */
	}

	return jsonResponse({ ok: true, email, action: "unsubscribed" });
}

/**
 * GET /api/digest/status?email=x
 * Returns subscriber status (requires admin API key).
 */
export async function handleDigestStatus(
	_request: Request,
	env: Env,
): Promise<Response> {
	try {
		const idx = (await env.CACHE?.get("digest:subscribers")) ?? "";
		const emails = idx.split("\n").filter(Boolean);
		return jsonResponse({ count: emails.length });
	} catch {
		return jsonResponse({ count: 0, warning: "KV unavailable" });
	}
}
