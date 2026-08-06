/**
 * @degenfeed/auth — Wallet sign-in provider (Better Auth)
 *
 * Wire protocol for EVM (SIWE) + Solana (SIWS) wallet authentication against
 * the Better Auth instance mounted on the api-server at /api/auth/better/*.
 *
 * EVM flow (official SIWE plugin):
 *   1. POST /api/auth/better/siwe/nonce      { walletAddress, chainId } → { nonce }
 *   2. Build ERC-4361 message client-side (buildSiweMessage)
 *   3. POST /api/auth/better/siwe/verify     { message, signature, walletAddress, chainId }
 *      → { token, user } + httpOnly session cookie (browser, credentials: include)
 *
 * Solana flow (custom SIWS-style plugin):
 *   1. POST /api/auth/better/solana/nonce    { walletAddress } → { nonce, message }
 *      (the server returns the EXACT message to sign — no client-side builder)
 *   2. Sign `message` with the wallet (Ed25519 detached)
 *   3. POST /api/auth/better/solana/verify   { walletAddress, signature, nonce }
 *      (signature must be base58) → { token, user } + httpOnly session cookie
 */
export interface WalletSession {
  address: string;
  chain: 'ethereum' | 'solana';
  token?: string;
  csrfToken?: string;
  gtsAuthorizeUrl?: string | null;
  profile?: Record<string, unknown> | null;
}

export interface WalletNonceResult {
  nonce: string;
  /** Server-built sign-in message — Solana only (EVM builds client-side). */
  message?: string;
}

const BETTER_AUTH_BASE = '/api/auth/better';

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || `Request failed (${res.status})`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Request a sign-in nonce for a wallet address.
 * @param chain ethereum | solana
 * @param chainId EVM chain id (default 1); ignored for solana
 */
export async function requestWalletNonce(
  address: string,
  chain: 'ethereum' | 'solana' = 'ethereum',
  chainId = 1,
): Promise<WalletNonceResult> {
  if (chain === 'solana') {
    const data = await postJson(`${BETTER_AUTH_BASE}/solana/nonce`, { walletAddress: address });
    if (!data.nonce || !data.message) throw new Error('Nonce request failed');
    return { nonce: String(data.nonce), message: String(data.message) };
  }
  const data = await postJson(`${BETTER_AUTH_BASE}/siwe/nonce`, {
    walletAddress: address,
    chainId,
  });
  if (!data.nonce) throw new Error('Nonce request failed');
  return { nonce: String(data.nonce) };
}

/**
 * Build the ERC-4361 (SIWE) message for Ethereum wallets. The message MUST
 * match the Better Auth SIWE plugin's domain binding: `domain` (default
 * window.location.host) must equal the server's SIWE_DOMAIN, and the nonce
 * must be the one returned by requestWalletNonce.
 */
export function buildSiweMessage(
  address: string,
  nonce: string,
  opts: { chainId?: number; domain?: string; uri?: string } = {},
): string {
  const domain =
    opts.domain ?? (typeof window !== 'undefined' ? window.location.host : 'degenfeed.xyz');
  const origin =
    opts.uri ?? (typeof window !== 'undefined' ? window.location.origin : 'https://degenfeed.xyz');
  const chainId = opts.chainId ?? 1;
  const now = new Date().toISOString();
  const exp = new Date(Date.now() + 300_000).toISOString();

  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to DegenFeed\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${now}\nExpiration Time: ${exp}`;
}

/**
 * Build the Solana sign-in message — kept for reference/documentation. The
 * Better Auth Solana plugin returns the authoritative message from the nonce
 * endpoint; clients should sign THAT message, not one built here.
 */
export function buildSolanaMessage(address: string, nonce: string): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'degenfeed.xyz';
  const now = new Date().toISOString();
  const exp = new Date(Date.now() + 300_000).toISOString();
  return `${domain} wants you to sign in with your Solana account:\n${address}\n\nSign in to DegenFeed\n\nNonce: ${nonce}\nIssued At: ${now}\nExpiration Time: ${exp}`;
}

export interface VerifyWalletParams {
  address: string;
  signature: string;
  chain: 'ethereum' | 'solana';
  nonce: string;
  /** EVM only — the signed ERC-4361 message. */
  message?: string;
  /** EVM only — chain id (default 1). */
  chainId?: number;
}

/**
 * Verify the wallet signature with the Better Auth server and get a session.
 * On success the server sets an httpOnly session cookie (credentials: include)
 * and returns a session token + the wallet-bound user.
 */
export async function verifyWalletSignature(params: VerifyWalletParams): Promise<WalletSession> {
  const { address, signature, chain, nonce, message, chainId } = params;

  let data: Record<string, unknown>;
  if (chain === 'solana') {
    data = await postJson(`${BETTER_AUTH_BASE}/solana/verify`, {
      walletAddress: address,
      signature,
      nonce,
    });
  } else {
    if (!message) throw new Error('SIWE message is required for EVM verification');
    data = await postJson(`${BETTER_AUTH_BASE}/siwe/verify`, {
      message,
      signature,
      walletAddress: address,
      chainId: chainId ?? 1,
    });
  }

  const user = (data.user ?? {}) as { walletAddress?: string };
  return {
    address: user.walletAddress ?? address,
    chain,
    token: data.token ? String(data.token) : undefined,
    gtsAuthorizeUrl: null,
    profile: null,
  };
}
