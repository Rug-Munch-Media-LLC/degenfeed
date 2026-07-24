import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

/**
 * POST /api/spaces/[id]/livekit-token
 * Generates a LiveKit access token for the participant.
 * Body: { userId, displayName, canPublish (optional) }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = getLiveKitConfig();

  if (!config.apiKey || !config.apiSecret) {
    // No LiveKit configured — return placeholder for dev
    return NextResponse.json({
      token: `dev-token-${id}-${Date.now()}`,
      room: `space-${id}`,
      region: 'dev',
    });
  }

  try {
    const body = await request.json();
    const { userId, displayName, canPublish } = body;

    // In production, generate a proper LiveKit JWT:
    // import { AccessToken } from 'livekit-server-sdk';
    // const at = new AccessToken(config.apiKey, config.apiSecret, {
    //   identity: userId || 'anon',
    //   name: displayName || 'Listener',
    // });
    // at.addGrant({
    //   roomJoin: true,
    //   room: `space-${id}`,
    //   canPublish: canPublish ?? false,
    //   canSubscribe: true,
    // });
    // const token = at.toJwt();

    const token = `livekit-${config.apiKey}-${id}-${userId}-${Date.now()}`;

    return NextResponse.json({
      token,
      room: `space-${id}`,
      region: config.wsUrl?.match(/wss:\/\/([^.]+)/)?.[1] ?? 'us',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
