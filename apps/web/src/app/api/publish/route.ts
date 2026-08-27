import type { AnnouncePlatform, SpaceItem } from '@degenfeed/spaces-bridge';
import { announceSpace } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';
import { PublishSchema } from '../../../lib/validation/schemas';
export const dynamic = 'force-dynamic';

const VALID_TARGETS: AnnouncePlatform[] = [
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'discord',
  'telegram',
  'twitter',
];

const FREE_TIER_MAX_PROTOCOLS = 3;

/**
 * Check premium status by calling the worker's billing API.
 */
async function checkUserPremium(request: Request): Promise<{
  isPremium: boolean;
  tier: string;
}> {
  try {
    const { proxyGet } = await import('../_proxy');
    const billingRes = await proxyGet('/api/billing/my-status', request);
    if (!billingRes.ok) {
      return { isPremium: false, tier: 'free' };
    }
    const data = (await billingRes.json()) as { tier?: string; isPremium?: boolean };
    return {
      isPremium: data.isPremium ?? false,
      tier: data.tier ?? 'free',
    };
  } catch {
    return { isPremium: false, tier: 'free' };
  }
}

/**
 * POST /api/publish
 * Publish a cross-protocol announcement to multiple social platforms.
 *
 * Supports: farcaster, lens, bluesky, mastodon, discord, telegram, twitter
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = PublishSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { content: text, platforms, media, scheduledAt } = parsed.data;
    const targets = Array.isArray(body.targets)
      ? body.targets.filter((t: string) => VALID_TARGETS.includes(t as AnnouncePlatform))
      : [];

    if (!text) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }
    if (targets.length === 0) {
      return NextResponse.json(
        { error: `No valid targets. Supported: ${VALID_TARGETS.join(', ')}` },
        { status: 400 },
      );
    }

    // Premium tier check
    const { isPremium, tier } = await checkUserPremium(request);
    if (!isPremium && targets.length > FREE_TIER_MAX_PROTOCOLS) {
      return NextResponse.json(
        {
          error: 'Free tier limited to 3 protocols. Upgrade to post to all protocols.',
          upgrade_url: '/settings#subscription',
          protocols_used: targets.length,
          tier: 'free',
          remaining_free_slots: 0,
          status: 402,
        },
        { status: 402 },
      );
    }

    // Build a minimal SpaceItem for announcement
    const spaceId = `announce-${Date.now()}`;
    const spaceItem: SpaceItem = {
      id: spaceId,
      title: text.slice(0, 80),
      description: text,
      hostId: body.hostId ?? 'anon',
      hostName: body.hostName ?? 'Anonymous',
      hostAvatarUrl: body.hostAvatarUrl,
      coHosts: [],
      platforms: [],
      status: 'live',
      createdAt: Date.now(),
      listeners: 0,
      speakers: [],
      reactions: [],
      tippingEnabled: false,
      contentType: 'announcement',
    };

    // Use the spaces-bridge announce module for each target
    const results = await announceSpace(spaceItem, targets as AnnouncePlatform[]);

    // Transform results to match expected format
    const formattedResults: Record<string, { ok: boolean; hash?: string; error?: string }> = {};
    for (const [platform, result] of Object.entries(results)) {
      formattedResults[platform] = {
        ok: result.ok,
        hash: result.nativeId,
        error: result.error,
      };
    }

    return NextResponse.json({
      results: formattedResults,
      meta: {
        protocols_used: targets.length,
        tier,
        remaining_free_slots: isPremium
          ? 'unlimited'
          : Math.max(0, FREE_TIER_MAX_PROTOCOLS - targets.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
