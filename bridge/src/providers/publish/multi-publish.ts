/**
 * Multi-Platform Publishing Engine
 *
 * Publish a single article to multiple platforms simultaneously.
 * Mirror.xyz + Paragraph.xyz + Substack + Medium in one call.
 */

import type { SchemaGuard } from '../../server/types';
import { publishToMirror, type MirrorPublishRequest } from './mirror-publish';
import { publishToParagraph, type ParagraphPublishRequest } from './paragraph-publish';
import { crossPostToSubstack, type SubstackCrossPostRequest } from './substack-publish';
import { crossPostToMedium, type MediumCrossPostRequest } from './medium-publish';

export const schema: SchemaGuard = {
  id: 'multi-publish',
  name: 'Multi-Platform Publishing',
  description: 'Publish to Mirror, Paragraph, Substack, and Medium simultaneously',
  endpoint: '/api/publish/multi',
  requiresAuth: true,
  contentType: 'article',
};

export interface MultiPublishRequest {
  /** Common content */
  title: string;
  content: string;
  tags?: string[];
  featuredImage?: string;

  /** Platform-specific configs */
  mirror?: {
    enabled: boolean;
    author: string;
    price?: string;
    supply?: number;
  };
  paragraph?: {
    enabled: boolean;
    authorFid: number;
    authorAddress?: string;
    newsletterId?: string;
    createFarcasterCast?: boolean;
  };
  substack?: {
    enabled: boolean;
    authorEmail: string;
    isPremium?: boolean;
    scheduledAt?: string;
  };
  medium?: {
    enabled: boolean;
    integrationToken: string;
    authorId?: string;
    publishStatus?: 'draft' | 'public' | 'unlisted';
    canonicalUrl?: string;
    publicationId?: string;
  };

  /** Premium user flag */
  isPremiumUser: boolean;
}

export interface MultiPublishResult {
  ok: boolean;
  results: Array<{
    platform: string;
    success: boolean;
    url?: string;
    id?: string;
    error?: string;
  }>;
}

export async function publishToMultiple(
  req: MultiPublishRequest,
): Promise<MultiPublishResult> {
  const results: MultiPublishResult['results'] = [];

  const promises: Promise<void>[] = [];

  // Mirror
  if (req.mirror?.enabled) {
    promises.push(
      (async () => {
        try {
          const result = await publishToMirror({
            title: req.title,
            content: req.content,
            author: req.mirror!.author,
            price: req.mirror!.price,
            supply: req.mirror!.supply,
          });
          results.push({
            platform: 'mirror',
            success: result.ok,
            url: result.mirrorEntryUrl,
            id: result.arweaveTxId,
            error: result.error,
          });
        } catch (err) {
          results.push({
            platform: 'mirror',
            success: false,
            error: (err as Error).message,
          });
        }
      })(),
    );
  }

  // Paragraph
  if (req.paragraph?.enabled) {
    promises.push(
      (async () => {
        try {
          const result = await publishToParagraph({
            title: req.title,
            content: req.content,
            authorFid: req.paragraph!.authorFid,
            authorAddress: req.paragraph!.authorAddress,
            newsletterId: req.paragraph!.newsletterId,
            featuredImage: req.featuredImage,
            tags: req.tags,
            createFarcasterCast: req.paragraph!.createFarcasterCast,
          });
          results.push({
            platform: 'paragraph',
            success: result.ok,
            url: result.paragraphUrl,
            id: result.articleId,
            error: result.error,
          });
        } catch (err) {
          results.push({
            platform: 'paragraph',
            success: false,
            error: (err as Error).message,
          });
        }
      })(),
    );
  }

  // Substack
  if (req.substack?.enabled) {
    promises.push(
      (async () => {
        try {
          const result = await crossPostToSubstack(
            {
              title: req.title,
              content: req.content,
              authorEmail: req.substack!.authorEmail,
              featuredImage: req.featuredImage,
              tags: req.tags,
              scheduledAt: req.substack!.scheduledAt,
              isPremium: req.substack!.isPremium,
            },
            req.isPremiumUser,
          );
          results.push({
            platform: 'substack',
            success: result.ok,
            url: result.postUrl,
            id: result.postId,
            error: result.error,
          });
        } catch (err) {
          results.push({
            platform: 'substack',
            success: false,
            error: (err as Error).message,
          });
        }
      })(),
    );
  }

  // Medium
  if (req.medium?.enabled) {
    promises.push(
      (async () => {
        try {
          const result = await crossPostToMedium(
            {
              title: req.title,
              content: req.content,
              integrationToken: req.medium!.integrationToken,
              authorId: req.medium!.authorId,
              featuredImage: req.featuredImage,
              tags: req.tags,
              publishStatus: req.medium!.publishStatus,
              canonicalUrl: req.medium!.canonicalUrl,
              publicationId: req.medium!.publicationId,
            },
            req.isPremiumUser,
          );
          results.push({
            platform: 'medium',
            success: result.ok,
            url: result.postUrl,
            id: result.postId,
            error: result.error,
          });
        } catch (err) {
          results.push({
            platform: 'medium',
            success: false,
            error: (err as Error).message,
          });
        }
      })(),
    );
  }

  await Promise.allSettled(promises);

  return {
    ok: results.every((r) => r.success),
    results,
  };
}
