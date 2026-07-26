/**
 * @degenfeed/api-worker — Hardware Wallet 2FA
 *
 * Challenge-response 2FA using hardware wallets (Ledger, Trezor, etc.).
 *
 * HOW IT WORKS:
 *   1. GET /api/auth/hw-wallet/status — Check if HW 2FA is active for the session
 *   2. POST /api/auth/hw-wallet/challenge — Generate a random signing challenge
 *   3. POST /api/auth/hw-wallet/verify — Verify the signed challenge
 *   4. POST /api/auth/hw-wallet/toggle — Enable/disable HW 2FA for the account
 *
 * SECURITY:
 *   - Challenges are single-use, expire after 5 minutes
 *   - The challenge includes the wallet address, timestamp, and random nonce
 *   - Verification recovers the signer's address from the signature
 *   - Phishing-resistant: the message explicitly states "This does not authorize
 *     any transaction" and includes the domain context
 *
 * COMPATIBILITY:
 *   - Ethereum / EVM: uses EIP-191 personal_sign (works with Ledger, Trezor,
 *     MetaMask hardware, Rabby hardware, etc.)
 *   - Solana: uses ed25519 signMessage (works with Phantom, Solflare, Backpack
 *     hardware wallets)
 */

import { rateLimit } from '../index';
import { hwWallet2FAStatusKey, hwWalletChallengeKey } from '../kv-key-patterns';
import { verifyEthereumSignature, verifySolanaSignature } from '../lib/signature-verify';
import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────

export interface HwChallenge {
  nonce: string;
  challenge: string;
  expiresAt: number;
}

export interface Hw2FAStatus {
  enabled: boolean;
  lastVerifiedAt: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CHALLENGE_RATE_LIMIT = 5; // max 5 challenges per 60s per address
const VERIFY_RATE_LIMIT = 5; // max 5 verify attempts per 60s per address

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Build the challenge message the user must sign with their hardware wallet.
 *
 * Format is designed to be clear, domain-specific, and phishing-resistant:
 *   - Names the application ("DegenFeed authentication challenge")
 *   - Includes the wallet address being authenticated
 *   - Includes an ISO-8601 timestamp for audit trail
 *   - Includes a random nonce for uniqueness
 *   - Explicit disclaimer: no transaction authorization
 */
function buildChallengeMessage(
  wallet: string,
  chain: string,
  timestamp: string,
  nonce: string,
): string {
  return [
    'DegenFeed authentication challenge',
    '',
    `Chain: ${chain}`,
    `Wallet: ${wallet}`,
    `Timestamp: ${timestamp}`,
    `Nonce: ${nonce}`,
    '',
    'Sign this message to prove you control this wallet.',
    'This does NOT authorize any transaction or on-chain action.',
    'If you did not request this, ignore this message.',
  ].join('\n');
}

/**
 * Store a 2FA challenge in KV with 5-minute TTL.
 */
async function storeChallenge(env: Env, address: string, challenge: HwChallenge): Promise<void> {
  const key = hwWalletChallengeKey(address, challenge.nonce);
  await env.CACHE?.put(key, JSON.stringify(challenge), {
    expirationTtl: Math.ceil(CHALLENGE_TTL_MS / 1000),
  });
}

/**
 * Retrieve and delete (consume) a stored challenge.
 * Returns null if not found or expired.
 */
async function consumeChallenge(
  env: Env,
  address: string,
  nonce: string,
): Promise<HwChallenge | null> {
  const key = hwWalletChallengeKey(address, nonce);
  try {
    const raw = await env.CACHE?.get(key);
    if (!raw) return null;
    const challenge = JSON.parse(raw) as HwChallenge;
    // Delete immediately to prevent replay
    await env.CACHE?.delete(key).catch(() => {});
    return challenge;
  } catch {
    return null;
  }
}

// ─── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/hw-wallet/challenge
 *
 * Generates a cryptographically random challenge that must be signed
 * with the user's hardware wallet. The challenge expires after 5 minutes.
 *
 * Request body: none (uses session)
 * Response:
 *   { challenge: string, nonce: string, expiresIn: number }
 */
export async function handleHwWalletChallenge(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  // Rate limit: 5 challenge requests per 60s per address
  const rl = await rateLimit(
    env,
    `${ip}:${session.address}`,
    'hw2fa:challenge',
    CHALLENGE_RATE_LIMIT,
    60_000,
  );
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many challenge requests. Try again later.',
        retryAfterMs: rl.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
        },
      },
    );
  }

  const nonce = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const challenge = buildChallengeMessage(session.address, session.chain, timestamp, nonce);

  const hwChallenge: HwChallenge = {
    nonce,
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  };

  await storeChallenge(env, session.address, hwChallenge);

  return jsonResponse({
    challenge,
    nonce,
    expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
  });
}

/**
 * POST /api/auth/hw-wallet/verify
 *
 * Verifies a signed challenge against the user's known wallet address.
 *
 * Request body:
 *   { signature: string, nonce: string }
 *     - signature: the hex-encoded signature from the wallet
 *     - nonce: the nonce returned by the challenge endpoint
 *
 * Response:
 *   { verified: true } on success
 *   { error: string } on failure
 */
