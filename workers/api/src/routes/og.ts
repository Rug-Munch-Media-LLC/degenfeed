/**
 * OG share embed — returns HTML with OpenGraph meta tags for a post.
 * When pasted into Discord/Twitter/Telegram, shows a rich preview card.
 *
 * GET /api/feed/post/:id?format=og
 */

import type { UnifiedPost } from "@degenfeed/types";
import type { Env } from "../index";

export async function handlePostOg(
	_request: Request,
	env: Env,
	postId: string,
): Promise<Response> {
	const decoded = decodeURIComponent(postId);

	let post: UnifiedPost | null = null;
	try {
		const stored = await env.CACHE?.get(`post:${decoded}`);
		if (stored) post = JSON.parse(stored) as UnifiedPost;
	} catch { /* empty -- error deliberately ignored */ }

	if (!post) {
		return new Response("<html><body><p>Post not found</p></body></html>", {
			status: 404,
			headers: { "content-type": "text/html" },
		});
	}

	const text = post.text.slice(0, 200);
	const image =
		post.embeds.find((e) => e.kind === "image")?.url ||
		post.author.avatarUrl ||
		"https://degenfeed.xyz/og-image.png";
	const author = post.author.displayName;
	const protocol = post.protocol;

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta property="og:title" content="${escapeHtml(author)} on ${protocol}"/>
<meta property="og:description" content="${escapeHtml(text)}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>
<meta property="og:url" content="https://degenfeed.xyz/post/${encodeURIComponent(post.id)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="DegenFeed"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(author)} on ${protocol}"/>
<meta name="twitter:description" content="${escapeHtml(text)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
</head>
<body><p>${escapeHtml(author)}: ${escapeHtml(text)}</p></body>
</html>`;

	return new Response(html, {
		status: 200,
		headers: {
			"content-type": "text/html",
			"cache-control": "public, s-maxage=300, stale-while-revalidate=600",
		},
	});
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
