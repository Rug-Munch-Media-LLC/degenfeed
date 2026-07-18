import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../_auth';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

/**
 * Cross-protocol bridge reply endpoint.
 * Accepts a reply composed on one protocol and relays it to the target protocol.
 */
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
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

    const validProtocols = [
      'nostr',
      'farcaster',
      'lens',
      'bluesky',
      'mastodon',
      'reddit',
      'threads',
    ];
    if (!validProtocols.includes(parentProtocol) || !validProtocols.includes(replyProtocol)) {
      return NextResponse.json(
        { error: `Invalid protocol. Must be one of: ${validProtocols.join(', ')}` },
        { status: 400 },
      );
    }

    // Generate a bridged reply ID with bridge metadata
    const bridgedId = `${replyProtocol}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

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
