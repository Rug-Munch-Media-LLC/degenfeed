/**
 * Scheduled cron handler — fires via wrangler.toml [triggers].
 *
 * Cron schedules:
 *   every-30-min — Trending content scraper
 *   daily-14:00  — Daily digest email + trending refresh
 *
 * The dispatcher in index.ts checks the cron trigger and routes here.
 *
 * Daily digest:
 *   1. Builds the multi-protocol daily digest (Nostr→Bluesky→Mastodon→RSS).
 *   2. Pulls all newsletter subscribers from KV.
 *   3. Sends the digest via Postmark email (or logs summary).
 *   4. Also refreshes trending content.
 *
 * Trending-only tick:
 *   1. Scrapes all platforms for trending content.
 *   2. Caches in KV for 1 hour.
 */

import type { Protocol } from "@degenfeed/types";
import type { Env } from "../index";
import { scrapeTrendingContent } from "./trending-scraper";

export async function handleCron(env: Env): Promise<Response> {
	// Fire-and-forget trending scraper refresh on every cron tick
	scrapeTrendingContent(env).catch((err) =>
		console.warn("[cron] trending scrape failed:", err),
	);

	const start = Date.now();
	const digestNiche = "crypto,bitcoin,ethereum,defi,nft";
	const digestProtocols: Protocol[] = [
		// biome-ignore format: keep protocols readable
		'nostr',
		"farcaster",
		"lens",
		"bluesky",
		"mastodon",
		"rss",
	];

	// Build the digest
	const { gatherDigestPosts, buildDigestHtml } = await import("./newsletter");
	const { computeTrendingTopics } = await import("@degenfeed/ranking");
	const posts = await gatherDigestPosts(
		env,
		digestProtocols,
		digestNiche.split(","),
	);

	if (posts.length === 0) {
		console.log("[cron] no posts for digest, skipping");
		return new Response("OK — no posts", { status: 200 });
	}

	const trending = computeTrendingTopics(posts, Date.now());
	const html = buildDigestHtml(
		posts,
		trending,
		digestNiche.split(","),
		digestProtocols,
		Date.now(),
	);

	// Pull subscribers
	let subscribers: string[] = [];
	if (env.SUBSCRIPTIONS) {
		try {
			const idx = await env.SUBSCRIPTIONS.get("newsletter:subscribers");
			if (idx) subscribers = idx.split("\n").filter(Boolean);
		} catch { /* KV operation failed -- non-critical, continue */ }
	}

	const token = env.POSTMARK_SERVER_TOKEN;
	let sent = 0;

	if (token && subscribers.length > 0) {
		// Real email delivery via Postmark
		const results = await Promise.allSettled(
			subscribers.map(async (email) => {
				try {
					const res = await fetch("https://api.postmarkapp.com/email", {
						method: "POST",
						headers: {
							"content-type": "application/json",
							"x-postmark-server-token": token,
							accept: "application/json",
						},
						body: JSON.stringify({
							From: "digest@degenfeed.xyz",
							To: email,
							Subject: `DegenFeed Daily — ${new Date(Date.now()).toDateString()}`,
							HtmlBody: html,
							MessageStream: "outbound",
						}),
					});
					if (res.ok) sent++;
				} catch {
					/* skip failed sends */
				}
			}),
		);
		const errors = results.filter((r) => r.status === "rejected").length;
		console.log(
			`[cron] digest sent to ${sent}/${subscribers.length} subscribers (${errors} errors) in ${Date.now() - start}ms`,
		);
	} else {
		// No Postmark yet — log runbook output for manual review.
		console.log(
			`[cron] digest built (${posts.length} posts, ${subscribers.length} subscribers). No Postmark token configured — email NOT sent.`,
		);
		console.log(`[cron] sample: ${html.slice(0, 200).replace(/\n/g, " ")}...`);
	}

	return new Response(
		JSON.stringify({
			ok: true,
			posts: posts.length,
			subscribers: subscribers.length,
			sent: token ? sent : 0,
			durationMs: Date.now() - start,
		}),
		{ status: 200, headers: { "content-type": "application/json" } },
	);
}
