/**
 * @degenfeed/newsletter-bridge-sdk
 *
 * Bridge Substack, Ghost, and generic RSS newsletters to DegenFeed.
 * Fetches content via RSS/API and formats for cross-protocol posting.
 * Uses `fetch()` throughout - compatible with Cloudflare Workers.
 */

import type { Protocol } from '@degenfeed/types';
export type { Protocol };

// ─── Types ─────────────────────────────────────────────────────────

export interface NewsletterPost {
	id: string;
	title: string;
	url: string;
	contentHtml: string;
	contentText: string;
	excerpt: string;
	author: string;
	publishedAt: string;
	updatedAt: string | null;
	tags: string[];
	source: NewsletterSource;
}

export interface NewsletterSource {
	type: 'substack' | 'ghost' | 'rss';
	url: string;
	name: string;
}

export interface BridgeConfig {
	sources: NewsletterSource[];
	pollIntervalMs: number;
	onNewPost: (post: NewsletterPost) => Promise<void> | void;
	onError?: (error: Error) => void;
}

export interface CrossPostPayload {
	title: string;
	body: string;
	url: string;
	tags: string[];
	publishedAt: string;
	author: string;
}

// ─── RSS XML Parser ────────────────────────────────────────────────

function decodeXml(str: string): string {
	return str
		.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, '/').replace(/&#(\d+);/g, (_m: string, d: string) => String.fromCodePoint(Number(d)))
		.replace(/&nbsp;/g, ' ').replace(/&apos;/g, "'");
}

function stripHtml(html: string): string {
	return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ').trim();
}

export function parseRssXml(xmlText: string, limit?: number): NewsletterPost[] {
	const posts: NewsletterPost[] = [];
	const itemRe = /<item>[\s\S]*?<\/item>/gi;
	let match: RegExpExecArray | null;
	let count = 0;

	while ((match = itemRe.exec(xmlText)) !== null) {
		if (limit !== undefined && count >= limit) break;
		count++;
		const item = match[0];
		const ex = (tag: string): string => {
			const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item);
			return m ? decodeXml(m[1]!.trim()) : '';
		};
		const title = ex('title');
		const link = ex('link');
		const pubDate = ex('pubDate');
		const desc = ex('description');
		const contentEncoded = ex('content\\:encoded') || desc;
		const author = ex('dc\\:creator') || ex('author');
		const guid = ex('guid') || link;

		const cats: string[] = [];
		const catRe = /<category[^>]*>([\s\S]*?)<\/category>/gi;
		let cm: RegExpExecArray | null;
		while ((cm = catRe.exec(item)) !== null) { if (cm[1]) cats.push(decodeXml(cm[1])); }

		const text = stripHtml(contentEncoded).slice(0, 2000);
		posts.push({
			id: guid, title, url: link, contentHtml: contentEncoded,
			contentText: text, excerpt: text.slice(0, 300), author,
			publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
			updatedAt: null, tags: cats,
			source: { type: 'rss', url: '', name: '' },
		});
	}
	return posts;
}

// ─── Substack Client ───────────────────────────────────────────────

export class SubstackClient {
	private baseUrl: string;
	constructor(substackUrl: string) { this.baseUrl = substackUrl.replace(/\/$/, ''); }

	async getLatestPosts(limit = 10): Promise<NewsletterPost[]> {
		const res = await fetch(`${this.baseUrl}/feed`, {
			headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)', accept: 'application/rss+xml, text/xml' },
		});
		if (!res.ok) throw new Error(`Substack RSS fetch failed: ${res.status}`);
		const posts = parseRssXml(await res.text(), limit);
		for (const p of posts) p.source = { type: 'substack', url: this.baseUrl, name: new URL(this.baseUrl).hostname };
		return posts;
	}
}

// ─── Ghost Client ─────────────────────────────────────────────────

export class GhostClient {
	private ghostUrl: string;
	private apiKey: string;
	constructor(ghostUrl: string, contentApiKey: string) {
		this.ghostUrl = ghostUrl.replace(/\/$/, '');
		this.apiKey = contentApiKey;
	}

