/**
 * @components/join/types — Shared types for the cross-network join experience.
 *
 * Defines the platform taxonomy, greeting configs, guest identity shape,
 * and stream/space data contracts used by join components.
 */

/* ─── Source Platform ─────────────────────────────────────────── */

export type SourcePlatform =
  | 'mastodon'
  | 'bluesky'
  | 'farcaster'
  | 'nostr'
  | 'threads'
  | 'lens'
  | 'degenfeed'
  | 'direct';

export const PLATFORM_IDS: SourcePlatform[] = [
  'mastodon',
  'bluesky',
  'farcaster',
  'nostr',
  'threads',
  'lens',
  'degenfeed',
  'direct',
];

/* ─── Platform Metadata ───────────────────────────────────────── */

export interface PlatformConfig {
  id: SourcePlatform;
  label: string;
  icon: string;
  color: string;
  greeting: string;
  subtext: string;
  ctaLabel: string;
}

export const PLATFORM_CONFIG: Record<SourcePlatform, PlatformConfig> = {
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    greeting: 'Coming from Mastodon?',
    subtext: "You're in the right place! Watch and chat without an account.",
    ctaLabel: 'Sign up with Mastodon',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '☁️',
    color: '#1185fe',
    greeting: 'Coming from Bluesky?',
    subtext: 'Welcome! Watch the stream and join the conversation.',
    ctaLabel: 'Sign up with Bluesky',
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    greeting: 'Coming from Farcaster?',
    subtext: 'You found the stream! Listen in and react live.',
    ctaLabel: 'Sign up with Farcaster',
  },
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8b5cf6',
    greeting: 'Coming from Nostr?',
    subtext: 'The stream is live. Join as a guest in one click.',
    ctaLabel: 'Sign up with Nostr',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    icon: '🧵',
    color: '#888888',
    greeting: 'Coming from Threads?',
    subtext: "You've found the action. Watch and chat instantly.",
    ctaLabel: 'Sign up with Threads',
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    icon: '◎',
    color: '#abfe2c',
    greeting: 'Coming from Lens?',
    subtext: 'Welcome to the stream! React and tip the creator.',
    ctaLabel: 'Sign up with Lens',
  },
  degenfeed: {
    id: 'degenfeed',
    label: 'DegenFeed',
    icon: '🌀',
    color: '#00ff41',
    greeting: 'Welcome back!',
    subtext: 'You are signed in. Full access unlocked.',
    ctaLabel: 'Go to Dashboard',
  },
  direct: {
    id: 'direct',
    label: 'Direct Link',
    icon: '🔗',
    color: '#16a34a',
    greeting: 'Welcome to DegenFeed!',
    subtext: 'Watch the stream live. No account required to watch.',
    ctaLabel: 'Create free account',
  },
};

/* ─── Guest Identity ──────────────────────────────────────────── */

export interface GuestIdentity {
  id: string;
  displayName: string;
  platform: SourcePlatform;
  instance?: string;
}

/* ─── Stream Data (join-context subset) ───────────────────────── */

export interface JoinStreamData {
  id: string;
  title: string;
  creatorId: string;
  creatorDisplayName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  category: string;
  viewerCount: number;
  isLive: boolean;
  description?: string;
  thumbnailUrl?: string;
}

/* ─── Space Data (join-context subset) ────────────────────────── */

export interface JoinSpaceData {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  status: 'live' | 'scheduled' | 'ended';
  listeners: number;
  speakers: Array<{
    id: string;
    displayName: string;
    avatarUrl?: string;
    isHost: boolean;
    isCoHost: boolean;
    speaking: boolean;
    muted: boolean;
  }>;
  reactions: Array<{
    userId: string;
    emoji: string;
    createdAt: number;
  }>;
  tippingEnabled: boolean;
  scheduledAt?: string;
}

/* ─── Analytics Payload ───────────────────────────────────────── */

export interface StreamViewAnalytics {
  streamId: string;
  sourcePlatform: SourcePlatform | 'unknown';
  sourceInstance?: string;
  referrer: string;
  userAgent: string;
  timestamp: number;
  guestId?: string;
}
