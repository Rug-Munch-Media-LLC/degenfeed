/**
 * /api/thread/:dfUri — Unified cross-protocol thread view.
 *
 * Gathers ALL replies to a post across every protocol into one thread:
 *   1. Native replies from the parent post's own protocol
 *   2. Cross-protocol bridge replies stored in KV (`bridge:reply:{dfUri}:*`)
 *   3. Native replies on sibling posts where the content was cross-posted
 *      via Postiz (`crosspost:{dfUri}` sibling mapping)
 *
 * Nesting is tracked in `bridge:reply:thread:{rootUri}` as a flat edge list
 * `[{ replyUri, parentUri, protocol, depth }]` so replies-to-bridge-replies
 * stay attached to the root thread across protocols.
 *
 * GET /api/thread/:dfUri?sort=chrono|top|protocol&limit=50
 * Returns: { post, replies: ThreadReply[], protocols: string[], bridgeCount, byProtocol }
 */

import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { ALLOWED_PROTOCOLS, sanitizeString } from '../sanitize';
import { handlePostReplies } from './replies';

// ─── Types ──────────────────────────────────────────────────

/** UnifiedPost extended with cross-protocol thread metadata. */
export interface ThreadReply extends UnifiedPost {
  /** True when this reply arrived through the cross-protocol bridge */
  bridged?: boolean;
  /** Protocol the bridged reply was posted from */
  bridgeFrom?: string;
  /** True when this reply lives on a sibling cross-posted copy of the parent */
  viaCrossPost?: boolean;
  /** Nesting depth within the unified thread (1 = direct reply) */
  depth?: number;
  /** df:// URI of the immediate parent within the thread */
  parentUri?: string;
}

/** Flat parent-child edge stored under `bridge:reply:thread:{rootUri}`. */
interface ThreadEdge {
  replyUri: string;
  parentUri: string;
  protocol: string;
  depth: number;
}

/** Record written by cross-reply.ts under `bridge:reply:{uri}:{protocol}:{id}`. */
interface BridgeEntry {
  parentPostUri: string;
  parentProtocol: string;
  replyProtocol: string;
  replyId: string;
  content: string;
  timestamp: number;
  walletAddress: string;
}

/** Sibling copy of a post cross-posted to another protocol via Postiz. */
interface CrosspostSibling {
  protocol: string;
  nativeId: string;
}

const THREAD_TTL = 86400 * 30;
const MAX_THREAD_EDGES = 500;

// ─── URI helpers ────────────────────────────────────────────

/**
 * Normalize a thread identifier to its canonical `df://protocol:nativeId`
 * form. Accepts `df://protocol:id`, `protocol:id`, and URL-encoded variants.
 */
export function parseDfUri(
  raw: string,
): { dfUri: string; protocol: string; nativeId: string } | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* use raw as-is */
  }
  if (value.startsWith('df://')) value = value.slice(5);
  const colon = value.indexOf(':');
  if (colon === -1) return null;
  const protocol = value.slice(0, colon);
  const nativeId = value.slice(colon + 1);
  if (!protocol || !nativeId || !ALLOWED_PROTOCOLS.has(protocol)) return null;
  return { dfUri: `df://${protocol}:${nativeId}`, protocol, nativeId };
}

// ─── Thread relationship tracking (used by cross-reply.ts) ──

/**
 * Record a parent→child edge in the bridge thread index so nested
 * cross-protocol replies stay attached to the root thread.
 *
 * If the parent is itself a tracked reply, the edge is appended to the
 * parent's ROOT thread with depth = parentDepth + 1.
 */
export async function recordThreadRelationship(
  env: Env,
  parentPostUri: string,
  replyUri: string,
  protocol: string,
): Promise<void> {
  if (!env.CACHE) return;
  const parent = parseDfUri(parentPostUri);
  const canonical = parent?.dfUri ?? parentPostUri;

  let rootUri = canonical;
  let depth = 1;
  try {
    const parentMeta = (await env.CACHE.get(`bridge:reply:parent:${canonical}`, 'json')) as {
      rootUri?: string;
      depth?: number;
    } | null;
    if (parentMeta?.rootUri) {
      rootUri = parentMeta.rootUri;
      depth = (parentMeta.depth ?? 1) + 1;
    }
  } catch {
    /* treat parent as root */
  }

  const threadKey = `bridge:reply:thread:${rootUri}`;
  try {
    const edges = ((await env.CACHE.get(threadKey, 'json')) as ThreadEdge[] | null) ?? [];
    if (!edges.some((e) => e.replyUri === replyUri)) {
      edges.push({ replyUri, parentUri: canonical, protocol, depth });
    }
    await env.CACHE.put(threadKey, JSON.stringify(edges.slice(-MAX_THREAD_EDGES)), {
      expirationTtl: THREAD_TTL,
    });
    await env.CACHE.put(`bridge:reply:parent:${replyUri}`, JSON.stringify({ rootUri, depth }), {
      expirationTtl: THREAD_TTL,
    });
  } catch (e) {
    console.error(`[thread] Failed to record thread edge ${replyUri} -> ${canonical}:`, e);
  }
}

