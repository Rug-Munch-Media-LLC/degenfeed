/**
 * @degenfeed/degenchat — DegenChat relay service
 *
 * Ties the Redis pub/sub hub to the protocol adapters: an outbound message is
 * published on the hub, and the relay fans it out to every chosen protocol
 * adapter. Inbound protocol events are published back onto the hub so clients
 * (and other bridges) see them.
 *
 * The relay is the "cross-protocol message relay" layer of DegenChat:
 *
 *   [Client] → RedisHub.publish(DM_SENT) → DegenChatRelay → adapters
 *              → Nostr/Farcaster/Mastodon/Bluesky/Lens/Matrix/XMPP
 *
 * Every provider integration has error handling + health checks. No silent
 * failures. [Built per repo rules]
 */

import type { Env } from '@degenfeed/types';
import {
  DEGENCHAT_CHANNELS,
  type DegenChatDmPayload,
  type DegenChatGroupPayload,
} from './channels';
import {
  DEGENCHAT_ADAPTERS,
  type DegenChatAdapterConfig,
  type DegenChatAdapterMessage,
  type DegenChatAdapterResult,
  type DegenChatProtocolId,
} from './protocol-adapters';
import { RedisHub } from './redis-hub';

// ─── Types ────────────────────────────────────────────────────────────────

export interface RelayDeliveryResult {
  protocol: DegenChatProtocolId;
  result: DegenChatAdapterResult;
}

export interface DegenChatRelayOptions {
  hub?: RedisHub;
  /** Per-protocol adapter configs (tokens/endpoints). */
  configs?: Partial<Record<DegenChatProtocolId, DegenChatAdapterConfig>>;
  /** Called when a message is published on the hub (for client fan-out). */
  onMessage?: (channel: string, envelope: unknown) => void;
}

// ─── Relay ────────────────────────────────────────────────────────────────

export class DegenChatRelay {
  private hub: RedisHub;
  private configs: Partial<Record<DegenChatProtocolId, DegenChatAdapterConfig>>;
  private started = false;

  constructor(options: DegenChatRelayOptions = {}) {
    this.hub = options.hub ?? new RedisHub();
    this.configs = options.configs ?? {};
  }

  /**
   * Start the relay: subscribe to DM/group channels and wire inbound events
   * to protocol adapters for fan-out.
   */
  async start(env: Env): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.hub.start();

    this.hub.subscribe(DEGENCHAT_CHANNELS.DM_SENT, async (_channel, envelope) => {
      const payload = envelope.payload as DegenChatDmPayload;
      await this.fanOutDm(payload, env);
    });

    this.hub.subscribe(DEGENCHAT_CHANNELS.GROUP_SENT, async (_channel, envelope) => {
      const payload = envelope.payload as DegenChatGroupPayload;
      await this.fanOutGroup(payload, env);
    });
  }

  /**
   * Send a direct message to one or more protocols through the relay.
   */
  async sendDm(
    payload: DegenChatDmPayload,
    env: Env,
    opts?: { skipPublish?: boolean },
  ): Promise<RelayDeliveryResult[]> {
    if (!opts?.skipPublish) {
      await this.hub.publish(DEGENCHAT_CHANNELS.DM_SENT, payload, payload.fromProtocol);
    }
    return this.fanOutDm(payload, env);
  }

  /**
   * Send a group message to a room's bridged protocols.
   */
  async sendGroup(
    payload: DegenChatGroupPayload,
    env: Env,
    opts?: { skipPublish?: boolean },
  ): Promise<RelayDeliveryResult[]> {
    if (!opts?.skipPublish) {
      await this.hub.publish(DEGENCHAT_CHANNELS.GROUP_SENT, payload, payload.fromProtocol);
    }
    return this.fanOutGroup(payload, env);
  }

  /**
   * Publish an inbound protocol event back onto the hub so connected clients
   * receive it in real time.
   */
  async publishInbound<T>(channel: string, payload: T, sourceProtocol: string): Promise<void> {
    await this.hub.publish(channel as never, payload, sourceProtocol);
  }

  status() {
    return this.hub.status();
  }

  async stop(): Promise<void> {
    await this.hub.stop();
    this.started = false;
  }

  // ─── Internal fan-out ──────────────────────────────────────────────

  private async fanOutDm(payload: DegenChatDmPayload, env: Env): Promise<RelayDeliveryResult[]> {
    const targets = payload.protocols?.length
      ? payload.protocols
      : (Object.keys(DEGENCHAT_ADAPTERS) as DegenChatProtocolId[]);

    const message: DegenChatAdapterMessage = {
      id: payload.messageId,
      conversationId: payload.conversationId,
      fromId: payload.fromId,
      toId: payload.toId,
      body: payload.body,
      encrypted: payload.encrypted,
      contentType: payload.contentType,
      mediaUrl: payload.mediaUrl,
      timestamp: payload.timestamp,
    };

    const results: RelayDeliveryResult[] = [];
    await Promise.allSettled(
      targets.map(async (protocol) => {
        const proto = protocol as DegenChatProtocolId;
        const adapter = DEGENCHAT_ADAPTERS[proto];
        if (!adapter) return;
        try {
          const result = await adapter.send(message, env, this.configs[proto]);
          results.push({ protocol: proto, result });
        } catch (err) {
          results.push({
            protocol: proto,
            result: {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }),
    );
    return results;
  }

  private async fanOutGroup(
    payload: DegenChatGroupPayload,
    env: Env,
  ): Promise<RelayDeliveryResult[]> {
    const targets = payload.protocols?.length
      ? payload.protocols
      : (Object.keys(DEGENCHAT_ADAPTERS) as DegenChatProtocolId[]);

    const message: DegenChatAdapterMessage = {
      id: payload.messageId,
      conversationId: payload.roomId,
      fromId: payload.fromId,
      toId: payload.roomId,
      body: payload.body,
      encrypted: payload.encrypted,
      contentType: payload.contentType,
      mediaUrl: payload.mediaUrl,
      timestamp: payload.timestamp,
    };

    const results: RelayDeliveryResult[] = [];
    await Promise.allSettled(
      targets.map(async (protocol) => {
        const proto = protocol as DegenChatProtocolId;
        const adapter = DEGENCHAT_ADAPTERS[proto];
        if (!adapter) return;
        try {
          const result = adapter.sendGroup
            ? await adapter.sendGroup(message, payload.roomId, env, this.configs[proto])
            : await adapter.send(message, env, this.configs[proto]);
          results.push({ protocol: proto, result });
        } catch (err) {
          results.push({
            protocol: proto,
            result: {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }),
    );
    return results;
  }
}

let _relayInstance: DegenChatRelay | null = null;

export function getDegenChatRelay(options?: DegenChatRelayOptions): DegenChatRelay {
  if (!_relayInstance) _relayInstance = new DegenChatRelay(options);
  return _relayInstance;
}

export function resetDegenChatRelay(): void {
  _relayInstance = null;
}
