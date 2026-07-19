/**
 * GET /api/creator/coin/[address]/curve
 *
 * Proxies to the Workers API for bonding curve data:
 * price, progress %, total raised, recent trades, holder count.
 */

import { proxyGet } from '../../../../_proxy';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
): Promise<Response> {
  const { address } = await params;
  if (!address || typeof address !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing coin address' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Validate address format (basic check)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new Response(JSON.stringify({ error: 'Invalid coin address format' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    return proxyGet(`/api/creator/coin/${address}/curve`, _request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
