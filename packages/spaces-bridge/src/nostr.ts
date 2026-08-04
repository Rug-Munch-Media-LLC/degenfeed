/**
 * @degenfeed/spaces-bridge — Nostr Spaces Bridge
 *
 * Nostr NIP-93 (formerly NIP-53) live events for audio spaces AND live
 * video streams. Uses Kind 30311 parameterized replaceable events.
 *
 * This bridge directly uses @degenfeed/nostr-sdk for relay operations
 * rather than importing from the worker (which creates a circular dep).
 *
 * RELAY PUBLISH RELIABILITY (fix from earlier audit):
 * RelayPool connects asynchronously. Calling `pool.publish()` immediately
 * after construction silently drops the event ("Not connected") because no
 * relay has finished the WebSocket handshake yet, and calling
 * `pool.disconnectAll()` right after kills the connection before it opens.
 * `publishSignedEvent()` below waits for at least one connected relay,
 * publishes, and waits for OK acks before disconnecting.
 */

import type { NostrEvent, UnsignedEvent } from '@degenfeed/nostr-sdk';
import { getPublicKey, RelayPool, signEvent } from '@degenfeed/nostr-sdk';
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

// ─── Reliable relay publish ─────────────────────────────────────────────

export interface RelayPublishResult {
  published: boolean;
  relaysAttempted: string[];
  relaysAccepted: string[];
  relaysFailed: string[];
  eventId?: string;
}

/**
 * Publish a SIGNED Nostr event to a set of relays, waiting for the
 * WebSocket connections to open before sending and collecting OK acks.
 *
 * Without the connection wait, `RelayPool.publish()` skips every relay
 * (they are still connecting) and the event is silently dropped.
 */
