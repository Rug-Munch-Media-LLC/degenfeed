import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/creator/videos/upload
 *
 * Upload a video to PeerTube and register in creator's library.
 * Accepts multipart/form-data (file, title, description, tags, etc.).
 * Proxies to the worker backend which handles PeerTube upload + KV storage.
 */
export async function POST(request: Request) {
  try {
    const baseUrl = process.env.WORKER_URL
      ?? process.env.NEXT_PUBLIC_WORKER_URL
      ?? process.env.NEXT_PUBLIC_API_BASE
      ?? 'http://localhost:8787';

    const forwardedHeaders: Record<string, string> = {};
    const cookie = request.headers.get('cookie');
    if (cookie) forwardedHeaders['Cookie'] = cookie;
    const auth = request.headers.get('authorization');
    if (auth) forwardedHeaders['Authorization'] = auth;

    // Forward the original multipart body as-is
    const body = await request.blob();

    const res = await fetch(`${baseUrl}/api/creator/videos/upload`, {
      method: 'POST',
      headers: {
        ...forwardedHeaders,
        // Preserve content-type (multipart boundary)
        'content-type': request.headers.get('content-type') ?? 'application/octet-stream',
      },
      body,
    });

    const responseBody = await res.text();
    return new Response(responseBody, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-cache',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Upload proxy failed: ${msg}` }, { status: 500 });
  }
}
