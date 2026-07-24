/**
 * @degenfeed/api-worker — Nostr Live Event Bridge (Kind 30311)
 *
 * Full lifecycle management for Nostr live events per NIP-93 (formerly NIP-53):
 *   - Announce new live streams as replaceable Kind 30311 events
 *   - Update live status (viewer count, status changes) by re-publishing
 *     with the same 'd' tag (replaceable event semantics)
 *   - End live streams with status='ended'
 *   - Announce audio spaces as Kind 30311 with space-specific tags
 *   - Fetch reactions (kind 1 replies + kind 9735 zap receipts)
 *   - Bridge Nostr chat replies into the DegenFeed stream chat
 *
 * Relies on @degenfeed/nostr-sdk for relay pool management and signing.
 * All operations use the existing bridge-reliability pattern for retry+circuit-breaker.
 */

import type { NostrEvent, UnsignedEvent } from '@degenfeed/nostr-sdk';
import * as NostrSdk from '@degenfeed/nostr-sdk';
import type { Space } from '@degenfeed/types';
import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { ChatMessage, LiveStream, StreamReaction } from './stream-store';
import { addChatMessage, addReaction } from './stream-store';

// ─── Types ──────────────────────────────────────────────────────────────

export type NostrLiveStatus = 'live' | 'ended' | 'planned';

export interface NostrLiveEventContent {
  kind: 30311;
  content: string;
  tags: string[][];
  created_at: number;
}

export interface NostrZapReceipt {
  eventId: string;
  pubkey: string;
  zapperPubkey: string;
  amountMsats: number;
  content: string;
  createdAt: number;
}

export interface NostrStreamReaction {
  type: 'reply' | 'zap' | 'reaction';
  nativeId: string;
  pubkey: string;
  content: string;
  amountSats?: number;
  createdAt: number;
}

export interface NostrBridgeConfig {
  /** Nostr private key (hex) — falls back to env.NOSTR_PRIVATE_KEY */
  nsec?: string;
  /** Comma-separated relay URLs — falls back to env.RELAY_URLS */
  relayUrls?: string;
  /** DegenFeed relay for guaranteed publishing */
  degenfeedRelay?: string;
  /** Host pubkey for the 'p' tag on stream events */
  hostPubkey?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const DEFAULT_RELAYS = 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net';
const DEGENFEED_RELAY = 'wss://relay.degenfeed.xyz';
const LIVE_EVENT_KIND = 30311;
const ZAP_RECEIPT_KIND = 9735;

// ─── NostrLiveBridge ────────────────────────────────────────────────────

export class NostrLiveBridge {
  private env: Env;
  private config: Required<NostrBridgeConfig>;
  private pubkey: string | null = null;

  constructor(env: Env, config?: NostrBridgeConfig) {
    this.env = env;
    this.config = {
      nsec: config?.nsec ?? env.NOSTR_PRIVATE_KEY ?? '',
      relayUrls: config?.relayUrls ?? env.RELAY_URLS ?? DEFAULT_RELAYS,
      degenfeedRelay: config?.degenfeedRelay ?? DEGENFEED_RELAY,
      hostPubkey: config?.hostPubkey ?? '',
    };

    if (this.config.nsec) {
      try {
        this.pubkey = NostrSdk.getPublicKey(this.config.nsec);
      } catch {
        console.warn('[nostr-live-bridge] Failed to derive pubkey from nsec');
      }
    }
  }

  // ─── Stream Lifecycle ─────────────────────────────────────────────

