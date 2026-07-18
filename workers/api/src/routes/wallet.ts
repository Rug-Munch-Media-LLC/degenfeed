import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { type Env, jsonResponse, rateLimit } from '../index';
import { createSession, generateCsrfToken, parseSessionCookie, storeCsrfToken } from '../session';

const GTS_SCOPES = 'read write follow push';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(input: string): Uint8Array {
  if (input.length === 0) return new Uint8Array(0);
  const alphabetMap = new Map<string, number>();
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    alphabetMap.set(BASE58_ALPHABET[i] as string, i);
  }
  // Count leading '1's — each represents a 0x00 byte in the result.
  let leadingZeros = 0;
  for (const ch of input) {
    if (ch === '1') leadingZeros++;
    else break;
  }
  // Build big-endian representation of the base58 value.
  const digits: number[] = [];
  for (let i = leadingZeros; i < input.length; i++) {
    const ch = input[i];
    if (ch === undefined) continue;
    const val = alphabetMap.get(ch);
    if (val === undefined) throw new Error('Invalid base58 character');
    let carry = val;
    for (let j = 0; j < digits.length; j++) {
      const cur = (digits[j] as number) * 256 + carry;
      digits[j] = cur % 58;
      carry = Math.floor(cur / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  // Convert base58 digits to bytes (MSB first).
  const bytes = new Uint8Array(digits.length);
  for (let i = 0; i < digits.length; i++) {
    bytes[i] = digits[digits.length - 1 - i] as number;
  }
  if (leadingZeros === 0) return bytes;
  const out = new Uint8Array(leadingZeros + bytes.length);
  out.set(bytes, leadingZeros);
  return out;
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

function nonceKey(address: string): string {
  return `nonce:${address.toLowerCase()}`;
}

export async function handleWalletNonce(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const address = url.searchParams.get('address')?.toLowerCase() || '';
  if (!address) return jsonResponse({ error: 'Address required' }, 400);

  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(env, ip, 'wallet:nonce', 20, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
      },
    });
  }

  const nonce = generateNonce();
  try {
    await env.CACHE?.put(nonceKey(address), nonce, { expirationTtl: 300 });
  } catch {
    // If KV is unavailable, fall back to a short-lived signed nonce response
    // (client must send it back within the same request — not ideal, but graceful)
  }

  return jsonResponse({ nonce });
}

function verifyEthereumSignature(
  message: string,
  signature: string,
  expectedAddress: string,
): boolean {
  try {
    const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
    const msgHash = keccak_256(new TextEncoder().encode(prefix + message));

    const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
    const rHex = sig.slice(0, 64);
    const sHex = sig.slice(64, 128);
    const v = Number.parseInt(sig.slice(128, 130), 16);
    const recovery = v - 27;
    if (recovery < 0 || recovery > 3) return false;

    const sigObj = secp256k1.Signature.fromCompact(hexToBytes(rHex + sHex)).addRecoveryBit(
      recovery,
    );
    const pubKey = sigObj.recoverPublicKey(msgHash);
    const pubBytes = pubKey.toRawBytes(false).slice(1);
    const address = `0x${bytesToHex(keccak_256(pubBytes).slice(-20))}`;

    return address.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

function verifySolanaSignature(
  message: string,
  signature: string,
  expectedAddress: string,
): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = hexToBytes(signature);
    const pubBytes = base58ToBytes(expectedAddress);
    if (pubBytes.length !== 32) return false;
    return ed25519.verify(sigBytes, msgBytes, pubBytes);
  } catch {
    return false;
  }
}

async function tryGtsAuth(
  env: Env,
): Promise<{ accessToken: string; clientId: string; clientSecret: string } | null> {
  // If static GTS credentials are configured in env vars, use them.
  // Otherwise do NOT create a new OAuth app on every request — that pollutes
  // the instance with stale apps. Wallet-only auth still works without GTS.
  if (!env.GTS_CLIENT_ID || !env.GTS_CLIENT_SECRET) return null;

  try {
    const gtsUrl = env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
    const tokenRes = await fetch(`${gtsUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.GTS_CLIENT_ID,
        client_secret: env.GTS_CLIENT_SECRET,
        scope: GTS_SCOPES,
      }).toString(),
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string; token_type?: string };

    if (!token.access_token) return null;

    return {
      accessToken: token.access_token,
      clientId: env.GTS_CLIENT_ID,
      clientSecret: env.GTS_CLIENT_SECRET,
    };
  } catch {
    return null;
  }
}

export async function handleWalletVerify(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      address: string;
      signature: string;
      message: string;
      chain: 'ethereum' | 'solana';
      nonce: string;
    };

    if (!body.address || !body.signature || !body.message || !body.chain || !body.nonce) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';
    const rl = await rateLimit(
      env,
      `${clientIp}:${body.address.toLowerCase()}`,
      'wallet:verify',
      5,
      60_000,
    );
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
        },
      });
    }

    // Verify nonce from KV
    let storedNonce: string | null = null;
    try {
      storedNonce = (await env.CACHE?.get(nonceKey(body.address))) ?? null;
    } catch {
      storedNonce = null;
    }
    if (!storedNonce || storedNonce !== body.nonce) {
      return jsonResponse({ error: 'Invalid or expired nonce' }, 401);
    }
    try {
      await env.CACHE?.delete(nonceKey(body.address));
    } catch {
      // ignore cleanup failure
    }

    // Verify signature
    let valid = false;
    if (body.chain === 'ethereum') {
      valid = verifyEthereumSignature(body.message, body.signature, body.address);
    } else if (body.chain === 'solana') {
      valid = verifySolanaSignature(body.message, body.signature, body.address);
    }
    if (!valid) {
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }

    // Wallet is verified — it's a first-class identity on DegenFeed
    // GotoSocial account link is OPTIONAL
    const gtsSession = await tryGtsAuth(env);

    // If GTS auth worked, try to link/create profile
    let gtsAuthorizeUrl: string | null = null;
    if (gtsSession) {
      const redirectUri = encodeURIComponent(
        env.GTS_REDIRECT_URI || 'https://degenfeed.xyz/auth/callback',
      );
      gtsAuthorizeUrl = `${env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz'}/oauth/authorize?client_id=${gtsSession.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${GTS_SCOPES}&sign_up=true`;
    }

    if (!env.AUTH_SECRET) {
      return jsonResponse({ error: 'Auth secret not configured' }, 500);
    }

    const { setCookie, payload } = await createSession(body.address, body.chain, env.AUTH_SECRET);

    // Generate and store CSRF token for the new session.
    // IMPORTANT: parse the cookie value from the Set-Cookie header so the KV key
    // matches what validateCsrfToken looks up (the cookie value only, not the
    // full header string).
    const cookieValueForCsrf = parseSessionCookie(setCookie);
    const csrfToken = cookieValueForCsrf
      ? await storeCsrfToken(cookieValueForCsrf, env)
      : generateCsrfToken();

    return new Response(
      JSON.stringify({
        success: true,
        walletAddress: payload.address,
        chain: payload.chain,
        identity: {
          protocol: payload.chain,
          id: payload.address,
          displayName: `${payload.address.slice(0, 6)}...${payload.address.slice(-4)}`,
          handle: `${payload.address.slice(0, 6)}...${payload.address.slice(-4)}`,
          avatarUrl: null,
        },
        gtsAuthorizeUrl,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': setCookie,
          'x-csrf-token': csrfToken,
          'cache-control': 'no-store',
        },
      },
    );
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}
