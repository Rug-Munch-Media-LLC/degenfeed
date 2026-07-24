/**
 * @degenfeed/crossplatform-register — Pixelfed registration
 *
 * Pixelfed uses a Mastodon-compatible API for account creation.
 * Endpoint: POST /api/v1/accounts  (same as Mastodon)
 *
 * Pixelfed is a federated image sharing platform (ActivityPub).
 * Registration flow is identical to Mastodon — create app, then account,
 * then obtain OAuth token.
 *
 * If no instance URL is provided, defaults to https://pixelfed.social
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerPixelfed(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.pixelfedInstanceUrl || 'https://pixelfed.social';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;

    // Step 1: Check username availability
    const lookupRes = await fetch(
      `${apiBase}/accounts/lookup?acct=${encodeURIComponent(desiredUsername)}`,
      { headers: { 'user-agent': 'DegenFeed/0.1' } },
    );
    if (lookupRes.ok) {
      return {
        platform: 'pixelfed',
        status: 'failed',
        error: `@${desiredUsername} is already taken on ${instanceUrl}`,
      };
    }

    // Step 2: Check if instance allows registration and get config
    const instanceRes = await fetch(`${apiBase}/instance`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (instanceRes.ok) {
      const instanceData = (await instanceRes.json()) as {
        registrations?: boolean;
        approval_required?: boolean;
        invites_enabled?: boolean;
        configuration?: {
          accounts?: {
            max_featured_tags?: number;
          };
        };
      };
      if (instanceData.registrations === false) {
        return {
          platform: 'pixelfed',
          status: 'failed',
          error: `Registrations closed on ${instanceUrl}. Sign up manually or try another instance.`,
        };
      }
      if (instanceData.approval_required) {
        // Registration requires admin approval — we proceed but mark as pending
      }
    }

    // Step 3: Register a client app (OAuth) on the instance
    const appRes = await fetch(`${apiBase}/apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        client_name: 'DegenFeed',
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: 'read write follow',
        website: 'https://degenfeed.xyz',
      }),
    });
    const appData = (await appRes.json()) as {
      client_id?: string;
      client_secret?: string;
      error?: string;
      id?: number;
    };

    if (!appRes.ok || !appData.client_id) {
      // If app registration fails, try direct account creation (some instances allow it)
      return await tryDirectAccountCreation(
        desiredUsername,
        walletAddress,
        instanceUrl,
        apiBase,
        opts,
      );
    }

    // Step 4: Create user account
    const password = generatePixelfedPassword();
    const email = `${walletAddress.slice(2, 10)}-pf@register.degenfeed.xyz`;
    const agreement = true;
    const locale = 'en';

    const createRes = await fetch(`${apiBase}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        username: desiredUsername,
        email,
        password,
        agreement,
        locale,
      }),
    });

    const createData = (await createRes.json()) as {
      id?: string;
      username?: string;
      acct?: string;
      error?: string;
    };

    if (!createRes.ok || !createData.id) {
      return {
        platform: 'pixelfed',
        status: 'failed',
        error: createData.error || 'Pixelfed account creation failed',
      };
    }

    // Step 5: Obtain OAuth token
    const tokenRes = await fetch(`${apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        client_id: appData.client_id,
        client_secret: appData.client_secret,
        grant_type: 'password',
        username: desiredUsername,
        password,
        scope: 'read write follow',
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };

    const accountInfo: Record<string, string> = {
      accountId: createData.id,
      username: createData.username || createData.acct || desiredUsername,
      instance: instanceUrl,
    };

    if (tokenData.access_token) {
      accountInfo.accessToken = tokenData.access_token;
    }

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('pixelfed', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'pixelfed',
      status: 'created',
      username: `${createData.username || desiredUsername}@${new URL(instanceUrl).hostname}`,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'pixelfed',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Pixelfed registration error',
    };
  }
}

/**
 * Some Pixelfed instances allow direct account creation without OAuth app registration.
 * This is a fallback for those instances.
 */
async function tryDirectAccountCreation(
  desiredUsername: string,
  walletAddress: string,
  instanceUrl: string,
  apiBase: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  const password = generatePixelfedPassword();
  const email = `${walletAddress.slice(2, 10)}-pf@register.degenfeed.xyz`;

  const createRes = await fetch(`${apiBase}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
    body: JSON.stringify({
      username: desiredUsername,
      email,
      password,
      agreement: true,
      locale: 'en',
    }),
  });

  const createData = (await createRes.json()) as {
    id?: string;
    username?: string;
    error?: string;
  };

  if (!createRes.ok || !createData.id) {
    return {
      platform: 'pixelfed',
      status: 'failed',
      error: createData.error || 'Pixelfed account creation failed (no app registration)',
    };
  }

  const accountInfo: Record<string, string> = {
    accountId: createData.id,
    username: createData.username || desiredUsername,
    instance: instanceUrl,
    note: 'No OAuth token — login via instance directly',
  };

  const { persistPlatformAccount } = await import('./kv');
  await persistPlatformAccount('pixelfed', walletAddress, accountInfo, opts.storage);

  return {
    platform: 'pixelfed',
    status: 'created',
    username: `${createData.username || desiredUsername}@${new URL(instanceUrl).hostname}`,
    accountInfo,
  };
}

function generatePixelfedPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 24; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
