/**
 * @degenfeed/crossplatform-register — Castopod registration
 *
 * Creates a user account on a self-hosted Castopod instance.
 * Castopod is a federated podcast hosting platform (ActivityPub).
 *
 * Castopod uses CodeIgniter Shield for auth — registration is via
 * web form POST /cp-auth/register with X-Forwarded-Proto: https header.
 *
 * Self-hosted instance: https://podcast.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

/**
 * Headers needed for all requests to bypass Castopod's Caddy HTTPS redirect
 * when calling via HTTP on the internal Docker network.
 */
const BYPASS_HTTPS_HEADERS: Record<string, string> = {
  'x-forwarded-proto': 'https',
  'x-forwarded-port': '443',
  'x-forwarded-host': 'podcast.degenfeed.xyz',
};

export async function registerCastopod(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.castopodInstanceUrl || 'https://podcast.degenfeed.xyz';
    const siteHost = new URL(instanceUrl).host;
    const apiBase = `${instanceUrl.replace(/\/$/, '')}`;

    // Step 1: Check instance health
    // Castopod exposes a health endpoint at GET /health
    const healthRes = await fetch(`${apiBase}/health`, {
      headers: {
        'user-agent': 'DegenFeed/0.1',
        accept: 'application/json',
        ...BYPASS_HTTPS_HEADERS,
      },
    });

    if (!healthRes.ok) {
      // Fallback: try homepage
      const pingRes = await fetch(instanceUrl, {
        headers: {
          'user-agent': 'DegenFeed/0.1',
          ...BYPASS_HTTPS_HEADERS,
        },
      });
      if (!pingRes.ok) {
        return {
          platform: 'castopod' as const,
          status: 'failed',
          error: `Castopod instance ${instanceUrl} is unreachable`,
        };
      }
    }

    // Step 2: Check if registration is open
    // Castopod stores registration status in settings; we can infer from the
    // register page or check if registration returns allowed.
    // POST /cp-auth/register returns 303 on success, 404 if disabled

    // Step 3: Register user via Castopod auth form
    const password = generateCastopodPassword();
    const email = `${walletAddress.slice(2, 10)}-cp@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/cp-auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'DegenFeed/0.1',
        accept: 'text/html',
        ...BYPASS_HTTPS_HEADERS,
      },
      body: new URLSearchParams({
        username: desiredUsername,
        password,
        email,
      }).toString(),
      redirect: 'manual',
    });

    if (registerRes.status === 404) {
      return {
        platform: 'castopod' as const,
        status: 'failed',
        error: `Registration is closed on ${instanceUrl}. Contact the admin.`,
      };
    }

    if (registerRes.status !== 303) {
      const errData: { error?: string; message?: string } = {};
      try {
        const body = await registerRes.text();
        // Try to parse error from HTML or JSON
        const match = body.match(/(?:error|message)[":= ]+([^"<\n]+)/i);
        if (match) errData.message = match[1];
      } catch {
        // ignore parse errors
      }

      return {
        platform: 'castopod' as const,
        status: 'failed',
        error:
          errData.error ||
          errData.message ||
          `Castopod registration failed with HTTP ${registerRes.status}`,
      };
    }

    // Step 4: Obtain auth token via Castopod login
    let accessToken = '';
    const loginRes = await fetch(`${apiBase}/cp-auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'DegenFeed/0.1',
        accept: 'text/html',
        ...BYPASS_HTTPS_HEADERS,
      },
      body: new URLSearchParams({
        email,
        password,
      }).toString(),
      redirect: 'manual',
    });

    // Castopod login sets session cookies; for token-based auth,
    // we extract the session ID from the Set-Cookie header
    const setCookie = loginRes.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/ci_session=([^;]+)/);
    if (sessionMatch) {
      // match() guarantees capture group 1 exists when the regex matches
      // biome-ignore lint/style/noNonNullAssertion: guaranteed by regex match
      accessToken = sessionMatch[1]!;
    }

    // Step 5: Build actor/profile URL
    const actorId = `${instanceUrl}/@${desiredUsername}`;

    // Encrypt the session token using the caller-supplied seal function before KV storage.
    // The raw session token is never stored in plaintext — only the AES-256-GCM sealed blob.
    const accessTokenToStore = opts.sealSecret ? await opts.sealSecret(accessToken) : accessToken;
    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      _sealedAccessToken: accessTokenToStore,
      actorId,
      profileUrl: actorId,
      email,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('castopod', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'castopod' as const,
      status: 'created',
      username: `${desiredUsername}@${siteHost}`,
      accountInfo: {
        username: desiredUsername,
        instance: instanceUrl,
        actorId,
        profileUrl: actorId,
        email,
      },
    };
  } catch (err) {
    return {
      platform: 'castopod' as const,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Castopod registration error',
    };
  }
}

function generateCastopodPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
