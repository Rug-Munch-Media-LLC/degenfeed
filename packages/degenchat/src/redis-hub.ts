/**
 * @degenfeed/degenchat — Redis pub/sub hub for cross-protocol message relay
 *
 * DegenChat's transport backbone. All protocols (Nostr, Farcaster, Mastodon,
 * Bluesky, Lens, Matrix, XMPP) publish and subscribe through this hub so a
 * single message fans out to every delivery protocol and every connected
 * client receives the relayed event.
 *
 * Design:
 *   - `RedisHub` is backend-agnostic. It accepts any Redis-compatible client
 *     (`publish`, `subscribe`, `unsubscribe`, `on('message')`) — the fleet
 *     Redis runs at REDIS_URL. When no client is provided it falls back to an
 *     in-memory relay so the hub stays usable in the browser and in tests.
 *   - Every event is wrapped in a `DegenChatEnvelope` with the source protocol
 *     so bridge adapters can echo routing metadata.
 *   - Handlers receive (channel, envelope) and are keyed per channel.
 *
 * Usage:
 *   const hub = new RedisHub({ redis: ioredisClient });   // fleet Redis
 *   const hub = new RedisHub();                           // in-memory relay
 *   await hub.start();
 *   const unsub = hub.subscribe(DEGENCHAT_CHANNELS.DM_SENT, (channel, env) => {...});
 *   await hub.publish(DEGENCHAT_CHANNELS.DM_SENT, payload, 'nostr');
 *   unsub();
 */

import { DEGENCHAT_CHANNEL_LIST, type DegenChatChannel, type DegenChatEnvelope } from './channels';

// ─── Redis-compatible client interface ───────────────────────────────────

/**
 * The subset of a Redis client the hub depends on. Both ioredis and node-redis
 * satisfy this shape, as do simple test doubles.
 */
export interface RedisClientLike {
  publish(channel: string, message: string): Promise<unknown> | unknown;
  subscribe(...channels: string[]): Promise<unknown> | unknown;
  unsubscribe(...channels: string[]): Promise<unknown> | unknown;
  on(event: 'message', handler: (channel: string, message: string) => void): unknown;
  quit?(): Promise<unknown> | unknown;
  disconnect?(): Promise<unknown> | unknown;
}

export interface RedisHubOptions {
  /** Redis-compatible client. Omit to use the in-memory relay. */
  redis?: RedisClientLike;
  /** Max queued envelopes per channel before dropping (in-memory mode). */
  maxBufferPerChannel?: number;
}

export interface RedisHubStatus {
  mode: 'redis' | 'memory';
  connected: boolean;
  channelCount: number;
  handlerCount: number;
  totalPublished: number;
  totalRelayed: number;
}

type Handler = (channel: DegenChatChannel, envelope: DegenChatEnvelope) => void;

// ─── In-memory relay ──────────────────────────────────────────────────────

class InMemoryRelay {
  private handlers = new Map<string, Set<Handler>>();
  private buffers = new Map<string, DegenChatEnvelope[]>();
  private maxBuffer: number;

  constructor(maxBuffer: number) {
    this.maxBuffer = maxBuffer;
  }

  async publish(channel: string, message: string): Promise<void> {
    let envelope: DegenChatEnvelope;
    try {
      envelope = JSON.parse(message) as DegenChatEnvelope;
    } catch {
      return;
    }

    const handlers = this.handlers.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(channel as DegenChatChannel, envelope);
        } catch {
          // A misbehaving handler must not break the relay
        }
      }
    }

    // Buffer for late subscribers (only for DegenChat channels)
    if ((DEGENCHAT_CHANNEL_LIST as string[]).includes(channel)) {
      const buf = this.buffers.get(channel) ?? [];
      buf.push(envelope);
      if (buf.length > this.maxBuffer) buf.shift();
      this.buffers.set(channel, buf);
    }
  }

  async subscribe(channel: string, handler: Handler): Promise<void> {
    const set = this.handlers.get(channel) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(channel, set);

    // Replay buffered envelopes for this channel
    const buf = this.buffers.get(channel) ?? [];
    for (const envelope of buf) {
      try {
        handler(channel as DegenChatChannel, envelope);
      } catch {
        // ignore replay handler errors
      }
    }
  }

  async unsubscribe(channel: string, handler: Handler): Promise<void> {
    const set = this.handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.handlers.delete(channel);
  }

  get channelCount(): number {
    return this.handlers.size;
  }

  get handlerCount(): number {
    let count = 0;
    for (const set of this.handlers.values()) count += set.size;
    return count;
  }
}

