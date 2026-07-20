/**
 * @degenfeed/api-worker — Content Format Translator
 *
 * Transforms DegenFeed UnifiedPost content into protocol-correct output
 * for every supported protocol. Each formatter produces the exact payload
 * shape the target protocol's API expects.
 *
 * This is the REVERSE of the feed-providers' normalizers: instead of
 * turning protocol-native data into UnifiedPosts, we turn UnifiedPosts
 * (or raw text+media) into protocol-native data.
 */

import type { Facet, ImageEmbed } from "@degenfeed/bluesky-sdk/formatter";
import type { Embed, Protocol } from "@degenfeed/types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface MediaAttachment {
	url: string;
	alt?: string;
	mimeType?: string;
	data?: Uint8Array;
}

export interface TranslateInput {
	text: string;
	images?: MediaAttachment[];
	links?: string[];
	mentions?: string[];
	hashtags?: string[];
	/** Parent post info for replies */
	parentNativeId?: string;
	parentProtocol?: Protocol;
	/** Title for long-form content (NIP-23, RSS) */
	title?: string;
}

// ─── Protocol-specific translators ─────────────────────────────────────────

/**
 * Build an ActivityPub NOTE object (Mastodon-compatible status).
 */
export function formatForActivityPub(input: TranslateInput): {
	status: string;
	media_ids?: string[];
	sensitive?: boolean;
	spoiler_text?: string;
	visibility?: string;
} {
	let text = input.text;

	// Strip unsupported HTML, convert newlines to <br> for Mastodon's HTML renderer
	text = text
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]*>/g, "")
		.replace(/\n/g, "\n");

	// Mastodon has 500 char limit, but our GtS instance may allow more
	const maxLen = 500;
	if (text.length > maxLen) {
		text = `${text.slice(0, maxLen - 1)}…`;
	}

	return {
		status: text,
		visibility: "public",
	};
}

/**
 * Build an AT Protocol post record with proper facets.
 * Uses the atproto-formatter when available, or builds inline.
 */
export async function formatForAtProtocol(
	input: TranslateInput,
	pdsUrl?: string,
	opts?: { resolveMentions?: boolean },
): Promise<{
	text: string;
	facets?: Facet[];
	embed?: ImageEmbed | { $type: string; [key: string]: unknown };
	langs?: string[];
}> {
	const text = input.text.slice(0, 300); // Bluesky 300 char limit
	const facets: Facet[] = [];
	const encoder = new TextEncoder();

	// Detect @mentions in text
	if (opts?.resolveMentions !== false && input.mentions) {
		for (const mention of input.mentions) {
			const idx = text.indexOf(`@${mention}`);
			if (idx !== -1) {
				const before = text.slice(0, idx);
				const byteStart = encoder.encode(before).length;
				const byteEnd = byteStart + encoder.encode(`@${mention}`).length;
				facets.push({
					index: { byteStart, byteEnd },
					features: [
						{ $type: "app.bsky.richtext.facet#mention", did: mention },
					],
				});
			}
		}
	}

	// Detect #hashtags
	const hashtagRe = /(^|\s)(#[a-zA-Z0-9_]+)/g;
	let hMatch: RegExpExecArray | null;
	while ((hMatch = hashtagRe.exec(text)) !== null) {
		const prefix = hMatch[1] ?? "";
		const tag = (hMatch[2] ?? "").slice(1);
		const charStart = hMatch.index + prefix.length;
		const before = text.slice(0, charStart);
		const byteStart = encoder.encode(before).length;
		const byteEnd = byteStart + encoder.encode(`#${tag}`).length;
		facets.push({
			index: { byteStart, byteEnd },
			features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
		});
	}

	// Detect URLs
	const urlRe = /(^|\s)(https?:\/\/[^\s<]+[^\s<.,!?;:)\]}>'"])/g;
	let uMatch: RegExpExecArray | null;
	while ((uMatch = urlRe.exec(text)) !== null) {
		const prefix = uMatch[1] ?? "";
		const url = (uMatch[2] ?? "").trim();
		const charStart = uMatch.index + prefix.length;
		const before = text.slice(0, charStart);
		const byteStart = encoder.encode(before).length;
		const byteEnd = byteStart + encoder.encode(url).length;
		facets.push({
			index: { byteStart, byteEnd },
			features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
		});
	}

	facets.sort((a, b) => a.index.byteStart - b.index.byteStart);

	let embed: ImageEmbed | undefined;
	if (input.images && input.images.length > 0) {
		embed = {
			$type: "app.bsky.embed.images",
			images: input.images.slice(0, 4).map((img) => ({
				image: {
					$type: "blob",
					ref: { $link: img.url },
					mimeType: img.mimeType ?? "image/jpeg",
					size: 0,
				},
				alt: img.alt ?? "",
			})),
		};
	}

	return { text, facets, embed, langs: ["en"] };
}

