export interface WalletSession {
  address: string;
  chain: 'ethereum' | 'solana';
  accessToken?: string;
  csrfToken?: string;
  gtsAuthorizeUrl?: string | null;
  profile?: Record<string, unknown> | null;
}

interface WalletVerifyResponse {
  success: boolean;
  walletAddress: string;
  chain: 'ethereum' | 'solana';
  sessionToken?: string;
  gtsAuthorizeUrl?: string | null;
  identity?: Record<string, unknown> | null;
}

export async function requestWalletNonce(address: string): Promise<string> {
  const res = await fetch(`/api/auth/wallet/nonce?address=${encodeURIComponent(address)}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Nonce request failed' }));
    throw new Error((err as { error: string }).error || 'Nonce request failed');
  }
  const data = (await res.json()) as Record<string, unknown>;
  const nonceData = data as unknown as { nonce?: string; message?: string };
  return nonceData.nonce ?? '';
}

/**
 * Build the SIWE message for Ethereum wallets.
 */
export function buildSiweMessage(address: string, nonce: string): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'degenfeed.xyz';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://degenfeed.xyz';
  const now = new Date().toISOString();
  const exp = new Date(Date.now() + 300_000).toISOString();

  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to DegenFeed\n\nURI: ${origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${now}\nExpiration Time: ${exp}`;
}

/**
 * Build the Solana sign-in message.
 */
export function buildSolanaMessage(address: string, nonce: string): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'degenfeed.xyz';
  const now = new Date().toISOString();
  return `${domain} wants you to sign in with your Solana account:\n${address}\n\nSign in to DegenFeed\n\nNonce: ${nonce}\nIssued At: ${now}`;
}

/**
 * Verify the wallet signature with the server and get a session.
 */
export async function verifyWalletSignature(
  address: string,
  signature: string,
  message: string,
  chain: 'ethereum' | 'solana',
  nonce: string,
): Promise<WalletSession> {
  const res = await fetch('/api/auth/wallet/verify', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, signature, message, chain, nonce }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error((err as { error: string }).error || 'Verification failed');
  }

  // Capture the CSRF token from the response header
  const csrfToken = res.headers.get('x-csrf-token') ?? undefined;

  const data = (await res.json()) as WalletVerifyResponse;
  if (!data.success) {
    throw new Error('Invalid verification response');
  }

  return {
    address: data.walletAddress,
    chain: data.chain,
    csrfToken,
    gtsAuthorizeUrl: data.gtsAuthorizeUrl ?? null,
    profile: data.identity ?? null,
  };
}
