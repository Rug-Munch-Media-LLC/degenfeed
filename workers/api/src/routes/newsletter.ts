/**
 * /api/newsletter — DegenFeed Daily Intelligence Briefing
 *
 * A multi-protocol daily digest that aggregates the best content from
 * Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS, and the RMI DataBus
 * into a single email-ready briefing. This is DegenFeed's flagship
 * intelligence product — not an RMI shill.
 *
 * Endpoints:
 *   POST   /api/newsletter/subscribe  { email, niches[], protocols[] }
 *   DELETE /api/newsletter/subscribe  { email }
 *   GET    /api/newsletter/digest     → JSON / HTML / plaintext daily digest
 *   GET    /api/newsletter/status     → subscriber count
 *
 * The digest is built from the same feed pipeline as the home page,
 * ranked by the v2 algorithm, and formatted for email consumption.
 */

import {
	computeTrendingTopics,
	deduplicatePosts,
	enrichPostNiches,
	isRelevantPost,
	isSpamPost,
	rankDiverse,
} from "@degenfeed/feed-core";
import {
	getNewsletterFeeds,
	RmiDataBusProvider,
	RssProvider,
} from "@degenfeed/feed-providers";
import type { Protocol, UnifiedPost } from "@degenfeed/types";
import { getProtocolColor, rmiUrl } from "@degenfeed/utils";
import { authenticateApiKey } from "../admin";
import { type Env, jsonResponse, noCacheJsonResponse } from "../index";
import { DEFAULT_PROTOCOLS, getProvider } from "./feed";

const ALLOWED_NICHES = new Set([
	"bitcoin",
	"ethereum",
	"solana",
	"defi",
	"nft",
	"ai",
	"regulation",
	"security",
	"macro",
	"memecoin",
	"layer2",
	"stablecoin",
	"etf",
	"onchain",
	"crypto",
]);

