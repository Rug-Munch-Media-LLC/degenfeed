/**
 * @degenfeed/crossplatform-register — PeerTube registration
 *
 * Creates a user account on a PeerTube instance.
 * PeerTube uses OAuth 2.0 + REST API. Registration must be enabled by admin.
 *
 * API docs: https://docs.joinpeertube.org/api/reference#operation/registerUser
 * Endpoint: POST /api/v1/users/register
 *
 * Self-hosted instance: https://video.degenfeed.xyz
 * Note: Registration may be disabled or behind Cloudflare on production instances.
 * Falls back to manual signup instructions if API is unavailable.
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerPeerTube(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.peertubeInstanceUrl || 'https://video.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;

    // Step 1: Check if instance allows registration
    const configRes = await fetch(`${apiBase}/config`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });
    if (!configRes.ok) {
      return {
        platform: 'peertube',
        status: 'failed',
        error: `PeerTube instance ${instanceUrl} is unreachable or behind Cloudflare`,
      };
    }

    const config = (await configRes.json()) as {
      signup?: { allowed?: boolean; requiresEmailVerification?: boolean };
      instance?: { name?: string };
    };

    if (!config.signup?.allowed) {
      return {
        platform: 'peertube',
        status: 'failed',
        error: `Registration is disabled on ${instanceUrl}. Sign up manually at ${instanceUrl}/signup`,
      };
    }

    // Step 2: Check username availability via existing user search
    const lookupRes = await fetch(
      `${apiBase}/users?search=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );
    if (lookupRes.ok) {
      const lookupData = (await lookupRes.json()) as {
        data?: Array<{ username: string }>;
        total?: number;
      };
      if ((lookupData.total ?? 0) > 0) {
        const exists = lookupData.data?.some(
          (u) => u.username === desiredUsername || u.username === `@${desiredUsername}`,
        );
        if (exists) {
          return {
            platform: 'peertube',
            status: 'failed',
            error: `@${desiredUsername} is already taken on ${instanceUrl}`,
          };
        }
      }
    }

    // Step 3: Register user
    const password = generatePeerTubePassword();
    const email = `${walletAddress.slice(2, 10)}-pt@register.degenfeed.xyz`;
    const displayName = `DegenFeed User ${walletAddress.slice(2, 8)}`;

    const registerRes = await fetch(`${apiBase}/users/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
        accept: 'application/json',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        displayName,
        email,
      }),
    });

    if (!registerRes.ok) {
      // Most PeerTube instances behind Cloudflare return HTML errors
      const contentType = registerRes.headers.get('content-type') || '';
      let errMsg = `PeerTube registration failed with HTTP ${registerRes.status}`;

      if (contentType.includes('json')) {
        const errData = (await registerRes.json()) as {
          error?: string;
          errors?: Record<string, string>;
        };
        errMsg = errData.error || Object.values(errData.errors || {}).join(', ') || errMsg;
      } else if (registerRes.status === 403) {
        errMsg = `Registration may be disabled or behind Cloudflare on ${instanceUrl}. Manual signup at ${instanceUrl}/signup`;
      }

      return {
        platform: 'peertube',
        status: 'failed',
        error: errMsg,
      };
    }

    const registerData = (await registerRes.json()) as {
      user?: { id: number; username: string };
      emailVerified?: boolean;
      account?: { id: number; name: string; url: string };
      oauthClient?: { client_id: string; client_secret: string };
    };

    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      userId: String(registerData.user?.id ?? ''),
      accountName: registerData.account?.name ?? desiredUsername,
      accountUrl: registerData.account?.url ?? `${instanceUrl}/accounts/${desiredUsername}`,
      email,
      emailVerified: String(registerData.emailVerified ?? false),
    };

    if (registerData.oauthClient) {
      accountInfo.oauthClientId = registerData.oauthClient.client_id;
      accountInfo.oauthClientSecret = registerData.oauthClient.client_secret;
    }

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('peertube', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'peertube',
      status: registerData.emailVerified !== false ? 'created' : 'pending',
      username: `${desiredUsername}@${new URL(instanceUrl).hostname}`,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'peertube',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown PeerTube registration error',
    };
  }
}

function generatePeerTubePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
