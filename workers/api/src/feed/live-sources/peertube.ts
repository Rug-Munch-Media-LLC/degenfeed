/**
 * @degenfeed/api-worker — PeerTube Multi-Instance Live Source
 *
 * Aggregates live streams from multiple PeerTube instances across the fediverse.
 * Each instance is polled independently — one failure never blocks others.
 *
 * Instances:
 *   - video.degenfeed.xyz (self-hosted, primary)
 *   - tube.cryptoschizo.club (crypto-adjacent)
 *   - video.ploud.fr (general)
 *   - diode.zone (tech/creative)
 *   - Any additional federated instances from env
 *
 * Features:
 *   - Multi-instance parallel fetching
 *   - Live status detection via PeerTube REST API
 *   - Viewer + total views tracking
 *   - Channel info with avatar
 *   - Category ID → label mapping
 *   - Independent error handling per instance
 */

import type { Env } from '../../types';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';

// ─── PeerTube API Types ─────────────────────────────────────────────────

interface PeerTubeVideo {

interface PeerTubeApiResponse {

// ─── Instance Configuration ─────────────────────────────────────────────

interface PeerTubeInstance {

const DEFAULT_INSTANCES: PeerTubeInstance[] = [
  {
  {
];

// ─── Source Health Tracking ─────────────────────────────────────────────

async function trackPeerTubeHealth(
  env: Env,
  instanceUrl: string,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {

// ─── Category Overrides by Instance ─────────────────────────────────────

function getInstanceCategory(
  instance: PeerTubeInstance,
  apiCategory?: { id: number; label: string },
): string {

// ─── Fetch Single Instance ──────────────────────────────────────────────

/**
 * Fetch live streams from a single PeerTube instance.
 */
async function fetchPeerTubeInstance(
  instance: PeerTubeInstance,
  env: Env,
): Promise<UnifiedLiveStream[]> {

// ─── Main Fetcher ───────────────────────────────────────────────────────

/**
 * Fetch live PeerTube streams from all configured instances.
 * Each instance is fetched independently — one failure never blocks others.
 * Primary instance (video.degenfeed.xyz) uses full 50 count; others use 20.
 */
export async function fetchAllPeerTubeStreams(env: Env): Promise<UnifiedLiveStream[]> {

/**
 * Get total live count across all PeerTube instances.
 * Useful for the "Live" badge counter.
 */
export async function getPeerTubeLiveCount(env: Env): Promise<number> {

/**
 * Get instance health summary for monitoring.
 */
export async function getPeerTubeInstanceHealth(
  env: Env,
): Promise<
  Array<{ url: string; label: string; healthy: boolean; streamCount: number; error?: string }>
> {

