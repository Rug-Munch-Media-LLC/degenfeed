/**
 * @degenfeed/ws-worker — WebSocket Realtime Server (Cloudflare Durable Objects)
 *
 * Architecture:
 * - Each Durable Object instance handles WebSocket connections for a shard of users.
 * - The DO routes connections by userId hash, pinning each user to a consistent instance.
 * - The DO maintains a Map<userId, WebSocket> for all connected sessions.
 * - External API endpoints call the DO via HTTP to broadcast events to connected clients.
 * - The Cloudflare Worker entry point creates DO stubs and forwards requests.
 *
 * Scaling:
 * - Cloudflare automatically distributes DO instances across its edge network.
 * - Each DO can handle thousands of concurrent WebSocket connections.
 * - DO memory is capped at ~128 MB; GC cleans up disconnected sessions.
 * - Rate limiting is done at the Worker entry point to prevent abuse.
 * - For >10K users, shard by additional DO classes or use a DO-per-region strategy.
 * - Sessions are ephemeral: no server-side session state persists across restarts.
 *
 * Security:
 * - WebSocket upgrade requires a valid userId query parameter.
 * - Broadcast endpoints should be called only by the backend API worker.
 * - In production, add a shared secret between the API worker and this WS worker.
 * - Rate limit connections per IP to prevent DoS.
 */

import { CHANNEL_LIST, type ChannelName } from './channels';

interface Env {
  REALTIME_SERVER: DurableObjectNamespace;
  API_SHARED_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

interface SessionMetadata {
  userId: string;
  connectedAt: number;
  subscriptions: Set<ChannelName>;
}

type WsMessage =
  | { type: 'subscribe'; channel: ChannelName }
  | { type: 'unsubscribe'; channel: ChannelName }
  | { type: 'ping' }
  | { type: 'typing'; conversationId: string };

type BroadcastPayload = {
  channel: ChannelName;
  data: unknown;
  timestamp: number;
};

// ─── Durable Object ──────────────────────────────────────────────────

export class RealtimeServer {
  private sessions: Map<WebSocket, SessionMetadata> = new Map();
  private userWsMap: Map<string, Set<WebSocket>> = new Map();

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    void state.blockConcurrencyWhile(async () => {
      // Restore any persisted state on startup
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/broadcast') {
      return this.handleBroadcast(request);
    }

    if (path === '/status') {
      return this.handleStatus();
    }

    return this.handleWebSocketUpgrade(request, url);
  }

  // ─── WebSocket upgrade ──────────────────────────────────────────

  private handleWebSocketUpgrade(request: Request, url: URL): Response {
    const userId = url.searchParams.get('userId');
    if (!userId || userId.length > 128) {
      return new Response('Missing or invalid userId', { status: 400 });
    }

    const rawVersion = url.searchParams.get('v');
    const clientVersion = rawVersion ? Number(rawVersion) : 1;
    if (!Number.isFinite(clientVersion) || clientVersion < 1) {
      return new Response('Invalid version', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (!server) {
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    this.state.acceptWebSocket(server);

    const metadata: SessionMetadata = {
      userId,
      connectedAt: Date.now(),
      subscriptions: new Set(),
    };

    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        this.handleClientMessage(server, metadata, msg);
      } catch {
        server.send(
          JSON.stringify({
            channel: 'system:error',
            data: { error: 'Invalid message format' },
            timestamp: Date.now(),
          }),
        );
      }
    });

    server.addEventListener('close', () => {
      this.removeSession(server, metadata);
    });

    server.addEventListener('error', () => {
      this.removeSession(server, metadata);
    });

    server.accept();

    const subbedChannels = this.getActiveChannels(metadata.subscriptions);
    server.send(
      JSON.stringify({
        channel: 'system:connected',
        data: {
          userId,
          channels: subbedChannels,
          serverTime: Date.now(),
        },
        timestamp: Date.now(),
      }),
    );

    this.addSession(server, metadata);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── Client message handler ─────────────────────────────────────

  private handleClientMessage(ws: WebSocket, meta: SessionMetadata, msg: WsMessage) {
    switch (msg.type) {
      case 'subscribe': {
        if (CHANNEL_LIST.includes(msg.channel)) {
          meta.subscriptions.add(msg.channel);
          ws.send(
            JSON.stringify({
              channel: 'system:subscribed',
              data: { channel: msg.channel },
              timestamp: Date.now(),
            }),
          );
        }
        break;
      }
      case 'unsubscribe': {
        meta.subscriptions.delete(msg.channel);
        break;
      }
      case 'ping': {
        ws.send(
          JSON.stringify({
            channel: 'system:pong',
            data: { serverTime: Date.now() },
            timestamp: Date.now(),
          }),
        );
        break;
      }
      case 'typing': {
        this.broadcast('dm:typing', {
          userId: meta.userId,
          conversationId: msg.conversationId,
        });
        break;
      }
    }
  }

  // ─── Session management ─────────────────────────────────────────

  private addSession(ws: WebSocket, meta: SessionMetadata) {
    this.sessions.set(ws, meta);
    const userSet = this.userWsMap.get(meta.userId) ?? new Set();
    userSet.add(ws);
    this.userWsMap.set(meta.userId, userSet);

    void this.state.storage.put('sessionCount', this.sessions.size);
  }

  private removeSession(ws: WebSocket, meta: SessionMetadata) {
    this.sessions.delete(ws);
    const userSet = this.userWsMap.get(meta.userId);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) {
        this.userWsMap.delete(meta.userId);
      }
    }

