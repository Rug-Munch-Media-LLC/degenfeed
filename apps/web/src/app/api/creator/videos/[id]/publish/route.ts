import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/creator/videos/:id/publish
 *
 * Publish or re-publish a video to additional platforms.
 * Accepts JSON body: { targets: string[], text?: string }
 * - targets: Array of platform IDs (nostr, farcaster, lens, bluesky, etc.)
 * - text: Optional custom announcement text
 *
 * Premium tier: unlimited targets.
 * Free tier: limited to 3 targets per request.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || id.length < 8) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const body = await request.json();
    const targets: string[] = Array.isArray(body.targets)
      ? body.targets.filter((t: string) => typeof t === 'string' && t.length > 0)
      : [];
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (targets.length === 0) {
      return NextResponse.json({ error: 'No valid targets specified' }, { status: 400 });
    }

    // Fetch video details to include in the announcement
    const baseUrl = process.env.WORKER_URL
      ?? process.env.NEXT_PUBLIC_WORKER_URL
      ?? process.env.NEXT_PUBLIC_API_BASE
      ?? 'http://localhost:8787';

    const forwardedHeaders: Record<string, string> = {};
    const cookie = request.headers.get('cookie');
    if (cookie) forwardedHeaders['Cookie'] = cookie;
    const auth = request.headers.get('authorization');
    if (auth) forwardedHeaders['Authorization'] = auth;

    // Get video metadata for the announcement
    const videoRes = await fetch(`${baseUrl}/api/creator/videos/${id}`, {
      headers: forwardedHeaders,
    });

    let videoTitle = 'Untitled';
    let videoUrl = '';
    if (videoRes.ok) {
      const videoData = await videoRes.json() as { video?: { title: string; url: string } };
      if (videoData.video) {
        videoTitle = videoData.video.title;
        videoUrl = videoData.video.url;
      }
    }

    // Build announcement text
    const announcement = text
      ? `${text}\n\n🎬 Watch: ${videoUrl}`
      : `🎬 New video: "${videoTitle}"\n\nWatch on DegenFeed: ${videoUrl}`;

    // Publish via the existing publish API
    const publishRes = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...forwardedHeaders,
      },
      body: JSON.stringify({
        targets,
        text: announcement,
        auth: {},
      }),
    });

    const data = await publishRes.json();
    const status = data.meta?.tier === 'free' && targets.length > 3 ? 402 : publishRes.status;

    return NextResponse.json(data, { status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Publish failed: ${msg}` }, { status: 500 });
  }
}
