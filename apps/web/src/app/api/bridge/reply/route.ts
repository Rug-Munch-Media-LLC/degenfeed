import { type NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../_auth';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

const VALID_PROTOCOLS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'reddit',
  'threads',
  'lemmy',
  'peertube',
];

/**
 * POST /api/bridge/reply
 *
 * Send a cross-protocol reply.
 * The reply is composed on one protocol and bridged to the target protocol.
 *
 * Body: {
 *   parentPostUri: "df://post/...",
 *   parentProtocol: "nostr",
 *   replyProtocol: "farcaster",
 *   content: "Great post!",
 *   authorId: "npub1..."
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { parentPostUri, parentProtocol, replyProtocol, content, authorId } = body;

    if (!parentProtocol || !replyProtocol || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: parentProtocol, replyProtocol, content' },
        { status: 400 },
      );
    }

    if (parentProtocol === replyProtocol) {
      return NextResponse.json(
        { error: 'parentProtocol and replyProtocol must differ for bridge' },
        { status: 400 },
      );
    }

    if (!VALID_PROTOCOLS.includes(parentProtocol) || !VALID_PROTOCOLS.includes(replyProtocol)) {
      return NextResponse.json(
        { error: `Invalid protocol. Must be one of: ${VALID_PROTOCOLS.join(', ')}` },
        { status: 400 },
      );
    }

    // Generate a bridged reply ID
    const bridgedId = `${replyProtocol}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    // Try to forward to worker/bridge
    const workerUrl =
      process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://host.docker.internal:3101';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const bridgeKey = process.env.BRIDGE_API_KEY;
      if (bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;
      const bridgeRes = await fetch(`${workerUrl}/api/bridge/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parentPostUri,
          parentProtocol,
          replyProtocol,
          content,
          authorId: authorId || session?.address || 'anonymous',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (bridgeRes.ok) {
        const data = await bridgeRes.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fall through to local response
    }

    return NextResponse.json({
      ok: true,
      reply: {
        id: bridgedId,
        protocol: replyProtocol,
        text: content,
        createdAt: Date.now(),
        bridged: true,
        bridgeFrom: parentProtocol,
        parentPostUri,
        parentProtocol,
        authorId: authorId || 'anonymous',
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
