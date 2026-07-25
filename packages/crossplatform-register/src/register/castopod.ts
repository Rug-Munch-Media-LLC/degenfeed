/**
 * @degenfeed/crossplatform-register — Castopod registration
 *
 * Creates a user account on a self-hosted Castopod instance.
 * Castopod is a federated podcast hosting platform (ActivityPub).
 *
 * Castopod API:
 *   - Health: GET /api/health-check
 *   - Register: POST /api/register
 *
 * Self-hosted instance: https://podcasts.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerCastopod(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.castopodInstanceUrl || 'https://podcasts.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

    // Step 1: Check instance health
    const healthRes = await fetch(`${instanceUrl}/api/health-check`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });

    if (!healthRes.ok) {
      // Try the base URL fallback
      const pingRes = await fetch(instanceUrl, {
        headers: { 'user-agent': 'DegenFeed/0.1' },
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
    const siteRes = await fetch(`${apiBase}/site`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (siteRes.ok) {
      const siteData = (await siteRes.json()) as {
        registrations_open?: boolean;
        closed?: boolean;
      };
      if (siteData.registrations_open === false || siteData.closed === true) {
        return {
          platform: 'castopod' as const,
          status: 'failed',
          error: `Registration is closed on ${instanceUrl}. Contact the admin.`,
        };
      }
    }

    // Step 3: Check username availability
    const lookupRes = await fetch(
      `${apiBase}/users/lookup?username=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );
    if (lookupRes.ok) {
      const lookupData = (await lookupRes.json()) as { exists?: boolean };
      if (lookupData.exists) {
        return {
          platform: 'castopod' as const,
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }
    }

    // Step 4: Register user
    const password = generateCastopodPassword();
    const email = `${walletAddress.slice(2, 10)}-cp@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        email,
        display_name: desiredUsername,
        agree_terms: true,
        locale: 'en',
      }),
    });

    if (!registerRes.ok) {
      const errData = (await registerRes.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (registerRes.status === 409) {
        return {
          platform: 'castopod' as const,
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
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

    const registerData = (await registerRes.json().catch(() => ({}))) as {
      user?: { id: string; username: string; display_name: string };
      token?: string;
      actor_id?: string;
      message?: string;
    };

    // Step 5: Obtain auth token
    let accessToken = registerData.token || '';
    if (!accessToken) {
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
      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        accessToken = tokenData.access_token || '';
      }
    }

    // Step 6: Get actor/profile URL
    const actorId = registerData.actor_id || `${instanceUrl}/@${desiredUsername}`;

    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      userId: String(registerData.user?.id ?? ''),
      displayName: registerData.user?.display_name || desiredUsername,
      accessToken,
      actorId,
      profileUrl: actorId,
      email,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('castopod', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'castopod' as const,
      status: 'created',
      username: `${desiredUsername}@podcasts.degenfeed.xyz`,
      accountInfo,
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
