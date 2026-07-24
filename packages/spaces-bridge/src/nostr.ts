/**
 * @degenfeed/spaces-bridge — Nostr Spaces Bridge
 *
 * Nostr NIP-93 (formerly NIP-53) live events for audio spaces.
 * Uses Kind 30311 parameterized replaceable events.
 *
 * This bridge directly uses @degenfeed/nostr-sdk for relay operations
 * rather than importing from the worker (which creates a circular dep).
 */

import { getPublicKey, RelayPool, signEvent } from '@degenfeed/nostr-sdk';
import type { UnsignedEvent, NostrEvent } from '@degenfeed/nostr-sdk';
import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.degenfeed.xyz';
const DEFAULT_RELAYS = 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net';
const DEGENFEED_RELAY = 'wss://relay.degenfeed.xyz';
const LIVE_EVENT_KIND = 30311;

function getRelayUrls(): string[] {
  return (process.env.RELAY_URLS || DEFAULT_RELAYS)
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

function getNsec(): string | null {
  return process.env.NOSTR_PRIVATE_KEY || null;
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const nostrBridge: PlatformBridge = {
  platform: 'nostr',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const nsec = getNsec();
    if (!nsec) throw new Error('NOSTR_PRIVATE_KEY not configured');

    const pubkey = getPublicKey(nsec);
    const id = `space-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const tags: string[][] = [
      ['d', `degenfeed-space-${id}`],
      ['title', options.title],
      ['summary', options.description || options.title],
      ['streaming', `${APP_URL}/spaces/${id}`],
      ['status', options.scheduledAt ? 'planned' : 'live'],
      ['current_participants', '1'],
      ['t', 'space'],
      ['t', 'audio'],
      ['t', 'degenfeed'],
      ['p', options.hostId],
      ['relays', DEGENFEED_RELAY],
    ];

    if (options.hostName) tags.push(['host', options.hostName]);

    const coHosts = options.coHosts ?? [];
    for (const coHost of coHosts) tags.push(['p', coHost]);

    const content = [
      `🎙️ SPACE: ${options.title}`,
      '',
      options.description || '',
      '',
      `Host: ${options.hostName}`,
      `Speakers: ${coHosts.length + 1}`,
      '',
      `Join: ${APP_URL}/spaces/${id}`,
    ].join('\n');

    const unsigned: UnsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: LIVE_EVENT_KIND,
      tags,
      content,
    };

    const signed = signEvent(unsigned, nsec);

    // Publish to relays
    const relays = [...new Set([...getRelayUrls(), DEGENFEED_RELAY])].filter(Boolean);
    const pool = new RelayPool(relays, { eoseTimeout: 5000 });
    pool.publish(signed);
    pool.disconnectAll();

    return {
      platform: 'nostr',
      nativeId: signed.id,
      url: `${APP_URL}/spaces/${id}`,
      metadata: { eventId: signed.id, dTag: `degenfeed-space-${id}`, pubkey },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    // Live spaces are aggregated server-side.
    // Direct relay queries can be added but for now delegate to aggregator.
    return [];
  },

  async getSpace(_nativeId: string): Promise<SpaceItem | null> {
    return null;
  },

  async endSpace(space: SpaceItem): Promise<void> {
    const nsec = getNsec();
    if (!nsec) return;

    const pubkey = getPublicKey(nsec);
    const tags: string[][] = [
      ['d', `degenfeed-space-${space.id}`],
      ['status', 'ended'],
      ['ended_at', String(Math.floor(Date.now() / 1000))],
      ['title', space.title],
      ['t', 'space'],
      ['t', 'audio'],
      ['t', 'degenfeed'],
      ['p', space.hostId],
    ];

    if (space.recordingUrl) {
      tags.push(['recording', space.recordingUrl]);
    }

    const content = `🔴 SPACE ENDED: ${space.title}\n\nHost: ${space.hostName}`;

    const unsigned: UnsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: LIVE_EVENT_KIND,
      tags,
      content,
    };

    const signed = signEvent(unsigned, nsec);
    const relays = [...new Set([...getRelayUrls(), DEGENFEED_RELAY])].filter(Boolean);
    const pool = new RelayPool(relays, { eoseTimeout: 5000 });
    pool.publish(signed);
    pool.disconnectAll();
  },

  async updateSpace(space: SpaceItem): Promise<void> {
    const nsec = getNsec();
    if (!nsec) return;

    const pubkey = getPublicKey(nsec);
    const tags: string[][] = [
      ['d', `degenfeed-space-${space.id}`],
      ['title', space.title],
      ['summary', space.description || space.title],
      ['streaming', `${APP_URL}/spaces/${space.id}`],
      ['status', space.status === 'live' ? 'live' : space.status === 'scheduled' ? 'planned' : 'ended'],
      ['current_participants', String(space.listeners || 0)],
      ['t', 'space'],
      ['t', 'audio'],
      ['t', 'degenfeed'],
      ['p', space.hostId],
    ];

    const content = `🎙️ SPACE: ${space.title}\n\nListeners: ${space.listeners}`;

    const unsigned: UnsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: LIVE_EVENT_KIND,
      tags,
      content,
    };

    const signed = signEvent(unsigned, nsec);
    const relays = [...new Set([...getRelayUrls(), DEGENFEED_RELAY])].filter(Boolean);
    const pool = new RelayPool(relays, { eoseTimeout: 5000 });
    pool.publish(signed);
    pool.disconnectAll();
  },
};
