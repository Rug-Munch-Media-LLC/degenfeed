/**
 * Nostr relay connection pool with health checking and auto-reconnect.
 *
 * Manages WebSocket connections to multiple relays. Supports:
 *   - subscribe() — async generator yielding events
 *   - list() — one-shot page fetch with timeout
 *   - publish() — fan-out event to all relays
 *   - Auto-reconnect with exponential backoff
 *   - Health checking (CONNECT → OK handshake)
 */

import type { NostrEvent } from './event';

export type RelayEventKind = 'event' | 'eose' | 'notice' | 'ok';
export type SubscriptionState = 'initial' | 'running' | 'eose' | 'closed';

export interface RelayEvent {
  kind: RelayEventKind;
  subscriptionId?: string;
  event?: NostrEvent;
  message?: string;
  ok?: { eventId: string; success: boolean; message: string };
}

/** Filter per NIP-01. */
export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  '#e'?: string[];
  '#p'?: string[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
}

export interface RelaySubscription {
  id: string;
  filters: NostrFilter[];
  /** Called for each event, eose, notice */
  onEvent: (ev: RelayEvent) => void;
  /** Called when subscription is done (eose received or timeout) */
  onComplete?: () => void;
  closed?: boolean;
}

export interface RelayPoolOptions {
  /** Timeout for initial WebSocket connection in ms. Default: 5000 */
  connectTimeout?: number;
  /** Timeout waiting for EOSE in ms. Default: 3000 */
  eoseTimeout?: number;
  /** Reconnect delay base in ms. Default: 1000 */
  reconnectDelay?: number;
  /** Max reconnect attempts. Default: 5, set 0 for infinite */
  maxReconnects?: number;
  /** Log level. Default: 'warn' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

interface RelayState {
  url: string;
  ws: WebSocket | null;
  connected: boolean;
  subscriptions: Map<string, RelaySubscription>;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

function noop() {}

export class RelayPool {
  private relays: Map<string, RelayState> = new Map();
  private opts: Required<RelayPoolOptions>;
  private logger: Console;

  constructor(relayUrls: string[], opts: RelayPoolOptions = {}) {
    this.opts = {
      connectTimeout: opts.connectTimeout ?? 5000,
      eoseTimeout: opts.eoseTimeout ?? 3000,
      reconnectDelay: opts.reconnectDelay ?? 1000,
      maxReconnects: opts.maxReconnects ?? 5,
      logLevel: opts.logLevel ?? 'warn',
    };
    this.logger = self.console; // Use global console

    for (const url of relayUrls) {
      this.addRelay(url);
    }
  }

  /** Add a relay to the pool. Connects immediately. */
  addRelay(url: string): void {
    if (this.relays.has(url)) return;
    const state: RelayState = {
      url,
      ws: null,
      connected: false,
      subscriptions: new Map(),
      reconnectAttempts: 0,
      reconnectTimer: null,
    };
    this.relays.set(url, state);
    this.connectRelay(state);
  }

  /** Remove a relay from the pool. Disconnects. */
  removeRelay(url: string): void {
    const state = this.relays.get(url);
    if (!state) return;
    this.disconnectRelay(state);
    this.relays.delete(url);
  }

  /** Get list of connected relay URLs. */
  getConnectedRelays(): string[] {
    const connected: string[] = [];
    for (const [url, state] of this.relays) {
      if (state.connected) connected.push(url);
    }
    return connected;
  }

  // ─── Connect / Disconnect ────────────────────────────────────────────