function isValidEmail(s: string): boolean {
	if (typeof s !== "string") return false;
	if (s.length > 254) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function safeKey(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
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

function formatTime(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 60) return `${mins}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

export async function gatherDigestPosts(
	env: Env,
	protocols: Protocol[],
	niches: string[],
): Promise<UnifiedPost[]> {
	const all: UnifiedPost[] = [];
	const timeoutMs = 5000;

	// RMI DataBus (institutional-grade news, 353+ sources) — only reachable from internal network.
	try {
		const rmiUrlValue = rmiUrl(env);
		const rmiConfigured =
			rmiUrlValue &&
			!rmiUrlValue.includes("127.0.0.1") &&
			!rmiUrlValue.includes("localhost");
		if (rmiConfigured) {
			const rmi = new RmiDataBusProvider({ backendUrl: rmiUrlValue });
			const r = await rmi.fetchFeed({ timeoutMs });
			if (r.posts.length > 0) all.push(...r.posts);
		}
	} catch {
		/* RMI unavailable from edge */
	}

	// Fetch from each selected protocol so the digest is truly multi-protocol.
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

	// Public RSS feeds (fast, reliable) — used when RSS is selected or as a fallback.
	if (protocols.includes("rss")) {
		const fastFeeds = [
			"https://cointelegraph.com/rss",
			"https://decrypt.co/feed",
			"https://bitcoinmagazine.com/.rss/full/",
			"https://blog.ethereum.org/feed.xml",
			"https://blog.chain.link/feed/",
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

	// Newsletter-specific RSS feeds — top crypto + defi newsletters.
	// These are fetched as a batch using the curated newsletter list.
	{
		const newsletterGroup = getNewsletterFeeds();
		const newsletterUrls = [
			...newsletterGroup.topCrypto.slice(0, 6),
			...newsletterGroup.defiProtocol.slice(0, 4),
			...newsletterGroup.aiCrypto.slice(0, 3),
		].map((f) => f.url);
		const nlResults = await Promise.allSettled(
			newsletterUrls.map(async (url) => {
				try {
					const rss = new RssProvider({ feeds: [url] });
					const r = await rss.fetchFeed({ timeoutMs: 3000 });
					return r.posts;
				} catch {
					return [] as UnifiedPost[];
				}
			}),
		);
		for (const r of nlResults) {
			if (r.status === "fulfilled") all.push(...r.value);
		}
	}

	let filtered = all.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
	if (niches.length > 0) {
		filtered = filtered.filter((p) => p.niches.some((n) => niches.includes(n)));
	}
	const deduped = deduplicatePosts(filtered);
	const relevant = deduped.filter(isRelevantPost);
	const ctx = {
		viewer: null,
		recentAuthors: new Map<string, number>(),
		sourceQuality: new Map<string, number>(),
		viewerNiches: new Set(niches),
		followed: new Set<string>(),
		now: Date.now(),
		preferences: {
			preferredNiches: niches,
			preferredPlatforms: protocols,
			recencyWeight: 1,
			engagementWeight: 1,
			diversityBoost: true,
		},
	};
	return rankDiverse(relevant, ctx, { maxPerAuthor: 2 });
}

export function buildDigestHtml(
	posts: UnifiedPost[],
	trending: { topic: string; count: number; score: number }[],
	niches: string[],
	protocols: Protocol[],
	fetchedAt: number,
): string {
	const list = posts
		.slice(0, 15)
		.map((p) => {
			const link =
				p.embeds.find((e) => e.kind === "link")?.url ||
				`https://degenfeed.xyz/post/${encodeURIComponent(p.id)}`;
			const title =
				p.text.slice(0, 140).replace(/\s+/g, " ").trim() ||
				`Post by ${p.author.displayName}`;
			const desc = stripTags(p.html || p.text).slice(0, 200);
			const img = p.embeds.find((e) => e.kind === "image")?.url;
			const color = getProtocolColor(p.protocol);
			const emoji = protocolEmoji(p.protocol);
			const nichesHtml = p.niches
				.slice(0, 3)
				.map(
					(n) =>
						`<span style="background:#1f2937;color:#9ca3af;padding:1px 6px;border-radius:4px;font-size:10px;margin-right:4px">#${escapeHtml(n)}</span>`,
				)
				.join("");
			const imgHtml = img
				? `<img src="${escapeHtml(img)}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin:6px 0"/>`
				: "";
			return `<div style="margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #1f2937">
  <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">
    <span style="color:${color}">${emoji} ${escapeHtml(p.protocol)}</span>
    · ${escapeHtml(p.author.displayName)} · ${formatTime(p.createdAt)} ago
  </div>
  <h3 style="margin:0 0 4px 0;font-size:16px;line-height:1.3">
    <a href="${escapeHtml(link)}" style="color:#fff;text-decoration:none">${escapeHtml(title)}</a>
  </h3>
  ${imgHtml}
  <p style="font-size:13px;color:#9ca3af;line-height:1.5;margin:4px 0">${escapeHtml(desc)}</p>
  <div style="font-size:11px;margin-top:4px">${nichesHtml}</div>
</div>`;
		})
		.join("\n");

	const trendingHtml = trending
		.slice(0, 8)
		.map(
			(t) =>
				`<span style="display:inline-block;background:#1f2937;color:#10b981;padding:2px 8px;border-radius:12px;font-size:11px;margin:2px">${escapeHtml(t.topic)} <span style="color:#6b7280">${t.count}</span></span>`,
		)
		.join(" ");

	const nicheLabel = niches.length > 0 ? niches.join(", ") : "all topics";
	const protocolLabel =
		protocols.length > 0 ? protocols.join(", ") : "all protocols";

	return `<!doctype html>
<html><head><meta charset="utf-8"/><title>DegenFeed Daily — ${new Date(fetchedAt).toDateString()}</title></head>
<body style="background:#0a0a0a;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#111827;padding:24px;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="margin:0;font-size:24px;color:#10b981">◆ DegenFeed Daily</h1>
    <p style="color:#9ca3af;margin:6px 0 0 0;font-size:12px">
      ${new Date(fetchedAt).toUTCString()} · ${nicheLabel} · ${protocolLabel}
    </p>
  </div>
  <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin-bottom:20px">
    The best of web3, AI, and tech — aggregated from Nostr, Farcaster, Lens, Bluesky, Mastodon, and 353 RSS sources. Ranked by quality, recency, and diversity.
  </p>
  ${trendingHtml.length > 0 ? `<div style="margin-bottom:20px;text-align:center">${trendingHtml}</div>` : ""}
  ${list}
  <hr style="border:0;border-top:1px solid #1f2937;margin:24px 0"/>
  <p style="font-size:11px;color:#6b7280;text-align:center">
    You're receiving this because you subscribed at <a href="https://degenfeed.xyz/newsletter" style="color:#10b981">degenfeed.xyz/newsletter</a>.<br/>
    <a href="https://degenfeed.xyz/newsletter?unsubscribe=1" style="color:#6b7280">Unsubscribe</a> ·
    <a href="https://degenfeed.xyz/api/feed/rss.xml" style="color:#6b7280">RSS</a> ·
    <a href="https://degenfeed.xyz" style="color:#6b7280">Open app</a>
  </p>
</div>
</body></html>`;
}

function buildDigestText(
	posts: UnifiedPost[],
	trending: { topic: string; count: number; score: number }[],
	niches: string[],
	protocols: Protocol[],
	fetchedAt: number,
): string {
	const list = posts
		.slice(0, 15)
		.map((p, i) => {
			const link =
				p.embeds.find((e) => e.kind === "link")?.url ||
				`https://degenfeed.xyz/post/${encodeURIComponent(p.id)}`;
			const title =
				p.text.slice(0, 140).replace(/\s+/g, " ").trim() ||
				`Post by ${p.author.displayName}`;
			return `${i + 1}. [${p.protocol.toUpperCase()}] ${title}\n   ${link}\n   ${p.author.displayName} · ${formatTime(p.createdAt)} ago\n`;
		})
		.join("\n");
	const trendingText = trending
		.slice(0, 8)
		.map((t) => `#${t.topic} (${t.count})`)
		.join(", ");
	return `DEGENFEED DAILY — ${new Date(fetchedAt).toUTCString()}
Topics: ${niches.length > 0 ? niches.join(", ") : "all"} · Protocols: ${protocols.length > 0 ? protocols.join(", ") : "all"}

${trendingText.length > 0 ? `Trending: ${trendingText}\n\n` : ""}
${list}
---
Unsubscribe: https://degenfeed.xyz/newsletter?unsubscribe=1
RSS: https://degenfeed.xyz/api/feed/rss.xml
`;
}