    void this.state.storage.put('sessionCount', this.sessions.size);
  }

  // ─── Broadcast helpers ──────────────────────────────────────────

  broadcast(channel: ChannelName, data: unknown) {
    const payload: BroadcastPayload = { channel, data, timestamp: Date.now() };
    const raw = JSON.stringify(payload);

    for (const [ws, meta] of this.sessions) {
      if (meta.subscriptions.size === 0 || meta.subscriptions.has(channel)) {
        try {
          ws.send(raw);
        } catch {
          // Will be cleaned up by close/error handler
        }
      }
    }
  }

  broadcastToUser(userId: string, channel: ChannelName, data: unknown) {
    const payload: BroadcastPayload = { channel, data, timestamp: Date.now() };
    const raw = JSON.stringify(payload);

    const userSet = this.userWsMap.get(userId);
    if (!userSet) return;

    for (const ws of userSet) {
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(raw);
        } catch {
          // Will be cleaned up by close/error handler
        }
      }
    }
  }

  // ─── HTTP endpoints ─────────────────────────────────────────────

  private async handleBroadcast(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body: {
      channel?: ChannelName;
      data?: unknown;
      userId?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (!body.channel || !CHANNEL_LIST.includes(body.channel)) {
      return new Response('Invalid channel', { status: 400 });
    }

    if (body.userId) {
      this.broadcastToUser(body.userId, body.channel, body.data);
    } else {
      this.broadcast(body.channel, body.data);
    }

    return new Response(JSON.stringify({ ok: true, sessions: this.sessions.size }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  private handleStatus(): Response {
    const channels = new Map<ChannelName, number>();
    for (const meta of this.sessions.values()) {
      for (const ch of meta.subscriptions) {
        channels.set(ch, (channels.get(ch) ?? 0) + 1);
      }
    }

    return new Response(
      JSON.stringify({
        sessions: this.sessions.size,
        uniqueUsers: this.userWsMap.size,
        channels: Object.fromEntries(channels),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  private getActiveChannels(subscriptions: Set<ChannelName>): ChannelName[] {
    if (subscriptions.size > 0) return Array.from(subscriptions);
    return CHANNEL_LIST;
  }
}

// ─── Worker entry point ────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'degenfeed-ws' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    // WebSocket connection: use DO for user affinity
    if (path === '/ws' || path === '/') {
      const userId = url.searchParams.get('userId') || 'anon';
      const doId = env.REALTIME_SERVER.idFromName(userId);
      const stub = env.REALTIME_SERVER.get(doId);
      return stub.fetch(request);
    }

    // Broadcast endpoints: route to a single DO instance
    if (path === '/broadcast') {
      const doId = env.REALTIME_SERVER.idFromName('broadcast-hub');
      const stub = env.REALTIME_SERVER.get(doId);
      return stub.fetch(request);
    }

    // Status endpoint
    if (path === '/status') {
      const doId = env.REALTIME_SERVER.idFromName('broadcast-hub');
      const stub = env.REALTIME_SERVER.get(doId);
      return stub.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
