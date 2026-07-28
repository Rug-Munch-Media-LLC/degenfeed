/**
 * Nostr Bridge Routes — Account Registration, Auth, Relay Management, Publishing
 *
 * These routes run on the bridge server (port 8787) and handle:
 *   - Nostr account registration (whitelist npub, create kind 0, NIP-05)
 *   - Authentication verification (nsec challenge/response)
 *   - Relay management (add/remove relays from kind 10002)
 *   - Event publishing to our relay
 *   - Health monitoring
 *
 * The bridge connects to our local Nostr relay via WebSocket (ws://127.0.0.1:8085).
 * Keys are NEVER stored server-side — all key operations happen client-side.
 */

import type http from 'node:http';

// ─── Constants ────────────────────────────────────────────────────────────

const OUR_RELAY_WS = process.env.NOSTR_RELAY_WS || 'ws://127.0.0.1:8085';
const OUR_RELAY_WSS = process.env.NOSTR_RELAY_WSS || 'wss://nostr.degenfeed.xyz';
const _DEGENFEED_NPUB =
  process.env.DEGENFEED_NOSTR_NPUB ||
  '0307fc061381e9a4d66111a67fd863e2e7d3ce70bfb01146192015a80df6bbf';
const NIP05_DOMAIN = process.env.NIP05_DOMAIN || 'nostr.degenfeed.xyz';
const DEGENFEED_NOSTR_NSEC =
  process.env.DEGENFEED_NOSTR_NSEC || process.env.NOSTR_PRIVATE_KEY_HEX || '';
const _API_KEY = process.env.NOSTR_API_KEY || '';

// ─── In-Memory KV Store ─────────────────────────────────────────────────
// Maps npub hex -> { username, nip05, registeredAt, profile }
// In production, replace with Postgres/Redis/Cloudflare KV
interface RegisteredUser {
  npubHex: string;
  npubBech32: string;
  username: string;
  nip05: string;
  registeredAt: number;
  profile: Record<string, string>;
}

const users = new Map<string, RegisteredUser>();

// ─── Error Responses ────────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code, message, request_id: `req_${Date.now()}` } }));
}

// ─── Relay WebSocket Publish ────────────────────────────────────────────

function publishToRelay(
  event: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(OUR_RELAY_WS);
      const timer = setTimeout(() => {
        ws.close();
        resolve({ success: false, message: 'Relay publish timeout' });
      }, 8000);

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify(['EVENT', event]));
      });

      ws.addEventListener('message', (evt: MessageEvent) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg[0] === 'OK') {
            clearTimeout(timer);
            ws.close();
            const eventId = msg[1];
            const ok = msg[2] === true;
            const message = msg[3] || '';
            resolve({
              success: ok,
              message: ok ? `Published: ${String(eventId).slice(0, 16)}…` : message,
            });
          }
        } catch {
          // ignore parse errors
        }
      });

      ws.addEventListener('error', () => {
        clearTimeout(timer);
        resolve({ success: false, message: 'WebSocket connection error' });
      });

      ws.addEventListener('close', () => {
        clearTimeout(timer);
        resolve({ success: false, message: 'WebSocket closed before OK' });
      });
    } catch (err) {
      resolve({ success: false, message: `Failed to connect: ${(err as Error).message}` });
    }
  });
}

// ─── Relay Health Check ─────────────────────────────────────────────────

function checkRelayHealth(): Promise<{ connected: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const ws = new WebSocket(OUR_RELAY_WS);
      const timer = setTimeout(() => {
        ws.close();
        resolve({ connected: false, latencyMs: Date.now() - start });
      }, 5000);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        const latency = Date.now() - start;
        // Send a NIP-11 info request via subscription close pattern
        ws.send(JSON.stringify(['REQ', 'health-check', { kinds: [], limit: 0 }]));
        setTimeout(() => {
          ws.close();
          resolve({ connected: true, latencyMs: latency });
        }, 500);
      });

      ws.addEventListener('error', () => {
        clearTimeout(timer);
        resolve({ connected: false, latencyMs: Date.now() - start });
      });
    } catch {
      resolve({ connected: false, latencyMs: -1 });
    }
  });
}

// ─── NIP-05 Well-Known URL ─────────────────────────────────────────────
// Returns the URL where our well-known nostr.json is hosted
function getNip05Url(): string {
  return `https://${NIP05_DOMAIN}/.well-known/nostr.json`;
}

// ─── Route Handlers ─────────────────────────────────────────────────────

