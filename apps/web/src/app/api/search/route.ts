import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../_proxy';

export const dynamic = 'force-dynamic';

/**
 * Unified cross-protocol search endpoint.
 *
 * GET /api/search?q=bitcoin&sources=mastodon,bluesky,nostr&page=1&limit=20
 *
 * Parameters:
 *   q       - Search query (required)
 *   sources - Comma-separated protocol filter (optional, default: all)
 *   page    - Page number (optional, default: 1)
 *   limit   - Results per page (optional, default: 20, max: 100)
 *
 * Returns results from ALL protocols in a unified format with
 * cross-protocol deduplication.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const sources = searchParams.get('sources') || 'all';
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';

    // Forward to worker/bridge which handles Meilisearch + fallback
    const workerUrl =
      process.env.WORKER_URL ||
      process.env.NEXT_PUBLIC_WORKER_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      'http://localhost:8787';

    const targetUrl = `${workerUrl}/api/search?q=${encodeURIComponent(q)}&sources=${encodeURIComponent(sources)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;

    // Try actual proxy first
    try {
      const res = await proxyGet('/api/search', request);
      if (res.ok) return res;
    } catch {
      // Fall through
    }

    // Fallback: direct fetch to bridge
    const res = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        // Forward auth cookie if present
        ...(request.headers.get('cookie') ? { Cookie: request.headers.get('cookie')! } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Bridge returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[search] Error:', err);
    // Return empty results on error
    return NextResponse.json({
      data: [],
      identities: [],
      communities: [],
      videos: [],
      meta: { total: 0, q: '', sources: 'all', page: 1, limit: 20 },
    });
  }
}