/**
 * Build a Nostr event (kind 1 for short posts, kind 30023 for long-form).
 */
export function formatForNostr(
	input: TranslateInput,
	pubkey: string,
): {
	kind: number;
	content: string;
	tags: string[][];
	created_at: number;
} {
	const isLongForm = input.text.length > 280 || !!input.title;
	const kind = isLongForm ? 30023 : 1;
	const tags: string[][] = [];

	// Content warnings
	tags.push(["t", "degenfeed"]);

	// Hashtags
	if (input.hashtags) {
		for (const tag of input.hashtags) {
			tags.push(["t", tag.toLowerCase()]);
		}
	}

	// Links as r-tags (NIP-23)
	if (input.links) {
		for (const link of input.links) {
			tags.push(["r", link]);
		}
	}

	// Mentions as p-tags
	if (input.mentions) {
		for (const mention of input.mentions) {
			if (/^[0-9a-f]{64}$/i.test(mention)) {
				tags.push(["p", mention]);
			}
		}
	}

	// Image URLs as r-tags or imeta
	if (input.images) {
		for (const img of input.images) {
			tags.push(["imeta", `url ${img.url}`, `alt ${img.alt ?? ""}`]);
		}
	}

	// Parent for replies
	if (input.parentNativeId && /^[0-9a-f]{64}$/i.test(input.parentNativeId)) {
		tags.push(["e", input.parentNativeId, "", "reply"]);
	}

	// Title for long-form
	let content = input.text;
	if (isLongForm && input.title) {
		// NIP-23 long-form: title is separate, content is markdown
		content = input.text;
	}

	return {
		kind,
		content,
		tags,
		created_at: Math.floor(Date.now() / 1000),
	};
}

/**
 * Build Farcaster cast data (text + embeds).
 * Farcaster has a 320-character limit.
 */
export function formatForFarcaster(input: TranslateInput): {
	text: string;
	embeds: { url: string }[];
} {
	const maxLen = 320;
	let text = input.text;
	if (text.length > maxLen) {
		text = `${text.slice(0, maxLen - 3)}...`;
	}

	const embeds: { url: string }[] = [];

	// Add image URL embeds (up to 2)
	if (input.images) {
		for (const img of input.images.slice(0, 2)) {
			embeds.push({ url: img.url });
		}
	}

	// Add link embeds
	if (input.links) {
		for (const link of input.links.slice(0, 1)) {
			if (!embeds.some((e) => e.url === link)) {
				embeds.push({ url: link });
			}
		}
	}

	return { text, embeds };
}

/**
 * Build a Lens publication request.
 */
export function formatForLens(input: TranslateInput): {
	content: string;
	contentUri?: string;
} {
	// Lens has a generous character limit
	const content = input.text.slice(0, 10000);

	return { content };
}

/**
 * Build a Telegram message with HTML parse mode.
 */
export function formatForTelegram(input: TranslateInput): {
	text: string;
	parseMode: "HTML";
	mediaUrls?: string[];
} {
	// Telegram has 4096 char limit
	let text = input.text.slice(0, 4000);

	// Escape HTML entities, preserve basic formatting
	text = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\n\n/g, "\n\n");

	// Build caption with links
	if (input.links && input.links.length > 0) {
		text += "\n\n";
		for (const link of input.links) {
			text += `<a href="${link}">${link}</a>\n`;
		}
	}

	const mediaUrls = input.images?.map((img) => img.url);

	return { text, parseMode: "HTML", mediaUrls };
}

/**
 * Build an RSS feed item (XML).
 */
export function formatForRss(input: TranslateInput, feedUrl: string): string {
	const title = input.title ?? input.text.slice(0, 100);
	const content = input.text;
	const link = input.links?.[0] ?? feedUrl;
	const date = new Date().toUTCString();

	// Build enclosure elements for images
	const enclosures = (input.images ?? [])
		.map(
			(img) =>
				`<enclosure url="${escapeXml(img.url)}" type="${img.mimeType ?? "image/jpeg"}" length="0"/>`,
		)
		.join("\n      ");

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(content.slice(0, 300))}</description>
    <language>en</language>
    <pubDate>${date}</pubDate>
    <lastBuildDate>${date}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${crypto.randomUUID()}</guid>
      <pubDate>${date}</pubDate>
      <description>${escapeXml(content.slice(0, 500))}</description>
      ${enclosures}
    </item>
  </channel>
</rss>`;
}

/**
 * Escape XML special characters for RSS.
 */
function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
