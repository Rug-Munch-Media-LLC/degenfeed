import type { Protocol } from '@degenfeed/types';

export interface Preferences {
  theme: string;
  fontSize: string;
  layoutDensity: string;
  notifications: Record<string, Record<string, boolean>>;
  privacy: { publicProfile: boolean; showTipsReceived: boolean; showFollowers: boolean };
  content: {
    defaultFeed: string;
    mutedWords: string[];
    mutedUsers: string[];
    blockedUsers: string[];
  };
}

export type Section =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'content'
  | 'security'
  | 'subscription'
  | 'streaming'
  | 'api';

export const SECTION_LABELS: Record<Section, { label: string; icon: string; desc: string }> = {
  account: {
    label: 'Account',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    desc: 'Wallet addresses, email, connected protocols',
  },
  appearance: {
    label: 'Appearance',
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    desc: 'Theme, font size, layout density',
  },
  notifications: {
    label: 'Notifications',
    icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
    desc: 'Per-protocol per-type toggles',
  },
  privacy: {
    label: 'Privacy',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    desc: 'Public/private profile, visibility settings',
  },
  content: {
    label: 'Content',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    desc: 'Default feed, muted words, muted & blocked users',
  },
  security: {
    label: 'Security',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    desc: 'Passkeys, 2FA, hardware wallet',
  },
  subscription: {
    label: 'Subscription',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    desc: 'Plan, billing, and premium features',
  },
  streaming: {
    label: 'Streaming',
    icon: 'M5 3l14 9-14 9V3z',
    desc: 'Live streaming settings, OBS setup, and stream history',
  },
  api: {
    label: 'API & Developers',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    desc: 'API keys and developer settings',
  },
};

export const PROTOCOLS: Protocol[] = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];

export type NotificationType = 'likes' | 'reposts' | 'replies' | 'follows' | 'tips';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'likes',
  'reposts',
  'replies',
  'follows',
  'tips',
];
