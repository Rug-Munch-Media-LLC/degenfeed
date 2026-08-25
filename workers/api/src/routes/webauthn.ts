/**
 * @degenfeed/api-worker — WebAuthn / Passkey 2FA routes
 *
 * Phishing-resistant biometric authentication using the WebAuthn (FIDO2)
 * standard. Users register a passkey (fingerprint, Face ID, YubiKey, or
 * platform authenticator) and authenticate with it instead of (or in
 * addition to) their wallet signature.
 *
 * The server stores zero secrets — only public keys. Phishing-resistant
 * by design: the browser enforces the origin, so a fake site cannot
 * replay the credential.
 *
 * KV key patterns (all in CACHE namespace):
 *   webauthn:challenge:{wallet}  — registration/authentication challenge, TTL: 5 min
 *   webauthn:credentials:{wallet} — JSON array of stored credentials, TTL: none (persistent)
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { log } from '../index';
import { jsonResponse } from '../response-helpers';
import { createSession, requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

const RP_NAME = 'DegenFeed';
const RP_ID = 'degenfeed.xyz';
const ORIGIN = 'https://app.degenfeed.xyz';
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

// ─── KV key helpers ──────────────────────────────────────────────────────

function challengeKey(wallet: string): string {
  return `webauthn:challenge:${wallet.toLowerCase()}`;
}

function credentialsKey(wallet: string): string {
  return `webauthn:credentials:${wallet.toLowerCase()}`;
}

// ─── Credential type ─────────────────────────────────────────────────────

interface StoredCredential {
  credentialID: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
  name?: string;
  createdAt: number;
  lastUsed: number;
  fmt?: string;
}

// ─── KV helpers ──────────────────────────────────────────────────────────

async function storeChallenge(env: Env, wallet: string, challenge: string): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(challengeKey(wallet), challenge, {
    expirationTtl: CHALLENGE_TTL_SECONDS,
  });
}

async function getChallenge(env: Env, wallet: string): Promise<string | null> {
  if (!env.CACHE) return null;
  return env.CACHE.get(challengeKey(wallet));
}

async function deleteChallenge(env: Env, wallet: string): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.delete(challengeKey(wallet));
}

async function storeCredential(
  env: Env,
  wallet: string,
  credential: StoredCredential,
): Promise<void> {
  if (!env.CACHE) return;
  const raw = await env.CACHE.get(credentialsKey(wallet));
  const credentials: StoredCredential[] = raw ? JSON.parse(raw) : [];
  credentials.push(credential);
  await env.CACHE.put(credentialsKey(wallet), JSON.stringify(credentials));
}

async function getCredentials(env: Env, wallet: string): Promise<StoredCredential[]> {
  if (!env.CACHE) return [];
  const raw = await env.CACHE.get(credentialsKey(wallet));
  return raw ? JSON.parse(raw) : [];
}

async function getCredential(
  env: Env,
  wallet: string,
  credentialID: string,
): Promise<StoredCredential | null> {
  const credentials = await getCredentials(env, wallet);
  return credentials.find((c) => c.credentialID === credentialID) ?? null;
}

async function updateCredentialCounter(
  env: Env,
  wallet: string,
  credentialID: string,
  newCounter: number,
): Promise<void> {
  if (!env.CACHE) return;
  const raw = await env.CACHE.get(credentialsKey(wallet));
  if (!raw) return;
  const credentials: StoredCredential[] = JSON.parse(raw);
  const idx = credentials.findIndex((c) => c.credentialID === credentialID);
  if (idx === -1) return;
  credentials[idx]!.counter = newCounter;
  credentials[idx]!.lastUsed = Date.now();
  await env.CACHE.put(credentialsKey(wallet), JSON.stringify(credentials));
}

async function deleteCredentialByID(env: Env, wallet: string, credentialID: string): Promise<void> {
  if (!env.CACHE) return;
  const raw = await env.CACHE.get(credentialsKey(wallet));
  if (!raw) return;
  const credentials: StoredCredential[] = JSON.parse(raw);
  const filtered = credentials.filter((c) => c.credentialID !== credentialID);
  await env.CACHE.put(credentialsKey(wallet), JSON.stringify(filtered));
}

async function renameCredential(
  env: Env,
  wallet: string,
  credentialID: string,
  name: string,
): Promise<void> {
  if (!env.CACHE) return;
  const raw = await env.CACHE.get(credentialsKey(wallet));
  if (!raw) return;
  const credentials: StoredCredential[] = JSON.parse(raw);
  const idx = credentials.findIndex((c) => c.credentialID === credentialID);
  if (idx === -1) return;
  credentials[idx]!.name = name;
  await env.CACHE.put(credentialsKey(wallet), JSON.stringify(credentials));
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Safely encode a Uint8Array to a base64url string for JSON transport.
 */
