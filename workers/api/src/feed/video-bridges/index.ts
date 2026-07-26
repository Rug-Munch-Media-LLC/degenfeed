/**
 * @degenfeed/api-worker — Video Bridges Barrel Export
 *
 * All cross-platform video bridges in one place.
 * "Follow creators, not platforms" — every platform gets a dedicated fetcher.
 *
 * Each bridge exports three standard operations:
 *   fetch{Platform}ChannelVideos(channelName, limit?) → UnifiedVideo[]
 *   fetch{Platform}Trending(category?, limit?) → UnifiedVideo[]
 *   search{Platform}(query, limit?) → UnifiedVideo[]
 *
 * Platforms may also export additional operations (federated search, etc.)
 */

// ─── Bridge exports ────────────────────────────────────────────────────────

export * from './bitchute';
export * from './bluesky-video';
export * from './dailymotion';
export * from './dtube';
export * from './farcaster-frame-video';
export * from './ipfs-arweave-video';
export * from './kick';
export * from './lens-video';
export * from './live-tube';
export * from './nip71-video';
export * from './nostr-video';
export * from './odysee';
export * from './peertube';
export * from './rumble';
export * from './twitch';
export * from './vimeo';

// ─── Source registry ───────────────────────────────────────────────────────

/**
 * Every platform the video bridges can fetch from.
 * This powers the "Follow creators, not platforms" philosophy —
 * users follow once and get content from everywhere.
 */
export const BRIDGE_SOURCES = [
  'youtube',
  'twitch',
  'rumble',
  'odysee',
  'dtube',
  'peertube',
  'bitchute',
  'dailymotion',
  'vimeo',
  'zora',
  'lens',
  'bluesky',
  'tiktok',
  'instagram',
  'kick',
  'livetube',
  'nostr',
  'nip71',
  'farcaster',
  'ipfs',
  'arweave',
] as const;

export type BridgeSource = (typeof BRIDGE_SOURCES)[number];

/**
 * Platform metadata for badges and UI.
 */
export const BRIDGE_SOURCE_META: Record<string, { label: string; color: string; icon?: string }> = {

