/**
 * content-dedup — Cross-protocol and URL-based deduplication.
 *
 * Same content posted on Nostr and Farcaster (or Reddit and RSS)
 * should only appear once. Uses content hashing + URL matching
 * and keeps the version with highest engagement.
 */

import type { UnifiedPost } from "@degenfeed/types";

function sha256(text: string): string {
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return Math.abs(hash).toString(36);
}

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, "") // strip URLs
		.replace(
			/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{200D}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F500}-\u{1F53F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F980}-\u{1F9FF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{E50A}]/gu,
			"",
		)
		.replace(/\s+/g, " ")
		.trim();
}

function contentHash(post: UnifiedPost): string {
	const normalized = normalizeText(post.text);
	if (normalized.length < 20) return "";
	return sha256(normalized);
}

function extractUrls(text: string): string[] {
	const urlRegex = /https?:\/\/[^\s<>"]+/g;
	return (text.match(urlRegex) ?? []).map((u) => {
		try {
			const url = new URL(u);
			return url.origin + url.pathname.replace(/\/$/, "");
		} catch {
			return u.replace(/\/$/, "").split("?")[0]!;
		}
	});
}

function engagementScore(post: UnifiedPost): number {
	return (
		(post.metrics.likes ?? 0) * 1 +
		(post.metrics.reposts ?? 0) * 3 +
		(post.metrics.replies ?? 0) * 5 +
		(post.metrics.quotes ?? 0) * 3
	);
}

interface DedupResult {
	posts: UnifiedPost[];
	deduped: number;
	crossProtocol: number;
	urlDedup: number;
}

export function deduplicateCrossProtocol(posts: UnifiedPost[]): DedupResult {
	const contentHashes = new Map<
		string,
		{ post: UnifiedPost; score: number; protocols: Set<string> }
	>();
	const urlToPost = new Map<
		string,
		{ post: UnifiedPost; score: number; protocols: Set<string> }
	>();
	let crossProtocol = 0;
	let urlDedup = 0;

	const keep = new Map<string, UnifiedPost>();

	for (const post of posts) {
		const score = engagementScore(post);
		const hash = contentHash(post);
		const urls = extractUrls(post.text);

		let shouldKeep = true;

		// Cross-protocol content hash matching
		if (hash && contentHashes.has(hash)) {
			const existing = contentHashes.get(hash)!;
			existing.protocols.add(post.protocol);
			if (existing.post.protocol !== post.protocol) crossProtocol++;
			if (score > existing.score) {
				// Merge cross-protocol sources from old winner to new
				const mergedProtocols = new Set([...existing.protocols, post.protocol]);
				contentHashes.set(hash, { post, score, protocols: mergedProtocols });
				keep.delete(existing.post.id);
				keep.set(post.id, post);
			} else {
				// Add this post's protocol to the winner's multi-protocol set
				const existingEntry = keep.get(existing.post.id);
				if (existingEntry) {
					(
						existingEntry as unknown as Record<string, unknown>
					).crossProtocolSources = [
						...((existingEntry as unknown as Record<string, string[]>)
							.crossProtocolSources ?? []),
						post.protocol,
					];
				}
			}
			shouldKeep = false;
		}

		// URL-based dedup
		for (const url of urls) {
			if (urlToPost.has(url)) {
				const existing = urlToPost.get(url)!;
				existing.protocols.add(post.protocol);
				if (score > existing.score) {
					// Replace existing with higher-engagement version
					for (const [u, entry] of urlToPost) {
						if (entry.post === existing.post) {
							urlToPost.set(u, { post, score, protocols: existing.protocols });
						}
					}
					keep.delete(existing.post.id);
					keep.set(post.id, post);
					urlDedup++;
				} else {
					// Add to existing winner's cross-protocol sources
					const existingEntry = keep.get(existing.post.id);
					if (existingEntry) {
						const sources = new Set([
							...((existingEntry as unknown as Record<string, string[]>)
								.crossProtocolSources ?? []),
							post.protocol,
						]);
						(
							existingEntry as unknown as Record<string, string[]>
						).crossProtocolSources = [...sources];
					}
				}
				if (!shouldKeep) break;
				shouldKeep = false;
			} else {
				urlToPost.set(url, {
					post,
					score,
					protocols: new Set([post.protocol]),
				});
			}
		}

		if (shouldKeep && hash) {
			contentHashes.set(hash, {
				post,
				score,
				protocols: new Set([post.protocol]),
			});
			keep.set(post.id, post);
		} else if (shouldKeep) {
			keep.set(post.id, post);
		}
	}

	const deduped = posts.length - keep.size;
	// Add crossProtocolSources to posts that were cross-protocol merged
	const result = [...keep.values()].map((post) => {
		const hash = contentHash(post);
		if (hash && contentHashes.has(hash)) {
			const entry = contentHashes.get(hash)!;
			if (entry.protocols.size > 1) {
				return {
					...post,
					crossProtocolSources: [...entry.protocols].filter(
						(p) => p !== post.protocol,
					),
				} as UnifiedPost & { crossProtocolSources?: string[] };
			}
		}
		return post;
	});

	return {
		posts: result,
		deduped,
		crossProtocol,
		urlDedup,
	};
}
