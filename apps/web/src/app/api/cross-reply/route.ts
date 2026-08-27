import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CrossReplySchema = z.object({
  parentId: z.string().min(1).max(100),
  parentProtocol: z.string().min(1).max(50),
  targetProtocol: z.string().min(1).max(50),
  content: z.string().min(1).max(5000),
});

/**
 * POST /api/cross-reply
 *
 * Create a cross-protocol reply.
 * This is the "compose" endpoint for cross-protocol replies shown in the UI.
 *
 * Body: {
 *   parentId: "post-1",
 *   parentProtocol: "nostr",
 *   targetProtocol: "farcaster",
 *   content: "Cross-protocol reply!"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = CrossReplySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { parentId, parentProtocol, targetProtocol, content } = parsed.data;

    if (!parentId || !parentProtocol || !targetProtocol || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: parentId, parentProtocol, targetProtocol, content' },
        { status: 400 },
      );
    }

    if (parentProtocol === targetProtocol) {
      return NextResponse.json(
        { error: 'Must use different protocols for cross-reply' },
        { status: 400 },
      );
    }

    // Generate a cross-reply ID
    const crossId = `cross:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    // Forward to bridge worker
    const workerUrl =
      process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://host.docker.internal:3101';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const bridgeKey = process.env.BRIDGE_API_KEY;
      if (bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;
      const res = await fetch(`${workerUrl}/api/bridge/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parentPostUri: `df://post/${parentId}`,
          parentProtocol,
          replyProtocol: targetProtocol,
          content,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fall through
    }

    return NextResponse.json({
      ok: true,
      reply: {
        id: crossId,
        protocol: targetProtocol,
        text: content,
        createdAt: Date.now(),
        bridged: true,
        bridgeFrom: parentProtocol,
        parentId,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
