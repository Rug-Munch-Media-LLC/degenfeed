import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest, requireSession } from '../../../_auth';

export const dynamic = 'force-dynamic';

const LiveKitTokenSchema = z.object({
  displayName: z.string().max(50).optional(),
  canPublish: z.boolean().optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/spaces/[id]/livekit-token
 *
 * Issues a REAL LiveKit access token (HS256 JWT per LiveKit spec) for the
 * authenticated session holder. Returns 503 when LiveKit is not configured —
 * never a fake placeholder token (TOP-100 #3).
 *
 * LiveKit token format: standard JWT with
 *   iss = API key, sub/jti = identity, video grant claims in `video`.
 */

interface LiveKitConfig {
  apiKey?: string;
  apiSecret?: string;
  wsUrl?: string;
}

function getLiveKitConfig(): LiveKitConfig {
  return {
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    wsUrl: process.env.LIVEKIT_WS_URL ?? 'wss://degenfeed.livekit.cloud',
  };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signLivekitJwt(
  apiKey: string,
  apiSecret: string,
  identity: string,
  room: string,
  canPublish: boolean,
  ttlSeconds = 3600,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      jti: identity,
      exp: now + ttlSeconds,
      nbf: now - 10,
      video: {
        roomJoin: true,
        room,
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    }),
  );
  const signature = createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(signature)}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireSession(request);
  if (authError) return authError;

  const { id } = await params;
  const config = getLiveKitConfig();

  if (!config.apiKey || !config.apiSecret) {
    // No LiveKit configured — fail honestly instead of issuing a dead token.
    return NextResponse.json(
      {
        error: 'LiveKit is not configured — set LIVEKIT_API_KEY / LIVEKIT_API_SECRET',
        code: 'LIVEKIT_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = LiveKitTokenSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { displayName, canPublish } = parsed.data;

    const session = await getSessionFromRequest(request);
    const identity = session?.address ?? 'anon';

    const token = signLivekitJwt(
      config.apiKey,
      config.apiSecret,
      identity,
      `space-${id}`,
      canPublish ?? false,
    );

    return NextResponse.json({
      token,
      room: `space-${id}`,
      identity,
      displayName: displayName || 'Listener',
      region: config.wsUrl?.match(/wss:\/\/([^.]+)/)?.[1] ?? 'us',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
