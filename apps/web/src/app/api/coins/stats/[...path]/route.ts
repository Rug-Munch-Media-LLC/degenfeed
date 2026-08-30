/**
 * GET /api/coins/stats/[...path]
 *
 * Catch-all proxy to the Workers API coin statistics routes
 * (workers/api/src/routes/coin-stats.ts), registered upstream as:
 *
 *   /api/coins/stats/overview       → CoinStatsOverview (bare object)
 *   /api/coins/stats/top            → { coins: CoinStatsItem[], sortedBy }   (?by=)
 *   /api/coins/stats/trending       → { coins: CoinStatsItem[] }
 *   /api/coins/stats/new            → { coins: CoinStatsItem[] }
 *   /api/coins/stats/gainers        → { coins: CoinStatsItem[], period }    (?period=)
 *   /api/coins/stats/losers         → { coins: CoinStatsItem[], period }    (?period=)
 *   /api/coins/stats/most-holders   → { coins: CoinStatsItem[] }
 *   /api/coins/stats/highest-volume → { coins: CoinStatsItem[] }
 *
 * Query parameters are preserved and forwarded verbatim. Unknown subpaths are
 * rejected locally with 404 (the worker would do the same). No mock data is
 * ever fabricated — upstream failures surface as structured errors.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../../_proxy';

export const dynamic = 'force-dynamic';

/** Sub-routes registered by the worker at /api/coins/stats/* */
const KNOWN_STATS_PATHS = new Set([
  'overview',
  'top',
  'trending',
  'new',
  'gainers',
  'losers',
  'most-holders',
  'highest-volume',
]);

interface UpstreamErrorBody {
  error: string;
  code: 'UPSTREAM_NOT_IMPLEMENTED' | 'UPSTREAM_ERROR' | 'UPSTREAM_UNAVAILABLE';
  detail: string;
  path: string;
}

function structuredError(status: number, body: UpstreamErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;

  if (!path || path.length === 0) {
    return structuredError(400, {
      error: 'Missing stats path',
      code: 'UPSTREAM_ERROR',
      detail:
        'Expected /api/coins/stats/<overview|top|trending|new|gainers|losers|most-holders|highest-volume>.',
      path: '',
    });
  }

  const subPath = path.join('/');
  if (!KNOWN_STATS_PATHS.has(subPath)) {
    return structuredError(404, {
      error: 'Unknown coin stats path',
      code: 'UPSTREAM_NOT_IMPLEMENTED',
      detail: `No worker route registered for /api/coins/stats/${subPath}.`,
      path: subPath,
    });
  }

  try {
    const response = await proxyGet(`/api/coins/stats/${subPath}`, request);

    if (response.status < 500) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': response.headers.get('content-type') ?? 'application/json',
          'cache-control': response.headers.get('cache-control') ?? 'no-cache',
        },
      });
    }

    if (response.status === 404) {
      return structuredError(501, {
        error: 'Coin stats API is not implemented upstream',
        code: 'UPSTREAM_NOT_IMPLEMENTED',
        detail: `Upstream worker does not expose /api/coins/stats/${subPath}.`,
        path: subPath,
      });
    }

    return structuredError(502, {
      error: 'Coin stats API is unavailable',
      code: 'UPSTREAM_ERROR',
      detail: `Upstream worker returned HTTP ${response.status} for /api/coins/stats/${subPath}.`,
      path: subPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return structuredError(502, {
      error: 'Coin stats API is unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
      detail: `Failed to reach upstream worker: ${message}`,
      path: subPath,
    });
  }
}
