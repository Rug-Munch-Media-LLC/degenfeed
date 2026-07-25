/**
 * @degenfeed/crossplatform-register — WriteFreely registration
 *
 * Creates a user account on a self-hosted WriteFreely instance.
 * WriteFreely is a federated long-form publishing platform (ActivityPub).
 *
 * API: POST /api/account/new  (WriteFreely v0.15+)
 *
 * Self-hosted instance: https://blog.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerWriteFreely(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = 'https://blog.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

    // Step 1: Check instance health and registration status
    const instanceRes = await fetch(`${apiBase}/instance`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (!instanceRes.ok) {
      return {
        platform: 'writefreely',
        status: 'failed',
        error: `WriteFreely instance ${instanceUrl} is unreachable`,
      };
    }

    // Step 2: Register account
    const password = generateWriteFreelyPassword();
    const email = `${walletAddress.slice(2, 10)}-wf@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/account/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        email,
        alias: desiredUsername,
      }),
    });

    if (!registerRes.ok) {
      const errText = await registerRes.text().catch(() => '');
      // Check if user already exists
      if (registerRes.status === 409 || registerRes.status === 400) {
        const searchRes = await fetch(
          `${apiBase}/collections?alias=${encodeURIComponent(desiredUsername)}`,
          { headers: { 'user-agent': 'DegenFeed/0.1' } },
        );
        if (searchRes.ok) {
          return {
            platform: 'writefreely',
            status: 'failed',
            error: `@${desiredUsername} is already taken on ${instanceUrl}`,
          };
        }
      }
      return {
        platform: 'writefreely',
        status: 'failed',
        error: errText || `WriteFreely registration failed with HTTP ${registerRes.status}`,
      };
    }

    const registerData = (await registerRes.json()) as {
      user?: { id: number; username: string };
      collection?: { alias: string; title: string };
      access_token?: string;
    };

    // Step 3: Obtain access token
    let accessToken = registerData.access_token;
    if (!accessToken) {
      const tokenRes = await fetch(`${instanceUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          username: desiredUsername,
          password,
          client_id: 'degenfeed',
          client_secret: 'degenfeed_secret',
        }),
      });
      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        accessToken = tokenData.access_token;
      }
    }

    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      userId: String(registerData.user?.id ?? ''),
      collectionAlias: registerData.collection?.alias ?? desiredUsername,
      accessToken: accessToken ?? '',
      profileUrl: `${instanceUrl}/${desiredUsername}`,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('writefreely', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'writefreely',
      status: 'created',
      username: `${desiredUsername}@blog.degenfeed.xyz`,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'writefreely',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown WriteFreely registration error',
    };
  }
}

function generateWriteFreelyPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