  /**
   * Announce a stream as a Nostr Kind 30311 live event.
   *
   * Per NIP-93 (formerly NIP-53), Kind 30311 is a parameterized replaceable
   * event where the 'd' tag uniquely identifies the live event. Re-publishing
   * with the same 'd' tag replaces the previous event.
   *
   * Returns the signed event ID (hex).
   */
  async announceStream(stream: LiveStream): Promise<string> {
    return withReliability(
      'nostr',
      async () => {
        const nostr = NostrSdk;
        const pubkey = this.requirePubkey();

        const tags: string[][] = [
          ['d', `degenfeed-stream-${stream.id}`],
          ['title', stream.title],
          ['summary', stream.description || stream.title],
          ['streaming', stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`],
          ['status', 'live'],
          ['current_participants', String(stream.viewerCount || 0)],
          ['t', stream.type],
          ['t', 'degenfeed'],
          ['p', pubkey],
          ['relays', this.config.degenfeedRelay],
        ];

        // Add thumbnail if available
        if (stream.thumbnail) {
          tags.push(['image', stream.thumbnail]);
        }

        // Add category/type tags
        const surfaces = Array.isArray(stream.surfaces) ? stream.surfaces : [];
        for (const surface of surfaces) {
          tags.push(['t', surface]);
        }

        // Add co-host p-tags
        const coHosts = Array.isArray(stream.coHosts) ? stream.coHosts : [];
        for (const coHost of coHosts) {
          tags.push(['p', coHost]);
        }

        const content = this.buildStreamContent(stream);
        const unsigned: UnsignedEvent = {
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: LIVE_EVENT_KIND,
          tags,
          content,
        };

        const signed = nostr.signEvent(unsigned, this.config.nsec);
        await this.publishToRelays(signed);
        await this.recordSuccess('announceStream');

        return signed.id;
      },
      { env: this.env },
    );
  }

  /**
   * Update a live event's status (viewer count, current_participants, etc).
   *
   * Kind 30311 events are REPLACEABLE — re-publishing with the same 'd' tag
   * replaces the previous event on all relays that support NIP-33.
   */
  async updateLiveStatus(streamId: string, stream: LiveStream): Promise<void> {
    await withReliability(
      'nostr',
      async () => {
        const nostr = NostrSdk;
        const pubkey = this.requirePubkey();

        const tags: string[][] = [
          ['d', `degenfeed-stream-${streamId}`],
          ['title', stream.title],
          ['summary', stream.description || stream.title],
          ['streaming', stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`],
          ['status', stream.isLive ? 'live' : 'ended'],
          ['current_participants', String(stream.viewerCount || 0)],
          ['t', stream.type],
          ['t', 'degenfeed'],
          ['p', pubkey],
          ['relays', this.config.degenfeedRelay],
        ];

        if (stream.thumbnail) {
          tags.push(['image', stream.thumbnail]);
        }

        // Include the ended-at timestamp if applicable
        if (!stream.isLive && stream.endedAt) {
          tags.push(['ended_at', String(Math.floor(stream.endedAt / 1000))]);
        }

        const content = this.buildStreamContent(stream);
        const unsigned: UnsignedEvent = {
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: LIVE_EVENT_KIND,
          tags,
          content,
        };

        const signed = nostr.signEvent(unsigned, this.config.nsec);
        await this.publishToRelays(signed);
        await this.recordSuccess('updateLiveStatus');
      },
      { env: this.env },
    );
  }

  /**
   * End a live event by publishing a Kind 30311 with status='ended'.
   *
   * Also includes the ended_at timestamp tag so Nostr clients can
   * display the event as "ended" rather than "live".
   */
  async endStream(streamId: string, stream: LiveStream): Promise<void> {
    await withReliability(
      'nostr',
      async () => {
        const nostr = NostrSdk;
        const pubkey = this.requirePubkey();

        const tags: string[][] = [
          ['d', `degenfeed-stream-${streamId}`],
          ['status', 'ended'],
          ['ended_at', String(Math.floor(Date.now() / 1000))],
          ['title', stream.title],
          ['summary', stream.description || stream.title],
          ['t', 'degenfeed'],
          ['p', pubkey],
        ];

        if (stream.recordingUrl) {
          tags.push(['recording', stream.recordingUrl]);
        }

        const content = `🔴 STREAM ENDED: ${stream.title}\n\n${stream.creator}\n\nWatch recording: ${stream.recordingUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`;

        const unsigned: UnsignedEvent = {
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: LIVE_EVENT_KIND,
          tags,
          content,
        };

        const signed = nostr.signEvent(unsigned, this.config.nsec);
        await this.publishToRelays(signed);
        await this.recordSuccess('endStream');
      },
      { env: this.env },
    );
  }

  // ─── Space Lifecycle ──────────────────────────────────────────────

