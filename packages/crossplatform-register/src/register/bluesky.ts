import type { PlatformRegistration, RegisterOptions } from './types';

function generateBlueskyAppPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz-123456789';
  let result = 'df-';
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export async function registerBluesky(
  desiredUsername: string,
  _walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const { acquireInviteCode, returnInviteCode } = await import('./invite-pool');
    const inviteCode = await acquireInviteCode(opts.blueskyInvitePool);
    if (!inviteCode)
      return {
        platform: 'bluesky',
        status: 'failed',
        error: 'No Bluesky invite codes available. Pool depleted.',
      };
    const pdsUrl = opts.bskyPdsUrl || 'https://bsky.social';
    const email = `user-${_walletAddress.slice(0, 8)}@register.degenfeed.xyz`;
    const appPassword = generateBlueskyAppPassword();
    const createRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({ email, handle: desiredUsername, password: appPassword, inviteCode }),
    });
    const createData = (await createRes.json()) as {
      did?: string;
      handle?: string;
      error?: string;
      message?: string;
    };
    if (!createRes.ok || !createData.did) {
      await returnInviteCode(inviteCode, opts.blueskyInvitePool);
      return {
        platform: 'bluesky',
        status: 'failed',
        error: createData.error || createData.message || 'Bluesky account creation failed',
      };
    }
    const accountInfo: Record<string, string> = {
      did: createData.did,
      handle: createData.handle || desiredUsername,
      email,
      appPassword,
    };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('bluesky', _walletAddress, accountInfo, opts.storage);
    return {
      platform: 'bluesky',
      status: 'created',
      username: createData.handle || desiredUsername,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'bluesky',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Bluesky registration error',
    };
  }
}
