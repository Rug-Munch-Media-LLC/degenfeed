/**
 * @degenfeed/api-worker — Protocol Content Visibility Verification
 *
 * Verifies that content posted to a protocol is visible:
 *   1. On the protocol's native feed
 *   2. In DegenFeed's main unified feed
 *   3. In DegenFeed's per-protocol feed
 *   4. Via search
 *   5. To other users on the protocol (not on DegenFeed)
 *
 * Routes:
 *   POST /api/protocol/verify/post   — Verify a specific post's visibility
 *   GET  /api/protocol/verify/health  — Overall verification system health
 */

import { log } from '../index';
import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── POST /api/protocol/verify/post ────────────────────────────────────

export async function handleVerifyPost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    protocol?: string;
    nativeId?: string;
    instanceUrl?: string;
    text?: string;
    authorHandle?: string;
  };
  try {
    body = (await request.json()) as {
      protocol?: string;
      nativeId?: string;
      instanceUrl?: string;
      text?: string;
      authorHandle?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { protocol, nativeId, instanceUrl, text, authorHandle } = body;
  if (!protocol || !nativeId) {
    return jsonResponse({ error: 'protocol and nativeId are required' }, 400);
  }

  const checks: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    detail: string;
  }> = [];

  // Check 1: Content appears on protocol's native feed
  try {
    const nativeCheck = await checkNativeFeed(protocol, nativeId, instanceUrl, env);
    checks.push(nativeCheck);
  } catch (err) {
    checks.push({
      name: 'Native feed visibility',
      status: 'failed',
      detail: `Error checking native feed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check 2: Content appears in DegenFeed's main unified feed
  try {
    const dfMainCheck = await checkDegenFeedMain(protocol, nativeId, text, env);
    checks.push(dfMainCheck);
  } catch (err) {
    checks.push({
      name: 'DegenFeed main feed visibility',
      status: 'failed',
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check 3: Content appears in DegenFeed's per-protocol feed
  try {
    const dfProtocolCheck = await checkDegenFeedProtocol(protocol, nativeId, text, env);
    checks.push(dfProtocolCheck);
  } catch (err) {
    checks.push({
      name: 'DegenFeed per-protocol feed visibility',
      status: 'failed',
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check 4: Content is discoverable via search
  try {
    const searchCheck = await checkSearch(protocol, nativeId, text, env);
    checks.push(searchCheck);
  } catch (err) {
    checks.push({
      name: 'Search discoverability',
      status: 'failed',
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check 5: Other users on the protocol can see it
  if (authorHandle) {
    try {
      const externalCheck = await checkExternalVisibility(
        protocol,
        nativeId,
        authorHandle,
        instanceUrl,
        env,
      );
      checks.push(externalCheck);
    } catch (err) {
      checks.push({
        name: 'External protocol user visibility',
        status: 'failed',
        detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  } else {
    checks.push({
      name: 'External protocol user visibility',
      status: 'skipped',
      detail: 'authorHandle not provided — external user check skipped',
    });
  }

  const allPassed = checks.every((c) => c.status === 'passed');
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'passed').length,
    failed: checks.filter((c) => c.status === 'failed').length,
    skipped: checks.filter((c) => c.status === 'skipped').length,
  };

  log('info', 'Post visibility verification', {
    protocol,
    nativeId,
    passed: summary.passed,
    failed: summary.failed,
  });

  return jsonResponse({
    data: {
      protocol,
      nativeId,
      verified: allPassed,
      checks,
      summary,
      verifiedAt: Date.now(),
    },
  });
}

// ─── Verification Checks ───────────────────────────────────────────────

/**
 * Check 1: Verify content exists on the protocol's native API.
 */
async function checkNativeFeed(
  protocol: string,
  nativeId: string,
  instanceUrl?: string,
  _env?: Env,
): Promise<{ name: string; status: 'passed' | 'failed'; detail: string }> {
  try {
    switch (protocol) {
      case 'mastodon': {
        const instance = instanceUrl || 'https://social.degenfeed.xyz';
        const res = await fetch(`${instance}/api/v1/statuses/${nativeId}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = (await res.json()) as { id: string; content?: string };
          return {
            name: 'Native feed visibility (Mastodon API)',
            status: 'passed',
            detail: `Status ${data.id} found on ${instance}`,
          };
        }
        return {
          name: 'Native feed visibility (Mastodon API)',
          status: 'failed',
          detail: `Status ${nativeId} not found on ${instance} (HTTP ${res.status})`,
        };
      }

      case 'peertube': {
        const instance = instanceUrl || 'https://video.degenfeed.xyz';
        const res = await fetch(`${instance}/api/v1/videos/${nativeId}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          return {
            name: 'Native feed visibility (PeerTube API)',
            status: 'passed',
            detail: `Video ${nativeId} found on ${instance}`,
          };
        }
        return {
          name: 'Native feed visibility (PeerTube API)',
          status: 'failed',
          detail: `Video ${nativeId} not found (HTTP ${res.status})`,
        };
      }

      case 'lemmy': {
        const instance = instanceUrl || 'https://community.degenfeed.xyz';
        const res = await fetch(`${instance}/api/v3/post?id=${Number(nativeId) || nativeId}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = (await res.json()) as { post_view?: unknown };
          if (data.post_view) {
            return {
              name: 'Native feed visibility (Lemmy API)',
              status: 'passed',
              detail: `Post ${nativeId} found on ${instance}`,
            };
          }
        }
        return {
          name: 'Native feed visibility (Lemmy API)',
          status: 'failed',
          detail: `Post ${nativeId} not found (HTTP ${res.status})`,
        };
      }

      case 'writefreely': {
        const instance = instanceUrl || 'https://blog.degenfeed.xyz';
        const res = await fetch(`${instance}/api/posts/${nativeId}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          return {
            name: 'Native feed visibility (WriteFreely API)',
            status: 'passed',
            detail: `Post ${nativeId} found on ${instance}`,
          };
        }
        return {
          name: 'Native feed visibility (WriteFreely API)',
          status: 'failed',
          detail: `Post ${nativeId} not found (HTTP ${res.status})`,
        };
      }

      case 'pixelfed': {
        const instance = instanceUrl || 'https://pixelfed.social';
        const res = await fetch(`${instance}/api/v1/statuses/${nativeId}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          return {
            name: 'Native feed visibility (Pixelfed API)',
            status: 'passed',
            detail: `Status ${nativeId} found on ${instance}`,
          };
        }
        return {
          name: 'Native feed visibility (Pixelfed API)',
          status: 'failed',
          detail: `Status ${nativeId} not found (HTTP ${res.status})`,
        };
      }

      default:
        return {
          name: `Native feed visibility (${protocol})`,
          status: 'failed',
          detail: `No native feed check implemented for ${protocol}`,
        };
    }
  } catch (err) {
    return {
      name: `Native feed visibility (${protocol})`,
      status: 'failed',
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check 2: Verify content appears in DegenFeed's unified feed.
 * We check the feed/unified endpoint for matching content.
 */
async function checkDegenFeedMain(
  protocol: string,
  nativeId: string,
  text?: string,
  _env?: Env,
): Promise<{ name: string; status: 'passed' | 'failed'; detail: string }> {
  try {
    // Query the local DegenFeed API for the post
    const dfApiUrl = 'https://degenfeed.xyz';
    const res = await fetch(`${dfApiUrl}/api/feed/unified?protocol=${protocol}&limit=50`, {
      headers: { 'user-agent': 'DegenFeed-Verify/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return {
        name: 'DegenFeed main feed',
        status: 'skipped',
        detail: `DegenFeed API unreachable (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as {
      data?: Array<{ id?: string; protocol?: string; text?: string }>;
    };

    if (!data.data || data.data.length === 0) {
      return {
        name: 'DegenFeed main feed',
        status: 'failed',
        detail: 'No posts found in unified feed',
      };
    }

    const found = data.data.some(
      (post) =>
        (post.protocol === protocol && post.id?.includes(nativeId)) ||
        (text && post.text?.includes(text.slice(0, 50))),
    );

    return {
      name: 'DegenFeed main feed',
      status: found ? 'passed' : 'failed',
      detail: found
        ? 'Post found in unified feed'
        : 'Post not found in unified feed (may take time to propagate)',
    };
  } catch (err) {
    return {
      name: 'DegenFeed main feed',
      status: 'skipped',
      detail: `Feed check unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check 3: Verify content appears in DegenFeed's per-protocol feed.
 */
async function checkDegenFeedProtocol(
  protocol: string,
  nativeId: string,
  text?: string,
  _env?: Env,
): Promise<{ name: string; status: 'passed' | 'failed'; detail: string }> {
  try {
    const dfApiUrl = 'https://degenfeed.xyz';
    const res = await fetch(`${dfApiUrl}/api/feed/protocol/${protocol}?limit=50`, {
      headers: { 'user-agent': 'DegenFeed-Verify/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return {
        name: 'DegenFeed per-protocol feed',
        status: 'skipped',
        detail: `Per-protocol feed unreachable (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as {
      data?: Array<{ id?: string; text?: string }>;
    };

    if (!data.data || data.data.length === 0) {
      return {
        name: 'DegenFeed per-protocol feed',
        status: 'failed',
        detail: `No posts in ${protocol} feed`,
      };
    }

    const found = data.data.some(
      (post) => post.id?.includes(nativeId) || (text && post.text?.includes(text.slice(0, 50))),
    );

    return {
      name: 'DegenFeed per-protocol feed',
      status: found ? 'passed' : 'failed',
      detail: found ? `Post found in ${protocol} feed` : `Post not found in ${protocol} feed`,
    };
  } catch (err) {
    return {
      name: 'DegenFeed per-protocol feed',
      status: 'skipped',
      detail: `Per-protocol feed check unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check 4: Verify content is discoverable via search.
 */
async function checkSearch(
  protocol: string,
  _nativeId: string,
  text?: string,
  _env?: Env,
): Promise<{ name: string; status: 'passed' | 'failed'; detail: string }> {
  if (!text || text.length < 10) {
    return {
      name: 'Search discoverability',
      status: 'skipped',
      detail: 'Text too short for meaningful search check',
    };
  }

  try {
    const dfApiUrl = 'https://degenfeed.xyz';
    const searchQuery = text.slice(0, 30).replace(/[^a-zA-Z0-9 ]/g, '');
    if (searchQuery.length < 5) {
      return {
        name: 'Search discoverability',
        status: 'skipped',
        detail: 'Search query too short after sanitization',
      };
    }

    const res = await fetch(
      `${dfApiUrl}/api/search?q=${encodeURIComponent(searchQuery)}&protocol=${protocol}`,
      {
        headers: { 'user-agent': 'DegenFeed-Verify/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) {
      return {
        name: 'Search discoverability',
        status: 'skipped',
        detail: `Search unreachable (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as {
      data?: Array<{ id?: string; text?: string }>;
    };

    if (!data.data || data.data.length === 0) {
      return {
        name: 'Search discoverability',
        status: 'failed',
        detail: 'No search results found',
      };
    }

    const found = data.data.some((post) => post.text?.includes(searchQuery));
    return {
      name: 'Search discoverability',
      status: found ? 'passed' : 'failed',
      detail: found ? 'Post found in search results' : 'Post not yet indexed in search',
    };
  } catch (err) {
    return {
      name: 'Search discoverability',
      status: 'skipped',
      detail: `Search unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check 5: Verify other users on the protocol can see the content
 * by fetching the author's public timeline from the protocol API.
 */
async function checkExternalVisibility(
  protocol: string,
  nativeId: string,
  authorHandle: string,
  instanceUrl?: string,
  _env?: Env,
): Promise<{ name: string; status: 'passed' | 'failed' | 'skipped'; detail: string }> {
  try {
    switch (protocol) {
      case 'mastodon': {
        const instance = instanceUrl || 'https://social.degenfeed.xyz';
        // Look up the account by handle
        const lookupRes = await fetch(
          `${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(authorHandle)}`,
          { headers: { 'user-agent': 'DegenFeed/0.1' }, signal: AbortSignal.timeout(5000) },
        );
        if (!lookupRes.ok) {
          return {
            name: 'External protocol user visibility',
            status: 'skipped',
            detail: `Could not look up account ${authorHandle}`,
          };
        }
        const account = (await lookupRes.json()) as { id: string };
        // Get the account's statuses
        const statusRes = await fetch(
          `${instance}/api/v1/accounts/${account.id}/statuses?limit=40`,
          { headers: { 'user-agent': 'DegenFeed/0.1' }, signal: AbortSignal.timeout(5000) },
        );
        if (statusRes.ok) {
          const statuses = (await statusRes.json()) as Array<{ id: string }>;
          const found = statuses.some((s) => s.id === nativeId);
          return {
            name: 'External protocol user visibility',
            status: found ? 'passed' : 'failed',
            detail: found
              ? `Post ${nativeId} visible in ${authorHandle}'s public timeline`
              : `Post ${nativeId} not in public timeline (may be cached)`,
          };
        }
        return {
          name: 'External protocol user visibility',
          status: 'skipped',
          detail: `Could not fetch statuses for ${authorHandle}`,
        };
      }

      default:
        return {
          name: 'External protocol user visibility',
          status: 'skipped',
          detail: `External visibility check not implemented for ${protocol}`,
        };
    }
  } catch (err) {
    return {
      name: 'External protocol user visibility',
      status: 'skipped',
      detail: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── GET /api/protocol/verify/health ──────────────────────────────────

export async function handleVerifyHealth(_request: Request, _env: Env): Promise<Response> {
  const checks = [
    { name: 'DegenFeed API', url: 'https://degenfeed.xyz/api/health' },
    { name: 'DegenFeed Search', url: 'https://degenfeed.xyz/api/feed/health' },
    { name: 'GoToSocial', url: 'https://social.degenfeed.xyz/api/v1/instance' },
    { name: 'PeerTube', url: 'https://video.degenfeed.xyz/api/v1/config' },
    { name: 'Lemmy', url: 'https://community.degenfeed.xyz/api/v3/site' },
    { name: 'Pixelfed', url: 'https://pixelfed.social/api/v1/instance' },
    { name: 'WriteFreely', url: 'https://blog.degenfeed.xyz/api/instance' },
    { name: 'BookWyrm', url: 'https://books.degenfeed.xyz/api/v1/site' },
    { name: 'Mobilizon', url: 'https://events.degenfeed.xyz/api/graphql' },
    { name: 'Funkwhale', url: 'https://music.degenfeed.xyz/api/v1/instance' },
  ];

  const results = await Promise.allSettled(
    checks.map(async (check) => {
      try {
        const res = await fetch(check.url, {
          method: check.url.includes('graphql') ? 'POST' : 'GET',
          ...(check.url.includes('graphql')
            ? {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'query { instanceConfig { registrationsOpen } }' }),
              }
            : { headers: { 'user-agent': 'DegenFeed/0.1' } }),
          signal: AbortSignal.timeout(5000),
        });
        return {
          name: check.name,
          url: check.url,
          status: res.ok ? 'healthy' : 'unhealthy',
          httpStatus: res.status,
        };
      } catch {
        return {
          name: check.name,
          url: check.url,
          status: 'unreachable',
          httpStatus: null,
        };
      }
    }),
  );

  const services = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { name: 'Unknown', status: 'error' as const },
  );

  const healthy = services.filter((s) => s.status === 'healthy').length;
  const total = services.length;

  return jsonResponse({
    data: {
      services,
      summary: { healthy, unhealthy: total - healthy, total },
      allHealthy: healthy === total,
    },
  });
}
