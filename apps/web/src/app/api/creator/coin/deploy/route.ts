/**
 * POST /api/creator/coin/deploy
 *
 * Proxies coin deployment to the Workers API.
 * Accepts creator coin configuration and returns the deployed coin address.
 */

import { proxyPost } from '../../../_proxy';

export const runtime = 'edge';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    // Basic server-side validation
    const { name, symbol, description, supply, creatorAllocation } = body as Record<
      string,
      unknown
    >;

    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) {
      return new Response(JSON.stringify({ error: 'Invalid or missing coin name (1–64 chars)' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!symbol || typeof symbol !== 'string' || symbol.length < 1 || symbol.length > 16) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing coin symbol (1–16 chars)' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    if (description && typeof description !== 'string') {
      return new Response(JSON.stringify({ error: 'Description must be a string' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (supply !== undefined && (typeof supply !== 'number' || supply <= 0)) {
      return new Response(JSON.stringify({ error: 'Supply must be a positive number' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (
      creatorAllocation !== undefined &&
      (typeof creatorAllocation !== 'number' || creatorAllocation < 0 || creatorAllocation > 100)
    ) {
      return new Response(JSON.stringify({ error: 'Creator allocation must be 0–100' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    return proxyPost('/api/creator/coin/deploy', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
