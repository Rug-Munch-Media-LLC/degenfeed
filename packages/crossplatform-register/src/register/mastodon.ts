import type { PlatformRegistration, RegisterOptions } from './types';

function generateMastodonPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 24; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export async function registerMastodon(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions & { mastodonRedirectUri?: string },
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.mastodonInstanceUrl || 'https://social.degenfeed.xyz';
    const lookupRes = await fetch(
      `${instanceUrl}/api/v1/accounts/lookup?acct=${encodeURIComponent(desiredUsername)}`,
      { headers: { 'user-agent': 'DegenFeed/0.1' } },
    );
    if (lookupRes.ok)
      return {
        platform: 'mastodon',
        status: 'failed',
        error: `@${desiredUsername} is already taken on this Mastodon instance`,
      };
    const appRes = await fetch(`${instanceUrl}/api/v1/apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        client_name: 'DegenFeed',
        redirect_uris: opts.mastodonRedirectUri || 'urn:ietf:wg:oauth:2.0:oob',
        scopes: 'read write follow',
        website: 'https://degenfeed.xyz',
      }),
    });
    const appData = (await appRes.json()) as {
      client_id?: string;
      client_secret?: string;
      error?: string;
    };
    if (!appRes.ok || !appData.client_id)
      return {
        platform: 'mastodon',
        status: 'failed',
        error: appData.error || 'Failed to register Mastodon app',
      };
    const password = generateMastodonPassword();
    const createRes = await fetch(`${instanceUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        username: desiredUsername,
        email: `${walletAddress.slice(0, 8)}-df@register.degenfeed.xyz`,
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
    if (!createRes.ok || !createData.id)
      return {
        platform: 'mastodon',
        status: 'failed',
        error: createData.error || 'Mastodon account creation failed',
      };
    const tokenRes = await fetch(`${instanceUrl}/oauth/token`, {
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
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokenData.access_token)
      return {
        platform: 'mastodon',
        status: 'failed',
        error: 'Account created but failed to obtain access token',
      };
    // Encrypt the access token using the caller-supplied seal function before KV storage.
    // The raw token is never stored in plaintext — only the AES-256-GCM sealed blob.
    const accessTokenToStore = opts.sealSecret
      ? await opts.sealSecret(tokenData.access_token)
      : tokenData.access_token;
    const accountInfo: Record<string, string> = {
      accountId: createData.id,
      username: createData.username || desiredUsername,
      instance: instanceUrl,
      _sealedAccessToken: accessTokenToStore,
    };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('mastodon', walletAddress, accountInfo, opts.storage);
    return {
      platform: 'mastodon',
      status: 'created',
      username: `${desiredUsername}@${new URL(instanceUrl).hostname}`,
      accountInfo: {
        accountId: createData.id,
        username: createData.username || desiredUsername,
        instance: instanceUrl,
      },
    };
  } catch (err) {
    return {
      platform: 'mastodon',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Mastodon registration error',
    };
  }
}