  /**
   * Announce an audio space as a Nostr Kind 30311 live event.
   *
   * Spaces get additional tags: 'space', 'audio' for Nostr client
   * discoverability, plus speaker/listener counts.
   */
  async announceSpace(space: Space): Promise<string> {
    return withReliability(
      'nostr',
      async () => {
        const nostr = NostrSdk;
        const pubkey = this.requirePubkey();

        const tags: string[][] = [
          ['d', `degenfeed-space-${space.id}`],
          ['title', space.title],
          ['summary', space.description || space.title],
          ['streaming', `https://app.degenfeed.xyz/spaces/${space.id}`],
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

        // Add speaker count if available
        const speakers = Array.isArray(space.speakers) ? space.speakers : [];
        tags.push(['speakers', String(speakers.length)]);

        // Add co-host p-tags
        const coHosts = Array.isArray(space.coHosts) ? space.coHosts : [];
        for (const coHost of coHosts) {
          tags.push(['p', coHost]);
        }

        // Add host info
        if (space.hostName) {
          tags.push(['host', space.hostName]);
        }

        const content = this.buildSpaceContent(space);
        const unsigned: UnsignedEvent = {
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: LIVE_EVENT_KIND,
          tags,
          content,
        };

        const signed = nostr.signEvent(unsigned, this.config.nsec);
        await this.publishToRelays(signed);
        await this.recordSuccess('announceSpace');

        return signed.id;
      },
      { env: this.env },
    );
  }

  // ─── Reactions & Zaps ─────────────────────────────────────────────

  /**
   * Fetch reactions to a live event from Nostr relays.
   *
   * Returns:
   *   - Kind 1 replies referencing the event (#e tag)
   *   - Kind 7 reactions (emoji reactions)
   *   - Kind 9735 zap receipts referencing the event
   *
   * Each reaction includes the pubkey, content/sats amount, and timestamp.
   */
  async fetchReactions(eventId: string): Promise<NostrStreamReaction[]> {
    const results = await withReliability(
      'nostr',
      async () => {
        const relayUrls = this.getRelayUrls();
        if (relayUrls.length === 0) return [] as NostrStreamReaction[];

        const nostr = NostrSdk;
        const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 4000 });

        // Fetch replies (kind 1), reactions (kind 7), and zaps (kind 9735)
        const events = await pool.list([{ '#e': [eventId], kinds: [1, 7, 9735], limit: 100 }]);
        pool.disconnectAll();

        return this.parseReactions(events, eventId);
      },
      { env: this.env },
    );

    return results ?? [];
  }