export async function handleNewsletterSubscribe(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST" && request.method !== "DELETE") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}
	let body: { email?: string; niches?: string[]; protocols?: string[] } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	const email = (body.email ?? "").trim().toLowerCase();
	if (!isValidEmail(email)) {
		return jsonResponse({ error: "Invalid email" }, 400);
	}
	const niches = Array.isArray(body.niches)
		? body.niches
				.map((n) => String(n).toLowerCase())
				.filter((n) => ALLOWED_NICHES.has(n))
		: [];
	const protocols = Array.isArray(body.protocols)
		? body.protocols
				.map((p) => String(p))
				.filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
		: DEFAULT_PROTOCOLS;

	const key = `newsletter:sub:${safeKey(email)}`;
	const listKey = "newsletter:subscribers";

	if (request.method === "DELETE") {
		try {
			await env.CACHE?.delete(key);
			const idx = (await env.CACHE?.get(listKey)) ?? "";
			const set = new Set(idx.split("\n").filter(Boolean));
			set.delete(safeKey(email));
			await env.CACHE?.put(listKey, [...set].join("\n"), {
				expirationTtl: 60 * 60 * 24 * 400,
			});
		} catch { /* KV operation failed -- non-critical, continue */ }
		return jsonResponse({ ok: true, email, action: "unsubscribed" });
	}

	const record = { email, niches, protocols, subscribedAt: Date.now() };
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
	} catch { /* KV operation failed -- non-critical, continue */ }
	return jsonResponse({
		ok: true,
		email,
		niches,
		protocols,
		action: "subscribed",
	});
}

export async function handleNewsletterDigest(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const fmt = url.searchParams.get("format") ?? "json";
	const nichesParam = url.searchParams.get("niches") ?? "";
	const protocolsParam = url.searchParams.get("protocols") ?? "";
	const niches = nichesParam
		.split(",")
		.map((n) => n.trim().toLowerCase())
		.filter((n) => ALLOWED_NICHES.has(n));
	const protocols = protocolsParam
		? protocolsParam
				.split(",")
				.map((p) => p.trim())
				.filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
		: DEFAULT_PROTOCOLS;

	// Cache bucketed to 5 minutes so preview loads stay fast but never stale.
	const fiveMinBucket = Math.floor(Date.now() / (1000 * 60 * 5));
	const cacheKey = `newsletter:digest:v3:${niches.join(",") || "all"}:${protocols.join(",")}:${fiveMinBucket}`;
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached && fmt === "json")
			return noCacheJsonResponse(JSON.parse(cached));
	} catch { /* KV operation failed -- non-critical, continue */ }

	const posts = await gatherDigestPosts(env, protocols, niches);
	const trending = computeTrendingTopics(posts, Date.now());
	const fetchedAt = Date.now();

	if (fmt === "html") {
		const html = buildDigestHtml(posts, trending, niches, protocols, fetchedAt);
		return new Response(html, {
			status: 200,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store, must-revalidate",
			},
		});
	}
	if (fmt === "text") {
		const text = buildDigestText(posts, trending, niches, protocols, fetchedAt);
		return new Response(text, {
			status: 200,
			headers: {
				"content-type": "text/plain; charset=utf-8",
				"cache-control": "no-store, must-revalidate",
			},
		});
	}

	const response = {
		data: posts.slice(0, 15).map((p) => ({
			id: p.id,
			protocol: p.protocol,
			author: p.author.displayName,
			text: p.text.slice(0, 200),
			url: p.embeds.find((e) => e.kind === "link")?.url || null,
			image: p.embeds.find((e) => e.kind === "image")?.url || null,
			niches: p.niches,
			createdAt: p.createdAt,
			metrics: p.metrics,
		})),
		meta: {
			total: posts.length,
			fetchedAt,
			niches,
			protocols,
			trending,
			source: "degenfeed-multi-protocol",
		},
	};
	try {
		await env.CACHE?.put(cacheKey, JSON.stringify(response), {
			expirationTtl: 300,
		});
	} catch { /* KV operation failed -- non-critical, continue */ }
	return noCacheJsonResponse(response);
}

export async function handleNewsletterStatus(
	request: Request,
	env: Env,
): Promise<Response> {
	const auth = request.headers.get("authorization") ?? "";
	const { ok } = authenticateApiKey(
		auth,
		env.NEWSLETTER_API_KEY,
		env.ADMIN_API_KEY,
	);
	if (!ok) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}
	try {
		const idx = (await env.CACHE?.get("newsletter:subscribers")) ?? "";
		const emails = idx.split("\n").filter(Boolean);
		return jsonResponse({ count: emails.length });
	} catch {
		return jsonResponse({ count: 0, warning: "KV unavailable" });
	}
}