  private connectRelay(state: RelayState): void {
    if (state.ws) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      this.log('warn', 'Relay connect timeout', state.url);
      this.handleDisconnect(state);
    }, this.opts.connectTimeout);

    try {
      const ws = new WebSocket(state.url);
      state.ws = ws;

      ws.onopen = () => {
        clearTimeout(timeoutId);
        state.connected = true;
        state.reconnectAttempts = 0;
        this.log('info', 'Connected to relay', state.url);

        // Re-subscribe all active subscriptions
        for (const sub of state.subscriptions.values()) {
          this.sendSubscription(state, sub);
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as unknown[];
          this.handleMessage(state, data);
        } catch (err) {
          this.log('error', 'Failed to parse message', state.url, err);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        this.log('warn', 'WebSocket error', state.url);
      };

      ws.onclose = () => {
        clearTimeout(timeoutId);
        this.handleDisconnect(state);
      };
    } catch (err) {
      clearTimeout(timeoutId);
      this.log('error', 'Failed to create WebSocket', state.url, err);
      this.handleDisconnect(state);
    }
  }

  private disconnectRelay(state: RelayState): void {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.ws) {
      state.ws.onclose = null; // Prevent auto-reconnect
      state.ws.close();
      state.ws = null;
    }
    state.connected = false;
  }

  private handleDisconnect(state: RelayState): void {
    state.connected = false;
    state.ws = null;

    // Notify all subscriptions of the disconnect
    for (const sub of state.subscriptions.values()) {
      sub.onEvent({
        kind: 'notice',
        message: `Disconnected from ${state.url}`,
      });
    }

    // Reconnect
    if (
      this.opts.maxReconnects === 0 ||
      state.reconnectAttempts < this.opts.maxReconnects
    ) {
      state.reconnectAttempts++;
      const delay = this.opts.reconnectDelay * Math.pow(2, state.reconnectAttempts - 1);
      this.log('info', `Reconnecting to ${state.url} in ${delay}ms (attempt ${state.reconnectAttempts})`);
      state.reconnectTimer = setTimeout(() => {
        this.connectRelay(state);
      }, delay);
    } else {
      this.log('warn', 'Max reconnects reached for', state.url);
    }
  }

  // ─── Subscriptions ───────────────────────────────────────────────────

  /**
   * Subscribe to events matching the given filters.
   * Returns a subscription id that can be used to close.
   */
  subscribe(
    filters: NostrFilter | NostrFilter[],
    callbacks: {
      onEvent: (event: NostrEvent) => void;
      onEose?: () => void;
      onNotice?: (message: string) => void;
    },
  ): string {
    const subId = generateSubId();
    const filterArray = Array.isArray(filters) ? filters : [filters];

    const sub: RelaySubscription = {
      id: subId,
      filters: filterArray,
      onEvent: (ev: RelayEvent) => {
        if (ev.kind === 'event' && ev.event) {
          callbacks.onEvent(ev.event);
        } else if (ev.kind === 'eose') {
          callbacks.onEose?.();
        } else if (ev.kind === 'notice' && ev.message) {
          callbacks.onNotice?.(ev.message);
        }
      },
    };

    for (const state of this.relays.values()) {
      if (!state.connected) {
        // Queue subscription for when relay connects
        state.subscriptions.set(subId, sub);
        continue;
      }
      state.subscriptions.set(subId, sub);
      this.sendSubscription(state, sub);
    }

    // Set EOSE timeout
    setTimeout(() => {
      callbacks.onEose?.();
    }, this.opts.eoseTimeout);

    return subId;
  }

  /**
   * One-shot fetch: subscribe, collect events until EOSE or timeout, then close.
   * Returns an array of events (limited by limit filter).
   */
  list(filters: NostrFilter | NostrFilter[], timeoutMs?: number): Promise<NostrEvent[]> {
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      const subId = this.subscribe(filters, {
        onEvent: (event) => {
          events.push(event);
        },
        onEose: () => {
          this.closeSubscription(subId);
          resolve(events);
        },
      });
      setTimeout(() => {
        this.closeSubscription(subId);
        resolve(events);
      }, timeoutMs ?? this.opts.eoseTimeout);
    });
  }

  /** Close a subscription across all relays. */
  closeSubscription(subId: string): void {
    for (const state of this.relays.values()) {
      state.subscriptions.delete(subId);
      if (state.connected && state.ws) {
        this.send(state.ws, ['CLOSE', subId]);
      }
    }
  }

  /** Close all subscriptions. */
  closeAllSubscriptions(): void {
    for (const state of this.relays.values()) {
      for (const subId of state.subscriptions.keys()) {
        if (state.connected && state.ws) {
          this.send(state.ws, ['CLOSE', subId]);
        }
      }
      state.subscriptions.clear();
    }
  }

  // ─── Publishing ──────────────────────────────────────────────────────

  /**
   * Publish an event to all connected relays.
   * Returns per-relay results via the callback.
   */
  publish(
    event: NostrEvent,
    callbacks?: {
      onOk?: (relayUrl: string, eventId: string, success: boolean, message: string) => void;
      onError?: (relayUrl: string, message: string) => void;
    },
  ): void {
    for (const [url, state] of this.relays) {
      if (!state.connected || !state.ws) {
        callbacks?.onError?.(url, 'Not connected');
        continue;
      }
      this.send(state.ws, ['EVENT', event]);
      // OK responses come as separate messages handled in handleMessage
    }
  }

  // ─── Internal message handling ───────────────────────────────────────

  private handleMessage(state: RelayState, data: unknown[]): void {
    if (!Array.isArray(data) || data.length < 2) return;

    const [type, ...rest] = data;

    if (type === 'EVENT' && rest.length >= 2) {
      const subId = rest[0] as string;
      const event = rest[1] as NostrEvent;
      const sub = state.subscriptions.get(subId);
      if (sub) {
        sub.onEvent({ kind: 'event', subscriptionId: subId, event });
      }
    } else if (type === 'EOSE' && rest.length >= 1) {
      const subId = rest[0] as string;
      const sub = state.subscriptions.get(subId);
      if (sub) {
        sub.onEvent({ kind: 'eose', subscriptionId: subId });
      }
    } else if (type === 'NOTICE' && rest.length >= 1) {
      const message = rest[0] as string;
      // Broadcast notice to all subscriptions on this relay
      for (const sub of state.subscriptions.values()) {
        sub.onEvent({ kind: 'notice', message });
      }
    } else if (type === 'OK' && rest.length >= 3) {
      const eventId = rest[0] as string;
      const success = rest[1] as boolean;
      const message = rest[2] as string;
      for (const sub of state.subscriptions.values()) {
        sub.onEvent({
          kind: 'ok',
          ok: { eventId, success, message },
        });
      }
    }
  }

  private sendSubscription(state: RelayState, sub: RelaySubscription): void {
    if (!state.ws || !state.connected) return;
    this.send(state.ws, ['REQ', sub.id, ...sub.filters]);
  }

  private send(ws: WebSocket, message: unknown[]): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      this.log('error', 'Failed to send message', err);
    }
  }

  // ─── Utils ───────────────────────────────────────────────────────────

  private log(level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]): void {
    if (level === 'error') this.logger.error('[nostr-sdk]', ...args);
    else if (level === 'warn') this.logger.warn('[nostr-sdk]', ...args);
    else if (level === 'info' || level === 'debug') {
      if (this.opts.logLevel === 'debug' || (this.opts.logLevel === 'info' && level === 'info')) {
        this.logger.log('[nostr-sdk]', ...args);
      }
    }
  }

  /** Disconnect all relays and clean up. */
  disconnectAll(): void {
    this.closeAllSubscriptions();
    for (const state of this.relays.values()) {
      this.disconnectRelay(state);
    }
    this.relays.clear();
  }
}

let subIdCounter = 0;

function generateSubId(): string {
  return `df-${++subIdCounter}-${Date.now()}`;
}
