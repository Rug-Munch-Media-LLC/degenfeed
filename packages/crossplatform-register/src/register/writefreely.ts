/**
 * @degenfeed/crossplatform-register — WriteFreely registration
 *
 * Creates a user account on a self-hosted WriteFreely instance.
 * WriteFreely is a federated long-form publishing platform (ActivityPub).
 *
 * WriteFreely does not expose a JSON registration API on OSS self-hosted.
 * We use the web signup form (POST /auth/signup) and then login to get an API token.
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
    const nodeInfoRes = await fetch(`${apiBase}/nodeinfo`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (!nodeInfoRes.ok) {
      return {
        platform: 'writefreely',
        status: 'failed',
        error: `WriteFreely instance ${instanceUrl} is unreachable`,
      };
    }

    const nodeInfo = (await nodeInfoRes.json()) as {
      openRegistrations?: boolean;
      software?: { name?: string; version?: string };
    };
    if (!nodeInfo.openRegistrations) {
      return {
        platform: 'writefreely',
        status: 'failed',
        error: `Registration is closed on ${instanceUrl}. Contact the admin.`,
      };
    }

    // Step 2: Register account via web signup form
    const password = generateWriteFreelyPassword();
    const email = `${walletAddress.slice(2, 10)}-wf@register.degenfeed.xyz`;

    const registerRes = await fetch(`${instanceUrl}/auth/signup`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'DegenFeed/0.1',
      },
      body: new URLSearchParams({
        alias: desiredUsername,
        pass: password,
        email,
      }).toString(),
      // 302 redirect is expected on success; follow it so we get the session cookie
      redirect: 'manual',
    });

    // Registration via web form returns 302 Found on success
    if (registerRes.status !== 302) {
      const errText = await registerRes.text().catch(() => '');
      // 409 or 400 often means "already taken" in OSS WriteFreely
      if (registerRes.status === 409 || registerRes.status === 400) {
        return {
          platform: 'writefreely',
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }
      return {
        platform: 'writefreely',
        status: 'failed',
        error: errText || `WriteFreely registration failed with HTTP ${registerRes.status}`,
      };
    }

    // Step 3: Obtain access token via API login
    let accessToken = '';
    const tokenRes = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
        accept: 'application/json',
      },
      body: JSON.stringify({
        alias: desiredUsername,
        pass: password,
      }),
    });

    if (tokenRes.ok) {
      const tokenData = (await tokenRes.json()) as {
        data?: { access_token?: string };
        access_token?: string;
      };
      accessToken = tokenData.data?.access_token ?? tokenData.access_token ?? '';
    }

    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      accessToken,
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
