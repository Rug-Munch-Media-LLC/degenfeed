/**
 * /api/permanence — On-chain content permanence API
 *
 * POST /api/permanence/store       — Upload content to Arweave + IPFS, return proof
 * GET  /api/permanence/verify/:hash — Check if content hash exists in permanent storage
 * POST /api/permanence/anchor       — Submit an on-chain anchor tx for EVM users (Base)
 *
 * Stores proofs in KV: `permanence:{contentHash}` → ContentProof JSON
 */

import type { ContentProof } from '@degenfeed/types';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Irys / Arweave constants ────────────────────────────────────────

const IRYS_GATEWAY = 'https://node1.irys.xyz';
const _ARWEAVE_GATEWAY = 'https://arweave.net';

// ─── IPFS constants ──────────────────────────────────────────────────

const IPFS_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const _WEB3_STORAGE_API = 'https://api.web3.storage/upload';

// ─── KV key helpers ──────────────────────────────────────────────────

function kvKey(contentHash: string): string {
