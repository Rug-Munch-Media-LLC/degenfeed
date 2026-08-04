/**
 * @degenfeed/crossplatform-register — Mobilizon registration
 *
 * Creates a user account on a self-hosted Mobilizon instance.
 * Mobilizon is a federated events management platform (ActivityPub).
 *
 * API: Mobilizon REST API
 * - Registration: POST /api/registrations
 * - Token: POST /api/auth/token
 *
 * Self-hosted instance: https://events.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerMobilizon(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = 'https://events.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

    // Step 1: Check instance health
    const healthRes = await fetch(`${apiBase}/health`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });

    if (!healthRes.ok) {
      // Try config endpoint as fallback
      const configRes = await fetch(`${apiBase}/config`, {
        headers: { 'user-agent': 'DegenFeed/0.1' },
      });
      if (!configRes.ok) {
        return {
          platform: 'mobilizon',
          status: 'failed',
          error: `Mobilizon instance ${instanceUrl} is unreachable`,
        };
      }
    }

    // Step 2: Check registration is open
    const configRes = await fetch(`${apiBase}/config`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (configRes.ok) {
      const configData = (await configRes.json()) as {
        registrations_open?: boolean;
        closed?: boolean;
      };
      if (configData.registrations_open === false || configData.closed === true) {
        return {
          platform: 'mobilizon',
          status: 'failed',
          error: `Registration is closed on ${instanceUrl}. Contact the admin.`,
        };
      }
    }

    // Step 3: Check username availability via a search
    const searchRes = await fetch(
      `${apiBase}/profiles?username=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        total?: number;
        elements?: Array<{ preferredUsername?: string }>;
      };
      if ((searchData.total ?? 0) > 0) {
        return {
          platform: 'mobilizon',
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }
    }

    // Step 4: Register new account
    const password = generateMobilizonPassword();
    const email = `${walletAddress.slice(2, 10)}-mz@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/registrations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        email,
        locale: 'en',
      }),
    });

    if (!registerRes.ok) {
      const errData = (await registerRes.json().catch(() => ({}))) as {
        error?: string;
        errors?: Record<string, string[]>;
      };

      if (registerRes.status === 422 || registerRes.status === 400) {
        // Check if username is the issue
        const fieldErrors = errData.errors ?? {};
        if (
          Object.values(fieldErrors).some((msgs) =>
            msgs.some(
              (m) => m.toLowerCase().includes('username') || m.toLowerCase().includes('taken'),
            ),
          )
        ) {
          return {
            platform: 'mobilizon',
            status: 'failed',
            error: `@${desiredUsername} is already taken on ${instanceUrl}`,
          };
        }
      }

      return {
        platform: 'mobilizon',
        status: 'failed',
        error:
          errData.error ||
          Object.values(errData.errors ?? {})
            .flat()
            .join(', ') ||
          `Mobilizon registration failed with HTTP ${registerRes.status}`,
      };
    }

    const registerData = (await registerRes.json()) as {
      user?: { id: string; email: string };
      access_token?: string;
    };

    // Step 5: Obtain authentication token
    let accessToken = registerData.access_token ?? '';
    if (!accessToken) {
      const tokenRes = await fetch(`${apiBase}/auth/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'DegenFeed/0.1',
        },
        body: JSON.stringify({
          username: desiredUsername,
          password,
          grant_type: 'password',
          client_id: 'degenfeed',
          client_secret: 'degenfeed_secret',
        }),
      });

      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          refresh_token?: string;
        };
        accessToken = tokenData.access_token ?? '';
      }
    }

    // Step 6: Fetch full profile
    let profileUrl = `${instanceUrl}/@${desiredUsername}`;
    if (accessToken) {
      const profileRes = await fetch(`${apiBase}/profile`, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'user-agent': 'DegenFeed/0.1',
        },
      });
      if (profileRes.ok) {
        const profileData = (await profileRes.json()) as {
          id?: string;
          preferredUsername?: string;
          url?: string;
        };
        profileUrl = profileData.url ?? profileUrl;
      }
    }

    // Encrypt the access token using the caller-supplied seal function before KV storage.
    // The raw token is never stored in plaintext — only the AES-256-GCM sealed blob.
    const accessTokenToStore = opts.sealSecret ? await opts.sealSecret(accessToken) : accessToken;
    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      _sealedAccessToken: accessTokenToStore,
      userId: String(registerData.user?.id ?? ''),
      profileUrl,
      email,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('mobilizon', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'mobilizon',
      status: 'created',
      username: `${desiredUsername}@events.degenfeed.xyz`,
      accountInfo: {
        username: desiredUsername,
        instance: instanceUrl,
        userId: String(registerData.user?.id ?? ''),
        profileUrl,
        email,
      },
    };
  } catch (err) {
    return {
      platform: 'mobilizon',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Mobilizon registration error',
    };
  }
}

function generateMobilizonPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
