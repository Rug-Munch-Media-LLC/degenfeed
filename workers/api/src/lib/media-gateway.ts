/**
 * @degenfeed/api-worker — Unified Media Gateway
 *
 * A unified proxy/gateway for all media (images, video, audio) that:
 *   1. Tries IPFS gateway first (free, decentralized, CDN-backed)
 *   2. Falls back to Arweave gateway (permanent, one-time fee)
 *   3. Falls back to R2 (our storage, paid)
 *   4. Adds proper caching headers
 *   5. Supports on-the-fly optimization via Cloudflare Image Resizing
 *
 * Request flow:
 *   GET /api/media/:cid[?size=thumb&format=webp]
 *   GET /api/media/gateway/:type/:id[?size=...]
 *
 * Where:
 *   :type = 'ipfs' | 'arweave' | 'r2'
 *   :id   = CID | txId | R2 key
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

/** IPFS gateways in priority order */
const IPFS_GATEWAYS = [
  { url: 'https://cloudflare-ipfs.com/ipfs/{cid}', name: 'cf-ipfs', priority: 1 },
  { url: 'https://{cid}.ipfs.dweb.link', name: 'dweb', priority: 2 },
  { url: 'https://ipfs.io/ipfs/{cid}', name: 'ipfs-io', priority: 3 },
  { url: 'https://gateway.pinata.cloud/ipfs/{cid}', name: 'pinata-gw', priority: 4 },
];

/** Arweave gateways in priority order */
const ARWEAVE_GATEWAYS = [
  { url: 'https://arweave.net/{txId}', name: 'arweave-net', priority: 1 },
  { url: 'https://arweave.dev/{txId}', name: 'arweave-dev', priority: 2 },
  { url: 'https://gateway.irys.xyz/{txId}', name: 'irys-gw', priority: 3 },
];

/** Media type classification */
export type MediaType = 'image' | 'video' | 'audio' | 'application' | 'unknown';

export type GatewayBackend = 'ipfs' | 'arweave' | 'r2';

export type MediaGatewayResult = {}
