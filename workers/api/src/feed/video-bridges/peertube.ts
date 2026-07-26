/**
 * @degenfeed/api-worker — PeerTube Video Bridge
 *
 * Fetches video content from PeerTube (ActivityPub / federated).
 * Sources:
 *   - DegenFeed's PeerTube instance: https://video.degenfeed.xyz
 *   - SepiaSearch for cross-instance search
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'peertube';
const PLATFORM_LABEL = 'PeerTube';
const PLATFORM_COLOR = '#F1680D';

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PeerTubeVideo {

interface PeerTubeListResponse {

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchPeerTubeChannelVideos(
  channelHandle: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchPeerTubeTrending(
  category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchPeerTube(query: string, limit: number = 10): Promise<UnifiedVideo[]> {

// ─── Cross-instance search via SepiaSearch ────────────────────────────────

export async function searchPeerTubeFederated(
  query: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {

// ─── Converter ─────────────────────────────────────────────────────────────

function convertPeerTubeVideos(
  videos: PeerTubeVideo[],
  instance: string = PEERTUBE_INSTANCE,
): UnifiedVideo[] {

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeScore(views: number, publishedMs: number): number {

function inferCategory(title: string, description: string): string {

