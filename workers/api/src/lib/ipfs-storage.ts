/**
 * @degenfeed/api-worker — IPFS Storage Integration
 *
 * Upload video content to IPFS via free providers only:
 *   - web3.storage (primary — free tier: 1TB, no API key required for small uploads)
 *   - Pinata (fallback — requires PINATA_API_KEY + PINATA_SECRET_KEY)
 *
 * NO paid providers. NO Infura (deprecated — Infura IPFS requires paid plan).
 *
 * Generates gateway URLs for content delivery:
 *   - ipfs.io
 *   - dweb.link
 *   - Our own gateway if configured
 *
 * Tracks pin status in KV for monitoring.
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

const WEB3_STORAGE_API = 'https://api.web3.storage/upload';
const PINATA_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
// Infura IPFS removed — no paid providers. Use web3.storage (free tier) or Pinata.

export const IPFS_GATEWAYS = [
  { url: 'https://{cid}.ipfs.dweb.link', name: 'dweb', priority: 1 },
  { url: 'https://ipfs.io/ipfs/{cid}', name: 'ipfs-io', priority: 2 },
  { url: 'https://cloudflare-ipfs.com/ipfs/{cid}', name: 'cf-ipfs', priority: 3 },
  { url: 'https://gateway.pinata.cloud/ipfs/{cid}', name: 'pinata-gw', priority: 4 },
] as const;

const KV_PREFIX = 'ipfs:pin:';

// ─── Types ──────────────────────────────────────────────────────────────

export interface IPFSUploadResult {

export interface PinStatus {

// ─── Gateway Helpers ────────────────────────────────────────────────────

/**
 * Get the best IPFS gateway URL for a CID.
 * Falls back through priority-ordered gateways if preferDegenFeed is set.
 */
export function getIPFSGatewayUrl(cid: string, preferLocalGateway = true): string {

/**
 * Get all gateway URLs for a CID.
 */
export function getAllGatewayUrls(cid: string): string[] {

// ─── Provider Implementations ──────────────────────────────────────────

/**
 * Upload a file buffer to web3.storage (free tier).
 * Returns the CID on success, null on failure.
 */
async function uploadViaWeb3Storage(
  file: Blob,
  fileName: string,
  apiKey?: string,
): Promise<{ cid: string; size: number } | null> {

/**
 * Upload via Pinata (requires PINATA_API_KEY + PINATA_SECRET_KEY in env).
 */
async function uploadViaPinata(
  file: Blob,
  fileName: string,
  apiKey: string,
  secretKey: string,
): Promise<{ cid: string; size: number } | null> {

// ─── KV Pin Tracking ───────────────────────────────────────────────────

async function trackPinStatus(
  kv: KVNamespace | undefined,
  cid: string,
  status: Omit<PinStatus, 'cid'>,
): Promise<void> {

/**
 * Get the current pin status for a CID from KV.
 */
export async function getPinStatus(
  kv: KVNamespace | undefined,
  cid: string,
): Promise<PinStatus | null> {

// ─── Main Upload Function ──────────────────────────────────────────────

/**
 * Upload a video/file to IPFS.
 *
 * Provider priority (zero paid providers):
 *   1. web3.storage (free, generous tier, works without API key)
 *   2. Pinata (if API keys configured)
 *
 * Stores pin status in KV (env.CACHE or env.CONTENT_LIBRARY) for monitoring.
 *
 * @param file - The file to upload (Blob)
 * @param fileName - File name for IPFS metadata
 * @param env - Worker env (for API keys and KV)
 * @returns IPFSUploadResult with CID and gateway URLs
 */
export async function uploadToIPFS(
  file: Blob,
  fileName: string,
  env: Env,
): Promise<IPFSUploadResult> {

/**
 * Upload raw bytes to IPFS.
 * Convenience wrapper that converts ArrayBuffer to Blob.
 */
export async function uploadBufferToIPFS(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  env: Env,
): Promise<IPFSUploadResult> {

/**
 * Check if IPFS is reachable/healthy by hitting the web3.storage API.
 * Returns true if the service is accessible (not a full upload test).
 */
export async function checkIPFSHealth(): Promise<boolean> {

/**
 * Verify that an IPFS CID resolves through at least one gateway.
 */
export async function verifyIPFSContent(cid: string): Promise<boolean> {

