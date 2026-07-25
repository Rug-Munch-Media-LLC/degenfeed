/**
 * @degenfeed/crossplatform-register — Funkwhale registration
 *
 * Creates a user account on a self-hosted Funkwhale instance.
 * Funkwhale is a federated music/audio sharing platform (ActivityPub).
 *
 * API: Funkwhale REST API v1, OAuth2 token-based auth
 * - Registration: POST /api/v1/users/register
 * - Token: POST /api/v1/oauth/token
 *
 * Self-hosted instance: https://music.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerFunkwhale(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = 'https://music.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;

    // Step 1: Check instance settings
    const settingsRes = await fetch(`${apiBase}/instance/settings`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });

    if (!settingsRes.ok) {
      // Try the settings endpoint
      const instanceRes = await fetch(`${apiBase}/instance`, {
        headers: { 'user-agent': 'DegenFeed/0.1' },
      });
      if (!instanceRes.ok) {
        return {
          platform: 'funkwhale',
          status: 'failed',
          error: `Funkwhale instance ${instanceUrl} is unreachable`,
        };
      }
    }

    // Step 2: Check username availability
    const lookupRes = await fetch(
      `${apiBase}/users?username=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );
    if (lookupRes.ok) {
      const lookupData = (await lookupRes.json()) as {
        count?: number;
        results?: Array<{ username: string }>;
      };
      if ((lookupData.count ?? 0) > 0) {
        return {
          platform: 'funkwhale',
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }
    }

    // Step 3: Register user
    const password = generateFunkwhalePassword();
    const email = `${walletAddress.slice(2, 10)}-fw@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/users/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        email,
      }),
    });

    if (!registerRes.ok) {
      const errData = (await registerRes.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      return {
        platform: 'funkwhale',
        status: 'failed',
        error:
          errData.error ||
          errData.detail ||
          `Funkwhale registration failed with HTTP ${registerRes.status}`,
      };
    }

    // Step 4: Obtain OAuth2 token
    const tokenRes = await fetch(`${apiBase}/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'DegenFeed/0.1',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: desiredUsername,
        password,
        client_id: 'degenfeed',
        client_secret: 'degenfeed_secret',
      }).toString(),
    });

    let accessToken = '';
    if (tokenRes.ok) {
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
      };
      accessToken = tokenData.access_token ?? '';
    }

    // Step 5: Get user profile info
    let userId = '';
    let displayName = desiredUsername;
    if (accessToken) {
      const profileRes = await fetch(`${apiBase}/users/me`, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'user-agent': 'DegenFeed/0.1',
        },
      });
      if (profileRes.ok) {
        const profileData = (await profileRes.json()) as {
          id?: number;
          username?: string;
          display_name?: string;
        };
        userId = String(profileData.id ?? '');
        displayName = profileData.display_name || profileData.username || desiredUsername;
      }
    }

    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      displayName,
      instance: instanceUrl,
      accessToken,
      userId,
      profileUrl: `${instanceUrl}/library/${desiredUsername}`,
      email,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('funkwhale', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'funkwhale',
      status: 'created',
      username: `${desiredUsername}@music.degenfeed.xyz`,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'funkwhale',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Funkwhale registration error',
    };
  }
}

function generateFunkwhalePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
