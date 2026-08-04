/**
 * @degenfeed/crossplatform-register — BookWyrm registration
 *
 * Creates a user account on a self-hosted BookWyrm instance.
 * BookWyrm is a federated social reading/rating platform (ActivityPub).
 *
 * API: POST /api/auth/register  (BookWyrm uses a Mastodon-compatible API)
 *
 * Self-hosted instance: https://books.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerBookWyrm(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = 'https://books.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

    // Step 1: Check instance site settings
    const siteRes = await fetch(`${apiBase}/v1/site`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });

    if (!siteRes.ok) {
      return {
        platform: 'bookwyrm',
        status: 'failed',
        error: `BookWyrm instance ${instanceUrl} is unreachable`,
      };
    }

    // Step 2: Check registration is open
    const siteData = (await siteRes.json()) as {
      registrations_open?: boolean;
      title?: string;
    };

    if (siteData.registrations_open === false) {
      return {
        platform: 'bookwyrm',
        status: 'failed',
        error: `Registration is closed on ${instanceUrl}. Contact the admin to request an account.`,
      };
    }

    // Step 3: Register via BookWyrm's API
    const password = generateBookWyrmPassword();
    const email = `${walletAddress.slice(2, 10)}-bw@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        email,
        confirm_password: password,
      }),
    });

    if (!registerRes.ok) {
      const errData = (await registerRes.json().catch(() => ({}))) as {
        error?: string;
        email?: string[];
        username?: string[];
      };

      // Check for username collision
      if (
        registerRes.status === 400 &&
        (errData.username?.some((m) => m.toLowerCase().includes('taken')) ||
          errData.error?.toLowerCase().includes('taken'))
      ) {
        return {
          platform: 'bookwyrm',
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }

      return {
        platform: 'bookwyrm',
        status: 'failed',
        error:
          errData.error ||
          Object.values(errData).flat().join(', ') ||
          `BookWyrm registration failed with HTTP ${registerRes.status}`,
      };
    }

    // Step 4: Get OAuth token for the user
    const tokenRes = await fetch(`${apiBase}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        grant_type: 'password',
        client_id: 'degenfeed',
        client_secret: 'degenfeed_secret',
      }),
    });

    let accessToken = '';
    if (tokenRes.ok) {
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        token_type?: string;
      };
      accessToken = tokenData.access_token ?? '';
    }

    // Encrypt the access token using the caller-supplied seal function before KV storage.
    // The raw token is never stored in plaintext — only the AES-256-GCM sealed blob.
    const accessTokenToStore = opts.sealSecret ? await opts.sealSecret(accessToken) : accessToken;
    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      _sealedAccessToken: accessTokenToStore,
      profileUrl: `${instanceUrl}/user/${desiredUsername}`,
      email,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('bookwyrm', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'bookwyrm',
      status: 'created',
      username: `${desiredUsername}@books.degenfeed.xyz`,
      accountInfo: {
        username: desiredUsername,
        instance: instanceUrl,
        profileUrl: `${instanceUrl}/user/${desiredUsername}`,
        email,
      },
    };
  } catch (err) {
    return {
      platform: 'bookwyrm',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown BookWyrm registration error',
    };
  }
}

function generateBookWyrmPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
