/**
 * @degenfeed/api-worker — Arweave Permanent Storage Integration
 *
 * Upload video content to Arweave via Irys (formerly Bundlr) for permanent
 * decentralized storage. One-time fee ~$0.01/MB.
 *
 * Designed for premium/permanent creator content where the creator pays
 * the upload fee (via connected wallet) or the platform covers it for
 * high-value content.
 *
 * Uses the same Irys gateway as permanence.ts but adapted for video files.
 */

import { log } from '../logger';

// ─── Constants ──────────────────────────────────────────────────────────

const IRYS_NODE = 'https://node1.irys.xyz';
const ARWEAVE_GATEWAY = 'https://arweave.net';
const FALLBACK_GATEWAYS = [
  'https://arweave.dev',
  'https://gateway.irys.xyz',
  'https://arweave.net',
];

// ─── Types ──────────────────────────────────────────────────────────────

export type ArweaveUploadResult = {}
