import type { DataCategory } from './types';

export const DATA_CATEGORIES: Array<{
  key: DataCategory;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    key: 'identities',
    label: 'Linked Identities',
    description: 'All your connected protocol accounts (Nostr, Farcaster, etc.)',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    key: 'bookmarks',
    label: 'Bookmarks',
    description: "Posts you've saved across all protocols",
    icon: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  },
  {
    key: 'follows',
    label: 'Follows',
    description: 'Who you follow and when you followed them',
    icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
  },
  {
    key: 'muted',
    label: 'Muted Users',
    description: 'Users you have muted',
    icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  },
  {
    key: 'mutedWords',
    label: 'Muted Words',
    description: 'Words and phrases you filter from your feed',
    icon: 'M3 3h18v18H3V3z',
  },
  {
    key: 'blocked',
    label: 'Blocked Users',
    description: 'Users you have blocked',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description: 'Your settings, theme, notification prefs, and more',
    icon: 'M12 15l-2 5 2-1 2 1-2-5zM12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24',
  },
  {
    key: 'mutedCommunities',
    label: 'Muted Communities',
    description: 'Communities you have muted',
    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
  },
  {
    key: 'blockedCommunities',
    label: 'Blocked Communities',
    description: 'Communities you have blocked',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
];

export const HOSTED_INSTANCES = [
  {
    platform: 'Mastodon',
    url: 'https://social.degenfeed.xyz',
    icon: 'Mastodon',
    color: '#6364ff',
    description: 'Microblogging — follow creators, share posts, join conversations',
    compatible: 'Ice Cubes, Mastodon iOS/Android, Tusky, Fedilab',
  },
  {
    platform: 'Lemmy',
    url: 'https://community.degenfeed.xyz',
    icon: 'Lemmy',
    color: '#7c3aed',
    description: 'Link aggregation and discussion — communities around any topic',
    compatible: 'Jerboa, Thunder, Summit, Voyager',
  },
  {
    platform: 'PeerTube',
    url: 'https://video.degenfeed.xyz',
    icon: 'PeerTube',
    color: '#f1680d',
    description: 'Video hosting and sharing — decentralized YouTube alternative',
    compatible: 'NewPipe, LibreTube, PeerTube mobile web',
  },
];
