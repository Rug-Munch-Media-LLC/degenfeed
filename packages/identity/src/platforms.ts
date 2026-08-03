/**
 * @degenfeed/identity — External platform registry
 *
 * Static metadata for "Bring Your Own Account" platforms that can be linked
 * to a DegenFeed profile without native protocol credentials. These are the
 * classic social/web platforms (X/Twitter, YouTube, GitHub, Discord, Telegram)
 * plus the verified-protocol platforms (Nostr, Farcaster, Lens, Bluesky,
 * Mastodon) that support handle-based verification.
 *
 * This is a pure metadata module — no network access.
 */

/** Which platforms are linkable and how they are verified */
export type ExternalPlatformId = 'twitter' | 'youtube' | 'github' | 'discord' | 'telegram';

/** Handles that can be resolved/verified via a public endpoint */
export type VerifyablePlatformId = 'nostr' | 'farcaster' | 'lens' | 'bluesky' | 'mastodon';

/** Any platform the profile linker supports */
export type LinkablePlatformId = ExternalPlatformId | VerifyablePlatformId;

export interface PlatformLinkMeta {
  /** Protocol id as stored in identity records (must be a @degenfeed/types Protocol) */
  id: LinkablePlatformId;
  /** Human-friendly label */
  label: string;
  /** Accent color used in badges/icons */
  color: string;
  /** Simple emoji icon (matches PROTOCOL_ICONS conventions in the web app) */
  icon: string;
  /** Placeholder shown in the connect input */
  placeholder: string;
  /** Short explanation of how the account will be verified */
  hint: string;
  /** Optional URL pattern builder for the canonical profile page */
  profileUrl?: (handle: string) => string;
}

/** Registry of external (non-protocol) platforms with link metadata. */
export const EXTERNAL_PLATFORMS: Record<ExternalPlatformId, PlatformLinkMeta> = {
  twitter: {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#0f1419',
    icon: '𝕏',
    placeholder: '@username or https://x.com/username',
    hint: 'Link your X handle to show it on your profile. Verified by URL format.',
    profileUrl: (handle) => {
      const username = handle.replace(/^@/, '').split('/').pop() ?? handle;
      return `https://x.com/${username}`;
    },
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    color: '#ff0000',
    icon: '▶️',
    placeholder: '@channel or https://youtube.com/@channel',
    hint: 'Link your YouTube channel. Verified by URL format.',
    profileUrl: (handle) => {
      const channel = handle.replace(/^@/, '').split('/').pop() ?? handle;
      return `https://youtube.com/@${channel}`;
    },
  },
  github: {
    id: 'github',
    label: 'GitHub',
    color: '#333333',
    icon: '🐙',
    placeholder: 'username or https://github.com/username',
    hint: 'Link your GitHub profile. Verified by URL format.',
    profileUrl: (handle) => {
      const username = handle.replace(/^@/, '').split('/').pop() ?? handle;
      return `https://github.com/${username}`;
    },
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    color: '#5865f2',
    icon: '🎮',
    placeholder: 'username or user id',
    hint: 'Link your Discord username. Verified by format.',
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    color: '#0088cc',
    icon: '✈️',
    placeholder: '@username or https://t.me/username',
    hint: 'Link your Telegram handle. Verified by URL format.',
    profileUrl: (handle) => {
      const username = handle.replace(/^@/, '').split('/').pop() ?? handle;
      return `https://t.me/${username}`;
    },
  },
};

/** Registry of BYOA protocols that verify against a public endpoint. */
export const VERIFYABLE_PLATFORMS: Record<VerifyablePlatformId, PlatformLinkMeta> = {
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    color: '#8b5cf6',
    icon: '⚡',
    placeholder: 'npub1... or user@domain (NIP-05)',
    hint: 'Enter your npub, or a NIP-05 identifier we verify against the domain.',
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    color: '#8a63d2',
    icon: '🔵',
    placeholder: 'FID (e.g. 12345) or username',
    hint: 'We resolve your FID/username against a public Farcaster hub.',
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    color: '#abfe2c',
    icon: '🌿',
    placeholder: 'handle.lens',
    hint: 'We resolve your Lens handle against the Lens API.',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    color: '#1185fe',
    icon: '🦋',
    placeholder: 'handle.bsky.social',
    hint: 'We resolve your handle to its DID via the public Bluesky API.',
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    color: '#6364ff',
    icon: '🐘',
    placeholder: 'user@instance.social',
    hint: 'We verify your account via the instance WebFinger endpoint.',
  },
};

/** All linkable platforms in display order. */
export const ALL_LINKABLE_PLATFORMS: PlatformLinkMeta[] = [
  VERIFYABLE_PLATFORMS.nostr,
  VERIFYABLE_PLATFORMS.farcaster,
  VERIFYABLE_PLATFORMS.lens,
  VERIFYABLE_PLATFORMS.bluesky,
  VERIFYABLE_PLATFORMS.mastodon,
  EXTERNAL_PLATFORMS.twitter,
  EXTERNAL_PLATFORMS.youtube,
  EXTERNAL_PLATFORMS.github,
  EXTERNAL_PLATFORMS.discord,
  EXTERNAL_PLATFORMS.telegram,
];

export function isExternalPlatform(id: string): id is ExternalPlatformId {
  return id in EXTERNAL_PLATFORMS;
}

export function isVerifyablePlatform(id: string): id is VerifyablePlatformId {
  return id in VERIFYABLE_PLATFORMS;
}

export function getPlatformMeta(id: string): PlatformLinkMeta | null {
  if (isExternalPlatform(id)) return EXTERNAL_PLATFORMS[id];
  if (isVerifyablePlatform(id)) return VERIFYABLE_PLATFORMS[id];
  return null;
}

/** Extract a bare handle from a full profile URL (e.g. "https://x.com/foo" → "foo"). */
export function extractHandleFromUrl(protocol: ExternalPlatformId, value: string): string {
  const trimmed = value.trim();
  // Discord is identified by username#discriminator or numeric id — no URL form
  if (protocol === 'discord') {
    return trimmed;
  }
  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed);
      const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
      return last.replace(/^@/, '');
    } catch {
      return trimmed.replace(/^@/, '');
    }
  }
  return trimmed.replace(/^@/, '').trim();
}
