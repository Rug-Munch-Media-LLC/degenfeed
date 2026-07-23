import { NextResponse } from 'next/server';
import { proxyGet } from '../../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creator/videos/:id
 *
 * Fetch a single video's details and analytics.
 * Proxies to the worker which returns video metadata + analytics.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  return proxyGet(`/api/creator/videos/${id}`, request);
}

/**
 * PUT /api/creator/videos/:id
 *
 * Update video metadata (title, description, tags, privacy, etc.).
 * Accepts multipart/form-data.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

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

    const body = await request.blob();
    const res = await fetch(`${baseUrl}/api/creator/videos/${id}`, {
      method: 'PUT',
      headers: {
        ...forwardedHeaders,
        'content-type': request.headers.get('content-type') ?? 'application/octet-stream',
      },
      body,
    });

    const responseBody = await res.text();
    return new Response(responseBody, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Update proxy failed: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE /api/creator/videos/:id
 *
 * Delete a video from PeerTube and remove from creator's library.
 * Verifies ownership server-side before deletion.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

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

    const res = await fetch(`${baseUrl}/api/creator/videos/${id}`, {
      method: 'DELETE',
      headers: forwardedHeaders,
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Delete proxy failed: ${msg}` }, { status: 500 });
  }
}
