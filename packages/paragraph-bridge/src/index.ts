/**
 * @degenfeed/paragraph-bridge
 *
 * Paragraph.xyz bridge for DegenFeed.
 * Paragraph is Farcaster-native — articles appear as Farcaster posts
 * with special metadata for long-form content.
 *
 * Uses `fetch()` throughout — compatible with Cloudflare Workers and Node.js.
 *
 * Paragraph API: https://paragraph.xyz/api
 * Paragraph Entry URL: https://paragraph.xyz/@author/article-slug
 */

import type { ContentProof } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────

export interface ParagraphPublishInput {
  title: string;
  content: string; // HTML or Markdown
  authorFid: number; // Farcaster ID
  authorAddress?: string; // EVM wallet address
  newsletterId?: string; // Paragraph newsletter ID
  featuredImage?: string;
  tags?: string[];
}

export interface ParagraphPublishResult {
  paragraphUrl: string; // paragraph.xyz/@author/title
  farcasterCastHash: string;
  articleId: string;
  publishedAt: string;
}

export interface ParagraphArticle {
  id: string;
  title: string;
  content: string;
  contentHtml: string;
  excerpt: string;
  author: string;
  authorFid: number;
  authorAddress: string;
  featuredImage?: string;
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  paragraphUrl: string;
  farcasterCastHash?: string;
  newsletterId?: string;
  wordCount: number;
  readTimeMinutes: number;
  contentProof?: ContentProof;
  crossPostedAt?: string;
}

export interface NewsletterStats {
  newsletterId: string;
  subscriberCount: number;
  openRate: number;
  clickRate: number;
  totalPosts: number;
  lastSentAt?: string;
}

export interface ParagraphApiResponse<T> {
  data: T;
  error?: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const DEFAULT_PARAGRAPH_API = 'https://paragraph.xyz/api';
const DEFAULT_FARCASTER_HUB = 'https://hub.farcaster.standardcrypto.vc:2281';

const PARAGRAPH_CAST_TYPE_LONG_FORM = 'long-form-content';

// ─── ParagraphBridge ───────────────────────────────────────────────

export class ParagraphBridge {
  private apiUrl: string;
  // @ts-expect-error -- stored for future use
  private farcasterHubUrl: string;
  private apiKey: string;

  constructor(config?: {
    apiUrl?: string;
    farcasterHubUrl?: string;
    apiKey?: string;
  }) {
    this.apiUrl = config?.apiUrl ?? DEFAULT_PARAGRAPH_API;
    this.farcasterHubUrl = config?.farcasterHubUrl ?? DEFAULT_FARCASTER_HUB;
    this.apiKey = config?.apiKey ?? '';
  }

  // ─── API helpers ──────────────────────────────────────────────────

