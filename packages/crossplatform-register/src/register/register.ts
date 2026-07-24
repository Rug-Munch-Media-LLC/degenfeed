import { registerBluesky } from './bluesky';
import { registerFarcaster } from './farcaster';
import { registerLens } from './lens';
import { registerMastodon } from './mastodon';
import { registerNostr } from './nostr';
import type { PlatformRegistration, RegisterOptions, RegistrationPlatform } from './types';

export async function registerOnPlatform(
  platform: string,
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  switch (platform) {
    case 'farcaster':
      return registerFarcaster(desiredUsername, walletAddress, opts);
    case 'lens':
      return registerLens(desiredUsername, walletAddress, opts);
    case 'bluesky':
      return registerBluesky(desiredUsername, walletAddress, opts);
    case 'mastodon':
      return registerMastodon(desiredUsername, walletAddress, opts);
    case 'nostr':
      return registerNostr(desiredUsername, walletAddress, opts);
    default:
      return {
        platform: platform as RegistrationPlatform,
        status: 'failed',
        error: `Unsupported platform: ${platform}`,
      };
  }
}
