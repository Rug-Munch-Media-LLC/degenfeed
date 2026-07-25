/**
 * @degenfeed/feed-providers — Lightweight Protocol Adapters
 *
 * Minimal (~100 line) adapters for protocols that don't need full SDKs.
 * Each adapter exports a single fetch function returning UnifiedPost[].
 *
 * These are "good enough" to get content flowing; when a protocol reaches
 * sufficient scale, promote it to a full provider + SDK package.
 *
 * TOTAL: 26 protocol adapters
 */

export { fetchBonfidaPosts, resolveSNS, reverseSNS } from './bonfida';
// ─── Creator Economy ──────────────────────────────────────────────
export { fetchCoinviseCreators, fetchCoinvisePosts } from './coinvise';
// ─── Originally shipped adapters ──────────────────────────────────
export { fetchDiasporaPosts } from './diaspora';
export type { ENSRecord } from './ens';
// ─── Decentralized Identity ───────────────────────────────────────
export { fetchENSPosts, resolveENS } from './ens';
export { fetchEpicyonPosts } from './epicyon';
export { fetchFilecoinPosts, getFilecoinBalance } from './filecoin';
export { fetchFriendicaPosts } from './friendica';
export { fetchGuppePosts } from './guppe';
// ─── Fediverse (new) ──────────────────────────────────────────────
export { fetchHubzillaPosts } from './hubzilla';
export { fetchIONPosts, resolveION } from './ion';
export { fetchJuiceboxPosts, fetchTrendingProjects } from './juicebox';
export { fetchKERIPosts, resolveKERI } from './keri';
export { fetchMintGatePosts } from './mintgate';
export { fetchMisskeyPosts } from './misskey';
// ─── Web3 Social ──────────────────────────────────────────────────
export { fetchOrbisPosts } from './orbis';
export { fetchPleromaPosts } from './pleroma';
export { fetchSiaPosts, resolveSkylink } from './sia';
// ─── DAO Tooling ──────────────────────────────────────────────────
export { fetchProposals, fetchSnapshotPosts } from './snapshot';
// ─── Decentralized Storage ────────────────────────────────────────
export { fetchStorjPosts, storjListBucket } from './storj';
export { fetchStreamsPosts } from './streams';
export { downloadSwarmContent, fetchSwarmPosts } from './swarm-eth';
export { fetchSyndicatePosts } from './syndicate';
export { fetchTallyPosts, fetchTallyProposals } from './tally';
export { fetchUnlockLocks, fetchUnlockPosts } from './unlock';
export { fetchUnstoppablePosts, resolveUnstoppable } from './unstoppable';
export { fetchVeramoPosts, resolveVeramoDID } from './veramo';
export { fetchWriteFreelyPosts } from './writefreely';