/**
 * After a multi-target publish, store the sibling mapping so the unified
 * thread view can pull replies from every protocol the post landed on.
 * Written under `crosspost:df://{protocol}:{nativeId}` for each copy.
 */
export async function storeCrosspostSiblings(
  env: Env,
  results: Record<string, { success?: boolean; error?: string; hash?: string }>,
): Promise<void> {
  const cache = env.CACHE;
  if (!cache) return;
  const published = Object.entries(results).filter(
    ([protocol, r]) => r.success && r.hash && ALLOWED_PROTOCOLS.has(protocol),
  );
  if (published.length < 2) return;
  const siblings: CrosspostSibling[] = published.map(([protocol, r]) => ({
    protocol,
    nativeId: r.hash as string,
  }));
  await Promise.all(
    published.map(([protocol, r]) =>
      cache
        .put(`crosspost:df://${protocol}:${r.hash}`, JSON.stringify(siblings), {
          expirationTtl: THREAD_TTL,
        })
        .catch((e) => console.error('[thread] Failed to store crosspost sibling map:', e)),
    ),
  );
}

// ─── Internal fetch helpers ─────────────────────────────────

async function fetchParentPost(env: Env, id: string): Promise<UnifiedPost | null> {
  try {
    const stored = await env.CACHE?.get(`post:${id}`);
    if (stored) return JSON.parse(stored) as UnifiedPost;
  } catch {
    /* fall through */
  }
  try {
    const cached = await env.CACHE?.get(`post:v1:${id}`);
    if (cached) {
      const parsed = JSON.parse(cached) as { data?: UnifiedPost };
      if (parsed.data) return parsed.data;
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function fetchNativeReplies(request: Request, env: Env, id: string): Promise<UnifiedPost[]> {
  try {
    const res = await handlePostReplies(request, env, encodeURIComponent(id));
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: UnifiedPost[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

async function fetchBridgeReplies(env: Env, dfUri: string): Promise<ThreadReply[]> {
  if (!env.CACHE) return [];
  const prefix = `bridge:reply:${dfUri}:`;
  const replies: ThreadReply[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page: { keys: { name: string }[]; list_complete: boolean; cursor?: string } =
        await env.CACHE.list({ prefix, cursor, limit: 1000 });
      for (const key of page.keys) {
        // Skip the thread index / parent metadata keys that share the prefix
        const rest = key.name.slice(prefix.length);
        const protocol = rest.split(':')[0] ?? '';
        if (!ALLOWED_PROTOCOLS.has(protocol)) continue;
        const entry = (await env.CACHE.get(key.name, 'json')) as BridgeEntry | null;
        if (!entry?.replyProtocol) continue;
        const nativeId =
          entry.replyId || key.name.slice(prefix.length + protocol.length + 1) || key.name;
        const wallet = entry.walletAddress || 'bridge-user';
        const shortWallet =
          wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
        const handles: Partial<Record<Protocol, string | null>> = {};
        handles[entry.replyProtocol as Protocol] = shortWallet;
        const post = buildUnifiedPost({
          protocol: entry.replyProtocol as Protocol,
          nativeId,
          author: {
            id: `${entry.replyProtocol}:${wallet}`,
            primary: { protocol: entry.replyProtocol as Protocol, id: wallet },
            handles,
            displayName: shortWallet,
            bio: '',
            avatarUrl: '',
            verified: [],
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: entry.content ?? '',
          createdAt: entry.timestamp || Date.now(),
          raw: { bridge: true, parentPostUri: entry.parentPostUri },
        }) as ThreadReply;
        post.dfUri = `df://${entry.replyProtocol}:${nativeId}`;
        post.bridged = true;
        post.bridgeFrom = entry.replyProtocol;
        post.depth = 1;
        post.parentUri = dfUri;
        replies.push(post);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    console.error(`[thread] Bridge reply lookup failed for ${dfUri}:`, e);
  }
  return replies;
}

// ─── Sorting ────────────────────────────────────────────────

type SortMode = 'chrono' | 'top' | 'protocol';

function engagementScore(p: UnifiedPost): number {
  return p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies;
}

function sortReplies(replies: ThreadReply[], mode: SortMode): ThreadReply[] {
  const sorted = [...replies];
  switch (mode) {
    case 'top':
      sorted.sort((a, b) => engagementScore(b) - engagementScore(a) || a.createdAt - b.createdAt);
      break;
    case 'protocol':
      sorted.sort((a, b) => a.protocol.localeCompare(b.protocol) || a.createdAt - b.createdAt);
      break;
    default:
      sorted.sort((a, b) => a.createdAt - b.createdAt);
  }
  return sorted;
}

// ─── Handler ────────────────────────────────────────────────

export async function handleUnifiedThread(
  request: Request,
  env: Env,
  dfUriParam: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }
  const parsed = parseDfUri(sanitizeString(dfUriParam, 1024) ?? '');
  if (!parsed) {
    return jsonResponse(
      { error: 'Invalid thread URI — expected df://protocol:nativeId', got: dfUriParam },
      400,
    );
  }
  const { dfUri, protocol, nativeId } = parsed;
  const url = new URL(request.url);
  const sortParam = url.searchParams.get('sort');
  const sort: SortMode = sortParam === 'top' || sortParam === 'protocol' ? sortParam : 'chrono';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const canonicalId = `${protocol}:${nativeId}`;

  // 1. Parent post + native replies + bridge replies + sibling map, in parallel
  const [post, nativeReplies, bridgeReplies, siblings] = await Promise.all([
    fetchParentPost(env, canonicalId),
    fetchNativeReplies(request, env, canonicalId),
    fetchBridgeReplies(env, dfUri),
    (async (): Promise<CrosspostSibling[]> => {
      try {
        const raw = (await env.CACHE?.get(`crosspost:${dfUri}`, 'json')) as
          | CrosspostSibling[]
          | null;
        return raw ?? [];
      } catch {
        return [];
      }
    })(),
  ]);

  // 2. Replies on cross-posted sibling copies (other protocols via Postiz)
  const siblingReplies: ThreadReply[] = [];
  const foreignSiblings = siblings.filter(
    (s) => ALLOWED_PROTOCOLS.has(s.protocol) && `${s.protocol}:${s.nativeId}` !== canonicalId,
  );
  if (foreignSiblings.length > 0) {
    const batches = await Promise.all(
      foreignSiblings.map((s) => fetchNativeReplies(request, env, `${s.protocol}:${s.nativeId}`)),
    );
    for (const batch of batches) {
      for (const reply of batch) {
        const r = reply as ThreadReply;
        r.viaCrossPost = true;
        siblingReplies.push(r);
      }
    }
  }

  // 3. Merge + dedup (native version wins; bridge flags are preserved)
  const merged = new Map<string, ThreadReply>();
  for (const reply of [...nativeReplies, ...siblingReplies] as ThreadReply[]) {
    reply.dfUri = reply.dfUri ?? `df://${reply.id}`;
    reply.depth = reply.depth ?? 1;
    reply.parentUri = reply.parentUri ?? dfUri;
    merged.set(reply.id, reply);
  }
  for (const bridge of bridgeReplies) {
    const existing = merged.get(bridge.id);
    if (existing) {
      existing.bridged = true;
      existing.bridgeFrom = bridge.bridgeFrom;
    } else {
      merged.set(bridge.id, bridge);
    }
  }

  // 4. Apply nesting from the thread edge index
  try {
    const edges =
      ((await env.CACHE?.get(`bridge:reply:thread:${dfUri}`, 'json')) as ThreadEdge[] | null) ?? [];
    for (const edge of edges) {
      const edgeParsed = parseDfUri(edge.replyUri);
      if (!edgeParsed) continue;
      const target = merged.get(`${edgeParsed.protocol}:${edgeParsed.nativeId}`);
      if (target) {
        target.depth = Math.max(1, edge.depth);
        target.parentUri = edge.parentUri;
      }
    }
  } catch {
    /* nesting is best-effort */
  }

  const replies = sortReplies([...merged.values()], sort).slice(0, limit);

  // 5. Aggregate metadata
  const byProtocol: Record<string, number> = {};
  for (const r of replies) {
    byProtocol[r.protocol] = (byProtocol[r.protocol] ?? 0) + 1;
  }
  const protocols = [...new Set([protocol, ...replies.map((r) => r.protocol)])];
  const bridgeCount = replies.filter((r) => r.bridged).length;

  return noCacheJsonResponse({
    post,
    replies,
    protocols,
    bridgeCount,
    byProtocol,
    sort,
    dfUri,
  });
}
