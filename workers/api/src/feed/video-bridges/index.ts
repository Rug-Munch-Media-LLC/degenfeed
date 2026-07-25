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
export * from './dailymotion';
export * from './dtube';
export * from './odysee';
export * from './peertube';
export * from './rumble';
export * from './twitch';
export * from './vimeo';
export * from './kick';
export * from './live-tube';
export * from './nostr-video';
export * from './farcaster-frame-video';
export * from './ipfs-arweave-video';

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
  'tiktok',
  'instagram',
  'kick',
  'livetube',
  'nostr',
  'farcaster',
  'ipfs',
  'arweave',
] as const;

export type BridgeSource = (typeof BRIDGE_SOURCES)[number];

/**
 * Platform metadata for badges and UI.
 */
export const BRIDGE_SOURCE_META: Record<string, { label: string; color: string; icon?: string }> = {
  youtube: { label: 'YouTube', color: '#FF0000' },
  twitch: { label: 'Twitch', color: '#9146FF' },
  rumble: { label: 'Rumble', color: '#85C742' },
  odysee: { label: 'Odysee', color: '#FF6A00' },
  dtube: { label: 'DTube', color: '#FF0000' },
  peertube: { label: 'PeerTube', color: '#F1680D' },
  bitchute: { label: 'BitChute', color: '#8B0000' },
  dailymotion: { label: 'Dailymotion', color: '#0066FF' },
  vimeo: { label: 'Vimeo', color: '#1AB7EA' },
  zora: { label: 'Zora', color: '#0052FF' },
  tiktok: { label: 'TikTok', color: '#010101' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  kick: { label: 'Kick', color: '#53FC18' },
  livetube: { label: 'LiveTube', color: '#FF4500' },
  nostr: { label: 'Nostr Video', color: '#8B5CF6' },
  farcaster: { label: 'Farcaster Video', color: '#8A63D2' },
  ipfs: { label: 'IPFS Video', color: '#4FC3F7' },
  arweave: { label: 'Arweave Video', color: '#9C27B0' },
};
