/**
 * @degenfeed/api-worker — Video Platform Wrapper Implementations
 *
 * Platform-specific wrappers for decentralized video platforms.
 * Each provider follows the VideoPlatformWrapper interface.
 *
 * Wrappers are extracted to individual files for maintainability:
 *   farcaster-wrapper.ts — Farcaster Frames (live + video embeds)
 *   zora-wrapper.ts      — Zora (video + audio NFTs)
 *   lens-wrapper.ts      — Lens (video publications)
 *   nostr-wrapper.ts     — Nostr (NIP-71 video events, NIP-53 live events)
 *   dtube-wrapper.ts     — DTube (decentralized YouTube on Steem/Hive)
 *   odysee-wrapper.ts    — Odysee/LBRY (decentralized video sharing)
 *   rumble-wrapper.ts    — Rumble (via RSS)
 *   bittube-wrapper.ts   — BitTube (decentralized video)
 *
 * Every provider gets: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API
 * changes. Every provider gets a health check.
 */

export { bittubePlatformWrapper } from './bittube-wrapper';
export { dtubePlatformWrapper } from './dtube-wrapper';
export { farcasterPlatformWrapper } from './farcaster-wrapper';
export { lensPlatformWrapper } from './lens-wrapper';
export { nostrPlatformWrapper } from './nostr-wrapper';
export { odyseePlatformWrapper } from './odysee-wrapper';
export { rumblePlatformWrapper } from './rumble-wrapper';
export { zoraPlatformWrapper } from './zora-wrapper';
