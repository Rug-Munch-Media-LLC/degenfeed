/**
 * @degenfeed/api-worker — Paragraph.xyz Bridge Routes
 *
 * Endpoints for the Paragraph bridge integration:
 *   POST  /api/paragraph/publish           — Cross-post to Paragraph
 *   GET   /api/paragraph/articles/:fid     — Get author's Paragraph articles
 *   GET   /api/paragraph/articles          — Get Paragraph articles
 *   GET   /api/paragraph/trending          — Trending on Paragraph
 *   POST  /api/paragraph/import            — Import Paragraph article to DegenFeed
 *   POST  /api/paragraph/subscribe         — Subscribe to newsletter
 *   GET   /api/paragraph/newsletter/stats  — Newsletter analytics
 *   GET   /api/paragraph/search            — Search Paragraph articles
 */

import { ParagraphBridge } from '@degenfeed/paragraph-bridge';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────

interface ParagraphEnv extends Env {
  /** Paragraph.xyz API URL (default: https://paragraph.xyz/api) */
  PARAGRAPH_API_URL?: string;
  /** Paragraph API key */
  PARAGRAPH_API_KEY?: string;
  /** Farcaster Hub URL for cast verification */
  FARCASTER_HUB_URL?: string;
}

function getBridge(env: ParagraphEnv): ParagraphBridge {
  return new ParagraphBridge({
    apiUrl: env.PARAGRAPH_API_URL,
    farcasterHubUrl: env.FARCASTER_HUB_URL,
    apiKey: env.PARAGRAPH_API_KEY,
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  const _respData = JSON.stringify(data);
  return new Response(_respData, {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
}

function noCacheJsonResponse(data: unknown, status = 200): Response {
  const _respData = JSON.stringify(data);
  return new Response(_respData, {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store, must-revalidate' },
  });
}

// ─── POST /api/paragraph/publish — Cross-post to Paragraph ───────

export async function handleParagraphPublish(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      title: string;
      content: string;
      authorFid?: number;
      newsletterId?: string;
      featuredImage?: string;
      tags?: string[];
    };

    if (!body.title || !body.content) {
      return jsonResponse({ error: 'title and content are required' }, 400);
    }

    if (!body.authorFid) {
      return jsonResponse({ error: 'authorFid (Farcaster ID) is required' }, 400);
    }

    const bridge = getBridge(env);
    const result = await bridge.publishToParagraph({
      title: body.title,
      content: body.content,
      authorFid: body.authorFid,
      authorAddress: session.address,
      newsletterId: body.newsletterId,
      featuredImage: body.featuredImage,
      tags: body.tags,
    });

    return jsonResponse(
      {
        ok: true,
        ...result,
        message: `Article published to Paragraph: ${result.paragraphUrl}`,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/paragraph/articles/:fid — Get author's Paragraph articles ─

export async function handleParagraphArticlesByFid(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const fid = Number(new URL(request.url).pathname.split('/').pop());
    if (!fid || Number.isNaN(fid)) {
      return jsonResponse({ error: 'Valid Farcaster ID (fid) required' }, 400);
    }

    const bridge = getBridge(env);
    const articles = await bridge.getParagraphArticles(fid);

    return noCacheJsonResponse({ articles, meta: { authorFid: fid, total: articles.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/paragraph/articles — Get Paragraph articles ─────────

export async function handleParagraphArticles(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const fidParam = url.searchParams.get('fid');
    const limit = Number(url.searchParams.get('limit')) || 20;

    // If fid is provided, return articles for that author
    if (fidParam) {
      const fid = Number(fidParam);
      if (Number.isNaN(fid)) {
        return jsonResponse({ error: 'Invalid fid parameter' }, 400);
      }
      const bridge = getBridge(env);
      const articles = await bridge.getParagraphArticles(fid);
      return noCacheJsonResponse({
        articles,
        meta: { authorFid: fid, total: articles.length, limit },
      });
    }

    // Without fid, return trending articles as the default listing
    const bridge = getBridge(env);
    const articles = await bridge.getTrending(limit);
    return noCacheJsonResponse({
      articles,
      meta: { total: articles.length, limit, trending: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/paragraph/trending — Trending on Paragraph ──────────

export async function handleParagraphTrending(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit')) || 20;

    const bridge = getBridge(env);
    const articles = await bridge.getTrending(limit);

    return noCacheJsonResponse({ articles, meta: { total: articles.length, limit } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/paragraph/import — Import Paragraph article to DegenFeed ─

export async function handleParagraphImport(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as { articleId: string };
    if (!body.articleId) {
      return jsonResponse({ error: 'articleId is required' }, 400);
    }

    const bridge = getBridge(env);
    const article = await bridge.crossPostFromParagraph(body.articleId);

    return jsonResponse(
      {
        ok: true,
        article,
        message: `Paragraph article "${article.title}" imported to DegenFeed`,
      },
      201,
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return jsonResponse({ error: 'Paragraph article not found' }, 404);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/paragraph/subscribe — Subscribe to newsletter ─────

export async function handleParagraphSubscribe(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      newsletterId: string;
      email: string;
    };

    if (!body.newsletterId || !body.email) {
      return jsonResponse({ error: 'newsletterId and email are required' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
      return jsonResponse({ error: 'Valid email required' }, 400);
    }

    const bridge = getBridge(env);
    await bridge.subscribeToNewsletter(body.newsletterId, body.email.toLowerCase());

    return jsonResponse({
      ok: true,
      email: body.email.toLowerCase(),
      newsletterId: body.newsletterId,
      message: `Subscribed to Paragraph newsletter (${body.newsletterId})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/paragraph/newsletter/stats — Newsletter analytics ──

export async function handleParagraphNewsletterStats(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const newsletterId = url.searchParams.get('newsletterId');

    if (!newsletterId) {
      return jsonResponse({ error: 'newsletterId query parameter is required' }, 400);
    }

    const bridge = getBridge(env);
    const stats = await bridge.getNewsletterStats(newsletterId);

    return noCacheJsonResponse({ stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/paragraph/search — Search Paragraph articles ───────

export async function handleParagraphSearch(
  request: Request,
  env: ParagraphEnv,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = Number(url.searchParams.get('limit')) || 10;

    if (!query) {
      return jsonResponse({ error: 'Search query (q) is required' }, 400);
    }

    const bridge = getBridge(env);
    const articles = await bridge.searchArticles(query, limit);

    return noCacheJsonResponse({
      articles,
      meta: { query, total: articles.length, limit },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}
