import { registerBluesky } from './bluesky';
import { registerBookWyrm } from './bookwyrm';
import { registerCastopod } from './castopod';
import { registerFarcaster } from './farcaster';
import { registerFunkwhale } from './funkwhale';
import { registerLemmy } from './lemmy';
import { registerLens } from './lens';
import { registerMastodon } from './mastodon';
import { registerMobilizon } from './mobilizon';
import { registerNostr } from './nostr';
import { registerOwncast } from './owncast';
import { registerPeerTube } from './peertube';
import { registerPixelfed } from './pixelfed';
import type { PlatformRegistration, RegisterOptions, RegistrationPlatform } from './types';
import { registerWriteFreely } from './writefreely';

const REGISTRABLE_PLATFORMS: RegistrationPlatform[] = [
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'nostr',
  'lemmy',
  'peertube',
  'pixelfed',
  'bookwyrm',
  'funkwhale',
  'mobilizon',
  'writefreely',
  'owncast',
  'castopod',
];

/**
 * Get the list of protocols that support registration (account creation).
 * Each protocol requires its own set of options (instance URL, invite pool, etc.)
 * but the unified API handles the differences internally.
 */
export function getSupportedProtocolsForRegistration(): RegistrationPlatform[] {
  return [...REGISTRABLE_PLATFORMS];
}

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
    case 'lemmy':
      return registerLemmy(desiredUsername, walletAddress, opts);
    case 'peertube':
      return registerPeerTube(desiredUsername, walletAddress, opts);
    case 'pixelfed':
      return registerPixelfed(desiredUsername, walletAddress, opts);
    case 'bookwyrm':
      return registerBookWyrm(desiredUsername, walletAddress, opts);
    case 'funkwhale':
      return registerFunkwhale(desiredUsername, walletAddress, opts);
    case 'mobilizon':
      return registerMobilizon(desiredUsername, walletAddress, opts);
    case 'writefreely':
      return registerWriteFreely(desiredUsername, walletAddress, opts);
    case 'owncast':
      return registerOwncast(desiredUsername, walletAddress, opts);
    case 'castopod':
      return registerCastopod(desiredUsername, walletAddress, opts);
    default:
      return {
        platform: platform as RegistrationPlatform,
        status: 'failed',
        error: `Unsupported platform: ${platform}. Supported: ${REGISTRABLE_PLATFORMS.join(', ')}`,
      };
  }
}
