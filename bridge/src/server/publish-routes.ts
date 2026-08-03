/**
 * @degenfeed/local-bridge — Cross-Protocol Publish Routes
 *
 * POST /api/publish
 *   Write once → publish to multiple protocols simultaneously.
 *
 * Body:
 *   {
 *     content: string,                       // required
 *     protocols: ['nostr','mastodon','bluesky','farcaster'],  // required
 *     media?: Array<{ url: string; alt?: string; mimeType?: string }>,
 *     options?: {
 *       nostr?:    { relays?: string[]; nip05?: string },
 *       mastodon?: { cw?: string; visibility?: 'public'|'unlisted'|'private'|'direct' },
 *       bluesky?:  { labels?: string[]; threadGate?: boolean },
 *       farcaster?:{ channel?: string; embed?: string },
 *     }
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     results: {
 *       nostr:    { ok: boolean, url?: string, error?: string },
 *       mastodon: { ok: boolean, url?: string, error?: string },
 *       ...
 *     },
 *     publishedAt: string
 *   }
 *
 * Honesty contract: every protocol result is a REAL publish attempt. If a
 * protocol client is not configured, we return ok:false with a clear error —
 * we NEVER fabricate success.
 */

import type http from 'node:http';
import WebSocket from 'ws';
import { MAX_PUBLISH_LENGTH, moderateContent } from '../lib/content-moderation';
import { RateLimiter } from '../lib/rate-limiter';

// ─── Config ───────────────────────────────────────────────────────────────

const GTS_BASE = process.env.GTS_BASE || 'http://127.0.0.1:8082';
const GTS_CLIENT_ID = process.env.GTS_CLIENT_ID || '';
const GTS_CLIENT_SECRET = process.env.GTS_CLIENT_SECRET || '';
const NOSTR_NSEC = process.env.DEGENFEED_NOSTR_NSEC || process.env.NOSTR_PRIVATE_KEY_HEX || '';
const NOSTR_RELAY = process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:8085';
const BLUESKY_PDS = process.env.ATPROTO_PDS_URL || 'https://bsky.social';
const BLUESKY_DID = process.env.BLUESKY_CROSSPOST_DID || '';
const BLUESKY_JWT = process.env.BLUESKY_CROSSPOST_JWT || '';
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || '';
const BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD || '';
const FARCASTER_FID = process.env.FARCASTER_BOT_FID || '';
const FARCASTER_SIGNER_KEY = process.env.FARCASTER_BOT_SIGNER_KEY || '';
const FARCASTER_HUB_URL = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';

// Per-user publish rate limit (layer on top of the web proxy per-IP limiter).
// Keyed on the authenticated address forwarded by the web app (`requestedBy`),
// so a single account cannot spam the shared crosspost identity.
const publishLimiter = new RateLimiter();
const USER_PUBLISH_MAX = Number(process.env.USER_PUBLISH_MAX ?? 10);
const USER_PUBLISH_WINDOW_MS = 60_000;

const VALID_PROTOCOLS = new Set(['nostr', 'mastodon', 'bluesky', 'farcaster']);

export interface PublishMediaItem {
  url: string;
  alt?: string;
  mimeType?: string;
}

export interface PublishOptions {
  nostr?: { relays?: string[]; nip05?: string };
  mastodon?: {
    cw?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  };
  bluesky?: { labels?: string[]; threadGate?: boolean };
  farcaster?: { channel?: string; embed?: string };
}

