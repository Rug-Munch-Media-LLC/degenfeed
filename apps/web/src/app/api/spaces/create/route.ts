import { NextResponse } from 'next/server';
import { createSpace, getBridge } from '@degenfeed/spaces-bridge';
import type { SpacePlatform } from '@degenfeed/spaces-bridge';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Determine which platforms to create on
    const requestedPlatforms: string[] = body.platforms ?? ['nostr'];
    const platforms: SpacePlatform[] = requestedPlatforms.filter(
      (p): p is SpacePlatform => ['nostr', 'peertube', 'owncast', 'livepeer'].includes(p),
    );

    if (platforms.length === 0) {
      platforms.push('nostr');
    }

    const result = await createSpace({
      title,
      description: body.description,
      hostId: body.hostId || 'anon',
      hostName: body.hostName || 'Anonymous',
      hostAvatarUrl: body.hostAvatarUrl,
      coHosts: body.coHosts || [],
      platforms,
      scheduledAt: body.scheduledAt,
      tippingEnabled: body.tippingEnabled ?? true,
      tipTokenAddress: body.tipTokenAddress,
      gating: body.gating,
      tags: body.tags,
      peertubeTokenAddress: body.peertubeTokenAddress,
      peertubeTokenSymbol: body.peertubeTokenSymbol,
      peertubeCreatorAddress: body.peertubeCreatorAddress,
    });

    const status: 'live' | 'scheduled' =
      body.scheduledAt && new Date(body.scheduledAt).getTime() > Date.now()
        ? 'scheduled'
        : 'live';

    const speakers = result.platformResults
      .filter((p) => !p.error)
      .map((p) => ({
        platform: p.platform,
        url: p.url,
        streamUrl: p.streamUrl,
        chatUrl: p.chatUrl,
      }));

    return NextResponse.json(
      {
        space: {
          id: result.id,
          title,
          description: body.description || '',
          hostId: body.hostId || 'anon',
          hostName: body.hostName || 'Anonymous',
          hostAvatarUrl: body.hostAvatarUrl,
          coHosts: body.coHosts || [],
          protocols: platforms,
          platforms: speakers,
          status,
          createdAt: Date.now(),
          scheduledAt: body.scheduledAt,
          listeners: 1,
          speakers: [
            {
              id: body.hostId || 'anon',
              displayName: body.hostName || 'Host',
              isHost: true,
              isCoHost: false,
              speaking: false,
            },
          ],
          reactions: [],
          tippingEnabled: body.tippingEnabled ?? true,
        },
        platformResults: result.platformResults,
        ok: true,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
