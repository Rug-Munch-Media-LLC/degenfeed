/**
 * Cross-poster default pair configurations
 */

import type { CrossPairConfig } from './crossposter-types';

export const DEFAULT_CONFIG: CrossPairConfig[] = [
  {
    id: 'gts-to-nostr',
    source: 'mastodon',
    targets: ['nostr'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 10, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      nostr: { relayUrl: process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:8085' },
    },
  },
  {
    id: 'gts-to-bluesky',
    source: 'mastodon',
    targets: ['bluesky'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      bluesky: {
        pdsUrl: process.env.ATPROTO_PDS_URL || 'https://bsky.social',
      },
    },
  },
  {
    id: 'gts-to-peertube',
    source: 'mastodon',
    targets: ['peertube'],
    enabled: true,
    pollIntervalMs: 300000,
    rateLimit: { maxPosts: 2, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
    contentFilter: (post) => post.embeds.some((e) => e.kind === 'video'),
  },
  {
    id: 'gts-to-farcaster',
    source: 'mastodon',
    targets: ['farcaster'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      farcaster: {
        botFid: process.env.FARCASTER_BOT_FID || '',
        botSignerKey: process.env.FARCASTER_BOT_SIGNER_KEY || '',
        hubUrl: process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281',
      },
    },
  },
  {
    id: 'gts-to-lens',
    source: 'mastodon',
    targets: ['lens'],
    enabled: false, // [DS] 2026-08-03: LENS_REFRESH_TOKEN missing (not in gopass) — disabled until credentials provisioned
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      lens: {
        apiUrl: process.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql',
      },
    },
  },
  {
    id: 'gts-to-pixelfed',
    source: 'mastodon',
    targets: ['pixelfed'],
    enabled: true,
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 4, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
    contentFilter: (post) => post.embeds.some((e) => e.kind === 'image'),
  },
  {
    id: 'gts-to-writefreely',
    source: 'mastodon',
    targets: ['writefreely'],
    enabled: false, // [DS] 2026-08-03: WRITEFREELY_TOKEN not valid (gopass holds admin password; login 401, DB tokens corrupted) — disabled until real token provisioned
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 6, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
    contentFilter: (post) => (post.text?.length || 0) >= 100,
  },
  {
    id: 'pixelfed-to-mastodon',
    source: 'pixelfed',
    targets: ['mastodon'],
    enabled: false, // [DS] 2026-08-03: MASTODON_ACCESS_TOKEN in gopass is stale (401 on live GTS) — disabled until valid token restored
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 4, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      mastodon: {
        instance: process.env.MASTODON_INSTANCE || 'https://social.degenfeed.xyz',
      },
    },
  },
  {
    id: 'lemmy-to-nostr',
    source: 'lemmy',
    targets: ['nostr'],
    enabled: true,
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
  },
];
