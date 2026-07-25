/**
 * @degenfeed/feed-providers — Lightweight Protocol Adapters
 *
 * Minimal (~100 line) adapters for protocols that don't need full SDKs.
 * Each adapter exports a single fetch function returning UnifiedPost[].
 *
 * These are "good enough" to get content flowing; when a protocol reaches
 * sufficient scale, promote it to a full provider + SDK package.
 */

export { fetchDiasporaPosts } from './diaspora';
export { fetchFriendicaPosts } from './friendica';
export { fetchPleromaPosts } from './pleroma';
export { fetchMisskeyPosts } from './misskey';
export { fetchWriteFreelyPosts } from './writefreely';
