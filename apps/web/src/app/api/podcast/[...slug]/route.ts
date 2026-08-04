/**
 * Podcast API — catch-all route
 * Proxies all /api/podcast/* requests to the bridge server.
 *
 * Routes handled:
 *   GET  /api/podcast/discover          — Discovery feed
 *   GET  /api/podcast/trending          — Trending episodes
 *   GET  /api/podcast/categories        — Categories with counts
 *   GET  /api/podcast/search            — Search
 *   GET  /api/podcast/mine              — My podcasts
 *   POST /api/podcast/create            — Create podcast
 *   POST /api/podcast/episode           — Publish episode
 *   GET  /api/podcast/:id               — Podcast detail
 *   GET  /api/podcast/:id/episodes      — Episodes list
 *   POST /api/podcast/episode/:id/publish — Publish episode
 *   POST /api/podcast/episode/:id/tip     — Tip episode
 *   DELETE /api/podcast/episode/:id       — Delete episode
 */

export const dynamic = 'force-dynamic';

function resolveWorkerUrl(): string {
  return (
    process.env.WORKER_URL ??
    process.env.NEXT_PUBLIC_WORKER_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://host.docker.internal:3101'
  );
}

function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get('cookie');
  if (cookie) headers.Cookie = cookie;
  const auth = request.headers.get('authorization');
  if (auth) headers.Authorization = auth;
  const wallet = request.headers.get('x-wallet-address');
  if (wallet) headers['X-Wallet-Address'] = wallet;
  // Inject bridge API key for local bridge auth (from server env)
  const bridgeKey = process.env.BRIDGE_API_KEY;
  if (bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;
  return headers;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const slug = (await params).slug;
  const path = slug?.length ? `/api/podcast/${slug.join('/')}` : '/api/podcast';
  return proxyToBridge('GET', path, request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const slug = (await params).slug;
  const path = slug?.length ? `/api/podcast/${slug.join('/')}` : '/api/podcast';
  return proxyToBridge('POST', path, request);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const slug = (await params).slug;
  const path = slug?.length ? `/api/podcast/${slug.join('/')}` : '/api/podcast';
  return proxyToBridge('DELETE', path, request);
}

async function proxyToBridge(method: string, path: string, request: Request): Promise<Response> {
  const base = resolveWorkerUrl();
  const url = new URL(request.url);
  const target = `${base}${path}${url.search}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...forwardHeaders(request),
  };

  try {
    const body = method !== 'GET' ? await request.text() : undefined;
    const res = await fetch(target, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });

    const responseBody = await res.text();
    return new Response(responseBody, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    return Response.json(
      { error: `Bridge proxy error: ${(err as Error).message}`, code: 502 },
      { status: 502 },
    );
  }
}
