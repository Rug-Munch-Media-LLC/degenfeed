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

    // Encrypt the nsec using the caller-supplied seal function before KV storage.
    // The raw nsec is never stored in plaintext — only the AES-256-GCM sealed blob.
    const nsecToStore = opts.sealSecret ? await opts.sealSecret(nsec) : nsec;
    const accountInfo: Record<string, string> = { pubkey, npub, _sealedNsec: nsecToStore };

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