export async function publishSignedEvent(
  event: NostrEvent,
  relays: string[],
  opts: { connectTimeoutMs?: number; ackTimeoutMs?: number } = {},
): Promise<RelayPublishResult> {
  const connectTimeoutMs = opts.connectTimeoutMs ?? 6000;
  const ackTimeoutMs = opts.ackTimeoutMs ?? 2500;
  const uniqueRelays = [...new Set(relays.filter(Boolean))];

  if (uniqueRelays.length === 0) {
    return { published: false, relaysAttempted: [], relaysAccepted: [], relaysFailed: [] };
  }

  const pool = new RelayPool(uniqueRelays, {
    connectTimeout: connectTimeoutMs,
    maxReconnects: 0,
    logLevel: 'error',
  });

  const accepted = new Set<string>();
  const failed = new Set<string>();

  try {
    // Wait for at least one relay to connect (publish() only sends to connected relays)
    const deadline = Date.now() + connectTimeoutMs;
    while (Date.now() < deadline && pool.getConnectedRelays().length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const connected = pool.getConnectedRelays();
    if (connected.length === 0) {
      console.warn(
        `[nostr-bridge] No relays connected in ${connectTimeoutMs}ms — event ${event.id?.slice(0, 8)} not published`,
      );
      return {
        published: false,
        relaysAttempted: uniqueRelays,
        relaysAccepted: [],
        relaysFailed: uniqueRelays,
        eventId: event.id,
      };
    }

    pool.publish(event, {
      onOk: (relayUrl, _eventId, success) => {
        if (success) accepted.add(relayUrl);
        else failed.add(relayUrl);
      },
      onError: (relayUrl) => failed.add(relayUrl),
    });

    // Give relays time to respond with OK
    await new Promise((resolve) => setTimeout(resolve, ackTimeoutMs));

    return {
      // Published = the signed event was handed to at least one connected
      // relay. relaysAccepted gives the finer-grained OK-ack signal.
      published: connected.length > 0,
      relaysAttempted: uniqueRelays,
      relaysAccepted: [...accepted],
      relaysFailed: [...failed],
      eventId: event.id,
    };
  } finally {
    pool.disconnectAll();
  }
}

// ─── NIP-53 Live Event (kind 30311) ─────────────────────────────────────

export interface PublishLiveEventOptions {
  /** Unique identifier (d tag) — stable across status updates */
  dTag: string;
  /** Stream / space title */
  title: string;
  /** Status: 'live', 'ended', 'planned' */
  status?: 'live' | 'ended' | 'planned';
  /** HLS stream URL (NIP-53 `streaming` tag) */
  streamUrl?: string;
  /** Description / summary */
  summary?: string;
  /** Thumbnail / poster image URL */
  imageUrl?: string;
  /** Current participant / viewer count */
  currentParticipants?: number;
  /** Preferred relays for the event + chat */
  relays?: string[];
  /** Participant pubkeys */
  participants?: string[];
  /** Hashtag topics */
  tags?: string[];
  /** Host display name */
  hostName?: string;
}

export interface PublishLiveEventResult {
  ok: boolean;
  eventId?: string;
  dTag?: string;
  error?: string;
  relayResult?: RelayPublishResult;
}

/**
 * Publish a NIP-53 kind:30311 live event (audio space OR live video).
 *
 * Includes the HLS `streaming` URL, `status` ("live"), and
 * `current_participants` so Nostr clients can surface the stream in
 * their live activity feeds. The event is always SIGNED before publish.
 */
export async function publishNip53LiveEvent(
  opts: PublishLiveEventOptions,
): Promise<PublishLiveEventResult> {
  const nsec = getNsec();
  if (!nsec) return { ok: false, error: 'NOSTR_PRIVATE_KEY not configured' };

  try {
    const pubkey = getPublicKey(nsec);
    const relays = [...new Set([...(opts.relays ?? []), ...getRelayUrls(), DEGENFEED_RELAY])];

    const tags: string[][] = [
      ['d', opts.dTag],
      ['title', opts.title.slice(0, 256)],
      ['status', opts.status ?? 'live'],
    ];
    if (opts.streamUrl) tags.push(['streaming', opts.streamUrl]);
    if (opts.currentParticipants !== undefined) {
      tags.push([
        'current_participants',
        String(Math.max(0, Math.floor(opts.currentParticipants))),
      ]);
    }
    if (opts.imageUrl) tags.push(['image', opts.imageUrl]);
    if (opts.hostName) tags.push(['host', opts.hostName]);
    for (const relay of relays) tags.push(['relays', relay]);
    for (const p of opts.participants ?? []) tags.push(['p', p]);
    for (const t of opts.tags ?? []) tags.push(['t', t]);

    const content = [
      opts.status === 'ended' ? `⏹️ ENDED: ${opts.title}` : `🔴 LIVE: ${opts.title}`,
      opts.summary ?? '',
      opts.currentParticipants !== undefined ? `👁️ ${opts.currentParticipants} watching` : '',
      opts.streamUrl ?? '',
    ]
      .filter(Boolean)
      .join('\n');

    const unsigned: UnsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: LIVE_EVENT_KIND,
      tags,
      content,
    };

    const signed = signEvent(unsigned, nsec);
    const relayResult = await publishSignedEvent(signed, relays);

    return {
      ok: relayResult.published,
      eventId: signed.id,
      dTag: opts.dTag,
      relayResult,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Publish a NIP-53 "ended" status for a live event (same d tag).
 */
export async function endNip53LiveEvent(opts: {
  dTag: string;
  title: string;
  summary?: string;
  recordingUrl?: string;
}): Promise<PublishLiveEventResult> {
  const nsec = getNsec();
  if (!nsec) return { ok: false, error: 'NOSTR_PRIVATE_KEY not configured' };

  try {
    const pubkey = getPublicKey(nsec);
    const relays = [...new Set([...getRelayUrls(), DEGENFEED_RELAY])];

    const tags: string[][] = [
      ['d', opts.dTag],
      ['title', opts.title.slice(0, 256)],
      ['status', 'ended'],
      ['ended_at', String(Math.floor(Date.now() / 1000))],
      ['t', 'degenfeed'],
    ];
    if (opts.recordingUrl) tags.push(['recording', opts.recordingUrl]);
    for (const relay of relays) tags.push(['relays', relay]);

    const content = `⏹️ Stream ended: ${opts.title}\n${opts.summary ?? ''}`.trim();

    const unsigned: UnsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: LIVE_EVENT_KIND,
      tags,
      content,
    };

    const signed = signEvent(unsigned, nsec);
    const relayResult = await publishSignedEvent(signed, relays);

    return {
      ok: relayResult.published,
      eventId: signed.id,
      dTag: opts.dTag,
      relayResult,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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

    // Publish to relays (waits for connection + OK acks)
    const relays = [...new Set([...getRelayUrls(), DEGENFEED_RELAY])].filter(Boolean);
    const relayResult = await publishSignedEvent(signed, relays);

    return {
      platform: 'nostr',
      nativeId: signed.id,
      url: `${APP_URL}/spaces/${id}`,
      metadata: {
        eventId: signed.id,
        dTag: `degenfeed-space-${id}`,
        pubkey,
        relayAccepted: relayResult.relaysAccepted,
      },
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
    await publishSignedEvent(signed, relays);
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
      [
        'status',
        space.status === 'live' ? 'live' : space.status === 'scheduled' ? 'planned' : 'ended',
      ],
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
    await publishSignedEvent(signed, relays);
  },
};