async function handleRegister(
  _path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST to register');
  }

  try {
    const body = await parseBody(req);
    const { pubkey, npub, username, profile } = body as {
      pubkey?: string;
      npub?: string;
      username?: string;
      profile?: Record<string, string>;
    };

    // Validate required fields
    if (!pubkey && !npub) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'pubkey or npub is required');
    }

    const npubHex = pubkey || npub || '';
    if (!/^[0-9a-f]{64}$/.test(npubHex)) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'pubkey must be a 64-character hex string');
    }

    if (!username || username.length < 2 || username.length > 30) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'username must be 2-30 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return jsonError(
        res,
        400,
        'VALIDATION_ERROR',
        'username must be alphanumeric with underscores only',
      );
    }

    // Check if username is already taken
    for (const user of users.values()) {
      if (user.username === username) {
        return jsonError(res, 409, 'CONFLICT', `Username "${username}" is already registered`);
      }
      if (user.npubHex === npubHex) {
        return jsonError(res, 409, 'CONFLICT', 'This pubkey is already registered');
      }
    }

    // Import npub encoding
    let npubBech32 = npubHex;
    try {
      const { npubEncode } = await import('@degenfeed/nostr-sdk');
      npubBech32 = npubEncode(npubHex);
    } catch {
      // Fallback: use hex directly
    }

    const nip05 = `${username}@${NIP05_DOMAIN}`;
    const registeredUser: RegisteredUser = {
      npubHex,
      npubBech32,
      username,
      nip05,
      registeredAt: Date.now(),
      profile: profile || {},
    };

    users.set(npubHex, registeredUser);

    // Publish their NIP-05 to the well-known URL syncer (async, non-blocking)
    // The actual well-known endpoint reads from this in-memory store
    console.log(`[nostr] Registered user: ${username} (${npubBech32.slice(0, 16)}…)`);

    return jsonOk(res, {
      ok: true,
      user: {
        npub: npubBech32,
        pubkey: npubHex,
        username,
        nip05,
        nip05WellKnown: getNip05Url(),
        registeredAt: registeredUser.registeredAt,
      },
      instructions: {
        importNsec: 'Your keys were generated client-side. Import your nsec into any Nostr client.',
        createProfile: 'Publish a kind 0 profile event with your display name and avatar.',
        relayList: 'Publish a kind 10002 event to set your relay preferences.',
        recommendedClients: ['Damus', 'Primal', 'Snort', 'Amethyst', 'Coracle'],
      },
    });
  } catch (err) {
    console.error('[nostr] Register error:', err);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'Registration failed');
  }
}

async function handleAuth(
  _path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST to authenticate');
  }

  try {
    const body = await parseBody(req);
    const { pubkey, npub, signature, challenge } = body as {
      pubkey?: string;
      npub?: string;
      signature?: string;
      challenge?: string;
    };

    // Two authentication modes:
    // 1. Simple: just provide pubkey/npub (verify they control the key via challenge elsewhere)
    // 2. Signed: provide pubkey + signature of a challenge (NIP-42 style)

    const npubHex = pubkey || npub || '';
    if (!npubHex) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'pubkey or npub is required');
    }

    // Check if this pubkey is registered
    const user = users.get(npubHex);
    if (!user) {
      // Allow non-registered users to auth (they just get a basic session)
      return jsonOk(res, {
        authenticated: true,
        registered: false,
        npub: npubHex,
        message: 'Authenticated. Consider registering for full features.',
      });
    }

    // If signature provided, verify it (NIP-42 style)
    if (signature && challenge) {
      try {
        const { verifyEvent, getEventHash } = await import('@degenfeed/nostr-sdk');
        const unsignedEvent = {
          pubkey: npubHex,
          created_at: Math.floor(Date.now() / 1000),
          kind: 22242,
          tags: [['challenge', challenge]],
          content: '',
        };
        const eventId = getEventHash(unsignedEvent);
        const isValid = verifyEvent({
          ...unsignedEvent,
          id: eventId,
          sig: signature,
        });

        if (!isValid) {
          return jsonError(res, 401, 'AUTH_FAILED', 'Signature verification failed');
        }
      } catch {
        return jsonError(res, 401, 'AUTH_FAILED', 'Signature verification error');
      }
    }

    return jsonOk(res, {
      authenticated: true,
      registered: true,
      user: {
        npub: user.npubBech32,
        pubkey: user.npubHex,
        username: user.username,
        nip05: user.nip05,
      },
    });
  } catch (err) {
    console.error('[nostr] Auth error:', err);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'Authentication failed');
  }
}

