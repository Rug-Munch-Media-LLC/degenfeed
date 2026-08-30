/**
 * GET /api/creator/coins
 *
 * Proxies to the Workers API route `GET /api/creator/coins`
 * (workers/api/src/routes/creator-dashboard.ts → handleCreatorCoinsList).
 *
 * Response shape (mirrors the worker exactly):
 *   { coins: Array<{ address, name, symbol, chain, deployedAt }> }
 *
 * The worker requires an authenticated session (401 when absent) and reads
 * the creator's coin list from KV. No mock/fabricated data is ever returned:
 * upstream 5xx / network failures are surfaced as structured errors.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

interface UpstreamErrorBody {
  error: string;
  code: 'UPSTREAM_NOT_IMPLEMENTED' | 'UPSTREAM_ERROR' | 'UPSTREAM_UNAVAILABLE';
  detail: string;
}

function structuredError(status: number, body: UpstreamErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const response = await proxyGet('/api/creator/coins', request);

    // Pass through successful and client-error responses unchanged (the
    // worker's own 400/401 bodies are already structured JSON).
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

    // Upstream 404 → the route is not registered in the deployed worker.
    if (response.status === 404) {
      return structuredError(501, {
        error: 'Creator coins API is not implemented upstream',
        code: 'UPSTREAM_NOT_IMPLEMENTED',
        detail:
          'The Workers API does not expose GET /api/creator/coins. The worker route must be registered before this endpoint can serve data.',
      });
    }

    // Upstream 5xx → surface a structured error instead of silent 500 HTML.
    return structuredError(502, {
      error: 'Creator coins API is unavailable',
      code: 'UPSTREAM_ERROR',
      detail: `Upstream worker returned HTTP ${response.status} for GET /api/creator/coins.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return structuredError(502, {
      error: 'Creator coins API is unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
      detail: `Failed to reach upstream worker: ${message}`,
    });
  }
}
