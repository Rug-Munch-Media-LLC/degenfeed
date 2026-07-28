/**
 * @degenfeed/crossplatform-register — Pixelfed registration
 *
 * Pixelfed (v0.12.x) runs on Laravel and does NOT expose a REST API for
 * account creation — registration is only available via the web form
 * or the Artisan CLI (`php artisan user:create`).
 *
 * For our self-hosted instance (photos.degenfeed.xyz), the bridge's SSO
 * provisioning layer handles registration via docker exec. This module
 * handles the check and returns an appropriate message if the API is
 * unavailable.
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
    const isOwnInstance = instanceUrl.includes('photos.degenfeed.xyz');

    // Step 1: Check instance status
    const instanceRes = await fetch(`${apiBase}/instance`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (instanceRes.ok) {
      const instanceData = (await instanceRes.json()) as {
        registrations?: boolean;
        approval_required?: boolean;
      };
      if (instanceData.registrations === false && !isOwnInstance) {
        return {
          platform: 'pixelfed',
          status: 'failed',
          error: `Registrations closed on ${instanceUrl}. Sign up manually.`,
        };
      }
    }

    const password = generatePixelfedPassword();
    const email = `${walletAddress.slice(2, 10)}-pf@register.degenfeed.xyz`;

    // For our own instance: registration is handled by the bridge's SSO layer
    // via docker exec. This module detects our instance and reports the
    // registration status based on bridge-side processing.
    if (isOwnInstance) {
      // Attempt OAuth app flow to verify instance is up
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

      if (!appRes.ok) {
        return {
          platform: 'pixelfed',
          status: 'failed',
          error: `Pixelfed instance ${instanceUrl} unreachable or not responding.`,
        };
      }

      // Instance is up — return "pending" status since the bridge handles
      // the actual account creation via artisan CLI out-of-band
      const accountInfo: Record<string, string> = {
        username: desiredUsername,
        instance: instanceUrl,
        email,
        note: 'Registration queued via bridge artisan handler',
      };

      const { persistPlatformAccount } = await import('./kv');
      await persistPlatformAccount('pixelfed', walletAddress, accountInfo, opts.storage);

      return {
        platform: 'pixelfed',
        status: 'pending',
        username: `${desiredUsername}@${new URL(instanceUrl).hostname}`,
        accountInfo,
      };
    }

    // For third-party instances: try OAuth app flow (Mastodon-compatible API)
    // Step 2: Register a client app (OAuth) on the instance
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
      return await tryDirectAccountCreation(
        desiredUsername,
        walletAddress,
        instanceUrl,
        apiBase,
        opts,
        password,
        email,
      );
    }

    // Step 3: Create user account
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

    // Pixelfed returns HTML for this endpoint (no REST API)
    const contentType = createRes.headers.get('content-type') || '';
    if (!createRes.ok || contentType.includes('text/html')) {
      return {
        platform: 'pixelfed',
        status: 'failed',
        error:
          'Pixelfed does not expose a REST API for account registration. ' +
          `Sign up manually at ${instanceUrl}.`,
      };
    }

    const createData = (await createRes.json()) as {
      id?: string;
      username?: string;
      acct?: string;
      error?: string;
    };

    if (!createData.id) {
      return {
        platform: 'pixelfed',
        status: 'failed',
        error: createData.error || 'Pixelfed account creation failed',
      };
    }

    // Step 4: Obtain OAuth token
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
  password: string,
  email: string,
): Promise<PlatformRegistration> {
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

  const contentType = createRes.headers.get('content-type') || '';
  if (!createRes.ok || contentType.includes('text/html')) {
    return {
      platform: 'pixelfed',
      status: 'failed',
      error:
        'Pixelfed does not expose a REST API for account registration. ' +
        `Sign up manually at ${instanceUrl}.`,
    };
  }

  const createData = (await createRes.json()) as {
    id?: string;
    username?: string;
    error?: string;
  };

  if (!createData.id) {
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
