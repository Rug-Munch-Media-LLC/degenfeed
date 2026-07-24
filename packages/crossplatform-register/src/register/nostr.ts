import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerNostr(
  _desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const { generateSecretKey, getPublicKey, nsecEncode, npubEncode } = await import(
      '@degenfeed/nostr-sdk'
    );
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const nsec = nsecEncode(secretKey);
    const npub = npubEncode(pubkey);
    const accountInfo: Record<string, string> = { pubkey, npub, _encryptedNsec: nsec };
    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('nostr', walletAddress, accountInfo, opts.storage);
    return {
      platform: 'nostr',
      status: 'created',
      username: npub.slice(0, 12),
      accountInfo: { pubkey, npub },
    };
  } catch (err) {
    return {
      platform: 'nostr',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Nostr key generation error',
    };
  }
}
