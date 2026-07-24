/**
 * @degenfeed/spaces-bridge — Nostr Spaces Bridge
 *
 * Enhanced wrapper around the existing NostrLiveBridge.
 * Adds support for audio-only Kind 30311 events with space-specific tags.
 *
 * NIP-93 (formerly NIP-53): Parameterized Replaceable Events for live activities.
 * Kind 30311 events with 'd' tag uniquely identify the space.
 *
 * Tag conventions:
 *   d       = degenfeed-space-{id}    (unique identifier)
 *   title   = Space title
 *   status  = live | planned | ended
 *   t       = space, audio, degenfeed (categorization)
 *   p       = host pubkey, co-host pubkeys
 *   relays  = DegenFeed relay URL
 *   streaming = https://app.degenfeed.xyz/spaces/{id}
 */

import { NostrLiveBridge } from '../../workers/api/src/lib/nostr-live-bridge';
import type { Space } from '@degenfeed/types';
import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.degenfeed.xyz';

// ─── Bridge Implementation ──────────────────────────────────────────────

export const nostrBridge: PlatformBridge = {
  platform: 'nostr',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const nsec = process.env.NOSTR_PRIVATE_KEY;
    if (!nsec) {
      throw new Error('NOSTR_PRIVATE_KEY not configured — cannot announce to Nostr');
    }

    // Map our SpaceItem to the internal Space type expected by NostrLiveBridge
    const space: Space = {
      id: `space-${Date.now()}`,
      title: options.title,
      description: options.description ?? '',
      hostId: options.hostId,
      hostName: options.hostName,
      hostAvatarUrl: options.hostAvatarUrl,
      coHosts: options.coHosts ?? [],
      speakers: [],
      listeners: 0,
      status: options.scheduledAt ? 'scheduled' : 'live',
      createdAt: Date.now(),
      reactions: [],
      tippingEnabled: options.tippingEnabled ?? true,
      platforms: [],
    };

    const bridge = new NostrLiveBridge(process.env as Record<string, string> as never, {
      nsec,
      hostPubkey: options.hostId,
    });

    const eventId = await bridge.announceSpace(space);

    return {
      platform: 'nostr',
      nativeId: eventId,
      url: `${APP_URL}/spaces/${space.id}`,
      metadata: {
        eventId,
        dTag: `degenfeed-space-${space.id}`,
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    // Live spaces are aggregated server-side; the Nostr feed is
    // fetched via the existing /api/spaces/live endpoint which
    // queries the worker backend.
    // This bridge method is for direct relay queries if needed.
    return [];
  },

  async getSpace(_nativeId: string): Promise<SpaceItem | null> {
    return null; // Delegate to the aggregator
  },

  async endSpace(space: SpaceItem): Promise<void> {
    const nsec = process.env.NOSTR_PRIVATE_KEY;
    if (!nsec) return;

    const legacySpace: Space = {
      id: space.id,
      title: space.title,
      description: space.description ?? '',
      hostId: space.hostId,
      hostName: space.hostName,
      hostAvatarUrl: space.hostAvatarUrl,
      coHosts: space.coHosts,
      speakers: space.speakers,
      listeners: space.listeners,
      status: 'ended',
      createdAt: space.createdAt,
      reactions: space.reactions,
      tippingEnabled: space.tippingEnabled,
      platforms: [],
    };

    const bridge = new NostrLiveBridge(process.env as Record<string, string> as never, {
      nsec,
      hostPubkey: space.hostId,
    });
    await bridge.endStream(space.id, {
      id: space.id,
      title: space.title,
      creator: space.hostName,
      type: 'space',
      isLive: false,
      viewerCount: space.listeners,
      host: space.hostName,
      streamUrl: `${APP_URL}/spaces/${space.id}`,
      description: space.description ?? '',
      surfaces: ['space', 'audio'],
      coHosts: space.coHosts,
      endedAt: Date.now(),
    } as never);
  },

  async updateSpace(space: SpaceItem): Promise<void> {
    const nsec = process.env.NOSTR_PRIVATE_KEY;
    if (!nsec) return;

    const legacySpace: Space = {
      id: space.id,
      title: space.title,
      description: space.description ?? '',
      hostId: space.hostId,
      hostName: space.hostName,
      hostAvatarUrl: space.hostAvatarUrl,
      coHosts: space.coHosts,
      speakers: space.speakers,
      listeners: space.listeners,
      status: space.status,
      createdAt: space.createdAt,
      reactions: space.reactions,
      tippingEnabled: space.tippingEnabled,
      platforms: [],
    };

    const bridge = new NostrLiveBridge(process.env as Record<string, string> as never, {
      nsec,
      hostPubkey: space.hostId,
    });
    await bridge.updateSpaceStatus(legacySpace);
  },
};
