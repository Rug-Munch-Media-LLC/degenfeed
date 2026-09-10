/**
 * Medium Publish Bridge Provider
 *
 * Wires Medium publishing into DegenFeed's bridge API.
 * Medium is closed source, so:
 * - RSS reading for fetching articles (all users)
 * - Direct Medium API for cross-posting (premium users)
 * - Postiz fallback for cross-posting
 * - Payment routing: Medium earnings → wallet
 */

import type { SchemaGuard, UnifiedPost } from '../../server/types';
import { MediumBridge } from '@degenfeed/medium-bridge';
import { getPaymentRouter } from '@degenfeed/payment-router';

// ─── Schema ─────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'medium-publish',
  name: 'Medium Bridge',
  description: 'Cross-post to Medium. RSS reading for all users, publishing for premium.',
  endpoint: '/api/publish/medium',
  requiresAuth: true,
  authEnvVar: 'MEDIUM_INTEGRATION_TOKEN',
  contentType: 'article',
};

// ─── Initialize bridge ─────────────────────────────────────────────

let _mediumBridge: MediumBridge | null = null;
function getBridge(): MediumBridge {
  if (!_mediumBridge) {
    _mediumBridge = new MediumBridge({
      postizApiKey: process.env.POSTIZ_API_KEY || '',
      postizWorkspaceId: process.env.POSTIZ_WORKSPACE_ID || '',
    });
  }
  return _mediumBridge;
}

// ─── Cross-post to Medium (Premium) ──────────────────────────────

export interface MediumCrossPostRequest {
  title: string;
  content: string; // HTML format
  integrationToken: string; // Medium integration token
  authorId?: string; // Auto-resolved if not provided
  featuredImage?: string;
  tags?: string[];
  canonicalUrl?: string;
  publicationId?: string;
  publishStatus?: 'draft' | 'public' | 'unlisted';
  scheduledAt?: string;
}

export interface MediumCrossPostResponse {
  ok: boolean;
  postUrl?: string;
  postId?: string;
  publishedAt?: string;
  error?: string;
  requiresPremium?: boolean;
  requiresSetup?: boolean;
}

export async function crossPostToMedium(
  req: MediumCrossPostRequest,
  isPremiumUser: boolean,
): Promise<MediumCrossPostResponse> {
  if (!isPremiumUser) {
    return {
      ok: false,
      error: 'Medium cross-posting requires a Premium subscription',
      requiresPremium: true,
    };
  }

  try {
    const bridge = getBridge();

    // Auto-resolve userId if not provided
    let authorId = req.authorId;
    if (!authorId) {
      try {
        authorId = await bridge.getUserId(req.integrationToken);
      } catch {
        return {
          ok: false,
          error: 'Invalid Medium integration token. Get one at https://medium.com/me/settings',
          requiresSetup: true,
        };
      }
    }

    const result = await bridge.createMediumPost({
      title: req.title,
      content: req.content,
      authorId,
      integrationToken: req.integrationToken,
      featuredImage: req.featuredImage,
      tags: req.tags,
      canonicalUrl: req.canonicalUrl,
      publicationId: req.publicationId,
      publishStatus: req.publishStatus,
      scheduledAt: req.scheduledAt,
    });

    // Route payment tracking
    const router = getPaymentRouter();
    await router.recordPayment('medium', {
      platform: 'medium',
      platformPaymentId: result.postId,
      amount: '0',
      amountRaw: '0',
      asset: 'STRIPE_USD',
      sourceAddress: authorId,
      destinationWallet: '',
      creatorId: `medium:${authorId}`,
      platformFee: '0',
      netAmount: '0',
      metadata: {
        title: req.title,
        postUrl: result.postUrl,
        publishStatus: req.publishStatus || 'public',
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

// ─── Fetch Medium RSS ────────────────────────────────────────────

export async function fetchMediumFeed(
  mediumPath: string,
  limit = 10,
): Promise<UnifiedPost[]> {
  try {
    const bridge = getBridge();
    const entries = await bridge.fetchFromRss(mediumPath, limit);
    return entries.map((entry, i) => ({
      id: `medium:rss:${mediumPath}:${i}`,
      protocol: 'rss',
      author: {
        id: `medium:${entry.author}`,
        primary: { protocol: 'rss', id: entry.author },
        handles: { rss: entry.author },
        displayName: entry.author,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'medium', url: entry.link }],
        keys: {},
      },
      text: `${entry.title}\n\n${entry.excerpt}`,
      html: entry.contentHtml,
      contentType: 'article',
      embeds: [
        { kind: 'link', url: entry.link, meta: { platform: 'medium' } },
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
      niches: entry.categories.length > 0 ? entry.categories : ['writing'],
    }));
  } catch (err) {
    console.log(`[medium-publish] RSS error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Medium User Info ────────────────────────────────────────────

export interface MediumUserInfo {
  userId: string;
  name: string;
  url: string;
  imageUrl?: string;
  publications: Array<{ id: string; name: string; url: string }>;
}

export async function getMediumUserInfo(
  integrationToken: string,
): Promise<{ ok: boolean; user?: MediumUserInfo; error?: string }> {
  try {
    const bridge = getBridge();
    const userId = await bridge.getUserId(integrationToken);
    const publications = await bridge.getPublications(userId, integrationToken);

    return {
      ok: true,
      user: {
        userId,
        name: '',
        url: `https://medium.com/@${userId}`,
        publications,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── Medium Stats ────────────────────────────────────────────────

export async function getMediumStats(
  integrationToken: string,
): Promise<{
  ok: boolean;
  stats?: {
    totalPosts: number;
    totalViews: number;
    totalReads: number;
    totalClaps: number;
    totalFollowers: number;
  };
  error?: string;
}> {
  try {
    const bridge = getBridge();
    const userId = await bridge.getUserId(integrationToken);
    const stats = await bridge.getStats(userId, integrationToken);
    return {
      ok: true,
      stats: {
        totalPosts: stats.totalPosts,
        totalViews: stats.totalViews,
        totalReads: stats.totalReads,
        totalClaps: stats.totalClaps,
        totalFollowers: stats.totalFollowers,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
