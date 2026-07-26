/**
 * @degenfeed/api-worker — Bluesky Video Bridge
 *
 * Fetches video content from Bluesky/AT Protocol.
 * Bluesky supports video embeds via external embeds and the app.bsky.embed.video type.
 * No silent failures — individual errors are caught, never break the feed.
 */

import type { UnifiedVideo } from '../video-aggregator';

export async function fetchBlueskyChannelVideos(
  _did: string,
  _limit = 10,
): Promise<UnifiedVideo[]> {

export async function fetchBlueskyVideoFeed(): Promise<UnifiedVideo[]> {

export async function searchBlueskyVideos(query: string): Promise<UnifiedVideo[]> {

