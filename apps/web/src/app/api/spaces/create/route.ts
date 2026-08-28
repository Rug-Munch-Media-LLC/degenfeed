import { createSpace } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';
import { SpaceCreateSchema } from '../../../../lib/validation/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = SpaceCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { title, description, hostId, platforms: requestedPlatforms, contentType } = parsed.data;

    // Determine which platforms to create on
    const platforms: SpacePlatform[] = (requestedPlatforms ?? ['nostr']).filter(
      (p): p is SpacePlatform =>
        [
          'nostr',
          'peertube',
          'owncast',
          'livepeer',
          'farcaster',
          'lens',
          'bluesky',
          'mastodon',
          'discord',
          'telegram',
          'twitter',
          'youtube',
          'twitch',
          'kick',
          'nostr-pictures',
          'bluesky-photos',
          'pixelfed',
        ].includes(p),
    );

    if (platforms.length === 0) {
      platforms.push('nostr');
    }

    const result = await createSpace({
      title,
      description,
      hostId: hostId || 'anon',
      hostName: body.hostName || 'Anonymous',
      hostAvatarUrl: body.hostAvatarUrl,
      coHosts: body.coHosts || [],
      platforms,
      contentType,
      photoUrls: body.photoUrls,
      scheduledAt: body.scheduledAt,
      tippingEnabled: body.tippingEnabled ?? true,
      tipTokenAddress: body.tipTokenAddress,
      gating: body.gating,
      tags: body.tags,
      peertubeTokenAddress: body.peertubeTokenAddress,
      peertubeTokenSymbol: body.peertubeTokenSymbol,
      peertubeCreatorAddress: body.peertubeCreatorAddress,
      youTubePrivacy: body.youTubePrivacy,
      twitchGame: body.twitchGame,
      kickCategory: body.kickCategory,
    });

    const status: 'live' | 'scheduled' =
      body.scheduledAt && new Date(body.scheduledAt).getTime() > Date.now() ? 'scheduled' : 'live';

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
          contentType,
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
