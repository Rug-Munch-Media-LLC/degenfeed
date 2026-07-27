import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Unified cross-protocol search endpoint.
 *
 * Proxies search requests to the search backend (bridge or Hono worker),
 * mapping frontend parameter names to backend parameter names.
 *
 * Frontend sends: q, limit, protocols
 * Backend expects: q, limit, sources
 *
 * GET /api/search?q=bitcoin&limit=20&protocols=mastodon,bluesky
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '20';
    const page = searchParams.get('page') || '1';

    // Accept both 'protocols' (frontend) and 'sources' (backend) params
    const protocols = searchParams.get('sources') || searchParams.get('protocols') || 'all';

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Search query is required (min 2 characters)' },
        { status: 400 },
      );
    }

    const workerUrl =
      process.env.WORKER_URL ||
      process.env.NEXT_PUBLIC_WORKER_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8787';

    // Forward to the backend with correctly mapped parameter names
    const targetUrl = `${workerUrl}/api/search?q=${encodeURIComponent(q)}&sources=${encodeURIComponent(protocols)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;

    const res = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        // Forward auth cookie if present
        ...(request.headers.get('cookie') ? { Cookie: request.headers.get('cookie')! } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
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