export interface PublishResult {
  ok: boolean;
  url?: string;
  error?: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message, code }));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
    });
    req.on('end', () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ─── Nostr publisher ──────────────────────────────────────────────────────

async function publishToNostr(
  content: string,
  options: PublishOptions['nostr'],
  media: PublishMediaItem[],
): Promise<PublishResult> {
  if (!NOSTR_NSEC) {
    return { ok: false, error: 'Nostr publishing not configured (missing DEGENFEED_NOSTR_NSEC)' };
  }

  try {
    const { createTextNote } = await import('@degenfeed/nostr-sdk');

    // Optional NIP-05 identity tag
    const tags: string[][] = [];
    if (options?.nip05) {
      tags.push(['i', `nip05:${options.nip05}`]);
    }
    // Media URLs as attachments (nostr clients render imeta/imt tags)
    for (const m of media) {
      tags.push(['imeta', `url ${m.url}`, `alt ${m.alt || ''}`.trimEnd()]);
    }

    const signed = createTextNote(content, NOSTR_NSEC, tags) as unknown as Record<string, unknown>;

    const relays = [...new Set([NOSTR_RELAY, ...(options?.relays || [])])];
    let lastError = 'No relay attempted';
    let firstOkUrl: string | undefined;

    for (const relayUrl of relays) {
      try {
        const result = await publishEventToRelay(relayUrl, signed);
        if (result.ok) {
          firstOkUrl = result.url;
        } else {
          lastError = result.error || 'Relay rejected event';
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Relay publish failed';
      }
    }

    if (firstOkUrl) {
      return { ok: true, url: firstOkUrl };
    }
    return { ok: false, error: `Nostr publish failed on all relays: ${lastError}` };
  } catch (err) {
    return {
      ok: false,
      error: `Nostr publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function publishEventToRelay(
  relayUrl: string,
  event: Record<string, unknown>,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(relayUrl) as unknown as {
        on: (ev: string, cb: (...args: never[]) => void) => void;
        send: (data: string) => void;
        close: () => void;
      };
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        resolve({ ok: false, error: 'Relay timeout after 8s' });
      }, 8000);

      ws.on('open', () => {
        try {
          ws.send(JSON.stringify(['EVENT', event]));
        } catch {
          clearTimeout(timer);
          resolve({ ok: false, error: 'Failed to send event' });
        }
      });
      ws.on('message', (dataRaw: never) => {
        try {
          const msg = JSON.parse(String(dataRaw)) as unknown[];
          if (msg[0] === 'OK') {
            clearTimeout(timer);
            const ok = msg[2] === true;
            if (ok) {
              resolve({
                ok: true,
                url: `nostr:${relayUrl.replace('wss://', '').replace('ws://', '')}/${String(event.id || '').slice(0, 16)}`,
              });
            } else {
              resolve({ ok: false, error: String(msg[3] || 'Relay rejected event') });
            }
          }
        } catch {
          /* ignore non-OK messages */
        }
      });
      ws.on('error', () => {
        clearTimeout(timer);
        resolve({ ok: false, error: `WebSocket error connecting to ${relayUrl}` });
      });
      ws.on('close', () => {
        clearTimeout(timer);
        resolve({ ok: false, error: `Relay closed before OK: ${relayUrl}` });
      });
    } catch (err) {
      resolve({
        ok: false,
        error: `Failed to connect to ${relayUrl}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

// ─── Mastodon (GoToSocial) publisher ──────────────────────────────────────

async function publishToMastodon(
  content: string,
  options: PublishOptions['mastodon'],
  _media: PublishMediaItem[],
): Promise<PublishResult> {
  if (!GTS_CLIENT_ID || !GTS_CLIENT_SECRET) {
    return {
      ok: false,
      error: 'Mastodon publishing not configured (missing GTS_CLIENT_ID / GTS_CLIENT_SECRET)',
    };
  }

  try {
    // App-level token with write scope (server-to-server status posting).
    // Request the FULL registered scope set — GTS rejects narrower requests.
    const { getClientCredentialsToken } = await import('./gts-oauth');
    const tokenRes = await getClientCredentialsToken(
      GTS_CLIENT_ID,
      GTS_CLIENT_SECRET,
      'read write follow push admin:read admin:write',
    );
    const accessToken = tokenRes.access_token;
    if (!accessToken) {
      return { ok: false, error: 'Mastodon: failed to obtain OAuth token' };
    }

    const body: Record<string, unknown> = {
      status: content,
      visibility: options?.visibility || 'public',
    };
    if (options?.cw) body.spoiler_text = options.cw;

    const res = await fetch(`${GTS_BASE}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Mastodon HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = (await res.json()) as { id?: string; url?: string };
    return {
      ok: true,
      url: data.url || (data.id ? `${GTS_BASE}/@me/${data.id}` : undefined),
    };
  } catch (err) {
    return {
      ok: false,
      error: `Mastodon publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Bluesky / AT Protocol publisher ──────────────────────────────────────

async function publishToBluesky(
  content: string,
  options: PublishOptions['bluesky'],
  media: PublishMediaItem[],
): Promise<PublishResult> {
  if (!BLUESKY_DID) {
    return {
      ok: false,
      error: 'Bluesky publishing not configured (missing BLUESKY_CROSSPOST_DID)',
    };
  }

  try {
    let jwt = BLUESKY_JWT;
    if (!jwt && BLUESKY_IDENTIFIER && BLUESKY_APP_PASSWORD) {
      const sessionRes = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: BLUESKY_IDENTIFIER,
          password: BLUESKY_APP_PASSWORD,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!sessionRes.ok) {
        return { ok: false, error: 'Bluesky: session creation failed' };
      }
      const session = (await sessionRes.json()) as { accessJwt?: string };
      jwt = session.accessJwt || '';
    }

    if (!jwt) {
      return {
        ok: false,
        error: 'Bluesky: no access token available (JWT refresh not configured)',
      };
    }

    const record: Record<string, unknown> = {
      text: content,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };

    if (options?.labels && options.labels.length > 0) {
      record.labels = {
        $type: 'com.atproto.label.defs#selfLabels',
        values: options.labels.map((val) => ({ val })),
      };
    }

    if (media.length > 0) {
      record.embed = {
        $type: 'app.bsky.embed.images',
        images: media.slice(0, 4).map((m) => ({
          image: { $type: 'blob', ref: { $link: m.url }, mimeType: m.mimeType || 'image/jpeg' },
          alt: m.alt || '',
        })),
      };
    }

    const res = await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        repo: BLUESKY_DID,
        collection: 'app.bsky.feed.post',
        record,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Bluesky HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = (await res.json()) as { uri?: string };
    const rkey = data.uri?.split('/').pop();

    // Thread gate: only allow mentions (default) — create a threadgate record
    if (options?.threadGate && data.uri && rkey) {
      try {
        await fetch(`${BLUESKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            repo: BLUESKY_DID,
            collection: 'app.bsky.feed.threadgate',
            record: {
              $type: 'app.bsky.feed.threadgate',
              post: data.uri,
              createdAt: new Date().toISOString(),
              allow: [{ $type: 'app.bsky.feed.threadgate#mentionRule' }],
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        /* threadgate is best-effort — post already created */
      }
    }

    return { ok: true, url: data.uri };
  } catch (err) {
    return {
      ok: false,
      error: `Bluesky publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Farcaster publisher ──────────────────────────────────────────────────

async function publishToFarcaster(
  content: string,
  _options: PublishOptions['farcaster'],
  _media: PublishMediaItem[],
): Promise<PublishResult> {
  if (!FARCASTER_FID || !FARCASTER_SIGNER_KEY) {
    return {
      ok: false,
      error:
        'Farcaster publishing not configured (missing FARCASTER_BOT_FID / FARCASTER_BOT_SIGNER_KEY)',
    };
  }

  try {
    const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');

    const truncated = content.length > 320 ? `${content.slice(0, 317)}...` : content;

    const castResult = buildFarcasterCastMessage({
      signerKeyHex: FARCASTER_SIGNER_KEY,
      fid: Number(FARCASTER_FID),
      text: truncated,
    });

    if (!castResult.ok || !castResult.messageHex) {
      return { ok: false, error: castResult.error || 'Failed to build cast message' };
    }

    const bodyBytes = new Uint8Array(
      castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => Number.parseInt(b, 16)) ?? [],
    );

    const res = await fetch(`${FARCASTER_HUB_URL}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/1.0',
      },
      body: bodyBytes,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Farcaster HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = (await res.json()) as { hash?: string };
    return {
      ok: true,
      url: data.hash ? `https://warpcast.com/~/cast/${data.hash}` : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Farcaster publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────

/**
 * POST /api/publish — cross-protocol fan-out.
 * Returns false if the path is not ours so the main router can fall through.
 */
export async function handlePublishRoute(
  path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (path !== '/api/publish') return false;
  if (req.method !== 'POST') {
    jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST to publish');
    return true;
  }

  let body: Record<string, unknown>;
  try {
    body = await parseBody(req);
  } catch (err) {
    jsonError(res, 400, 'INVALID_BODY', err instanceof Error ? err.message : 'Invalid JSON body');
    return true;
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const requestedBy = typeof body.requestedBy === 'string' ? body.requestedBy.slice(0, 64) : '';

  // ── Content moderation (v1 keyword/pattern filter) ──
  const moderation = moderateContent(content);
  if (!moderation.allowed) {
    jsonError(res, 451, 'CONTENT_BLOCKED', 'Content blocked by moderation policy');
    return true;
  }
  if (moderation.flagged.length > 0 && process.env.MODERATION_BLOCK_FLAGGED !== 'false') {
    jsonError(
      res,
      451,
      'CONTENT_FLAGGED',
      `Content flagged by moderation policy (${moderation.flagged.length} rule(s))`,
    );
    return true;
  }
  if (content.length > MAX_PUBLISH_LENGTH) {
    jsonError(res, 400, 'CONTENT_TOO_LONG', `content exceeds ${MAX_PUBLISH_LENGTH} chars`);
    return true;
  }

  // ── Per-user rate limit (attribution layer) ──
  const limitKey = requestedBy ? `user:${requestedBy}` : 'user:anonymous';
  if (!publishLimiter.allow(limitKey, USER_PUBLISH_MAX, USER_PUBLISH_WINDOW_MS)) {
    jsonError(
      res,
      429,
      'RATE_LIMITED',
      `Too many publishes (max ${USER_PUBLISH_MAX}/min per user)`,
    );
    return true;
  }

  const protocolsRaw = Array.isArray(body.protocols) ? body.protocols : [];
  const protocols = protocolsRaw.filter(
    (p): p is string => typeof p === 'string' && VALID_PROTOCOLS.has(p),
  );
  const media = Array.isArray(body.media)
    ? (body.media as PublishMediaItem[]).filter(
        (m) => m && typeof m.url === 'string' && m.url.length > 0,
      )
    : [];
  const options = (
    body.options && typeof body.options === 'object' ? body.options : {}
  ) as PublishOptions;

  if (!content) {
    jsonError(res, 400, 'CONTENT_REQUIRED', 'content is required');
    return true;
  }
  if (protocols.length === 0) {
    jsonError(
      res,
      400,
      'NO_PROTOCOLS',
      `No valid protocols. Supported: ${Array.from(VALID_PROTOCOLS).join(', ')}`,
    );
    return true;
  }

  console.log(
    `[publish] fan-out by ${requestedBy || 'anonymous'} → ${protocols.join(',')} (${media.length} media)`,
  );

  const results: Record<string, PublishResult> = {};
  const publishedAt = new Date().toISOString();

  await Promise.all(
    protocols.map(async (protocol) => {
      try {
        let result: PublishResult;
        switch (protocol) {
          case 'nostr':
            result = await publishToNostr(content, options.nostr, media);
            break;
          case 'mastodon':
            result = await publishToMastodon(content, options.mastodon, media);
            break;
          case 'bluesky':
            result = await publishToBluesky(content, options.bluesky, media);
            break;
          case 'farcaster':
            result = await publishToFarcaster(content, options.farcaster, media);
            break;
          default:
            result = { ok: false, error: `Unknown protocol: ${protocol}` };
        }
        results[protocol] = result;
      } catch (err) {
        results[protocol] = {
          ok: false,
          error: err instanceof Error ? err.message : 'Publish failed',
        };
      }
    }),
  );

  jsonOk(res, {
    ok: true,
    results,
    publishedAt,
    meta: {
      protocols_used: protocols.length,
      media: media.length,
      requestedBy: requestedBy || null,
      moderation: {
        flagged: moderation.flagged.length,
      },
    },
  });
  return true;
}
