import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerLens(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const apiUrl = opts.polygonRpcUrl || 'https://api-v2.lens.dev/graphql';
    const checkRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query CheckHandle { checkHandleAvailability(request: { handle: "${desiredUsername}" }) { available } }`,
        variables: {},
      }),
    });
    const checkData = (await checkRes.json()) as {
      data?: { checkHandleAvailability?: { available: boolean } };
    };
    if (!checkData.data?.checkHandleAvailability?.available)
      return {
        platform: 'lens',
        status: 'failed',
        error: `Lens handle @${desiredUsername} is not available`,
      };
    const profileRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateProfile { createProfile(request: { handle: "${desiredUsername}", to: "${walletAddress}" }) { ... on RelaySuccess { txHash } ... on RelayError { reason } } }`,
        variables: {},
      }),
    });
    const profileData = (await profileRes.json()) as {
      data?: { createProfile?: { txHash?: string; reason?: string } };
    };
    const result = profileData.data?.createProfile;
    if (!result || result.reason)
      return {
        platform: 'lens',
        status: 'failed',
        error: result?.reason || 'Lens profile creation failed',
      };
    const txHash = result.txHash || '';
    const profileId = await waitForLensProfile(txHash, desiredUsername);
    const accountInfo: Record<string, string> = {
      profileId: profileId || '',
      handle: `${desiredUsername}.lens`,
      txHash,
    };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('lens', walletAddress, accountInfo, opts.storage);
    return {
      platform: 'lens',
      status: 'created',
      username: `${desiredUsername}.lens`,
      txHash,
      accountInfo,
    };
  } catch (err) {
    return {
      platform: 'lens',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Lens registration error',
    };
  }
}

async function waitForLensProfile(_txHash: string, desiredHandle: string): Promise<string> {
  const apiUrl = 'https://api-v2.lens.dev/graphql';
  for (let i = 0; i < 30; i++) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query Profile { profile(request: { forHandle: "${desiredHandle}.lens" }) { id } }`,
        variables: {},
      }),
    });
    const data = (await res.json()) as { data?: { profile?: { id: string } | null } };
    if (data.data?.profile?.id) return data.data.profile.id;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for Lens profile indexing');
}
