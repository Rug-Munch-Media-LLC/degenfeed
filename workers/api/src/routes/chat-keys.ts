/**
 * /api/chat/keys — Encryption Key Verification Routes
 *
 * Routes:
 *   POST /api/chat/keys/verify       — Verify encryption keys with a peer
 *   GET  /api/chat/keys/fingerprint  — Get own key fingerprint
 *   GET  /api/chat/keys/fingerprint/:userId/:protocol — Get user's fingerprint
 *   GET  /api/chat/keys/verified     — Get list of verified peers
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

let _keyManager: typeof import('@degenfeed/chat-super-app').KeyVerificationManager | null = null;
async function getKeyManager() {
  if (!_keyManager) {
    const mod = await import('@degenfeed/chat-super-app');
    _keyManager = mod.getKeyVerificationManager();
  }
  return _keyManager!;
}

const VALID_PROTOCOLS = [
  'matrix',
  'nostr',
  'degenfeed-native',
  'signal',
  'xmtp',
  'xmpp',
  'session',
];

// ─── POST /api/chat/keys/verify ──────────────────────────────────────────

export async function handleKeyVerify(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    targetId: string;
    protocol: string;
    method: 'qr' | 'safety-numbers' | 'out-of-band' | 'cross-procotol';
    fingerprint: string;
    peerFingerprint: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.targetId || !body.protocol || !body.fingerprint || !body.peerFingerprint) {
    return jsonResponse(
      { error: 'Missing required fields: targetId, protocol, fingerprint, peerFingerprint' },
      400,
    );
  }

  if (!VALID_PROTOCOLS.includes(body.protocol)) {
    return jsonResponse(
      { error: `Invalid protocol. Supported: ${VALID_PROTOCOLS.join(', ')}` },
      400,
    );
  }

  try {
    const km = await getKeyManager();
    const result = await km.verifyKeys(
      env,
      session.address,
      body.targetId,
      body.protocol,
      body.method || 'safety-numbers',
      body.fingerprint,
      body.peerFingerprint,
    );

    return jsonResponse(
      {
        ok: true,
        verified: result.verified,
        verificationId: result.verificationId,
        safetyNumbers: result.safetyNumbers,
        protocol: result.protocol,
        matched: result.matchedFingerprints,
      },
      result.verified ? 200 : 200,
    ); // Always 200, verified status in body
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Verification failed',
      },
      500,
    );
  }
}

// ─── GET /api/chat/keys/fingerprint ──────────────────────────────────────

export async function handleGetOwnFingerprint(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || 'degenfeed-native';

  try {
    const km = await getKeyManager();
    const fingerprint = await km.getFingerprint(env, session.address, protocol);

    return noCacheJsonResponse({
      ok: true,
      fingerprint: {
        userId: fingerprint?.userId,
        protocol: fingerprint?.protocol,
        numericCode: fingerprint?.numericCode,
        shortCode: fingerprint?.shortCode,
        qrCodeUrl: fingerprint?.qrCodeUrl,
        algorithm: fingerprint?.algorithm,
        verified: fingerprint?.verified,
        createdAt: fingerprint?.createdAt,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to get fingerprint',
      },
      500,
    );
  }
}

// ─── GET /api/chat/keys/fingerprint/:userId/:protocol ────────────────────

export async function handleGetUserFingerprint(
  _request: Request,
  env: Env,
  userId: string,
  protocol: string,
): Promise<Response> {
  if (!VALID_PROTOCOLS.includes(protocol)) {
    return jsonResponse({ error: `Invalid protocol: ${protocol}` }, 400);
  }

  try {
    const km = await getKeyManager();
    const fingerprint = await km.getFingerprint(env, userId, protocol);

    if (!fingerprint) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    // Only return public info (no private keys)
    return noCacheJsonResponse({
      ok: true,
      fingerprint: {
        userId: fingerprint.userId,
        protocol: fingerprint.protocol,
        numericCode: fingerprint.numericCode,
        shortCode: fingerprint.shortCode,
        qrCodeUrl: fingerprint.qrCodeUrl,
        algorithm: fingerprint.algorithm,
        verified: fingerprint.verified,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to get fingerprint',
      },
      500,
    );
  }
}

// ─── GET /api/chat/keys/verified ─────────────────────────────────────────

export async function handleGetVerifiedPeers(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || 'degenfeed-native';

  try {
    const km = await getKeyManager();
    const peers = await km.getVerifiedPeers(env, session.address, protocol);

    return noCacheJsonResponse({
      ok: true,
      protocol,
      verifiedPeers: peers,
      count: peers.length,
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to get verified peers' }, 500);
  }
}

// ─── GET /api/chat/keys/check/:peerId — Check if peer is verified ────────

export async function handleCheckVerification(
  request: Request,
  env: Env,
  peerId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || 'degenfeed-native';

  try {
    const km = await getKeyManager();
    const verified = await km.isVerified(env, session.address, peerId, protocol);

    return noCacheJsonResponse({
      ok: true,
      verified,
      peerId,
      protocol,
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to check verification' }, 500);
  }
}
