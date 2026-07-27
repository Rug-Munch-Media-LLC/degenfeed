import { checkPublishRateLimit } from '../lib/community-store';
import { requirePremiumTier } from '../premium';
import { jsonResponse } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isAllowedProtocol,
  sanitizeString,
  sanitizeStringArray,
} from '../sanitize';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../session';
import type { Env } from '../types';

// ─── RSS-to-Nostr bridge ─────────────────────────────────────────────
// (unchanged — see bottom of file)

const _MAX_BRIDGE_PER_HOUR = 3;

// ─── URL scanner (RMI Backend integration) ──────────────────────────
// Scans URLs in publish content against rmi-backend's security data to
// block known scam/phishing links before they reach any protocol.
// Non-blocking on failure — if rmi-backend is unreachable, posts go through.

const URL_REGEX =
  /https?:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9](?:\/[^\s"<>{}|\\^`[\]]*)?/gi;

/**
 * Extract all URLs from a text string.
 */
function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Scan a list of URLs against rmi-backend's DataBus token_security endpoint.
 *
 * Returns flagged URLs (risk_score > 50) or null if the backend is unreachable.
 * Fire-and-forget friendly: never throws — always returns a clean result.
 */
async function scanUrlsAgainstRmiBackend(
  urls: string[],
  env: Env,
): Promise<{ flagged: string[]; error?: string }> {
  const { rmiUrl } = await import('@degenfeed/utils');

  const flagged: string[] = [];

  for (const url of urls) {
    try {
      const scanUrl = `${rmiUrl(env)}/api/v1/databus/fetch/token_security?url=${encodeURIComponent(url)}`;
      const resp = await fetch(scanUrl, {
        signal: AbortSignal.timeout(5_000),
        headers: { accept: 'application/json' },
      });

      if (!resp.ok) {
        // Backend returned an error for this URL — log but don't block
        console.warn(`[urlscan] rmi-backend returned ${resp.status} for ${url.slice(0, 60)}`);
        continue;
      }

      const result = (await resp.json()) as { risk_score?: number; data?: { risk_score?: number } };
      const riskScore = result.risk_score ?? result.data?.risk_score ?? 0;

      if (riskScore > 50) {
        flagged.push(url);
      }
    } catch {
      // rmi-backend unreachable — non-blocking, allow the post
      console.warn(`[urlscan] rmi-backend unreachable, skipping scan for ${url.slice(0, 60)}`);
    }
  }

  return { flagged };
}

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
  'lemmy',
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
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

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

    // ── Scan URLs against rmi-backend scam database ────────────────
    // Before publishing, check if any URLs in the post content are known
    // scams. Non-blocking: if rmi-backend is down, the post goes through.
    // This protects users from phishing links shared on the platform.
    const urlsInContent = extractUrls(text);
    if (urlsInContent.length > 0) {
      const scanResult = await scanUrlsAgainstRmiBackend(urlsInContent, env);
      if (scanResult.flagged.length > 0) {
        return jsonResponse(
          {
            error: 'One or more URLs in your post appear to be known scams',
            flagged_urls: scanResult.flagged,
            code: 'SCAM_URL_DETECTED',
          },
          400,
        );
      }
    }

    // ── Premium gate: Postiz publishing requires Pro+ ──────────────
    if (env.POSTIZ_BASE_URL && env.POSTIZ_API_KEY) {
      // Extract session to check premium
      const session = await requireSession(request, env);
      if (session instanceof Response) return session;

      const cookieVal = parseSessionCookie(request.headers.get('cookie'));
      const csrfToken = request.headers.get('X-CSRF-Token');
      if (cookieVal) {
        const csrfOk = await validateCsrfToken(cookieVal, csrfToken, env);
        if (!csrfOk) return jsonResponse({ error: 'Invalid CSRF token' }, 403);
      }

      const canPublish = await checkPublishRateLimit(env, session.address);
      if (!canPublish) {
        return jsonResponse({ error: 'Rate limited. Max 30 publishes per minute.' }, 429);
      }

      const gate = await requirePremiumTier(session.address, env, 'pro');
      if (gate) return gate;

      const postizResults = await tryPostizPublish(text, targets, env);
      if (postizResults) {
        await recordCrosspostSiblings(env, postizResults);
        const resp = jsonResponse({ results: postizResults, via: 'postiz' });
        resp.headers.set('X-Postiz-Used', 'true');
        return resp;
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
  results: Record<string, { success?: boolean; error?: string; hash?: string }>,
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
): Promise<Record<string, { success?: boolean; error?: string; hash?: string }> | null> {
  // Separate Postiz-capable targets from the rest
  const postizTargets = targets.filter((t) => POSTIZ_PLATFORMS.has(t));
  const fallbackTargets = targets.filter((t) => !POSTIZ_PLATFORMS.has(t));

  // Build fallback function for platforms Postiz doesn't support
  const _fallbackFn = async (platform: string) => {
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

  const results: Record<string, { success?: boolean; error?: string; hash?: string }> = {};

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
            value: [
              {
                content: text,
                image: [] as Array<{ id: string; path: string }>,
              },
            ],
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
        const _data = (await res.json()) as { postId?: string };
        results[target] = {
          success: true,
        };
      } else {
        const errText = await res.text().catch(() => '');
        results[target] = {
          error: `Postiz error: ${errText.slice(0, 200)}`,
        };
      }
    } catch (e) {
      results[target] = {
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
): Promise<Record<string, { success?: boolean; error?: string; hash?: string }>> {
  const results: Record<string, { success?: boolean; error?: string; hash?: string }> = {};

  for (const target of targets) {
    try {
      const result = await perProtocolPublishSingle(target, text, auth, env, body);
      results[target] = result;
    } catch (e) {
      results[target] = { error: String(e) };
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
): Promise<{
  success?: boolean;
  error?: string;
  hash?: string;
  via?: string;
  note?: string;
}> {
  switch (target) {
    case 'nostr': {
      return {
        error:
          'Server-side Nostr signing is deprecated. Sign your event client-side using @degenfeed/nostr-sdk.',
      };
    }

    case 'farcaster': {
      const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
      const signedMessage = body?.signedMessage || auth.farcaster_message;
      if (signedMessage) {
        let messageBody: BodyInit = signedMessage;
        const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          }
          messageBody = bytes;
        }
        const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream' },
          body: messageBody,
        });
        if (submitRes.ok) {
          const submitData = (await submitRes.json()) as Record<string, unknown>;
          return {
            success: true,
            hash: String(submitData.hash || '') || undefined,
          };
        }
        const errText = await submitRes.text();
        return { error: `Farcaster Hub rejected: ${errText.slice(0, 100)}` };
      }
      return {
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
            success: !!result?.txHash,
            hash: result?.txHash as string | undefined,
            error: result?.reason as string | undefined,
          };
        }
        const errText = await broadcastRes.text();
        return { error: `Lens broadcast failed: ${errText.slice(0, 100)}` };
      }
      return {
        error:
          'Client must sign typed data using wallet, then submit typedDataId + signature in publish request.',
      };
    }

    case 'bluesky': {
      const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
      const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
      if (!accessJwt) {
        return { error: 'Not signed into Bluesky' };
      }
      const repoDid = auth.bluesky_did || '';
      if (!repoDid) {
        return { error: 'Bluesky DID missing — pass auth.bluesky_did' };
      }
      const record = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      };
      const recordRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessJwt}`,
        },
        body: JSON.stringify({
          repo: repoDid,
          collection: 'app.bsky.feed.post',
          record,
        }),
      });
      if (recordRes.ok) {
        return { success: true };
      }
      const errText = await recordRes.text();
      return { error: `Bluesky publish failed: ${errText.slice(0, 100)}` };
    }

    case 'threads': {
      // Path 1: Meta Graph API (authenticated user with Meta OAuth)
      const accessToken = auth.threads_jwt || auth.threads_accessToken || auth.accessJwt;
      const threadsUserId = auth.threads_userId || auth.threads_did || '';
      if (accessToken && threadsUserId) {
        const threadsRes = await fetch(
          `https://graph.threads.net/v1.0/${threadsUserId}/threads?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text,
              media_type: 'TEXT',
            }),
          },
        );
        if (threadsRes.ok) {
          return { success: true, via: 'meta-api' };
        }
        const errText = await threadsRes.text();
        return {
          error: `Threads publish (Meta API) failed: ${errText.slice(0, 100)}`,
        };
      }

      // Path 2: ActivityPub bridge — publish to our GotoSocial instance
      // with #threads tag. This gets federated to Threads via ActivityPub
      // when our instance follows Threads accounts.
      const mastodonToken = auth.mastodon;
      if (mastodonToken) {
        const { GtSClient } = await import('@degenfeed/mastodon-sdk');
        const client = new GtSClient('https://social.degenfeed.xyz', mastodonToken);
        const taggedText = `${text}\n\n#threads`;
        await client.publish(taggedText, { visibility: 'public' });
        return {
          success: true,
          via: 'activitypub-bridge',
          note: 'Published to Mastodon with #threads tag — federates to Threads via ActivityPub',
        };
      }

      return {
        error:
          'Not signed into Threads. Use Meta OAuth (auth.threads_jwt + auth.threads_userId) or Mastodon token (auth.mastodon) for ActivityPub bridge.',
      };
    }

    case 'mastodon': {
      const { GtSClient } = await import('@degenfeed/mastodon-sdk');
      const instance = auth.mastodon_instance || 'https://social.degenfeed.xyz';
      const accessToken = auth.mastodon;
      if (!accessToken) {
        return { error: 'Not signed into Mastodon' };
      }
      const client = new GtSClient(instance, accessToken);
      await client.publish(text, { visibility: 'public' });
      return { success: true };
    }

    case 'lemmy': {
      const instance = auth.lemmy_instance || 'https://community.degenfeed.xyz';
      const token = auth.lemmy || auth.authToken;
      if (!token) {
        return { error: 'Not signed into Lemmy' };
      }
      const communityId = auth.lemmy_community || 1;
      await fetch(`${instance}/api/v3/post`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          community_id: Number(communityId),
          name: text.slice(0, 200),
          body: text,
        }),
      });
      return { success: true };
    }

    case 'reddit': {
      return {
        error:
          'Reddit publishing requires OAuth2. Use the official Reddit API client or Postiz integration.',
      };
    }

    case 'rss': {
      return {
        error: 'RSS is a read-only protocol. To publish RSS content, use the RSS-to-Nostr bridge.',
      };
    }

    case 'peertube': {
      const instance = auth.peertube_instance || 'https://video.degenfeed.xyz';
      const accessToken = auth.peertube || auth.authToken;
      if (!accessToken) {
        return { error: 'Not signed into PeerTube' };
      }
      const channelId = auth.peertube_channel || auth.peertube_channelId || 1;
      const title = text.slice(0, 200);
      await fetch(`${instance}/api/v1/videos/upload`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          channelId: Number(channelId),
          name: title,
          description: text,
          privacy: 1, // Public
        }),
      });
      return { success: true };
    }

    default:
      return { error: `${target} not supported` };
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

    const results: Array<{ title: string; success?: boolean; error?: string }> = [];
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
        results.push({ title: post.text.slice(0, 50), success: true });
      } catch (e) {
        results.push({ title: post.text.slice(0, 50), error: String(e) });
      }
    }
    pool.disconnectAll();

    return jsonResponse({
      results,
      total: posts.length,
      bridged: results.length,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cross-Publish API — One-Click Multi-Protocol Publishing
// ═══════════════════════════════════════════════════════════════════════════

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import { adaptForProtocols, previewForProtocols } from '@degenfeed/cross-protocol-bridge';
import { methodNotAllowed } from '../response-helpers';
// hasSuspiciousPayload already imported at top of file

/**
 * POST /api/publish/all
 *
 * Publish a MasterPost to ALL connected protocols for the user.
 * Body: { masterPost: MasterPost, auth?: Record<string, string> }
 */
export async function handlePublishAll(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      masterPost?: MasterPost;
      protocols?: string[];
      auth?: Record<string, string>;
    };

    const masterPost = body.masterPost;
    if (!masterPost?.text || hasSuspiciousPayload(masterPost.text)) {
      return jsonResponse({ error: 'Invalid or suspicious post text' }, 400);
    }

    // ── Scan URLs against rmi-backend scam database ────────────────
    const urlsInContent = extractUrls(masterPost.text);
    if (urlsInContent.length > 0) {
      const scanResult = await scanUrlsAgainstRmiBackend(urlsInContent, env);
      if (scanResult.flagged.length > 0) {
        return jsonResponse(
          {
            error: 'One or more URLs in your post appear to be known scams',
            flagged_urls: scanResult.flagged,
            code: 'SCAM_URL_DETECTED',
          },
          400,
        );
      }
    }

    const auth = body.auth ?? {};

    // Determine protocols: either specified or all connected
    const protocols = body.protocols ?? ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens'];

    // Execute cross-publish
    const { executeCrossPublish } = await import('../lib/cross-publish-orchestrator');
    const report = await executeCrossPublish(
      { masterPost, protocols: protocols as Protocol[], auth },
      env,
    );

    return jsonResponse(report);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/publish/selected
 *
 * Publish to selected protocols with preview returned before actual publish.
 * Body: { masterPost: MasterPost, protocols: string[], dryRun?: boolean }
 */
export async function handlePublishSelected(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      masterPost?: MasterPost;
      protocols?: string[];
      auth?: Record<string, string>;
      dryRun?: boolean;
      signedMessage?: string;
      typedDataId?: string;
      signature?: string;
    };

    const masterPost = body.masterPost;
    if (!masterPost?.text || hasSuspiciousPayload(masterPost.text)) {
      return jsonResponse({ error: 'Invalid or suspicious post text' }, 400);
    }

    // ── Scan URLs against rmi-backend scam database ────────────────
    const urlsInContent = extractUrls(masterPost.text);
    if (urlsInContent.length > 0) {
      const scanResult = await scanUrlsAgainstRmiBackend(urlsInContent, env);
      if (scanResult.flagged.length > 0) {
        return jsonResponse(
          {
            error: 'One or more URLs in your post appear to be known scams',
            flagged_urls: scanResult.flagged,
            code: 'SCAM_URL_DETECTED',
          },
          400,
        );
      }
    }

    const protocols = body.protocols ?? [];
    if (protocols.length === 0) {
      return jsonResponse({ error: 'At least one protocol required' }, 400);
    }

    // If dry run, return previews only
    if (body.dryRun) {
      const previews = previewForProtocols(masterPost, protocols);
      const adapted = adaptForProtocols(masterPost, protocols);

      return jsonResponse({
        previews,
        adapted: Object.fromEntries(
          Object.entries(adapted).map(([proto, result]) => [
            proto,
            'error' in result
              ? { error: result.error }
              : {
                  charCount: result.params.text.length,
                  hasMedia: (result.params.mediaUrls?.length ?? 0) > 0,
                  supportsRichText: result.params.supportsRichText,
                },
          ]),
        ),
        dryRun: true,
      });
    }

    // Execute publish
    const { executeCrossPublish } = await import('../lib/cross-publish-orchestrator');
    const report = await executeCrossPublish(
      {
        masterPost,
        protocols: protocols as Protocol[],
        auth: body.auth,
        signedMessage: body.signedMessage,
        typedDataId: body.typedDataId,
        signature: body.signature,
      },
      env,
    );

    return jsonResponse(report);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/publish/preview
 *
 * Preview how a post looks on each protocol without publishing.
 * Query params: text, protocols (comma-separated), title, hashtags (comma-separated)
 */
export async function handlePreviewPost(request: Request, _env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const url = new URL(request.url);
    const text = url.searchParams.get('text') ?? '';
    const protocols = (url.searchParams.get('protocols') ?? 'nostr,farcaster,bluesky').split(',');
    const title = url.searchParams.get('title') ?? undefined;
    const hashtags = (url.searchParams.get('hashtags') ?? '').split(',').filter(Boolean);
    const linkCardUrl = url.searchParams.get('linkUrl') ?? undefined;

    if (!text || hasSuspiciousPayload(text)) {
      return jsonResponse({ error: 'Invalid text' }, 400);
    }

    const masterPost: MasterPost = {
      text,
      title,
      hashtags,
      linkCard: linkCardUrl ? { url: linkCardUrl } : undefined,
    };

    const previews = previewForProtocols(masterPost, protocols);
    const adapted = adaptForProtocols(masterPost, protocols);

    return jsonResponse({
      previews,
      details: Object.fromEntries(
        Object.entries(adapted).map(([proto, result]) => [
          proto,
          'error' in result
            ? { error: result.error }
            : {
                charCount: result.params.text.length,
                charLimit: result.adapter.charLimit,
                charRemaining: result.adapter.charLimit - result.params.text.length,
                supportsRichText: result.params.supportsRichText,
                mediaAttached: (result.params.mediaUrls?.length ?? 0) > 0,
              },
        ]),
      ),
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/publish/schedule
 *
 * Schedule a cross-post for later publication.
 * Body: { masterPost: MasterPost, protocols: string[], scheduleAt: string (ISO), auth? }
 */
export async function handleScheduleCrossPost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      masterPost?: MasterPost;
      protocols?: string[];
      scheduleAt?: string;
      auth?: Record<string, string>;
    };

    const masterPost = body.masterPost;
    if (!masterPost?.text || hasSuspiciousPayload(masterPost.text)) {
      return jsonResponse({ error: 'Invalid or suspicious post text' }, 400);
    }

    // ── Scan URLs against rmi-backend scam database ────────────────
    const urlsInContent = extractUrls(masterPost.text);
    if (urlsInContent.length > 0) {
      const scanResult = await scanUrlsAgainstRmiBackend(urlsInContent, env);
      if (scanResult.flagged.length > 0) {
        return jsonResponse(
          {
            error: 'One or more URLs in your post appear to be known scams',
            flagged_urls: scanResult.flagged,
            code: 'SCAM_URL_DETECTED',
          },
          400,
        );
      }
    }

    const protocols = body.protocols ?? [];
    if (protocols.length === 0) {
      return jsonResponse({ error: 'At least one protocol required' }, 400);
    }

    const scheduleAt = body.scheduleAt;
    if (!scheduleAt) {
      return jsonResponse({ error: 'scheduleAt (ISO date string) is required' }, 400);
    }

    const scheduleTime = new Date(scheduleAt).getTime();
    if (Number.isNaN(scheduleTime)) {
      return jsonResponse({ error: 'Invalid scheduleAt date' }, 400);
    }

    // Store in KV for the scheduled executor to pick up
    const batchId = `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const scheduledEntry = {
      batchId,
      masterPost,
      protocols: protocols as Protocol[],
      auth: body.auth ?? {},
      scheduleAt: scheduleTime,
      createdAt: Date.now(),
    };

    if (env.CACHE) {
      await env.CACHE.put(
        `scheduled:crosspost:${batchId}`,
        JSON.stringify(scheduledEntry),
        { expirationTtl: 86400 * 30 }, // 30 days
      );
    }

    return jsonResponse({
      ok: true,
      batchId,
      scheduledAt: new Date(scheduleTime).toISOString(),
      message: `Post scheduled for ${new Date(scheduleTime).toLocaleString()}`,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/publish/scheduled
 *
 * List scheduled cross-posts.
 */
export async function handleListScheduledCrossPosts(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    if (!env.CACHE) {
      return jsonResponse({ scheduled: [] });
    }

    const scheduled: Array<{
      batchId: string;
      masterPost: { text: string; title?: string };
      protocols: string[];
      scheduleAt: number;
    }> = [];

    let cursor: string | undefined;
    do {
      const page: { keys: { name: string }[]; list_complete: boolean; cursor?: string } =
        await env.CACHE.list({ prefix: 'scheduled:crosspost:', cursor, limit: 100 });
      for (const key of page.keys) {
        const entry = await env.CACHE.get(key.name, 'json');
        if (entry) scheduled.push(entry as (typeof scheduled)[0]);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    // Sort by schedule time ascending
    scheduled.sort((a, b) => a.scheduleAt - b.scheduleAt);

    return jsonResponse({
      scheduled: scheduled.map((s) => ({
        batchId: s.batchId,
        text: s.masterPost.text.slice(0, 200),
        title: s.masterPost.title,
        protocols: s.protocols,
        scheduledAt: new Date(s.scheduleAt).toISOString(),
      })),
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * DELETE /api/publish/scheduled/:id
 *
 * Cancel a scheduled cross-post.
 */
export async function handleDeleteScheduledCrossPost(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id) {
      return jsonResponse({ error: 'Missing scheduled post ID' }, 400);
    }

    if (env.CACHE) {
      await env.CACHE.delete(`scheduled:crosspost:${id}`);
    }

    return jsonResponse({ ok: true, deletedId: id });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Scheduled Post Executor (called by cron) ────────────────────────────

/**
 * Execute all due scheduled cross-posts. Called by cron every minute.
 */
export async function executeDueScheduledCrossPosts(env: Env): Promise<number> {
  if (!env.CACHE) return 0;

  const now = Date.now();
  let executed = 0;

  let cursor: string | undefined;
  do {
    const page: { keys: { name: string }[]; list_complete: boolean; cursor?: string } =
      await env.CACHE.list({ prefix: 'scheduled:crosspost:', cursor, limit: 100 });

    for (const key of page.keys) {
      try {
        const raw = await env.CACHE.get(key.name, 'json');
        if (!raw) continue;

        const entry = raw as {
          batchId: string;
          masterPost: MasterPost;
          protocols: Protocol[];
          auth: Record<string, string>;
          scheduleAt: number;
        };

        // Skip future posts
        if (entry.scheduleAt > now) continue;

        // Execute the publish
        const { executeCrossPublish } = await import('../lib/cross-publish-orchestrator');
        await executeCrossPublish(
          {
            masterPost: entry.masterPost,
            protocols: entry.protocols,
            auth: entry.auth,
          },
          env,
        );

        // Remove the scheduled entry
        await env.CACHE.delete(key.name);
        executed++;
      } catch (err) {
        console.error(`[scheduled-executor] Failed to execute ${key.name}:`, err);
      }
    }

    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return executed;
}
