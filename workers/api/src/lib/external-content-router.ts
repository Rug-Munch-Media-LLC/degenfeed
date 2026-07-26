/**
 * @degenfeed/api-worker — External Content Router
 *
 * Smart routing for externally hosted video and live content.
 * Optimizes bandwidth, provides fallback chains, routes through CDN,
 * and handles IPFS/Arweave/PeerTube-federated content routing.
 *
 * Design principles:
 *   - Stream directly from source (don't proxy) for bandwidth optimization
 *   - Fallback chain: if primary source is down, try mirrors
 *   - Cache thumbnails and metadata on Cloudflare CDN
 *   - Detect and route IPFS/Arweave content through public gateways
 *   - Route federated PeerTube videos through our instance for better performance
 *
 * Every routing decision is logged. No silent failures.
 */

import type { Env } from '../types';

// ─── Content Routing Types ───────────────────────────────────────────────

export type ContentProtocol = 'https' | 'ipfs' | 'arweave' | 'peertube' | 'hls' | 'dash' | 'rtmp';

export interface ContentSource {

export interface RoutedContent {

export interface RoutingRule {

// ─── Default Routing Rules ──────────────────────────────────────────────

const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  // YouTube: embed via youtube.com directly (don't proxy)
  {
  // Cloudflare-hosted assets: direct (fastest)
  {
];

// ─── IPFS Gateway Configuration ─────────────────────────────────────────

const IPFS_GATEWAYS = [
  { url: 'https://ipfs.degenfeed.xyz/ipfs/{cid}', priority: 0, region: 'us-central' },
  { url: 'https://dweb.link/ipfs/{cid}', priority: 1, region: 'global' },
  { url: 'https://ipfs.io/ipfs/{cid}', priority: 2, region: 'global' },
  { url: 'https://cloudflare-ipfs.com/ipfs/{cid}', priority: 3, region: 'global' },
  { url: 'https://gateway.pinata.cloud/ipfs/{cid}', priority: 4, region: 'us-east' },
];

const ARWEAVE_GATEWAYS = [
  { url: 'https://arweave.degenfeed.xyz/{id}', priority: 0, region: 'us-central' },
  { url: 'https://arweave.net/{id}', priority: 1, region: 'global' },
  { url: 'https://arweave.live/{id}', priority: 2, region: 'global' },
  { url: 'https://gql.gateway.arweave.net/{id}', priority: 3, region: 'global' },
];

// ─── Content Router Class ────────────────────────────────────────────────

export class ContentRouter {

// ─── Helper Functions ───────────────────────────────────────────────────

/**
 * Detect content protocol from URL.
 */
export function detectProtocol(url: string): ContentProtocol {

/**
 * Simple string hash for cache keys.
 */
function hashUrl(url: string): string {

/**
 * Simple hash for thumbnail URLs.
 */
function simpleHash(str: string): string {

/**
 * Check if a content URL is reachable (lightweight HEAD request).
 * Used by the fallback chain to skip dead mirrors.
 */
export async function checkContentReachable(url: string, timeoutMs = 3000): Promise<boolean> {

/**
 * Get the best IPFS gateway URL for a CID.
 * Picks based on latency and availability.
 */
export function getIPFSGatewayUrl(cid: string, preferDegenFeed = true): string {

/**
 * Get the best Arweave gateway URL for a transaction ID.
 */
export function getArweaveGatewayUrl(txId: string): string {

/**
 * Extract video source type from a URL for embed component selection.
 */
export function classifyVideoUrl(url: string): {

