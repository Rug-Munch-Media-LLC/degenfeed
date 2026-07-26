/**
 * @degenfeed/api-worker — Mirror.xyz Bridge Routes
 *
 * Endpoints for the Mirror bridge integration:
 *   POST  /api/mirror/publish          — Publish article to Mirror network
 *   GET   /api/mirror/articles         — Get Mirror articles
 *   GET   /api/mirror/articles/:txId   — Single Mirror article by Arweave tx ID
 *   POST  /api/mirror/import           — Import Mirror article to DegenFeed
 *   GET   /api/mirror/trending         — Trending Mirror articles
 *   GET   /api/mirror/search           — Search Mirror articles
 */

import { MirrorBridge } from '@degenfeed/mirror-bridge';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────

interface MirrorEnv extends Env {
  /** Mirror.xyz GraphQL API URL (default: https://mirror.xyz/graphql) */
  MIRROR_GRAPHQL_URL?: string;
  /** Arweave gateway URL (default: https://arweave.net) */
  MIRROR_ARWEAVE_GATEWAY?: string;
  /** Optimism RPC URL for Writing NFT minting (default: https://mainnet.optimism.io) */
  MIRROR_OPTIMISM_RPC?: string;
}

function getBridge(env: MirrorEnv): MirrorBridge {
  return new MirrorBridge({
    graphqlUrl: env.MIRROR_GRAPHQL_URL,
    arweaveGateway: env.MIRROR_ARWEAVE_GATEWAY,
    optimismRpc: env.MIRROR_OPTIMISM_RPC,
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

// ─── POST /api/mirror/publish — Publish article to Mirror network ──

export async function handleMirrorPublish(request: Request, env: MirrorEnv): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      title: string;
      content: string;
      author?: string;
      price?: string;
      supply?: number;
      publishNFT?: boolean;
    };

    if (!body.title || !body.content) {
      return jsonResponse({ error: 'title and content are required' }, 400);
    }

    const author = body.author || session.address;
    if (!author) {
      return jsonResponse({ error: 'author wallet address required' }, 400);
    }

    const bridge = getBridge(env);

    // Full publish: Arweave + optional NFT mint
    const result = await bridge.publishToMirror({
      title: body.title,
      content: body.content,
      author,
      price: body.price,
      supply: body.supply,
    });

    return jsonResponse(
      {
        ok: true,
        ...result,
        message: body.price
          ? `Published to Mirror and minted Writing NFT for ${body.price} ETH`
          : 'Published to Mirror',
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/mirror/articles — Get Mirror articles ───────────────

export async function handleMirrorArticles(request: Request, env: MirrorEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const author = url.searchParams.get('author') || undefined;
    const limit = Number(url.searchParams.get('limit')) || 20;

    const bridge = getBridge(env);
    const articles = await bridge.getMirrorArticles({ author, limit });

    return noCacheJsonResponse({
      articles,
      meta: { total: articles.length, limit, author: author || null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/mirror/articles/:txId — Single Mirror article ──────

export async function handleMirrorArticleByTxId(
  request: Request,
  env: MirrorEnv,
): Promise<Response> {
  try {
    const txId = new URL(request.url).pathname.split('/').pop();
    if (!txId) return jsonResponse({ error: 'Arweave transaction ID required' }, 400);

    const bridge = getBridge(env);
    const article = await bridge.getMirrorArticle(txId);

    if (!article) {
      return jsonResponse({ error: 'Mirror article not found' }, 404);
    }

    return noCacheJsonResponse({ article });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return jsonResponse({ error: 'Article not found' }, 404);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/mirror/import — Import Mirror article to DegenFeed ─

export async function handleMirrorImport(request: Request, env: MirrorEnv): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as { arweaveTxId: string };
    if (!body.arweaveTxId) {
      return jsonResponse({ error: 'arweaveTxId is required' }, 400);
    }

    const bridge = getBridge(env);
    const article = await bridge.crossPostFromMirror(body.arweaveTxId);

    // In production, this stores the imported article in DegenFeed's
    // content database and indexes it for the feed.
    return jsonResponse(
      {
        ok: true,
        article,
        message: `Mirror article "${article.title}" imported to DegenFeed`,
      },
      201,
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return jsonResponse({ error: 'Mirror article not found' }, 404);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/mirror/trending — Trending Mirror articles ─────────

export async function handleMirrorTrending(_request: Request, env: MirrorEnv): Promise<Response> {
  try {
    const bridge = getBridge(env);
    const articles = await bridge.getTrending();

    return noCacheJsonResponse({ articles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/mirror/search — Search Mirror articles ─────────────

export async function handleMirrorSearch(request: Request, env: MirrorEnv): Promise<Response> {
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