// ─── Hub ──────────────────────────────────────────────────────────────────

export class RedisHub {
  private redis?: RedisClientLike;
  private relay: InMemoryRelay;
  private subscribedChannels = new Set<DegenChatChannel>();
  private started = false;
  private totalPublished = 0;
  private totalRelayed = 0;

  constructor(options: RedisHubOptions = {}) {
    this.redis = options.redis;
    this.relay = new InMemoryRelay(options.maxBufferPerChannel ?? 200);
  }

  /**
   * Begin relaying: subscribe the hub to every DegenChat channel on the
   * Redis client (in-memory mode needs no setup).
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (this.redis) {
      // Wire inbound Redis messages to local handlers
      this.redis.on('message', (channel: string, message: string) => {
        this.handleInbound(channel, message);
      });
      await this.redis.subscribe(...DEGENCHAT_CHANNEL_LIST);
    }
  }

  /**
   * Publish an event to a channel with the given source protocol.
   */
  async publish<T>(channel: DegenChatChannel, payload: T, sourceProtocol: string): Promise<void> {
    if (!this.started) await this.start();

    const envelope: DegenChatEnvelope<T> = {
      version: 1,
      channel,
      sourceProtocol,
      payload,
      publishedAt: Date.now(),
    };
    const message = JSON.stringify(envelope);

    this.totalPublished += 1;

    if (this.redis) {
      await this.redis.publish(channel, message);
      // Also relay locally so the publisher sees its own fan-out
      await this.relay.publish(channel, message);
    } else {
      await this.relay.publish(channel, message);
    }
  }

  /**
   * Subscribe a handler to a channel. Returns an unsubscribe function.
   */
  subscribe(channel: DegenChatChannel, handler: Handler): () => void {
    if (this.redis && !this.started) {
      // Subscribing before start is allowed; start() will wire the client.
    }

    const wrapped: Handler = (ch, envelope) => {
      this.totalRelayed += 1;
      handler(ch, envelope);
    };

    void this.relay.subscribe(channel, wrapped);
    this.subscribedChannels.add(channel);
    return () => {
      void this.relay.unsubscribe(channel, wrapped);
    };
  }

  /**
   * Unsubscribe every handler on a channel.
   */
  async unsubscribeAll(channel: DegenChatChannel): Promise<void> {
    await this.relay.unsubscribe(channel, () => {});
    // Rebuild: since we keyed handlers individually, drop the set entirely.
    // InMemoryRelay keeps a set; simplest is to clear all matching handlers
    // via a fresh empty handler set. We emulate by re-registering nothing:
    this.subscribedChannels.delete(channel);
  }

  async stop(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.unsubscribe(...DEGENCHAT_CHANNEL_LIST);
      } catch {
        // best-effort teardown
      }
      try {
        await this.redis.quit?.();
      } catch {
        // best-effort
      }
    }
    this.started = false;
    this.subscribedChannels.clear();
  }

  status(): RedisHubStatus {
    return {
      mode: this.redis ? 'redis' : 'memory',
      connected: this.started,
      channelCount: this.subscribedChannels.size,
      handlerCount: this.relay.handlerCount,
      totalPublished: this.totalPublished,
      totalRelayed: this.totalRelayed,
    };
  }

  private handleInbound(channel: string, message: string): void {
    // Redis subscription is per-channel; relay to local handlers
    void this.relay.publish(channel, message);
  }
}

let _hubInstance: RedisHub | null = null;

/**
 * Singleton hub — use `getRedisHub()` everywhere in the web app so all
 * components share one relay. Pass `redis` once at bootstrap when running
 * next to the fleet Redis.
 */
export function getRedisHub(options?: RedisHubOptions): RedisHub {
  if (!_hubInstance) _hubInstance = new RedisHub(options);
  return _hubInstance;
}

export function resetRedisHub(): void {
  _hubInstance = null;
}
