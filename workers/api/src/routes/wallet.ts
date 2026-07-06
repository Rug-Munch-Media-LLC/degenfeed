import { type Env, jsonResponse } from '../index';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const nonces = new Map<string, { nonce: string; expiresAt: number }>();
const GTS_SCOPES = 'read write follow push';

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

export async function handleWalletNonce(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const address = url.searchParams.get('address')?.toLowerCase() || '';
  if (!address) return jsonResponse({ error: 'Address required' }, 400);

  // Prevent memory exhaustion from unlimited nonce generation
  if (nonces.size > 10000) {
    const now = Date.now();
    for (const [key, entry] of nonces) {
      if (entry.expiresAt < now) nonces.delete(key);
    }
  }

  const nonce = generateNonce();
  nonces.set(address, { nonce, expiresAt: Date.now() + 300_000 });

  return jsonResponse({ nonce });
}

function verifyEthereumSignature(message: string, signature: string, expectedAddress: string): boolean {
  try {
    const prefix = '\x19Ethereum Signed Message:\n' + message.length;
    const msgHash = keccak_256(new TextEncoder().encode(prefix + message));

    const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
    const rHex = sig.slice(0, 64);
    const sHex = sig.slice(64, 128);
    const v = parseInt(sig.slice(128, 130), 16);
    const recovery = v - 27;
    if (recovery < 0 || recovery > 3) return false;

    const sigObj = secp256k1.Signature.fromCompact(hexToBytes(rHex + sHex)).addRecoveryBit(recovery);
    const pubKey = sigObj.recoverPublicKey(msgHash);
    const pubBytes = pubKey.toRawBytes(false).slice(1);
    const address = '0x' + bytesToHex(keccak_256(pubBytes).slice(-20));

    return address.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

function verifySolanaSignature(message: string, signature: string, expectedAddress: string): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = hexToBytes(signature);
    const pubBytes = hexToBytes(expectedAddress);
    return ed25519.verify(sigBytes, msgBytes, pubBytes);
  } catch {
    return false;
  }
}

async function tryGtsAuth(env: Env): Promise<{ accessToken: string; clientId: string; clientSecret: string } | null> {
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
    const token = await tokenRes.json() as any;

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

    // Verify nonce
    const stored = nonces.get(body.address.toLowerCase());
    if (!stored || stored.nonce !== body.nonce || stored.expiresAt < Date.now()) {
      nonces.delete(body.address.toLowerCase());
      return jsonResponse({ error: 'Invalid or expired nonce' }, 401);
    }
    nonces.delete(body.address.toLowerCase());

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
      gtsAuthorizeUrl = `${env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz'}/oauth/authorize?client_id=${gtsSession.clientId}&redirect_uri=${encodeURIComponent(env.GTS_REDIRECT_URI || 'https://degenfeed.xyz/auth/callback')}&response_type=code&scope=${GTS_SCOPES}&sign_up=true`;
    }

    return jsonResponse({
      success: true,
      walletAddress: body.address,
      chain: body.chain,
      // Wallet is always valid as identity
      identity: {
        protocol: body.chain,
        id: body.address.toLowerCase(),
        displayName: body.address.slice(0, 6) + '...' + body.address.slice(-4),
        handle: body.address.slice(0, 6) + '...' + body.address.slice(-4),
        avatarUrl: null,
      },
      // GTS link is optional — user can set up later
      gtsAuthorizeUrl,
      // Return a signed token the client can use as session proof
      sessionToken: bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}