  private async apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      ...(options.headers as Record<string, string>),
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    const res = await fetch(url, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Paragraph API error ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  // ─── Content helpers ──────────────────────────────────────────────

  private contentToExcerpt(content: string, maxLen = 280): string {
    const plain = content.replace(/<[^>]+>/g, '').trim();
    return plain.length > maxLen ? `${plain.slice(0, maxLen)}...` : plain;
  }

  private countWords(content: string): number {
    const plain = content.replace(/<[^>]+>/g, '').trim();
    return plain ? plain.split(/\s+/).length : 0;
  }

  private estimateReadTime(wordCount: number): number {
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  // ─── Publishing to Paragraph ──────────────────────────────────────

  /**
   * Cross-post article to Paragraph via Farcaster.
   *
   * Paragraph uses Farcaster casts with embedded metadata to represent
   * long-form articles. The cast contains a link to the full content on
   * Paragraph, and the Paragraph API indexes these casts as articles.
   */
  async publishToParagraph(opts: ParagraphPublishInput): Promise<ParagraphPublishResult> {
    const slug = opts.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const excerpt = this.contentToExcerpt(opts.content);
    const paragraphUrl = `https://paragraph.xyz/@fid:${opts.authorFid}/${slug}`;

    // Step 1: Submit to Paragraph API
    // Paragraph's API accepts article metadata and content, then publishes
    // it as a cast on Farcaster via their publishing infrastructure.
    const publishBody: Record<string, unknown> = {
      title: opts.title,
      content: opts.content,
      excerpt,
      authorFid: opts.authorFid,
      slug,
      castType: PARAGRAPH_CAST_TYPE_LONG_FORM,
      publishedAt: new Date().toISOString(),
    };
    if (opts.authorAddress) publishBody.authorAddress = opts.authorAddress;
    if (opts.newsletterId) publishBody.newsletterId = opts.newsletterId;
    if (opts.featuredImage) publishBody.featuredImage = opts.featuredImage;
    if (opts.tags?.length) publishBody.tags = opts.tags;

    const result = await this.apiFetch<
      ParagraphApiResponse<{ articleId: string; castHash: string; publishedAt: string }>
    >('/v1/articles/publish', {
      method: 'POST',
      body: JSON.stringify(publishBody),
    });

    if (result.error) {
      throw new Error(`Paragraph publish error: ${result.error}`);
    }

    const data = result.data;

    return {
      paragraphUrl,
      farcasterCastHash: data.castHash,
      articleId: data.articleId,
      publishedAt: data.publishedAt,
    };
  }

  // ─── Reading from Paragraph ───────────────────────────────────────

  /**
   * Fetch Paragraph articles for a Farcaster author.
   * Queries Paragraph's API by Farcaster ID (fid).
   */
  async getParagraphArticles(authorFid: number): Promise<ParagraphArticle[]> {
    const result = await this.apiFetch<ParagraphApiResponse<Array<Record<string, unknown>>>>(
      `/v1/articles?authorFid=${authorFid}&limit=20`,
    );
    if (result.error) {
      throw new Error(`Paragraph fetch error: ${result.error}`);
    }
    return (result.data || []).map((a) => this.mapParagraphArticle(a));
  }

  /**
   * Get a single Paragraph article by its ID.
   */
  async getParagraphArticle(articleId: string): Promise<ParagraphArticle | null> {
    try {
      const result = await this.apiFetch<ParagraphApiResponse<Record<string, unknown> | null>>(
        `/v1/articles/${articleId}`,
      );
      if (!result.data || result.error) return null;
      return this.mapParagraphArticle(result.data);
    } catch {
      return null;
    }
  }

  /**
   * Get trending Paragraph articles.
   * Uses Paragraph's trending API endpoint.
   */
  async getTrending(limit = 20): Promise<ParagraphArticle[]> {
    const result = await this.apiFetch<ParagraphApiResponse<Array<Record<string, unknown>>>>(
      `/v1/articles/trending?limit=${limit}`,
    );
    if (result.error) {
      throw new Error(`Paragraph trending error: ${result.error}`);
    }
    return (result.data || []).map((a) => this.mapParagraphArticle(a));
  }

  /**
   * Search Paragraph articles by keyword.
   */
  async searchArticles(query: string, limit = 10): Promise<ParagraphArticle[]> {
    const result = await this.apiFetch<ParagraphApiResponse<Array<Record<string, unknown>>>>(
      `/v1/articles/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
    if (result.error) {
      throw new Error(`Paragraph search error: ${result.error}`);
    }
    return (result.data || []).map((a) => this.mapParagraphArticle(a));
  }

  private mapParagraphArticle(raw: Record<string, unknown>): ParagraphArticle {
    const wordCount = this.countWords((raw.content as string) || '');
    const readTimeMinutes = this.estimateReadTime(wordCount);

    const contentProof: ContentProof = {
      contentHash: (raw.id as string) || '',
      timestamp: new Date(raw.publishedAt as string).getTime(),
      permanent: false,
    };

    return {
      id: raw.id as string,
      title: raw.title as string,
      content: (raw.content as string) || '',
      contentHtml: (raw.contentHtml as string) || (raw.content as string) || '',
      excerpt: (raw.excerpt as string) || this.contentToExcerpt((raw.content as string) || ''),
      author: (raw.author as string) || `fid:${raw.authorFid as number}`,
      authorFid: (raw.authorFid as number) || 0,
      authorAddress: (raw.authorAddress as string) || '',
      featuredImage: raw.featuredImage as string | undefined,
      tags: (raw.tags as string[]) || [],
      publishedAt: (raw.publishedAt as string) || '',
      updatedAt: raw.updatedAt as string | undefined,
      paragraphUrl:
        (raw.paragraphUrl as string) ||
        `https://paragraph.xyz/@fid:${raw.authorFid as number}/${raw.slug as string}`,
      farcasterCastHash: raw.castHash as string | undefined,
      newsletterId: raw.newsletterId as string | undefined,
      wordCount,
      readTimeMinutes,
      contentProof,
    };
  }

  // ─── Newsletter Integration ───────────────────────────────────────

  /**
   * Subscribe to a Paragraph newsletter from DegenFeed.
   */
  async subscribeToNewsletter(newsletterId: string, email: string): Promise<void> {
    const result = await this.apiFetch<ParagraphApiResponse<{ ok: boolean }>>(
      `/v1/newsletters/${newsletterId}/subscribe`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
    if (result.error) {
      throw new Error(`Paragraph newsletter subscribe error: ${result.error}`);
    }
  }

  /**
   * Get newsletter analytics/stats.
   */
  async getNewsletterStats(newsletterId: string): Promise<NewsletterStats> {
    const result = await this.apiFetch<ParagraphApiResponse<Record<string, unknown>>>(
      `/v1/newsletters/${newsletterId}/stats`,
    );
    if (result.error) {
      throw new Error(`Paragraph newsletter stats error: ${result.error}`);
    }
    return {
      newsletterId,
      subscriberCount: (result.data.subscriberCount as number) || 0,
      openRate: (result.data.openRate as number) || 0,
      clickRate: (result.data.clickRate as number) || 0,
      totalPosts: (result.data.totalPosts as number) || 0,
      lastSentAt: result.data.lastSentAt as string | undefined,
    };
  }

  // ─── Cross-posting ─────────────────────────────────────────────

  /**
   * Cross-post a Paragraph article to DegenFeed.
   * Fetches the article from Paragraph's API and returns it in a format
   * suitable for DegenFeed's content ingestion pipeline.
   */
  async crossPostFromParagraph(articleId: string): Promise<ParagraphArticle> {
    const article = await this.getParagraphArticle(articleId);
    if (!article) {
      throw new Error(`Paragraph article not found: ${articleId}`);
    }
    article.crossPostedAt = new Date().toISOString();
    return article;
  }
}
