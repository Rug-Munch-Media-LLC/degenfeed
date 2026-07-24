/**
 * Live Streams API Route
 *
 * Proxies to the bridge live provider (Owncast + PeerTube + YouTube + Twitch).
 * Returns unified live stream data for the /live page.
 *
 * GET /api/streams/live
 */

import { NextResponse } from 'next/server';

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://127.0.0.1:8787';

export interface LiveStreamEntry {
  id: string;
  source: 'owncast' | 'peertube' | 'youtube' | 'twitch';
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  viewerCount: number;
  startedAt: number;
  thumbnailUrl?: string;
  streamUrl: string;
  embedUrl?: string;
  chatUrl?: string;
  isLive: boolean;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface LiveStreamsResponse {
  streams: LiveStreamEntry[];
  featured: LiveStreamEntry[];
  total: number;
  sources: Record<string, boolean>;
}

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/live`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'DegenFeed-Web/0.1' },
    });

    if (!res.ok) {
      console.error(`[api/live] Bridge returned ${res.status}`);
      return NextResponse.json(
        { error: 'Live stream service unavailable', status: 503 },
        { status: 503 },
      );
    }

    const data = (await res.json()) as LiveStreamsResponse;
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[api/live] Error: ${(err as Error).message}`);
    // Fall back to empty response
    return NextResponse.json({
      streams: [],
      featured: [],
      total: 0,
      sources: { owncast: false, peertube: false, youtube: false, twitch: false },
    });
  }
}
