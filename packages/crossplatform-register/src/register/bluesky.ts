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

    // Sanitize handle for AT Protocol compatibility:
    // AT handles only allow [a-z0-9-] in the local part (no underscores, no dots).
    // GTS usernames often contain underscores, causing InvalidRequest from PDS.
    const sanitizedHandle = desiredUsername
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/--+/g, '-');
    if (!sanitizedHandle) {
      return {
        platform: 'bluesky',
        status: 'failed',
        error: 'Username contains no valid characters for Bluesky handle',
      };
    }

    // Truncate to fit PDS handle length limit (~32 chars total including domain).
    // Our PDS domain is .degenfeed.xyz (14 chars), so local part max is ~18 chars.
    const localPart = sanitizedHandle.slice(0, 18).replace(/-+$/, '');
    if (!localPart) {
      return {
        platform: 'bluesky',
        status: 'failed',
        error: 'Username contains no valid characters for Bluesky handle',
      };
    }

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
            handle = `${localPart}${domain}`;
          } else {
            handle = localPart;
          }
        } else {
          handle = localPart;
        }
      } catch {
        handle = localPart;
      }
    } else {
      handle = localPart;
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
    // Encrypt the app password using the caller-supplied seal function before KV storage.
    // The raw app password is never stored in plaintext — only the AES-256-GCM sealed blob.
    const appPasswordToStore = opts.sealSecret ? await opts.sealSecret(appPassword) : appPassword;
    const accountInfo: Record<string, string> = {
      did: createData.did,
      handle: createData.handle || handle,
      email,
      _sealedAppPassword: appPasswordToStore,
    };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('bluesky', _walletAddress, accountInfo, opts.storage);
    return {
      platform: 'bluesky',
      status: 'created',
      username: createData.handle || handle,
      accountInfo: {
        did: createData.did,
        handle: createData.handle || handle,
        email,
      },
    };
  } catch (err) {
    return {
      platform: 'bluesky',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Bluesky registration error',
    };
  }
}