export async function handleHwWalletVerify(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  // Rate limit: 5 verify attempts per 60s per address
  const rl = await rateLimit(
    env,
    `${ip}:${session.address}`,
    'hw2fa:verify',
    VERIFY_RATE_LIMIT,
    60_000,
  );
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many verification attempts. Try again later.',
        retryAfterMs: rl.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
        },
      },
    );
  }

  let body: { signature?: string; nonce?: string };
  try {
    body = (await request.json()) as { signature?: string; nonce?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.signature || !body.nonce) {
    return jsonResponse({ error: 'Missing required fields: signature, nonce' }, 400);
  }

  // Retrieve and consume the challenge (prevents replay)
  const stored = await consumeChallenge(env, session.address, body.nonce);
  if (!stored) {
    return jsonResponse({ error: 'Challenge not found or already used. Request a new one.' }, 400);
  }

  if (Date.now() > stored.expiresAt) {
    return jsonResponse({ error: 'Challenge has expired. Request a new one.' }, 400);
  }

  // Verify the signature recovers to the session's wallet address
  let isValid = false;
  if (session.chain === 'ethereum') {
    isValid = verifyEthereumSignature(stored.challenge, body.signature, session.address);
  } else if (session.chain === 'solana') {
    isValid = verifySolanaSignature(stored.challenge, body.signature, session.address);
  } else {
    return jsonResponse({ error: `Unsupported chain: ${session.chain}` }, 400);
  }

  if (!isValid) {
    return jsonResponse(
      {
        error: 'Invalid signature. Make sure you signed with the correct wallet and chain.',
      },
      401,
    );
  }

  // Mark 2FA as verified
  await save2FAVerified(env, session.address);

  return jsonResponse({ verified: true });
}

/**
 * GET /api/auth/hw-wallet/status
 *
 * Returns the hardware wallet 2FA status for the current session.
 *
 * Response:
 *   { enabled: boolean, lastVerifiedAt: number | null }
 */
export async function handleHwWalletStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const status = await get2FAStatus(env, session.address);
  return jsonResponse(status);
}

/**
 * POST /api/auth/hw-wallet/toggle
 *
 * Enable or disable hardware wallet 2FA for the account.
 * When enabling (enabled: true), the user must first complete a
 * challenge-verify cycle to prove they control the hardware wallet.
 *
 * Request body:
 *   { enabled: boolean }
 *
 * Response:
 *   { enabled: boolean, message: string }
 */
export async function handleHwWalletToggle(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body.enabled !== 'boolean') {
    return jsonResponse({ error: 'Missing required field: enabled' }, 400);
  }

  if (body.enabled) {
    // Enabling requires a recent verification.
    // The caller should have just completed /verify.
    const status = await get2FAStatus(env, session.address);
    if (!status.lastVerifiedAt) {
      return jsonResponse(
        {
          error: 'You must first verify your hardware wallet by completing the challenge flow.',
        },
        400,
      );
    }
    // Last verification must be within the last 5 minutes
    if (Date.now() - status.lastVerifiedAt > CHALLENGE_TTL_MS) {
      return jsonResponse(
        {
          error: 'Your last hardware wallet verification has expired. Please verify again.',
        },
        400,
      );
    }
  }

  await set2FAEnabled(env, session.address, body.enabled);

  return jsonResponse({
    enabled: body.enabled,
    message: body.enabled
      ? 'Hardware wallet 2FA is now enabled. You will be prompted to sign a challenge on your next login.'
      : 'Hardware wallet 2FA has been disabled.',
  });
}

/**
 * POST /api/auth/hw-wallet/verify-on-login
 *
 * Called during login to enforce hardware wallet 2FA.
 * This is the "second factor" — after the user signs in with their
 * primary wallet, if HW 2FA is enabled they must also complete this.
 *
 * Request body:
 *   { signature: string, nonce: string }
 *     - same as /verify
 *
 * Returns a CSRF token on success (same shape as wallet verify),
 * so the frontend can start making authenticated requests.
 */
export async function handleHwWalletVerifyOnLogin(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // First check if 2FA is enabled
  const status = await get2FAStatus(env, session.address);
  if (!status.enabled) {
    // 2FA isn't enabled — skip verification
    return jsonResponse({ verified: true, skipped: true });
  }

  // Verify the signed challenge
  const verifyResult = await handleHwWalletVerify(request, env);
  if (verifyResult.status !== 200) {
    return verifyResult;
  }

  return jsonResponse({
    verified: true,
    skipped: false,
    message: 'Hardware wallet 2FA challenge verified.',
  });
}

// ─── KV Storage ─────────────────────────────────────────────────────

/**
 * Save a 2FA verification timestamp.
 * This does NOT enable 2FA — it just records that the user proved
 * hardware wallet control at this time. The toggle enables the feature.
 */
async function save2FAVerified(env: Env, address: string): Promise<void> {
  const key = hwWallet2FAStatusKey(address);
  const existing = await get2FAStatus(env, address);
  const status: Hw2FAStatus = {
    enabled: existing.enabled,
    lastVerifiedAt: Date.now(),
  };
  await env.CACHE?.put(key, JSON.stringify(status));
}

/**
 * Set whether hardware wallet 2FA is enabled for an address.
 */
async function set2FAEnabled(env: Env, address: string, enabled: boolean): Promise<void> {
  const key = hwWallet2FAStatusKey(address);
  const existing = await get2FAStatus(env, address);
  const status: Hw2FAStatus = {
    enabled,
    lastVerifiedAt: enabled ? existing.lastVerifiedAt : null,
  };
  await env.CACHE?.put(key, JSON.stringify(status));
}

/**
 * Get the hardware wallet 2FA status for an address.
 */
export async function get2FAStatus(env: Env, address: string): Promise<Hw2FAStatus> {
  const key = hwWallet2FAStatusKey(address);
  try {
    const raw = await env.CACHE?.get(key);
    if (!raw) return { enabled: false, lastVerifiedAt: null };
    return JSON.parse(raw) as Hw2FAStatus;
  } catch {
    return { enabled: false, lastVerifiedAt: null };
  }
}