function _uint8ArrayToBase64URL(uint8: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...uint8));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Safely decode a base64url string back to Uint8Array.
 */
function _base64URLToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = 4 - (base64.length % 4);
  const padded = padding === 4 ? base64 : base64 + '='.repeat(padding);
  const binStr = atob(padded);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

// ─── Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/webauthn/register/begin
 *
 * Generate WebAuthn registration options for the authenticated user.
 * The challenge is stored in KV for verification on completion.
 */
export async function handleWebAuthnRegisterBegin(request: Request, env: Env): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const wallet = session.address;

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(wallet),
      userName: wallet.slice(0, 12),
      userDisplayName: `Wallet ${wallet.slice(0, 8)}`,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });

    await storeChallenge(env, wallet, options.challenge);

    log('info', '[webauthn] register begin', { wallet: wallet.slice(0, 12) });

    return jsonResponse(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration begin failed';
    log('error', '[webauthn] register begin error', { error: message });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /api/auth/webauthn/register/complete
 *
 * Verify the authenticator's registration response and store the
 * credential (public key) for future authentication.
 */
export async function handleWebAuthnRegisterComplete(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const wallet = session.address;
    const body = (await request.json()) as {
      response?: Record<string, unknown>;
      name?: string;
    };

    if (!body.response) {
      return jsonResponse({ error: 'Missing registration response' }, 400);
    }

    const expectedChallenge = await getChallenge(env, wallet);
    if (!expectedChallenge) {
      return jsonResponse({ error: 'Challenge not found or expired. Please start again.' }, 400);
    }

    // Delete challenge immediately to prevent replay
    await deleteChallenge(env, wallet);

    const verification = await verifyRegistrationResponse({
      response: body.response as unknown as Parameters<
        typeof verifyRegistrationResponse
      >[0]['response'],
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return jsonResponse({ error: 'Registration verification failed' }, 400);
    }

    const { registrationInfo } = verification;
    // v11: credential fields live under registrationInfo.credential;
    // credential.id is already Base64URLString
    const credentialID = registrationInfo.credential.id;

    const credential: StoredCredential = {
      credentialID,
      publicKey: registrationInfo.credential.publicKey,
      counter: registrationInfo.credential.counter,
      transports: (body.response as Record<string, unknown>).transports as string[] | undefined,
      name: body.name || `Passkey (${new Date().toLocaleDateString()})`,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    await storeCredential(env, wallet, credential);

    log('info', '[webauthn] register complete', {
      wallet: wallet.slice(0, 12),
      credentialID: credentialID.slice(0, 12),
    });

    return jsonResponse({
      verified: true,
      credentialId: credentialID,
      name: credential.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration complete failed';
    log('error', '[webauthn] register complete error', { error: message });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /api/auth/webauthn/authenticate/begin
 *
 * Generate authentication options for a user who wants to sign in
 * with their passkey. Requires wallet address in the request body.
 */
export async function handleWebAuthnAuthenticateBegin(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as { wallet?: string };
    const wallet = body.wallet?.toLowerCase();

    if (!wallet) {
      return jsonResponse({ error: 'Wallet address required' }, 400);
    }

    const credentials = await getCredentials(env, wallet);

    if (credentials.length === 0) {
      return jsonResponse({ error: 'No passkeys registered for this wallet' }, 404);
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map((cred) => ({
        id: cred.credentialID,
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      })),
      userVerification: 'preferred',
    });

    await storeChallenge(env, wallet, options.challenge);

    log('info', '[webauthn] authenticate begin', {
      wallet: wallet.slice(0, 12),
      credentialCount: credentials.length,
    });

    return jsonResponse(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication begin failed';
    log('error', '[webauthn] authenticate begin error', { error: message });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /api/auth/webauthn/authenticate/complete
 *
 * Verify the authenticator's authentication response. On success,
 * creates a new session for the user.
 */
export async function handleWebAuthnAuthenticateComplete(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      wallet?: string;
      credential?: Record<string, unknown>;
    };

    const wallet = body.wallet?.toLowerCase();
    if (!wallet) {
      return jsonResponse({ error: 'Wallet address required' }, 400);
    }

    if (!body.credential) {
      return jsonResponse({ error: 'Missing authentication credential' }, 400);
    }

    // Extract credential ID from the response
    const credentialResponse = body.credential;
    const rawId = credentialResponse.rawId as string | undefined;
    const responseId = (credentialResponse.response as Record<string, unknown>)?.id as
      | string
      | undefined;
    const credentialID = rawId || responseId;

    if (!credentialID) {
      return jsonResponse({ error: 'Missing credential ID' }, 400);
    }

    const storedCredential = await getCredential(env, wallet, credentialID);
    if (!storedCredential) {
      return jsonResponse({ error: 'Credential not found' }, 404);
    }

    const expectedChallenge = await getChallenge(env, wallet);
    if (!expectedChallenge) {
      return jsonResponse({ error: 'Challenge not found or expired. Please start again.' }, 400);
    }

    // Delete challenge immediately to prevent replay
    await deleteChallenge(env, wallet);

    const verification = await verifyAuthenticationResponse({
      response: credentialResponse as unknown as Parameters<
        typeof verifyAuthenticationResponse
      >[0]['response'],
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      // v11: stored credential passed as `credential` (WebAuthnCredential)
      credential: {
        id: storedCredential.credentialID,
        publicKey: storedCredential.publicKey,
        counter: storedCredential.counter,
      },
    });

    if (!verification.verified) {
      return jsonResponse({ error: 'Authentication verification failed' }, 401);
    }

    // Update counter (must do this for cloned credential protection)
    await updateCredentialCounter(
      env,
      wallet,
      credentialID,
      verification.authenticationInfo.newCounter,
    );

    // Create a new session — determine chain from stored wallet info
    // or default to "ethereum" (WebAuthn is chain-agnostic)
    const secret = env.AUTH_SECRET;
    if (!secret) {
      return jsonResponse({ error: 'Auth secret not configured' }, 500);
    }

    const { setCookie, payload } = await createSession(wallet, 'ethereum', secret);

    log('info', '[webauthn] authenticate complete', {
      wallet: wallet.slice(0, 12),
      credentialID: credentialID.slice(0, 12),
    });

    return new Response(
      JSON.stringify({
        verified: true,
        session: { address: payload.address, exp: payload.exp },
        token: setCookie,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': setCookie,
          'cache-control': 'no-store, must-revalidate',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication complete failed';
    log('error', '[webauthn] authenticate complete error', { error: message });
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * GET /api/auth/webauthn/credentials
 *
 * List all registered passkeys for the authenticated user.
 */
export async function handleWebAuthnListCredentials(request: Request, env: Env): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const credentials = await getCredentials(env, session.address);

    return jsonResponse(
      credentials.map((c) => ({
        id: c.credentialID,
        name: c.name || 'Passkey',
        createdAt: c.createdAt,
        lastUsed: c.lastUsed,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List credentials failed';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * DELETE /api/auth/webauthn/credentials/:id
 *
 * Remove a registered passkey by its credential ID.
 */
export async function handleWebAuthnDeleteCredential(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    await deleteCredentialByID(env, session.address, id);

    log('info', '[webauthn] credential deleted', {
      wallet: session.address.slice(0, 12),
      credentialID: id.slice(0, 12),
    });

    return jsonResponse({ removed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete credential failed';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * PATCH /api/auth/webauthn/credentials/:id
 * Body: { name: string }
 *
 * Rename a registered passkey.
 */
export async function handleWebAuthnRenameCredential(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name || name.length > 64) {
      return jsonResponse({ error: 'Name must be 1-64 characters' }, 400);
    }

    await renameCredential(env, session.address, id, name);

    return jsonResponse({ renamed: true, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rename credential failed';
    return jsonResponse({ error: message }, 500);
  }
}
