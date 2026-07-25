/**
 * @degenfeed/crossplatform-register — Owncast registration
 *
 * Creates a user account on a self-hosted Owncast instance.
 * Owncast is a federated live streaming platform (single-streamer per instance
 * by design, but we manage multiple instances).
 *
 * Owncast API:
 *   - Health: GET /api/status
 *   - Create user: POST /api/admin/users (requires admin key)
 *
 * Self-hosted instance: https://live.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerOwncast(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.owncastInstanceUrl || 'https://live.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;
    const adminKey = opts.owncastAdminKey || '';

    // Step 1: Check instance health
    const healthRes = await fetch(`${apiBase}/status`, {
      headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
    });

    if (!healthRes.ok) {
      return {
        platform: 'owncast' as const,
        status: 'failed',
        error: `Owncast instance ${instanceUrl} is unreachable`,
      };
    }

    // Owncast doesn't have multi-user by default; we manage per-streamer instances.
    // For a multi-user pattern, we store the stream key and admin access.
    const password = generateOwncastPassword();
    const email = `${walletAddress.slice(2, 10)}-oc@register.degenfeed.xyz`;

    // Create user via admin API (Owncast v0.1+)
    const createRes = await fetch(`${apiBase}/admin/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
        ...(adminKey ? { authorization: `Bearer ${adminKey}` } : {}),
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        email,
        displayName: desiredUsername,
      }),
    });

    if (!createRes.ok) {
      // Owncast may return 409 if user exists or 400 on validation
      if (createRes.status === 409) {
        return {
          platform: 'owncast' as const,
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }
      const errText = await createRes.text().catch(() => '');
      return {
        platform: 'owncast' as const,
        status: 'failed',
        error: errText || `Owncast registration failed with HTTP ${createRes.status}`,
      };
    }

    const createData = (await createRes.json().catch(() => ({}))) as {
      user?: { id: string; displayName: string };
      streamKey?: string;
      accessToken?: string;
    };

    // Step 3: Get stream key for live streaming
    let streamKey = createData.streamKey || '';
    if (!streamKey && adminKey) {
      const streamRes = await fetch(`${apiBase}/admin/streamkey`, {
        headers: {
          authorization: `Bearer ${adminKey}`,
          'user-agent': 'DegenFeed/0.1',
        },
      });
      if (streamRes.ok) {
        const streamData = (await streamRes.json()) as { streamKey?: string };
        streamKey = streamData.streamKey || '';
      }
    }

    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      userId: String(createData.user?.id ?? ''),
      displayName: createData.user?.displayName || desiredUsername,
      streamKey,
      accessToken: createData.accessToken || '',
      profileUrl: `${instanceUrl}/`,
      email,
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('owncast', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'owncast' as const,
      status: 'created',
      username: `${desiredUsername}@live.degenfeed.xyz`,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'owncast' as const,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Owncast registration error',
    };
  }
}

function generateOwncastPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
