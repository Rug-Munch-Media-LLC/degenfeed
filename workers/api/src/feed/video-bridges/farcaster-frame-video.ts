/**
 * @degenfeed/api-worker — Farcaster Frame Video Bridge
 *
 * Fetches video content embedded in Farcaster Frames.
 * Frames can contain video embeds (mp4, HLS, YouTube links).
 * We extract video embeds from trending Farcaster casts.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'farcaster';
const PLATFORM_LABEL = 'Farcaster Video';
const PLATFORM_COLOR = '#8A63D2';

const FARCASTER_HUB = 'http://127.0.0.1:2281';

// ─── Types ─────────────────────────────────────────────────────────────

interface FarcasterCast {

// ─── Fetch trending Farcaster casts with video embeds ────────────────────

export async function fetchFarcasterFrameVideos(
  limit: number = 20,
  signal?: AbortSignal,
): Promise<UnifiedVideo[]> {

// ─── Fetch trending casts ────────────────────────────────────────────────

async function fetchTrendingCasts(limit: number, signal?: AbortSignal): Promise<FarcasterCast[]> {

// ─── Extract video URLs from a cast ──────────────────────────────────────

interface VideoEmbed {

function extractVideoUrls(cast: FarcasterCast): VideoEmbed[] {

function detectVideoType(url: string): VideoEmbed['type'] {