	async getPosts(limit = 15, page = 1): Promise<{ posts: NewsletterPost[]; meta: { pagination: Record<string, unknown> } }> {
		const res = await fetch(
			`${this.ghostUrl}/ghost/api/content/posts/?key=${this.apiKey}&limit=${limit}&page=${page}&include=tags,authors`,
			{ headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' } },
		);
		if (!res.ok) throw new Error(`Ghost API error: ${res.status}`);
		const json = await res.json() as {
			posts: Array<{ id: string; title: string; slug: string; url: string; html: string; excerpt: string; plaintext?: string; published_at: string; updated_at: string | null; tags?: Array<{ name: string }>; primary_author?: { name: string } }>;
			meta: { pagination: Record<string, unknown> };
		};
		const posts = json.posts.map((p) => ({
			id: p.id, title: p.title, url: p.url, contentHtml: p.html ?? '',
			contentText: p.plaintext ?? stripHtml(p.html ?? ''), excerpt: p.excerpt ?? stripHtml(p.html ?? '').slice(0, 300),
			author: p.primary_author?.name ?? '', publishedAt: p.published_at, updatedAt: p.updated_at,
			tags: (p.tags ?? []).map((t) => t.name),
			source: { type: 'ghost' as const, url: this.ghostUrl, name: new URL(this.ghostUrl).hostname },
		}));
		return { posts, meta: json.meta };
	}

	async getPostBySlug(slug: string): Promise<NewsletterPost | null> {
		const res = await fetch(
			`${this.ghostUrl}/ghost/api/content/posts/slug/${slug}/?key=${this.apiKey}&include=tags,authors`,
			{ headers: { 'user-agent': 'DegenFeed/0.1' } },
		);
		if (!res.ok) return null;
		const json = await res.json() as { posts: Array<Record<string, unknown>> };
		if (!json.posts?.length) return null;
		// Return the first post via getPosts
		const { posts } = await this.getPosts(1, 1);
		return posts[0] ?? null;
	}
}

// ─── Newsletter Bridge ─────────────────────────────────────────────

export class NewsletterBridge {
	private config: BridgeConfig;
	private lastCheckAt: number;
	private seenIds: Set<string>;

	constructor(config: BridgeConfig) {
		this.config = config;
		this.lastCheckAt = Date.now();
		this.seenIds = new Set();
	}

	async pollNewContent(): Promise<NewsletterPost[]> {
		const newPosts: NewsletterPost[] = [];
		for (const source of this.config.sources) {
			try {
				let posts: NewsletterPost[];
				if (source.type === 'substack') {
					posts = await new SubstackClient(source.url).getLatestPosts(10);
				} else if (source.type === 'ghost') {
					// Ghost requires API key - skip if not in URL
					continue;
				} else {
					posts = await new RssFeedFetcher(source.url).fetchItems(10);
				}
				for (const post of posts) {
					if (!this.seenIds.has(post.id)) {
						this.seenIds.add(post.id);
						newPosts.push(post);
						if (this.config.onNewPost) await this.config.onNewPost(post);
					}
				}
			} catch (err) {
				if (this.config.onError) this.config.onError(err instanceof Error ? err : new Error(String(err)));
			}
		}
		this.lastCheckAt = Date.now();
		return newPosts;
	}

	getCrossPostPayload(post: NewsletterPost): CrossPostPayload {
		return {
			title: post.title, body: post.contentText || post.excerpt, url: post.url,
			tags: post.tags, publishedAt: post.publishedAt, author: post.author,
		};
	}
}

// ─── Generic RSS Fetcher ──────────────────────────────────────────

export class RssFeedFetcher {
	private feedUrl: string;
	constructor(feedUrl: string) { this.feedUrl = feedUrl; }

	async fetchItems(limit = 20): Promise<NewsletterPost[]> {
		const res = await fetch(this.feedUrl, {
			headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)', accept: 'application/rss+xml, text/xml' },
		});
		if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
		const posts = parseRssXml(await res.text(), limit);
		for (const p of posts) p.source = { type: 'rss', url: this.feedUrl, name: this.feedUrl };
		return posts;
	}
}
