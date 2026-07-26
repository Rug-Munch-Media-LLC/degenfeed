/**
 * @degenfeed/api-worker — Decentralized Video Storage Router
 *
 * ZERO-COST HOSTING PRIORITY:
 *   1. PeerTube federation (videos on other instances — $0)
 *   2. YouTube embeds (link to YouTube — $0)
 *   3. Twitch embeds (link to Twitch VODs — $0)
 *   4. DTube/Steem (blockchain-stored — $0)
 *   5. Odysee/LBRY (P2P hosting — $0)
 *   6. Nostr NIP-71 (video events on relays — $0)
 *   7. Farcaster Frames (external video links — $0)
 *   8. IPFS (via web3.storage free tier, public gateways — $0)
 *   9. Arweave (permanent, one-time fee ~$0.01/MB — cheap)
 *   10. R2 ($0.015/GB/month)
 *
 * Only fall back to R2/IPFS if creator explicitly wants "native upload".
 *
 * Each route is analyzed for the best zero-cost option first.
 * Content classification determines routing strategy.
 */

import { log } from '../logger';
import type { Env } from '../types';
import type { IPFSUploadResult } from './ipfs-storage';
import { getIPFSGatewayUrl, uploadBufferToIPFS } from './ipfs-storage';
import type { R2UploadResult } from './r2-storage';
import { uploadToR2 } from './r2-storage';

// ─── Types ──────────────────────────────────────────────────────────────

/** Content categories for storage routing decisions */
export type VideoContentType =
  | 'short' // <60s short-form video
  | 'longform' // >=60s VOD
  | 'podcast' // Audio / podcast episode
  | 'livestream' // Live stream recording (VOD)
  | 'premium' // Creator-gated premium content
  | 'temporary'; // Temp upload (auto-delete)

/** Storage backend for a given piece of content */
export type StorageBackend =
  | 'peertube-federation'
  | 'youtube-embed'
  | 'twitch-embed'
  | 'dtube-steem'
  | 'odysee-lbry'
  | 'nostr-nip71'
  | 'farcaster-frame'
  | 'ipfs'
  | 'r2'
  | 'arweave'
  | 'r2+ipfs' // R2 primary + IPFS mirror
  | 'r2+arweave'; // R2 primary + Arweave permanent copy

/** Result of routing analysis */
export type RoutingDecision = {};
