import type { SpacePlatform } from '@degenfeed/spaces-bridge';
import { createSpace } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// All supported platforms for validation
const VALID_PLATFORMS: SpacePlatform[] = [
  // Audio
  'nostr',
  'peertube',
  'owncast',
  'livepeer',
  // Social Announce
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'discord',
  'telegram',
  'twitter',
  // Video
  'youtube',
  'twitch',
  'kick',
  // Photos
  'nostr-pictures',
  'bluesky-photos',
  'pixelfed',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Determine which platforms to create on
    const requestedPlatforms: string[] = body.platforms ?? ['nostr'];
    const platforms: SpacePlatform[] = requestedPlatforms.filter((p): p is SpacePlatform =>
      VALID_PLATFORMS.includes(p as SpacePlatform),
    );

    if (platforms.length === 0) {
      platforms.push('nostr');
    }

    // Content type
    const contentType = body.contentType ?? 'audio';

    const result = await createSpace({
      title,
      description: body.description,
      hostId: body.hostId || 'anon',
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
