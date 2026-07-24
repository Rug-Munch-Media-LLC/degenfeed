/**
 * Lens Protocol Poster — Gasless publication via Momoka pathway
 *
 * Uses Lens API v2 (https://api-v2.lens.dev/graphql) for:
 *   - SIWE authentication (challenge + sign + verify)
 *   - Momoka gasless publication (no MATIC needed)
 *
 * Posting flow:
 *   1. Call authenticateLens() once to get a JWT
 *   2. Store the JWT as LENS_JWT env var
 *   3. Call publishToLens() with text, profileId, and JWT
 *
 * Requires ethers or viem for SIWE signing (authenticateLens).
 * publishToLens only needs native fetch + crypto.
 */

const LENS_API_URL = 'https://api-v2.lens.dev/graphql';

// ─── Internal GraphQL Client ──────────────────────────────────────────────

interface GqlResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

async function lensGql(
  query: string,
  variables?: Record<string, unknown>,
  jwt?: string,
): Promise<GqlResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'DegenFeed-Bridge/0.1',
  };
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
    headers['X-Access-Token'] = jwt;
  }

  const res = await fetch(LENS_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Lens API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<GqlResponse>;
}

// ─── Signing Helpers ───────────────────────────────────────────────────────

async function deriveAddress(privateKey: string): Promise<string> {
  try {
    const ethers = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  } catch {
    // ethers not available
  }

  try {
    const { privateKeyToAccount } = await import('viem/accounts');
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(key as `0x${string}`);
    return account.address;
  } catch {
    // viem not available
  }

  throw new Error(
    'Cannot derive address: install ethers (pnpm add ethers) or viem (pnpm add viem)',
  );
}

async function signMessage(message: string, privateKey: string): Promise<string> {
  try {
    const ethers = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    return await wallet.signMessage(message);
  } catch {
    // ethers not available
  }

  try {
    const { privateKeyToAccount } = await import('viem/accounts');
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(key as `0x${string}`);
    const signature = await account.signMessage({ message });
    return signature;
  } catch {
    // viem not available
  }

  throw new Error(
    'Cannot sign message: install ethers (pnpm add ethers) or viem (pnpm add viem)',
  );
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get a SIWE challenge from the Lens API for the given profile.
 */
export async function getChallenge(profileId: string): Promise<{ text: string; id: string }> {
  const query = `
    query Challenge($request: ChallengeRequest!) {
      challenge(request: $request) {
        text
        id
      }
    }
  `;

  const response = await lensGql(query, {
    request: { signedBy: { profileId } },
  });

  const challenge = response?.data?.challenge as { text?: string; id?: string } | undefined;
  if (!challenge?.text || !challenge?.id) {
    throw new Error(
      `Failed to get Lens challenge: ${response?.errors?.[0]?.message || 'unknown error'}`,
    );
  }

  return { text: challenge.text, id: challenge.id };
}

/**
 * Authenticate with Lens Protocol using a wallet private key.
 *
 * Uses SIWE (Sign In With Ethereum) flow:
 *   1. Challenge: fetches a sign-in challenge from Lens API
 *   2. Sign: signs the challenge with the wallet private key (EIP-191)
 *   3. Verify: submits the signature to receive a JWT access token
 *
 * Requires either `ethers` or `viem` to be installed for the signing step.
 *
 * @param profileId - Lens Profile ID (hex string, e.g. "0x01")
 * @param walletPrivateKey - Ethereum wallet private key (hex, with or without 0x prefix)
 * @returns Object with `ok` boolean, `jwt` string on success, or `error` message
 */
export async function authenticateLens(
  profileId: string,
  walletPrivateKey: string,
): Promise<{ ok: boolean; jwt?: string; error?: string }> {
  try {
    const pk = walletPrivateKey.startsWith('0x') ? walletPrivateKey : `0x${walletPrivateKey}`;

    // Step 1: Get challenge
    const { text: challengeText, id: challengeId } = await getChallenge(profileId);
    console.log('[lens-poster] Got challenge:', challengeText.slice(0, 60), '...');

    // Step 2: Sign the challenge
    const signature = await signMessage(challengeText, pk);
    console.log('[lens-poster] Signed challenge');

    // Step 3: Verify and get JWT
    const mutation = `
      mutation Verify($request: SignedAuthChallenge!) {
        verify(request: $request) {
          accessToken
          refreshToken
        }
      }
    `;

    const verifyResponse = await lensGql(
      mutation,
      { request: { id: challengeId, signature } },
    );

    const result = verifyResponse?.data?.verify as
      | { accessToken?: string; refreshToken?: string }
      | undefined;
    if (!result?.accessToken) {
      throw new Error(
        `Lens verification failed: ${verifyResponse?.errors?.[0]?.message || 'unknown error'}`,
      );
    }

    console.log('[lens-poster] Authenticated, got JWT');
    return { ok: true, jwt: result.accessToken };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[lens-poster] Authentication failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Publish a text post to Lens Protocol via the Momoka (gasless) pathway.
 *
 * Uses the `createMomokaPublication` GraphQL mutation which publishes
 * content off-chain through Lens's Momoka network — no MATIC required.
 *
 * @param text - Post content (max 5000 chars; truncated automatically)
 * @param profileId - Lens Profile ID (hex string, e.g. "0x01")
 * @param jwtToken - Valid JWT from authenticateLens() or LENS_JWT env var
 * @returns Object with `ok` boolean, `publicationId` string on success, or `error` message
 */
export async function publishToLens(
  text: string,
  profileId: string,
  jwtToken: string,
): Promise<{ ok: boolean; publicationId?: string; error?: string }> {
  try {
    // Truncate to Lens's maximum post length (5000 chars)
    const content = text.length > 5000 ? text.slice(0, 4970) + '...' : text;

    // Build Lens-compatible publication metadata (v2.0 format)
    const metadata = {
      version: '2.0',
      content,
      locale: 'en',
      mainContentFocus: 'TEXT_ONLY',
      metadata_id: `degenfeed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: 'Cross-posted via DegenFeed Bridge',
      attributes: [],
      tags: ['degenfeed', 'crosspost'],
      appId: 'degenfeed-bridge',
    };

    // Momoka publication mutation
    const mutation = `
      mutation CreateMomokaPublication($request: MomokaPublicationRequest!) {
        createMomokaPublication(request: $request) {
          ... on CreateMomokaPublicationResult {
            id
            proof
          }
          ... on MomokaPublicationError {
            reason
          }
        }
      }
    `;

    // Use an inline data URI for the contentURI.
    const contentURI = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

    const response = await lensGql(
      mutation,
      { request: { profileId, contentURI } },
      jwtToken,
    );

    const result = response?.data?.createMomokaPublication as
      | { id?: string; proof?: string; reason?: string }
      | undefined;

    if (result?.id) {
      console.log(`[lens-poster] ✓ Published Momoka publication: ${result.id}`);
      return { ok: true, publicationId: result.id };
    }

    if (result?.reason) {
      console.error(`[lens-poster] Momoka rejected: ${result.reason}`);
      return { ok: false, error: `Momoka rejected: ${result.reason}` };
    }

    const errorMsg = response?.errors?.[0]?.message || 'Unknown error from Lens API';
    console.error('[lens-poster] Publication failed:', errorMsg);
    return { ok: false, error: errorMsg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[lens-poster] Publish error:', message);
    return { ok: false, error: message };
  }
}
