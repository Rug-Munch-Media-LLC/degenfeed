/**
 * Substack Publish Bridge Provider
 *
 * Wires Substack publishing into DegenFeed's bridge API.
 * Substack is closed source, so cross-posting uses Postiz API.
 * - RSS fetching for reading newsletters
 * - Cross-posting TO Substack for premium users via Postiz
 * - Newsletter analytics
 * - Payment routing: Substack fiat earnings → USDC → DegenFeed wallet
 */

import type { SchemaGuard, UnifiedPost } from '../../server/types';
import { SubstackBridge } from '@degenfeed/substack-bridge';
import { getPaymentRouter } from '@degenfeed/payment-router';

// ─── Schema ─────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'substack-publish',
  name: 'Substack Bridge',
  description: 'Cross-post to Substack via Postiz integration. RSS reading for all users.',
  endpoint: '/api/publish/substack',
  requiresAuth: true,
  authEnvVar: 'POSTIZ_API_KEY',
  contentType: 'article',
};

// ─── Initialize bridge ─────────────────────────────────────────────

let _substackBridge: SubstackBridge | null = null;
function getBridge(): SubstackBridge {
  if (!_substackBridge) {
    _substackBridge = new SubstackBridge({
      postizApiKey: process.env.POSTIZ_API_KEY || '',
      postizWorkspaceId: process.env.POSTIZ_WORKSPACE_ID || '',
    });
  }
  return _substackBridge;
}

// ─── Cross-post to Substack (Premium) ────────────────────────────

export interface SubstackCrossPostRequest {
  title: string;
  content: string;
  authorEmail: string;
  featuredImage?: string;
  tags?: string[];
  scheduledAt?: string;
  isPremium?: boolean;
}

export interface SubstackCrossPostResponse {
  ok: boolean;
  postUrl?: string;
  postId?: string;
  publishedAt?: string;
  error?: string;
  requiresPremium?: boolean;
}

export async function crossPostToSubstack(
  req: SubstackCrossPostRequest,
  isPremiumUser: boolean,
): Promise<SubstackCrossPostResponse> {
  if (!isPremiumUser) {
    return {
      ok: false,
      error: 'Substack cross-posting requires a Premium subscription',
      requiresPremium: true,
    };
  }

  try {
    const bridge = getBridge();
    const result = await bridge.crossPostToSubstack({
      title: req.title,
      content: req.content,
      authorEmail: req.authorEmail,
      featuredImage: req.featuredImage,
      tags: req.tags,
      scheduledAt: req.scheduledAt,
      isPremium: req.isPremium,
    });

    // Route payment tracking (Substack fiat → USDC conversion tracking)
    const router = getPaymentRouter();
    await router.recordPayment('substack', {
      platform: 'substack',
      platformPaymentId: result.postId,
      amount: '0',
      amountRaw: '0',
      asset: 'STRIPE_USD',
      sourceAddress: req.authorEmail,
      destinationWallet: '', // Wallet comes from creator registration
      creatorId: `substack:${req.authorEmail}`,
      platformFee: '0',
      netAmount: '0',
      metadata: {
        title: req.title,
        postUrl: result.postUrl,
        scheduled: !!req.scheduledAt,
      },
    });

    return {
      ok: true,
      postUrl: result.postUrl,
      postId: result.postId,
      publishedAt: result.publishedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message,
    };
  }
}

// ─── Fetch Substack RSS ──────────────────────────────────────────

export async function fetchSubstackFeed(
  substackUrl: string,
  limit = 10,
): Promise<UnifiedPost[]> {
  try {
    const bridge = getBridge();
    const entries = await bridge.fetchFromRss(substackUrl, limit);
    return entries.map((entry, i) => ({
      id: `substack:rss:${substackUrl}:${i}`,
      protocol: 'rss',
      author: {
        id: `substack:${entry.author}`,
        primary: { protocol: 'rss', id: entry.author },
        handles: { rss: entry.author },
        displayName: entry.author,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'substack', url: entry.link }],
        keys: { substackUrl },
      },
      text: `${entry.title}\n\n${entry.excerpt}`,
      html: entry.contentHtml,
      contentType: 'article',
      embeds: [
        { kind: 'link', url: entry.link, meta: { platform: 'substack' } },
        ...(entry.thumbnail
          ? [{ kind: 'image' as const, url: entry.thumbnail, meta: {} }]
          : []),
      ],
      createdAt: new Date(entry.publishedAt).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: entry,
      niches: entry.categories.length > 0 ? entry.categories : ['newsletter'],
    }));
  } catch (err) {
    console.log(`[substack-publish] RSS error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Get Newsletter Stats ─────────────────────────────────────────

export interface SubstackStatsResponse {
  ok: boolean;
  subscriberCount?: number;
  openRate?: number;
  clickRate?: number;
  totalPosts?: number;
  paidSubscribers?: number;
  error?: string;
}

export async function getSubstackStats(
  substackUrl: string,
): Promise<SubstackStatsResponse> {
  try {
    const bridge = getBridge();
    const stats = await bridge.getNewsletterStats(substackUrl);
    return {
      ok: true,
      subscriberCount: stats.subscriberCount,
      openRate: stats.openRate,
      clickRate: stats.clickRate,
      totalPosts: stats.totalPosts,
      paidSubscribers: stats.paidSubscribers,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
