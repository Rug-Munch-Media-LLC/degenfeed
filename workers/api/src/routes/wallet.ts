import { type Env, jsonResponse } from '../index';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// In-memory nonce store (per-worker; fine for single-instance)
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

  const nonce = generateNonce();
  nonces.set(address, { nonce, expiresAt: Date.now() + 300_000 }); // 5 min

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
    const pubBytes = pubKey.toRawBytes(false).slice(1); // drop prefix
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

async function createGtsSession(env: Env, walletAddress: string, chain: string): Promise<Record<string, any> | null> {
  try {
    // Check if this wallet already has a GotoSocial account
    const gtsConfig = {
      apiBase: env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz',
      clientId: env.GTS_CLIENT_ID,
      clientSecret: env.GTS_CLIENT_SECRET,
    };

    // Try to authenticate as the app to get an admin token
    // For now, create an app token and return it
    const appRes = await fetch(`${gtsConfig.apiBase}/api/v1/apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'DegenFeed Web3',
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: GTS_SCOPES,
        website: 'https://degenfeed.xyz',
      }),
    });

    if (!appRes.ok) return null;
    const app = await appRes.json() as any;

    // Get an OAuth token for this app (without user interaction — this gives a user-less token)
    // For actual user accounts, we'd redirect through OAuth, but for web3 we'll
    // create an account via the API if supported, or use a different approach
    const tokenRes = await fetch(`${gtsConfig.apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: app.client_id,
        client_secret: app.client_secret,
        scope: GTS_SCOPES,
      }).toString(),
    });

    if (!tokenRes.ok) return null;
    const token = await tokenRes.json() as any;

    return {
      accessToken: token.access_token,
      clientId: app.client_id,
      clientSecret: app.client_secret,
      walletAddress,
      chain,
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

    // Create/link GotoSocial session
    const session = await createGtsSession(env, body.address, body.chain);

    // Fetch existing GotoSocial profile to check if account exists
    let profile: Record<string, any> | null = null;
    if (session?.accessToken) {
      try {
        const profileRes = await fetch(`${env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz'}/api/v1/accounts/verify_credentials`, {
          headers: { authorization: 'Bearer ' + session.accessToken },
        });
        if (profileRes.ok) {
          profile = await profileRes.json() as Record<string, any>;
        }
      } catch { /* ignore */ }

      // If no existing profile, this is a first-time login
      // The user will need to set up their GotoSocial account via OAuth
      if (!profile) {
        // Return a setup URL
        const authorizeUrl = `${env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz'}/oauth/authorize?client_id=${session.clientId}&redirect_uri=${encodeURIComponent(env.GTS_REDIRECT_URI || 'https://degenfeed.xyz/auth/callback')}&response_type=code&scope=${GTS_SCOPES}&sign_up=true`;
        return jsonResponse({
          success: true,
          requiresAccount: true,
          authorizeUrl,
          walletAddress: body.address,
          chain: body.chain,
        });
      }
    }

    return jsonResponse({
      success: true,
      walletAddress: body.address,
      chain: body.chain,
      profile,
      session,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}