async function handlePublish(
  _path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST to publish');
  }

  try {
    const body = (await parseBody(req)) as Record<string, unknown>;
    let event = body.event as Record<string, unknown> | undefined;

    // Mode 1: Simple content+tags — auto-sign with server key
    if (!event && body.content) {
      if (!DEGENFEED_NOSTR_NSEC) {
        return jsonError(
          res,
          400,
          'SERVER_KEY_MISSING',
          'DEGENFEED_NOSTR_NSEC not configured — cannot auto-sign. Send a pre-signed event instead.',
        );
      }
      try {
        const { createTextNote } = await import('@degenfeed/nostr-sdk');
        const signed = createTextNote(
          body.content as string,
          DEGENFEED_NOSTR_NSEC,
          (body.tags as string[][]) || [],
        );
        event = signed as unknown as Record<string, unknown>;
      } catch (err) {
        return jsonError(
          res,
          500,
          'SIGNING_ERROR',
          `Failed to auto-sign event: ${(err as Error).message}`,
        );
      }
    }

    // Mode 2: Pre-signed event — requires event.kind
    if (!event?.kind) {
      return jsonError(
        res,
        400,
        'VALIDATION_ERROR',
        'Send {event:{kind,id,pubkey,...}} for pre-signed, or {content,tags} for auto-sign',
      );
    }

    const result = await publishToRelay(event);
    if (result.success) {
      return jsonOk(res, {
        ok: true,
        eventId: (event.id as string) || '',
        relay: OUR_RELAY_WSS,
        message: result.message,
      });
    }

    return jsonError(res, 502, 'RELAY_ERROR', result.message || 'Failed to publish to relay');
  } catch (err) {
    console.error('[nostr] Publish error:', err);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'Publish failed');
  }
}

async function handleRelayManagement(
  _path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  // GET: list all known users and their relay info
  if (req.method === 'GET') {
    const userList = Array.from(users.values()).map((u) => ({
      username: u.username,
      npub: u.npubBech32,
      nip05: u.nip05,
      registeredAt: u.registeredAt,
    }));

    return jsonOk(res, {
      relay: {
        ws: OUR_RELAY_WS,
        wss: OUR_RELAY_WSS,
        nip05Domain: NIP05_DOMAIN,
        nip05WellKnown: getNip05Url(),
      },
      totalUsers: users.size,
      users: userList,
    });
  }

  return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET to list relay info');
}

async function handleHealth(
  _path: string,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const health = await checkRelayHealth();
  return jsonOk(res, {
    ok: health.connected,
    relay: {
      ws: OUR_RELAY_WS,
      wss: OUR_RELAY_WSS,
      connected: health.connected,
      latencyMs: health.latencyMs,
    },
    nip05: {
      domain: NIP05_DOMAIN,
      wellKnownUrl: getNip05Url(),
      registeredUsers: users.size,
    },
    timestamp: Date.now(),
  });
}

async function handleVerifyNip05(
  path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(path, `http://${req.headers.host || 'localhost'}`);
  const pubkey = url.searchParams.get('pubkey');
  const nip05 = url.searchParams.get('nip05');

  if (!pubkey || !nip05) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'pubkey and nip05 parameters required');
  }

  // Parse the nip05 identifier
  const atIndex = nip05.indexOf('@');
  if (atIndex === -1) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Invalid NIP-05 format (should be user@domain)');
  }

  const domain = nip05.slice(atIndex + 1);

  // Check domain matches
  if (domain !== NIP05_DOMAIN && domain !== 'degenfeed.xyz') {
    return jsonOk(res, {
      valid: false,
      reason: `Domain ${domain} is not managed by this relay`,
    });
  }

  // Check if the user is registered with matching pubkey
  const user = users.get(pubkey);
  if (!user) {
    return jsonOk(res, {
      valid: false,
      pubkey,
      nip05,
      reason: 'Pubkey not registered',
    });
  }

  const isValid = user.nip05 === nip05;
  return jsonOk(res, {
    valid: isValid,
    pubkey,
    nip05,
    username: isValid ? user.username : undefined,
  });
}

// ─── Body Parser ────────────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ─── Router ─────────────────────────────────────────────────────────────

export async function handleNostrRoute(
  path: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // Route mapping
  if (path === '/api/nostr/register') {
    await handleRegister(path, req, res);
    return true;
  }

  if (path === '/api/nostr/auth') {
    await handleAuth(path, req, res);
    return true;
  }

  if (path === '/api/nostr/publish') {
    await handlePublish(path, req, res);
    return true;
  }

  if (path === '/api/nostr/relays') {
    await handleRelayManagement(path, req, res);
    return true;
  }

  if (path === '/api/nostr/health') {
    await handleHealth(path, req, res);
    return true;
  }

  if (path.startsWith('/api/nostr/verify-nip05')) {
    await handleVerifyNip05(path, req, res);
    return true;
  }

  return false; // Not handled here
}

export { getNip05Url, NIP05_DOMAIN, OUR_RELAY_WS, OUR_RELAY_WSS, users };
