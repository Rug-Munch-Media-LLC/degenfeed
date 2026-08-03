// ═══════════════════════════════════════════════════════════════════════
// Realtime WebSocket endpoint — /ws/realtime
//
// Minimal realtime socket for the DegenFeed feed page "Live" indicator.
// The bridge is the ONLY service that owns the /ws/realtime path
// (api.degenfeed.xyz proxies to rmi-backend and has no WS endpoint).
//
// Features:
//   - Accepts WebSocket connections at /ws/realtime
//   - Sends { type: "connected", protocolCount, liveProtocols } on connect
//   - Sends a heartbeat every 30s
//   - Acks subscribe messages so the client sees a healthy channel
//   - Origin check (CSWSH protection); non-browser clients may omit Origin
//
// Full feed push (feed:new-post fan-out) is intentionally out of scope —
// this endpoint exists so the feed indicator turns green.
// ═══════════════════════════════════════════════════════════════════════

import type http from 'node:http';
import { type WebSocket, WebSocketServer } from 'ws';
import { PROVIDERS } from './feeds';

const WS_PATH = '/ws/realtime';
const HEARTBEAT_INTERVAL_MS = 30_000;

const ALLOWED_ORIGINS = [
  'https://app.degenfeed.xyz',
  'https://degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:3100',
];

/**
 * Attach the /ws/realtime WebSocket server to the existing HTTP server.
 * Called before server.listen(). Does not intercept plain HTTP requests —
 * those still flow through the normal request handler + auth middleware.
 */
export function attachRealtimeWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    // Incomplete handshake (e.g. curl probe without Sec-WebSocket-Key).
    // Return a friendly status instead of a bare 400/404.
    if (!req.headers['sec-websocket-key'] || req.headers['sec-websocket-version'] !== '13') {
      socket.write(
        'HTTP/1.1 426 Upgrade Required\r\n' +
          'Content-Type: application/json\r\n' +
          'Connection: close\r\n\r\n' +
          JSON.stringify({
            error: 'Upgrade Required',
            message: 'Use a WebSocket client (Sec-WebSocket-Version: 13) to connect',
            ws: WS_PATH,
          }),
      );
      socket.destroy();
      return;
    }

    // Origin check — block cross-site WebSocket hijacking.
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    const liveProtocols = Object.keys(PROVIDERS).filter(
      (key) => PROVIDERS[key].category !== 'infrastructure',
    );

    ws.send(
      JSON.stringify({
        type: 'connected',
        protocolCount: liveProtocols.length,
        liveProtocols,
        ts: Date.now(),
      }),
    );

    // Heartbeat every 30s so the client can detect a stale connection
    // (and so cloudflared/nginx keep-alive doesn't idle-close the tunnel).
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      }
    }, HEARTBEAT_INTERVAL_MS);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          topics?: string[];
          [key: string]: unknown;
        };
        if (msg.type === 'subscribe') {
          ws.send(
            JSON.stringify({
              type: 'subscribed',
              topics: msg.topics ?? [],
              ts: Date.now(),
            }),
          );
        } else if (msg.type?.startsWith('subscribe')) {
          // scope subscriptions: subscribe:feed:for-you / home / trending,
          // subscribe:protocol — ack so the client knows the channel exists
          ws.send(JSON.stringify({ type: 'subscribed', channel: msg.type, ts: Date.now() }));
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => clearInterval(heartbeat));
    ws.on('error', () => clearInterval(heartbeat));
  });
}
