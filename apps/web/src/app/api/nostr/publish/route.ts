/**
 * POST /api/nostr/publish
 *
 * Publish a signed Nostr event to our relay.
 *
 * This endpoint accepts any valid Nostr event (kind 0, 1, 7, 10002, etc.)
 * and publishes it to our relay at ws://127.0.0.1:8085.
 *
 * Body: {
 *   event: NostrEvent;  // Fully signed Nostr event
 * }
 *
 * Security: Events are validated for basic structure before publishing.
 * The signature should be verified client-side. The server does a
 * basic structure check (required fields exist).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const NostrPublishSchema = z.object({
  event: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = NostrPublishSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }
    const { event } = parsed.data;

    if (!event || typeof event !== 'object') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'event object is required' } },
        { status: 400 },
      );
    }

    // Validate required Nostr event fields
    const requiredFields = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];
    const missing = requiredFields.filter((f) => !event[f]);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: `Event missing required fields: ${missing.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Verify event structure
    if (!Array.isArray(event.tags)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'tags must be an array' } },
        { status: 400 },
      );
    }

    if (typeof event.kind !== 'number' || event.kind < 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'kind must be a non-negative number' } },
        { status: 400 },
      );
    }

    // Proxy to bridge server for relay publishing
    const workerUrl =
      process.env.WORKER_URL ??
      process.env.NEXT_PUBLIC_WORKER_URL ??
      'http://host.docker.internal:3101';

    const bridgeRes = await fetch(`${workerUrl}/api/nostr/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
      signal: AbortSignal.timeout(10000),
    });

    if (bridgeRes.ok) {
      const data = await bridgeRes.json();
      return NextResponse.json(data);
    }

    // Bridge relay might be down
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'RELAY_ERROR',
          message: 'Relay is currently unavailable. Try again shortly.',
        },
      },
      { status: 502 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed';
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
