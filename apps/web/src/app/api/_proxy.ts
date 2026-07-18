/**
 * Shared proxy helper for worker API routes.
 * Forwards requests to the worker backend using WORKER_URL env var.
 *
 * Environment variable priority:
 *   1. WORKER_URL
 *   2. NEXT_PUBLIC_WORKER_URL
 *   3. NEXT_PUBLIC_API_BASE
 *   4. http://localhost:8787 (fallback)
 */

function resolveWorkerUrl(): string {
  return (
    process.env.WORKER_URL ??
    process.env.NEXT_PUBLIC_WORKER_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8787'
  );
}

/**
 * Proxy a GET request to the worker backend.
 * Preserves query parameters from the incoming request.
 */
export async function proxyGet(workerPath: string, request: Request): Promise<Response> {
  const base = resolveWorkerUrl();
  const url = new URL(request.url);
  const target = `${base}${workerPath}${url.search}`;

  const res = await fetch(target);
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': res.headers.get('cache-control') ?? 'no-cache',
    },
  });
}

/**
 * Proxy a POST request to the worker backend.
 * Forwards the request body as JSON.
 */
export async function proxyPost(workerPath: string, request: Request): Promise<Response> {
  const base = resolveWorkerUrl();
  const body = await request.text();

  const res = await fetch(`${base}${workerPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

  const responseBody = await res.text();

  return new Response(responseBody, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}
