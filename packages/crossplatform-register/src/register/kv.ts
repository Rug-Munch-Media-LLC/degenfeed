import type { PlatformRegistration, RegistrationPlatform } from './types';

export function platformAccountKey(wallet: string, platform: string): string {
  return `platform:account:${wallet.toLowerCase()}:${platform}`;
}

export function platformAccountsIndexKey(wallet: string): string {
  return `platform:accounts:${wallet.toLowerCase()}`;
}

export async function persistPlatformAccount(
  platform: string,
  walletAddress: string,
  accountInfo: Record<string, string>,
  storage?: KVNamespace,
): Promise<void> {
  if (!storage) return;
  const key = platformAccountKey(walletAddress, platform);
  await storage.put(
    key,
    JSON.stringify({
      platform,
      walletAddress: walletAddress.toLowerCase(),
      accountInfo,
      createdAt: Date.now(),
    }),
  );
  const indexKey = platformAccountsIndexKey(walletAddress);
  try {
    const raw = await storage.get(indexKey);
    const platforms: string[] = raw ? JSON.parse(raw) : [];
    if (!platforms.includes(platform)) {
      platforms.push(platform);
      await storage.put(indexKey, JSON.stringify(platforms));
    }
  } catch {
    await storage.put(indexKey, JSON.stringify([platform]));
  }
}

export async function getPlatformAccounts(
  walletAddress: string,
  storage?: KVNamespace,
): Promise<PlatformRegistration[]> {
  if (!storage) return [];
  const indexKey = platformAccountsIndexKey(walletAddress);
  try {
    const raw = await storage.get(indexKey);
    if (!raw) return [];
    const platforms: string[] = JSON.parse(raw);
    const results: PlatformRegistration[] = [];
    for (const platform of platforms) {
      const accountKey = platformAccountKey(walletAddress, platform);
      const accountRaw = await storage.get(accountKey);
      if (accountRaw) {
        const record = JSON.parse(accountRaw) as {
          platform: string;
          accountInfo: Record<string, string>;
        };
        results.push({
          platform: record.platform as RegistrationPlatform,
          status: 'created',
          username:
            record.accountInfo?.username ||
            record.accountInfo?.handle ||
            record.accountInfo?.npub?.slice(0, 12),
          accountInfo: record.accountInfo,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}