  /**
   * Bridge Nostr chat replies into the DegenFeed stream chat.
   *
   * Opens a subscription to configured relays for kind 1 events
   * referencing the live event. Each reply is pushed to the stream
   * chat as a ChatMessage labeled "via Nostr" with the author's npub.
   */
  async bridgeChat(streamId: string, eventId: string, abortSignal?: AbortSignal): Promise<void> {
    const relayUrls = this.getRelayUrls();
    if (relayUrls.length === 0) return;

    const nostr = NostrSdk;
    const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 5000 });

    // Track seen event IDs to avoid duplicates
    const seenIds = new Set<string>();

    const seenEvent = (event: NostrEvent) => {
      if (seenIds.has(event.id)) return;
      seenIds.add(event.id);

      // Parse the reply and push to stream chat
      const npub = nostr.npubEncode(event.pubkey);
      const chatMsg: ChatMessage = {
        id: `nostr:${event.id}`,
        userId: `nostr:${event.pubkey}`,
        displayName: npub.slice(0, 16),
        avatarUrl: undefined,
        text: `${event.content} (via Nostr)`,
        createdAt: event.created_at * 1000,
      };

      addChatMessage(this.env, streamId, chatMsg).catch((err) =>
        console.error('[nostr-live-bridge] Failed to add chat message:', err),
      );

      // Broadcast to WebSocket
      broadcastToAll(CHANNELS.SPACE_UPDATE, {
        type: 'chat_message',
        streamId,
        message: chatMsg,
        protocol: 'nostr',
      });
    };

    // Subscribe to kind 1 events referencing the live event
    pool.subscribe(
      { '#e': [eventId], kinds: [1], limit: 50 },
      {
        onEvent: seenEvent,
        onEose: () => {
          // Continue listening for new events
        },
      },
    );

    // Handle zap receipts — show as reactions in stream
    pool.subscribe(
      { '#e': [eventId], kinds: [9735], limit: 20 },
      {
        onEvent: (event: NostrEvent) => {
          if (seenIds.has(event.id)) return;
          seenIds.add(event.id);

          const amountMsats = this.parseZapAmount(event);
          const sats = amountMsats ? Math.floor(amountMsats / 1000) : 0;

          const reaction: StreamReaction = {
            userId: `nostr:${event.pubkey}`,
            type: 'rocket',
            createdAt: Date.now(),
          };

          addReaction(this.env, streamId, reaction).catch((err) =>
            console.error('[nostr-live-bridge] Failed to add zap reaction:', err),
          );

          // Broadcast zap notification
          broadcastToAll(CHANNELS.SPACE_UPDATE, {
            type: 'zap_received',
            streamId,
            amountSats: sats,
            pubkey: event.pubkey,
            protocol: 'nostr',
          });
        },
      },
    );

    // Clean up on abort
    if (abortSignal) {
      abortSignal.addEventListener(
        'abort',
        () => {
          pool.disconnectAll();
        },
        { once: true },
      );
    }
  }

  // ─── Space Status Updates ─────────────────────────────────────────

  /**
   * Update an active space's live status (listener count changes, etc.).
   */
  async updateSpaceStatus(space: Space): Promise<void> {
    await withReliability(
      'nostr',
      async () => {
        const nostr = NostrSdk;
        const pubkey = this.requirePubkey();

        const tags: string[][] = [
          ['d', `degenfeed-space-${space.id}`],
          ['title', space.title],
          ['summary', space.description || space.title],
          ['streaming', `https://app.degenfeed.xyz/spaces/${space.id}`],
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

        const content = this.buildSpaceContent(space);
        const unsigned: UnsignedEvent = {
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: LIVE_EVENT_KIND,
          tags,
          content,
        };

        const signed = nostr.signEvent(unsigned, this.config.nsec);
        await this.publishToRelays(signed);
        await this.recordSuccess('updateSpaceStatus');
      },
      { env: this.env },
    );
  }

  // ─── Content Builders ─────────────────────────────────────────────

  /**
   * Build the Kind 30311 content string for a stream announcement.
   */
  private buildStreamContent(stream: LiveStream): string {
    const parts: string[] = [`🔴 LIVE: ${stream.title}`, ''];

    if (stream.description) {
      parts.push(stream.description, '');
    }

    parts.push(
      `Creator: ${stream.creator}`,
      `Type: ${stream.type}`,
      `Viewers: ${stream.viewerCount}`,
      `Host: ${stream.host}`,
      '',
      `Watch: ${stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`,
    );

    return parts.join('\n');
  }

  /**
   * Build the Kind 30311 content string for a space announcement.
   */
  private buildSpaceContent(space: Space): string {
    const speakers = Array.isArray(space.speakers) ? space.speakers : [];
    const speakerList = (
      speakers as Array<{
        isHost: boolean;
        displayName: string;
        isCoHost: boolean;
      }>
    )
      .map((s) => `${s.isHost ? '🎙️' : '🗣️'} ${s.displayName}${s.isCoHost ? ' (co-host)' : ''}`)
      .join('\n');

    const parts: string[] = [`🎙️ SPACE: ${space.title}`, ''];

    if (space.description) {
      parts.push(space.description, '');
    }

    parts.push(
      `Host: ${space.hostName}`,
      `Speakers: ${speakers.length}`,
      `Listeners: ${space.listeners}`,
      '',
      speakerList,
      '',
      `Join: https://app.degenfeed.xyz/spaces/${space.id}`,
    );

    return parts.join('\n');
  }

  // ─── Reaction Parsing ─────────────────────────────────────────────

  /**
   * Parse a list of Nostr events into NostrStreamReaction objects.
   */
  private parseReactions(events: NostrEvent[], _parentEventId: string): NostrStreamReaction[] {
    const reactions: NostrStreamReaction[] = [];

    for (const event of events) {
      if (event.kind === 1) {
        // Text note reply
        reactions.push({
          type: 'reply',
          nativeId: event.id,
          pubkey: event.pubkey,
          content: event.content,
          createdAt: event.created_at * 1000,
        });
      } else if (event.kind === 7) {
        // Emoji reaction
        reactions.push({
          type: 'reaction',
          nativeId: event.id,
          pubkey: event.pubkey,
          content: event.content,
          createdAt: event.created_at * 1000,
        });
      } else if (event.kind === ZAP_RECEIPT_KIND) {
        // Zap receipt
        const amountMsats = this.parseZapAmount(event);
        const sats = amountMsats ? Math.floor(amountMsats / 1000) : 0;
        reactions.push({
          type: 'zap',
          nativeId: event.id,
          pubkey: this.extractZapperPubkey(event),
          content: event.content || `⚡ ${sats} sats`,
          amountSats: sats,
          createdAt: event.created_at * 1000,
        });
      }
    }

    return reactions;
  }

  /**
   * Parse zap amount from a Kind 9735 receipt's tags.
   *
   * NIP-57: Zap receipts contain 'amount' tag with millisats.
   */
  private parseZapAmount(event: NostrEvent): number | null {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    const amountTag = tags.find((t) => t[0] === 'amount');
    if (amountTag?.[1]) {
      const parsed = parseInt(amountTag[1], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  /**
   * Extract the zapper's pubkey from a Kind 9735 receipt.
   *
   * NIP-57: The first 'p' tag is the zapper's pubkey.
   */
  private extractZapperPubkey(event: NostrEvent): string {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    const pTag = tags.find((t) => t[0] === 'p');
    return pTag?.[1] ?? event.pubkey;
  }

  // ─── Publishing ──────────────────────────────────────────────────

  /**
   * Publish a signed event to all configured relays + the DegenFeed relay.
   */
  private async publishToRelays(event: NostrEvent): Promise<void> {
    const nostr = NostrSdk;
    const allRelays = [...new Set([...this.getRelayUrls(), this.config.degenfeedRelay])].filter(
      Boolean,
    );

    const pool = new nostr.RelayPool(allRelays, { eoseTimeout: 5000 });
    pool.publish(event);
    pool.disconnectAll();
  }

  private requirePubkey(): string {
    if (!this.pubkey) {
      throw new Error(
        'Nostr pubkey is not available. Ensure NOSTR_PRIVATE_KEY is configured ' +
          'or pass an nsec in the config.',
      );
    }
    return this.pubkey;
  }

  private getRelayUrls(): string[] {
    return this.config.relayUrls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  }

  // ─── Recording ───────────────────────────────────────────────────

  private async recordSuccess(_operation: string): Promise<void> {
    try {
      await recordBridgeOperation(this.env, 'nostr', true, 0);
    } catch {
      // Non-critical
    }
  }
}

// ─── Standalone Helper Functions ────────────────────────────────────────

/**
 * Create a Kind 30311 Nostr event payload for a stream.
 *
 * Useful when you need the event data without publishing (e.g., for
 * client-side signing via NIP-07 browser extension).
 */
export function createLiveEventPayload(stream: LiveStream, pubkey: string): NostrLiveEventContent {
  const tags: string[][] = [
    ['d', `degenfeed-stream-${stream.id}`],
    ['title', stream.title],
    ['summary', stream.description || stream.title],
    ['streaming', stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`],
    ['status', stream.isLive ? 'live' : 'ended'],
    ['current_participants', String(stream.viewerCount || 0)],
    ['t', stream.type],
    ['t', 'degenfeed'],
    ['p', pubkey],
    ['relays', DEGENFEED_RELAY],
  ];

  if (stream.thumbnail) {
    tags.push(['image', stream.thumbnail]);
  }

  const content = [
    `🔴 LIVE: ${stream.title}`,
    '',
    stream.description || '',
    '',
    `Watch: ${stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`,
  ].join('\n');

  return {
    kind: LIVE_EVENT_KIND,
    content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Fetch zap receipts for a given event ID from Nostr relays.
 */
export async function fetchZapReceipts(
  env: Env,
  eventId: string,
  relayUrls?: string,
): Promise<NostrZapReceipt[]> {
  const urls = (relayUrls || env.RELAY_URLS || DEFAULT_RELAYS)
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return [];

  try {
    const nostr = require('@degenfeed/nostr-sdk');
    const pool = new nostr.RelayPool(urls, { eoseTimeout: 4000 });
    const events = await pool.list([{ '#e': [eventId], kinds: [ZAP_RECEIPT_KIND], limit: 50 }]);
    pool.disconnectAll();

    return events.map((ev: NostrEvent) => ({
      eventId: ev.id,
      pubkey: ev.pubkey,
      zapperPubkey: ev.tags?.find((t: string[]) => t[0] === 'P')?.[1] ?? ev.pubkey,
      amountMsats: parseInt(ev.tags?.find((t: string[]) => t[0] === 'amount')?.[1] ?? '0', 10),
      content: ev.content,
      createdAt: ev.created_at * 1000,
    }));
  } catch (err) {
    console.error('[nostr-live-bridge] Failed to fetch zap receipts:', err);
    return [];
  }
}
