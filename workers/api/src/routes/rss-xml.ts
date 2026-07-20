/**
 * /api/feed/rss.xml — Publishes a proper RSS 2.0 + Atom 1.0 feed of the
 * aggregated, ranked, de-spammed DegenFeed home feed.
 *
 * Anyone can subscribe to this with a podcast reader, Feedly, NetNewsWire,
 * Inoreader, etc. and get the top web3 stories without visiting the site.
 *
 * Query params:
 *   category — optional niche filter
 *   limit    — max items (default 50, cap 200)
 *   q        — free-text query filter
 */

import {
	deduplicatePosts,
	enrichPostNiches,
	isRelevantPost,
	isSpamPost,
} from "@degenfeed/feed-core";
import { RmiDataBusProvider, RssProvider } from "@degenfeed/feed-providers";
import type { Protocol, UnifiedPost } from "@degenfeed/types";
import { parseProtocols, rmiUrl } from "@degenfeed/utils";
import type { Env } from "../index";

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
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

function rfc2822(ts: number): string {
	return new Date(ts).toUTCString();
}

function postToRssItem(post: UnifiedPost, sourceName: string): string {
	const link =
		post.embeds.find((e) => e.kind === "link")?.url ||
		`https://degenfeed.xyz/post/${encodeURIComponent(post.id)}`;
	const title =
		post.text.slice(0, 140).replace(/\s+/g, " ").trim() ||
		`Post by ${post.author.displayName}`;
	const description = post.html || post.text;
	const image = post.embeds.find((e) => e.kind === "image")?.url;
	const categories = post.niches
		.slice(0, 5)
		.map((n) => `<category>${escapeXml(n)}</category>`)
		.join("");
	const descriptionXml = image
		? `<![CDATA[${description}<br/><img src="${escapeXml(image)}"/><br/><small>via ${escapeXml(sourceName)} on ${escapeXml(post.protocol)}</small>]]>`
		: `<![CDATA[${description}<br/><small>via ${escapeXml(sourceName)} on ${escapeXml(post.protocol)}</small>]]>`;
	return `<item>
  <title>${escapeXml(title)}</title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="false">${escapeXml(post.id)}</guid>
  <pubDate>${rfc2822(post.createdAt)}</pubDate>
  <author>${escapeXml(post.author.displayName)}</author>
  <source url="https://degenfeed.xyz">${escapeXml(sourceName)}</source>
  ${categories}
  <description>${descriptionXml}</description>
</item>`;
}

function postToAtomEntry(post: UnifiedPost, updated: string): string {
	const link =
		post.embeds.find((e) => e.kind === "link")?.url ||
		`https://degenfeed.xyz/post/${encodeURIComponent(post.id)}`;
	const title =
		post.text.slice(0, 140).replace(/\s+/g, " ").trim() ||
		`Post by ${post.author.displayName}`;
	const summary = stripTags(post.html || post.text).slice(0, 500);
	return `<entry>
  <title>${escapeXml(title)}</title>
  <id>tag:degenfeed.xyz,2026:${escapeXml(post.id)}</id>
  <link href="${escapeXml(link)}"/>
  <updated>${updated}</updated>
  <published>${rfc2822(post.createdAt)}</published>
  <author><name>${escapeXml(post.author.displayName)}</name></author>
  <summary>${escapeXml(summary)}</summary>
</entry>`;
}

async function gather(
	env: Env,
	_requested: Protocol[],
): Promise<UnifiedPost[]> {
	const all: UnifiedPost[] = [];
	const timeoutMs = 5000;

	// Try RMI DataBus first (only works from Talos internal network).
	try {
		const rmi = new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
		const rmiPosts = await rmi.fetchFeed({ timeoutMs });
		if (rmiPosts.posts.length > 0) {
			all.push(
				...rmiPosts.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches),
			);
		}
	} catch {
		/* RMI unavailable from edge */
	}

	// Fall back to a small curated set of fast RSS feeds fetched in parallel.
	if (all.length < 5) {
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
			if (r.status === "fulfilled") {
				all.push(
					...r.value.filter((p) => !isSpamPost(p)).map(enrichPostNiches),
				);
			}
		}
	}

	return all;
}

export async function handleRssXml(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const category = url.searchParams.get("category")?.toLowerCase() ?? "";
	const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
	const query = url.searchParams.get("q")?.toLowerCase() ?? "";
	const protocols = parseProtocols(url.searchParams.get("protocols"));

	const cacheKey = `rssxml:v1:${protocols.join(",")}:${category || "all"}:${query || "none"}:${limit}`;
	try {
		const cached = await env.CACHE?.get(cacheKey);
		if (cached) {
			return new Response(cached, {
				status: 200,
				headers: {
					"content-type": "application/rss+xml; charset=utf-8",
					"cache-control": "public, max-age=120",
				},
			});
		}
	} catch { /* KV operation failed -- non-critical, continue */ }

	const raw = await gather(env, protocols);
	let deduped = deduplicatePosts(raw);
	if (category) {
		deduped = deduped.filter((p) =>
			p.niches.map((n) => n.toLowerCase()).includes(category),
		);
	}
	const relevant = deduped.filter(isRelevantPost);
	const filtered = query
		? relevant.filter((p) =>
				`${p.text} ${p.author.displayName} ${p.niches.join(" ")}`
					.toLowerCase()
					.includes(query),
			)
		: relevant;
	filtered.sort((a, b) => b.createdAt - a.createdAt);
	const items = filtered.slice(0, limit);
	const updated = new Date().toUTCString();

	const rssItems = items
		.map((p) => postToRssItem(p, p.author.displayName))
		.join("\n");
	const atomEntries = items.map((p) => postToAtomEntry(p, updated)).join("\n");

	const title = category
		? `DegenFeed — ${category.charAt(0).toUpperCase() + category.slice(1)}`
		: "DegenFeed — Web3 Social Aggregator";
	const description = category
		? `Top ${category} stories across Nostr, Farcaster, Lens, Bluesky, Mastodon, and the RMI DataBus.`
		: "Top web3 stories across Nostr, Farcaster, Lens, Bluesky, Mastodon, and the RMI DataBus.";

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${escapeXml(title)}</title>
  <link>https://degenfeed.xyz</link>
  <description>${escapeXml(description)}</description>
  <language>en-us</language>
  <lastBuildDate>${updated}</lastBuildDate>
  <atom:link href="https://degenfeed.xyz/api/feed/rss.xml" rel="self" type="application/rss+xml"/>
  <generator>DegenFeed v2.0</generator>
${rssItems}
</channel>
</rss>`;

	const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <link href="https://degenfeed.xyz"/>
  <updated>${updated}</updated>
  <id>tag:degenfeed.xyz,2026:feed</id>
${atomEntries}
</feed>`;

	// Default returns RSS 2.0; pass ?format=atom for Atom 1.0
	const fmt = url.searchParams.get("format") === "atom" ? "atom" : "rss";
	const body = fmt === "atom" ? atom : rss;
	const contentType =
		fmt === "atom"
			? "application/atom+xml; charset=utf-8"
			: "application/rss+xml; charset=utf-8";

	try {
		await env.CACHE?.put(cacheKey, body, { expirationTtl: 120 });
	} catch { /* KV operation failed -- non-critical, continue */ }

	return new Response(body, {
		status: 200,
		headers: {
			"content-type": contentType,
			"cache-control": "public, max-age=120",
		},
	});
}
