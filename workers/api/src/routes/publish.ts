import { type Env, jsonResponse } from '../index';
import {
  hasSuspiciousPayload,
  isAllowedProtocol,
  sanitizeString,
  sanitizeStringArray,
} from '../sanitize';

// ─── RSS-to-Nostr bridge ─────────────────────────────────────────────
// (unchanged — see bottom of file)

const _MAX_BRIDGE_PER_HOUR = 3;

/**
 * Map our Protocol types to Postiz platform names.
 * Only platforms that Postiz supports natively go here.
 * The rest (rss, lemmy, reddit, ponder, solana, ethereum) still use
 * the per-protocol fallback.
 */
const POSTIZ_PLATFORMS = new Set([
  'mastodon',
  'bluesky',
  'threads',
  'nostr',
  'farcaster',
  'lens',
  'reddit',
]);

/**
 * Main publish handler.
 *
 * Flow:
 *   1. Validate input
 *   2. If Postiz is configured → route through PostizConnector (with fallback)
 *   3. Otherwise → use existing per-protocol logic
 */
export async function handlePublish(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    interface PublishRequest {
      text?: string;
      targets?: string[];
      auth?: Record<string, string>;
      signedMessage?: string;
      typedDataId?: string;
      signature?: string;
    }

    const body: PublishRequest = (await request.json()) as PublishRequest;
    const text = sanitizeString(body.text, 10000);
    const targets = sanitizeStringArray(body.targets, 64).filter(isAllowedProtocol);
    const auth = body.auth ?? ({} as Record<string, string>);

    if (!text || hasSuspiciousPayload(text)) {
      return jsonResponse({ error: 'Invalid text' }, 400);
    }
    if (targets.length === 0) {
      return jsonResponse({ error: 'Invalid targets' }, 400);
    }

    // ── Try Postiz first if configured ─────────────────────────────
    if (env.POSTIZ_BASE_URL && env.POSTIZ_API_KEY) {
      const postizResults = await tryPostizPublish(text, targets, env);
      if (postizResults) {
        await recordCrosspostSiblings(env, postizResults);
        return jsonResponse({ results: postizResults, via: 'postiz' });
      }
      // Postiz returned null → fall through to per-protocol logic
    }

    // ── Per-protocol fallback ──────────────────────────────────────
    const results = await perProtocolPublish(text, targets, auth, body, env);
    await recordCrosspostSiblings(env, results);
    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Postiz publish attempt ───────────────────────────────────────────

/**
 * Best-effort: persist the sibling map for multi-target publishes so the
 * unified thread view (/api/thread/:dfUri) can gather replies from every
 * protocol the post was cross-posted to. Never blocks the publish result.
 */
async function recordCrosspostSiblings(
  env: Env,
  results: Record<string, { ok: boolean; error?: string; hash?: string }>,
): Promise<void> {
  try {
    const { storeCrosspostSiblings } = await import('./thread');
    await storeCrosspostSiblings(env, results);
  } catch (e) {
    console.error('[publish] Failed to record crosspost siblings:', e);
  }
}

/**
 * Try to publish via Postiz. Returns results map if Postiz handled
 * at least some platforms, or null if Postiz is unreachable
 * (triggering full fallback).
 */
async function tryPostizPublish(
  text: string,
  targets: string[],
  env: Env,
): Promise<Record<string, { ok: boolean; error?: string; hash?: string }> | null> {
  // Separate Postiz-capable targets from the rest
  const postizTargets = targets.filter((t) => POSTIZ_PLATFORMS.has(t));
  const fallbackTargets = targets.filter((t) => !POSTIZ_PLATFORMS.has(t));

  // Build fallback function for platforms Postiz doesn't support
  const fallbackFn = async (platform: string) => {
    return perProtocolPublishSingle(platform, text, {}, env);
  };

  // Build integration ID map from env
  let integrationIds: Record<string, string> = {};
  try {
    if (env.POSTIZ_INTEGRATIONS) {
      integrationIds = JSON.parse(env.POSTIZ_INTEGRATIONS) as Record<string, string>;
    }
  } catch {
    // Malformed JSON — start empty
  }

  // Check if Postiz is alive
  try {
    const healthRes = await fetch(`${env.POSTIZ_BASE_URL}/public/v1/posts`, {
      method: 'GET',
      headers: {
        Authorization: env.POSTIZ_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (healthRes.status >= 500) {
      return null; // Postiz server error — full fallback
    }
  } catch {
    return null; // Postiz unreachable — full fallback
  }

  const results: Record<string, { ok: boolean; error?: string; hash?: string }> = {};

  // Handle Postiz-capable platforms
  for (const target of postizTargets) {
    const integrationId = integrationIds[target];
    if (!integrationId) {
      // No integration configured for this platform — skip Postiz
      // The fallback loop below will handle it... but to avoid double-processing,
      // we push it to fallbackTargets
      fallbackTargets.push(target);
      continue;
    }

    // Map our platform name to Postiz __type
    const postizType = target === 'farcaster' ? 'warpcast' : target;

    try {
      const postBody = {
        type: 'now' as const,
        date: new Date().toISOString(),
        shortLink: false,
        tags: [] as string[],
        posts: [
          {
            integration: { id: integrationId },
            value: [{ content: text, image: [] as Array<{ id: string; path: string }> }],
            settings: { __type: postizType },
          },
        ],
      };

      const res = await fetch(`${env.POSTIZ_BASE_URL}/public/v1/posts`, {
        method: 'POST',
        headers: {
          Authorization: env.POSTIZ_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const data = (await res.json()) as { postId?: string };
        results[target] = {
          ok: true,
          hash: data.postId,
        };
      } else {
        const errText = await res.text().catch(() => '');
        results[target] = {
          ok: false,
          error: `Postiz error: ${errText.slice(0, 200)}`,
        };
      }
    } catch (e) {
      results[target] = {
        ok: false,
        error: `Postiz error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Handle remaining targets via per-protocol fallback
  for (const target of fallbackTargets) {
    try {
      const result = await perProtocolPublishSingle(target, text, {}, env);
      results[target] = result;
    } catch (e) {
      results[target] = {
        ok: false,
        error: String(e),
      };
    }
  }

  return results;
}

// ─── Per-protocol fallback logic (extracted from original) ────────────

async function perProtocolPublish(
  text: string,
  targets: string[],
  auth: Record<string, string>,
  body: PublishRequestBody,
  env: Env,
): Promise<Record<string, { ok: boolean; error?: string; hash?: string }>> {
  const results: Record<string, { ok: boolean; error?: string; hash?: string }> = {};

  for (const target of targets) {
    try {
      const result = await perProtocolPublishSingle(target, text, auth, env, body);
      results[target] = result;
    } catch (e) {
      results[target] = { ok: false, error: String(e) };
    }
  }

  return results;
}

interface PublishRequestBody {
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
}

async function perProtocolPublishSingle(
  target: string,
  text: string,
  auth: Record<string, string>,
  env: Env,
  body?: PublishRequestBody,
): Promise<{ ok: boolean; error?: string; hash?: string }> {
  switch (target) {
    case 'nostr': {
      return {
        ok: false,
        error:
          'Server-side Nostr signing is deprecated. Sign your event client-side using @degenfeed/nostr-sdk.',
      };
    }

    case 'farcaster': {
      const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
      const signedMessage = body?.signedMessage || auth.farcaster_message;
      if (signedMessage) {
        const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream' },
          body: signedMessage,
        });
        if (submitRes.ok) {
          const submitData = (await submitRes.json()) as Record<string, unknown>;
          return { ok: true, hash: String(submitData.hash || '') || undefined };
        }
        const errText = await submitRes.text();
        return { ok: false, error: `Farcaster Hub rejected: ${errText.slice(0, 100)}` };
      }
      return {
        ok: false,
        error:
          'Client must sign cast using @farcaster/hub-web, then submit signedMessage in publish request.',
      };
    }

    case 'lens': {
      const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
      const typedDataId = body?.typedDataId || auth.lens_typedDataId;
      const signature = body?.signature || auth.lens_signature;
      if (typedDataId && signature) {
        const broadcastRes = await fetch(lensApi, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query:
              'mutation Broadcast($request: BroadcastRequest!) { broadcast(request: $request) { ... on RelayerResult { txHash } ... on RelayError { reason } } }',
            variables: { request: { id: typedDataId, signature } },
          }),
        });
        if (broadcastRes.ok) {
          const broadcastData = (await broadcastRes.json()) as Record<string, unknown>;
          const result = (broadcastData.data as Record<string, unknown>)?.broadcast as
            | Record<string, unknown>
            | undefined;
          return {
            ok: !!result?.txHash,
            hash: result?.txHash as string | undefined,
            error: result?.reason as string | undefined,
          };
        }
        const errText = await broadcastRes.text();
        return { ok: false, error: `Lens broadcast failed: ${errText.slice(0, 100)}` };
      }
      return {
        ok: false,
        error:
          'Client must sign typed data using wallet, then submit typedDataId + signature in publish request.',
      };
    }

    case 'bluesky':
    case 'threads': {
      const pdsUrl =
        target === 'bluesky'
          ? env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app'
          : env.THREADS_PDS_URL || 'https://public.threads.net';
      const accessJwt = auth[`${target}_jwt`] || auth[`${target}_accessJwt`] || auth.accessJwt;
      if (!accessJwt) {
        return { ok: false, error: `Not signed into ${target}` };
      }
      const repoDid = auth[`${target}_did`] || '';
      const recordRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` },
        body: JSON.stringify({
          repo: repoDid,
          collection: 'app.bsky.feed.post',
          record: { text, createdAt: new Date().toISOString() },
        }),
      });
      if (recordRes.ok) {
        return { ok: true };
      }
      const errText = await recordRes.text();
      return { ok: false, error: `${target} publish failed: ${errText.slice(0, 100)}` };
    }

    case 'mastodon': {
      const { GtSClient } = await import('@degenfeed/mastodon-sdk');
      const instance = auth.mastodon_instance || 'https://social.degenfeed.xyz';
      const accessToken = auth.mastodon;
      if (!accessToken) {
        return { ok: false, error: 'Not signed into Mastodon' };
      }
      const client = new GtSClient(instance, accessToken);
      await client.publish(text, { visibility: 'public' });
      return { ok: true };
    }

    default:
      return { ok: false, error: `${target} not supported` };
  }
}

// ─── RSS-to-Nostr bridge (unchanged) ──────────────────────────────────

export async function handleRssToNostrBridge(request: Request, _env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, string>;
    const feedUrl = body.feedUrl;
    const nsec = body.nsec;
    if (!feedUrl || !nsec) {
      return jsonResponse({ error: 'feedUrl and nsec are required' }, 400);
    }
    if (!/^nsec1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(nsec.trim())) {
      return jsonResponse({ error: 'Invalid nsec format' }, 400);
    }

    const { GenericRssSource, feedToUnifiedPosts } = await import('@degenfeed/rss-sdk');
    const src = await GenericRssSource.fetch(feedUrl);
    const posts = feedToUnifiedPosts(src);
    if (posts.length === 0) return jsonResponse({ error: 'No items in feed' }, 400);

    const nostr = await import('@degenfeed/nostr-sdk');
    const pk = nostr.getPublicKey(nsec);
    const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
      eoseTimeout: 3000,
    });

    const results: Array<{ title: string; ok: boolean; error?: string }> = [];
    const maxItems = Math.min(posts.length, 5);

    for (const post of posts.slice(0, maxItems)) {
      try {
        const linkUrl = post.embeds.find((e) => e.kind === 'link');
        const text = `${post.protocol}: ${post.text.slice(0, 200)}${linkUrl ? `\n\n${linkUrl.url}` : ''}`;
        const ev = nostr.createTextNote(text, nsec, []);
        ev.pubkey = pk;
        ev.id = nostr.getEventHash(ev);
        nostr.signEvent(ev, nsec);
        await pool.publish(ev);
        results.push({ title: post.text.slice(0, 50), ok: true });
      } catch (e) {
        results.push({ title: post.text.slice(0, 50), ok: false, error: String(e) });
      }
    }
    pool.disconnectAll();

    return jsonResponse({ results, total: posts.length, bridged: results.length });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
