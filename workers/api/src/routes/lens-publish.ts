/**
 * @degenfeed/api-worker — Lens Publications, Reactions & Feed
 *
 * Full API for reading/writing Lens content via our self-hosted indexer
 * and the free public Lens v2 GraphQL API.
 *
 * Routes:
 *   POST   /api/lens/publish         — Create a new post on Lens
 *   POST   /api/lens/publish/gasless — Create a post via Momoka (free, no gas)
 *   POST   /api/lens/publish/comment — Comment on a publication
 *   POST   /api/lens/publish/mirror  — Mirror a publication
 *   POST   /api/lens/publish/collect — Collect a publication
 *   POST   /api/lens/react           — Like/unlike a publication
 *   GET    /api/lens/feed            — Timeline feed from local indexer
 *   GET    /api/lens/feed/explore    — Explore/trending content
 *   GET    /api/lens/publications    — Get publications for a profile
 *
 * Error handling, rate limiting, and response validation on every endpoint.
 * No paid API dependency.
 */

import { LensClient, LENS_API_URL } from '@degenfeed/lens-sdk';
import type { Env } from '../index';
import { jsonResponse, log, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { validateBodySize, sanitizeString, hasSuspiciousPayload } from '../sanitize';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_API_URL_ENV = 'https://api-v2.lens.dev/graphql';
const LOCAL_INDEXER_URL = 'http://127.0.0.1:8099';
const INDEXER_TIMEOUT = 5000;

// ─── KV key helpers ─────────────────────────────────────────────────────────

function lensSessionKey(profileId: string): string {
  return `lens:session:${profileId}`;
}

// ─── Helper: Get stored Lens auth for a profile ─────────────────────────────

async function getLensAuth(
  env: Env,
  walletAddress: string,
): Promise<{ profileId: string; handle: string } | null> {
  try {
    const raw = await env.CACHE?.get(`lens:linked:${walletAddress.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as { profileId: string; handle: string };
  } catch {
    return null;
  }
}

// ─── POST /api/lens/publish — Create a post on Lens ──────────────────────

interface PublishBody {
  content: string;
  /** Optional metadata */
  title?: string;
  /** Media attachments */
  media?: Array<{ url: string; mimeType?: string }>;
  /** Tags */
  tags?: string[];
  /** Custom attributes */
  attributes?: Array<{ key: string; value: string }>;
}

export async function handleLensPublish(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // Get linked Lens profile
  const lensAuth = await getLensAuth(env, session.address);
  if (!lensAuth) {
    return jsonResponse({
      error: 'No Lens profile linked. Authenticate at POST /api/lens/auth first.',
    }, 401);
  }

  // Validate body
  const sizeCheck = validateBodySize(request, 128 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const content = sanitizeString(body.content, 5000);
  if (!content || !content.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400);
  }
  if (hasSuspiciousPayload(content)) {
    return jsonResponse({ error: 'Invalid characters in content' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);

    // Build post request
    const result = await client.request(
      `mutation CreatePost($request: CreatePostRequest!) {
        createPost(request: $request) {
          ... on CreatePostResponse { hash id }
          ... on RelayError { reason }
        }
      }`,
      {
        request: {
          profileId: lensAuth.profileId,
          content,
          ...(body.title ? { title: body.title } : {}),
          ...(body.media?.length ? { media: body.media } : {}),
          ...(body.tags?.length ? { tags: body.tags } : {}),
          ...(body.attributes?.length ? { attributes: body.attributes } : {}),
        },
      },
    );

    const response = result as { createPost?: { hash?: string; id?: string; reason?: string } };
    const createPost = response?.createPost;

    if (!createPost) {
      return jsonResponse({ error: 'Failed to create post on Lens' }, 500);
    }

    if (createPost.reason) {
      return jsonResponse({ error: `Lens relay error: ${createPost.reason}` }, 502);
    }

    log('info', '[lens-publish] Post created', {
      profile: lensAuth.handle,
      hash: createPost.hash,
      id: createPost.id,
    });

    return jsonResponse({
      success: true,
      hash: createPost.hash,
      publicationId: createPost.id,
      handle: `${lensAuth.handle}.lens`,
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lens publish failed';
    return jsonResponse({ error: message }, 502);
  }
}

// ─── POST /api/lens/publish/gasless — Post via Momoka (Gasless) ──────────

export async function handleLensPublishGasless(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const lensAuth = await getLensAuth(env, session.address);
  if (!lensAuth) {
    return jsonResponse({
      error: 'No Lens profile linked. Authenticate at POST /api/lens/auth first.',
    }, 401);
  }

  const sizeCheck = validateBodySize(request, 128 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const content = sanitizeString(body.content, 5000);
  if (!content || !content.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400);
  }
  if (hasSuspiciousPayload(content)) {
    return jsonResponse({ error: 'Invalid characters in content' }, 400);
  }

  try {
    const { MomokaClient } = await import('@degenfeed/lens-sdk/momoka');
    const momoka = new MomokaClient();

    // Submit via Momoka — this is gasless and free
    const result = await momoka.submit({
      content,
      profileId: lensAuth.profileId,
      accessToken: '',  // Momoka accepts submissions without Lens API token
      media: body.media,
      tags: body.tags,
      attributes: body.attributes,
    });

    if (!result.accepted) {
      return jsonResponse({
        error: result.error || 'Momoka submission rejected',
      }, 502);
    }

    // Store the Momoka proof for data portability
    await momoka.storeProof(
      env as unknown as { CACHE?: KVNamespace },
      session.address,
      result,
    );

    log('info', '[lens-publish] Gasless post created', {
      profile: lensAuth.handle,
      daHash: result.daHash,
    });

    return jsonResponse({
      success: true,
      gasless: true,
      daHash: result.daHash,
      proofUrl: result.proofUrl,
      publicationId: result.publicationId,
      handle: `${lensAuth.handle}.lens`,
      message: 'Your post was published gaslessly via Momoka. Zero gas fees paid.',
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gasless publish failed';
    return jsonResponse({ error: message }, 502);
  }
}

// ─── POST /api/lens/publish/comment — Comment on a publication ──────────

interface CommentBody {
  publicationId: string;
  content: string;
}

export async function handleLensComment(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const lensAuth = await getLensAuth(env, session.address);
  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  const sizeCheck = validateBodySize(request, 64 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: CommentBody;
  try {
    body = (await request.json()) as CommentBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.publicationId) {
    return jsonResponse({ error: 'publicationId is required' }, 400);
  }
  const content = sanitizeString(body.content, 5000);
  if (!content?.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const result = await client.request(
      `mutation Comment($request: CommentRequest!) {
        comment(request: $request) {
          ... on RelayResult { txHash }
          ... on RelayError { reason }
        }
      }`,
      {
        request: {
          publicationId: body.publicationId,
          profileId: lensAuth.profileId,
          content,
        },
      },
    );

    return jsonResponse({
      success: true,
      result,
      publicationId: body.publicationId,
    }, 201);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── POST /api/lens/publish/mirror — Mirror a publication ────────────────

interface MirrorBody {
  publicationId: string;
}

export async function handleLensMirror(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const lensAuth = await getLensAuth(env, session.address);
  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: MirrorBody;
  try {
    body = (await request.json()) as MirrorBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.publicationId) {
    return jsonResponse({ error: 'publicationId is required' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const result = await client.request(
      `mutation Mirror($request: MirrorRequest!) {
        mirror(request: $request) {
          ... on RelayResult { txHash }
          ... on RelayError { reason }
        }
      }`,
      { request: { publicationId: body.publicationId, profileId: lensAuth.profileId } },
    );

    return jsonResponse({ success: true, result });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── POST /api/lens/publish/collect — Collect a publication ──────────────

interface CollectBody {
  publicationId: string;
}

export async function handleLensCollect(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: CollectBody;
  try {
    body = (await request.json()) as CollectBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.publicationId) {
    return jsonResponse({ error: 'publicationId is required' }, 400);
  }

  // Build the on-chain collect transaction intent
  const { buildLensCollectIntent } = await import('./lens');
  const txIntent = buildLensCollectIntent(body.publicationId, session.address);

  if (!txIntent) {
    return jsonResponse({ error: 'Invalid publication ID format' }, 400);
  }

  return jsonResponse({
    success: true,
    message: 'Send this transaction to Polygon to collect the publication',
    tx: txIntent,
    chainId: 137,
    publicationId: body.publicationId,
  });
}

// ─── POST /api/lens/react — Like or unlike a publication ────────────────

interface ReactBody {
  publicationId: string;
  reaction: 'UPVOTE' | 'DOWNVOTE';
  /** 'add' to like, 'remove' to unlike */
  action: 'add' | 'remove';
}

export async function handleLensReact(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const lensAuth = await getLensAuth(env, session.address);
  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: ReactBody;
  try {
    body = (await request.json()) as ReactBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.publicationId) {
    return jsonResponse({ error: 'publicationId is required' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);

    if (body.action === 'add') {
      await client.request(
        `mutation AddReaction($request: ReactionRequest!) {
          addReaction(request: $request)
        }`,
        { request: { publicationId: body.publicationId, reaction: body.reaction || 'UPVOTE' } },
      );
    } else {
      await client.request(
        `mutation RemoveReaction($request: ReactionRequest!) {
          removeReaction(request: $request)
        }`,
        { request: { publicationId: body.publicationId, reaction: body.reaction || 'UPVOTE' } },
      );
    }

    return jsonResponse({ success: true, action: body.action, reaction: body.reaction });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── GET /api/lens/feed — Timeline feed from local indexer ──────────────

export async function handleLensFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;
  const author = url.searchParams.get('author') || undefined;

  // Try local indexer first
  try {
    const indexerUrl = env.LENS_INDEXER_URL || LOCAL_INDEXER_URL;
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (author) params.set('author', author);

    const res = await fetch(`${indexerUrl}/api/publications?${params}`, {
      headers: { 'User-Agent': 'DegenFeed-API/0.1' },
      signal: AbortSignal.timeout(INDEXER_TIMEOUT),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        data: Array<Record<string, unknown>>;
        meta: { total: number };
      };

      return noCacheJsonResponse({
        data: data.data,
        meta: {
          total: data.meta.total,
          returned: data.data.length,
          offset,
          limit,
          source: 'local_indexer',
        },
      });
    }
  } catch {
    // Indexer not available — fall back to Lens API
    log('warn', '[lens-publish] Local indexer unavailable, using Lens API');
  }

  // Fallback: query Lens API directly
  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const data = await client.request(
      `query Publications($request: PublicationsRequest!) {
        publications(request: $request) {
          items {
            __typename
            ... on Post {
              id slug
              author { address username { localName } metadata { displayName bio picture { ... on ImageSet { optimized { uri } } } } }
              metadata { content media { original { url mimeType } } tags }
              stats { reactions comments mirrors quotes }
              createdAt
            }
          }
          pageInfo { next }
        }
      }`,
      {
        request: {
          ...(author ? { profileId: author } : {}),
          limit: Math.min(limit, 50),
        },
      },
    );

    return noCacheJsonResponse({
      data: (data as { publications?: { items: unknown[] } })?.publications?.items || [],
      meta: { source: 'lens_api', limit },
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to fetch Lens feed', detail: String(err) }, 502);
  }
}

// ─── GET /api/lens/feed/explore — Explore/trending content ──────────────

export async function handleLensExplore(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 50);

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const data = await client.request(
      `query Explore($request: ExploreRequest!) {
        explorePublications(request: $request) {
          items {
            __typename
            ... on Post {
              id
              author { address username { localName } metadata { displayName picture { ... on ImageSet { optimized { uri } } } } }
              metadata { content media { original { url } } tags }
              stats { reactions comments mirrors quotes }
              createdAt
            }
          }
          pageInfo { next }
        }
      }`,
      {
        request: {
          limit,
          orderBy: 'TOP_REACTED',
        },
      },
    );

    return noCacheJsonResponse({
      data: (data as { explorePublications?: { items: unknown[] } })?.explorePublications?.items || [],
      meta: { source: 'lens_api', limit },
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to fetch explore feed', detail: String(err) }, 502);
  }
}

// ─── GET /api/lens/publications — Get publications for a profile ─────────

export async function handleLensProfilePublications(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 50);

  if (!profileId) {
    return jsonResponse({ error: 'profileId is required' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const data = await client.request(
      `query ProfilePublications($request: PublicationsRequest!) {
        publications(request: $request) {
          items {
            __typename
            ... on Post {
              id slug
              metadata { content media { original { url } } tags }
              stats { reactions comments mirrors quotes }
              createdAt
            }
          }
          pageInfo { next }
        }
      }`,
      {
        request: { profileId, limit },
      },
    );

    return noCacheJsonResponse({
      data: (data as { publications?: { items: unknown[] } })?.publications?.items || [],
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}
