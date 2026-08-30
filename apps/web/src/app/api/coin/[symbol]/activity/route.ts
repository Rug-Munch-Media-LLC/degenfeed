/**
 * GET /api/coin/[symbol]/activity
 *
 * Proxies to the Workers API route `GET /api/coin/:symbol/activity`
 * (workers/api/src/routes/coin-activity.ts → handleCoinActivity).
 *
 * Response shape (mirrors the worker exactly):
 *   {
 *     events: ActivityEvent[],   // { id, type, symbol, actor, amount?, ... timestamp }
 *     total: number,
 *     page: number,
 *     pageSize: number,
 *     hasMore: boolean,
 *     symbol: string,            // uppercased
 *   }
 *
 * Query params: page (>=1), pageSize (1-100, default 30), type (optional
 * activity-type filter). No mock data is ever fabricated — upstream 404/5xx
 * and network failures surface as structured errors.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../../_proxy';

export const dynamic = 'force-dynamic';

/** Activity types from workers/api/src/routes/coin-activity.ts */
const ACTIVITY_TYPES = new Set([
  'buy',
  'sell',
  'claim_vested',
  'new_holder',
  'phase_change',
  'badge_earned',
  'tip_creator',
]);

/** Conservative charset for a coin symbol (token tickers) — blocks path injection. */
const SYMBOL_PATTERN = /^[a-zA-Z0-9_\-.]{1,32}$/;

interface UpstreamErrorBody {
  error: string;
  code: 'UPSTREAM_NOT_IMPLEMENTED' | 'UPSTREAM_ERROR' | 'UPSTREAM_UNAVAILABLE';
  detail: string;
  symbol: string;
}

function structuredError(status: number, body: UpstreamErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
): Promise<Response> {
  const { symbol } = await params;

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    return structuredError(400, {
      error: 'Invalid coin symbol',
      code: 'UPSTREAM_ERROR',
      detail: 'A valid coin symbol (1-32 chars: letters, digits, _ - .) is required.',
      symbol: symbol ?? '',
    });
  }

  // Validate the same query params the worker understands, before proxying.
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const pageSize = Number(url.searchParams.get('pageSize')) || 30;
  const type = url.searchParams.get('type');
  if (page < 1) {
    return structuredError(400, {
      error: 'Invalid page parameter',
      code: 'UPSTREAM_ERROR',
      detail: 'page must be >= 1.',
      symbol,
    });
  }
  if (pageSize < 1 || pageSize > 100) {
    return structuredError(400, {
      error: 'Invalid pageSize parameter',
      code: 'UPSTREAM_ERROR',
      detail: 'pageSize must be between 1 and 100.',
      symbol,
    });
  }
  if (type && !ACTIVITY_TYPES.has(type)) {
    return structuredError(400, {
      error: 'Invalid activity type filter',
      code: 'UPSTREAM_ERROR',
      detail: `type must be one of: ${[...ACTIVITY_TYPES].join(', ')}.`,
      symbol,
    });
  }

  try {
    const response = await proxyGet(`/api/coin/${symbol}/activity`, request);

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
      // handleCoinActivity exists in the worker source but is NOT registered
      // in workers/api/src/routes/register/coins.ts — the backing service
      // genuinely does not exist yet. Report honestly as 501.
      return structuredError(501, {
        error: 'Coin activity API is not implemented upstream',
        code: 'UPSTREAM_NOT_IMPLEMENTED',
        detail:
          'The Workers API does not register GET /api/coin/:symbol/activity. The route must be added upstream before this endpoint can serve data.',
        symbol,
      });
    }

    return structuredError(502, {
      error: 'Coin activity API is unavailable',
      code: 'UPSTREAM_ERROR',
      detail: `Upstream worker returned HTTP ${response.status} for /api/coin/${symbol}/activity.`,
      symbol,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return structuredError(502, {
      error: 'Coin activity API is unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
      detail: `Failed to reach upstream worker: ${message}`,
      symbol,
    });
  }
}
