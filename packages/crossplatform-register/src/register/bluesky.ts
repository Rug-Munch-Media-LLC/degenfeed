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
    const pdsUrl = opts.bskyPdsUrl || 'https://bsky.social';

    // Determine if this is our self-hosted PDS (which has inviteCodeRequired=false)
    const isOwnPds = pdsUrl.includes('pds.degenfeed.xyz');

    // Only acquire invite code for PDS that require it
    let inviteCode: string | null = null;
    if (!isOwnPds) {
      const invitePool = await import('./invite-pool');
      inviteCode = await invitePool.acquireInviteCode(opts.blueskyInvitePool);
      if (!inviteCode) {
        return {
          platform: 'bluesky',
          status: 'failed',
          error: 'No Bluesky invite codes available. Pool depleted.',
        };
      }
    }

    const email = `user-${_walletAddress.slice(0, 8)}@register.degenfeed.xyz`;
    const appPassword = generateBlueskyAppPassword();

    // Build the handle — our PDS uses .degenfeed.xyz domain handles
    let handle: string;
    if (isOwnPds) {
      // For our PDS, fetch the available user domains from server description
      try {
        const serverRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.describeServer`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(5_000),
        });
        if (serverRes.ok) {
          const serverData = (await serverRes.json()) as { availableUserDomains?: string[] };
          const domain = serverData.availableUserDomains?.[0];
          if (domain) {
            handle = `${desiredUsername}${domain}`;
          } else {
            handle = desiredUsername;
          }
        } else {
          handle = desiredUsername;
        }
      } catch {
        handle = desiredUsername;
      }
    } else {
      handle = desiredUsername;
    }

    // Build request body — omit inviteCode for our own PDS (inviteCodeRequired=false)
    const body: Record<string, string> = { email, handle, password: appPassword };
    if (inviteCode) body.inviteCode = inviteCode;

    const createRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify(body),
    });
    const createData = (await createRes.json()) as {
      did?: string;
      handle?: string;
      error?: string;
      message?: string;
    };
    if (!createRes.ok || !createData.did) {
      // Return invite code if we acquired one and creation failed
      if (inviteCode) {
        const invitePool = await import('./invite-pool');
        await invitePool.returnInviteCode(inviteCode, opts.blueskyInvitePool);
      }
      return {
        platform: 'bluesky',
        status: 'failed',
        error: createData.error || createData.message || 'Bluesky account creation failed',
      };
    }
    const accountInfo: Record<string, string> = {
      did: createData.did,
      handle: createData.handle || handle,
      email,
      appPassword,
    };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('bluesky', _walletAddress, accountInfo, opts.storage);
    return {
      platform: 'bluesky',
      status: 'created',
      username: createData.handle || handle,
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
