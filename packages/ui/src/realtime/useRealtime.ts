/**
 * @degenfeed/realtime — useRealtime
 *
 * React hook for WebSocket connections to the DegenFeed realtime server.
 * Manages connection lifecycle, reconnection, and channel subscriptions.
 *
 * Usage:
 *   const { connected, subscribe, send } = useRealtime(userId);
 *   useEffect(() => {
 *     return subscribe('feed:new', (data) => console.log('New post:', data));
 *   }, [subscribe]);
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChannelName } from './channels';

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

function getWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const meta = document.querySelector('meta[name="ws-url"]');
    if (meta?.getAttribute('content')) return meta.getAttribute('content')!;
    const searchParam = new URLSearchParams(window.location.search).get('wsUrl');
    if (searchParam) return searchParam;
  }
  return 'wss://realtime.degenfeed.xyz/ws';
}

const WS_BASE_URL = getWsBaseUrl();

export interface RealtimeState {
  connected: boolean;
  userId: string | null;
}

export function useRealtime(userId?: string | null) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handlersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const mountedRef = useRef(true);
  const userIdRef = useRef(userId);

  userIdRef.current = userId;

  const connect = useCallback(() => {
    const id = userIdRef.current;
    if (!id || !mountedRef.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = `${WS_BASE_URL}?userId=${encodeURIComponent(id)}&v=1`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnected(true);

      for (const channel of handlersRef.current.keys()) {
        ws.send(JSON.stringify({ type: 'subscribe', channel }));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      if (!mountedRef.current) return;

      const attempt = reconnectAttemptRef.current;
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)] ?? 30000;
      reconnectAttemptRef.current = attempt + 1;

      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          channel: string;
          data: unknown;
          timestamp: number;
        };
        const handlerSet = handlersRef.current.get(payload.channel);
        if (handlerSet) {
          for (const handler of handlerSet) {
            try {
              handler(payload.data);
            } catch {
              // Swallow handler errors
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (userId) connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, connect]);

  const subscribe = useCallback(
    (channel: ChannelName | string, handler: (data: unknown) => void) => {
      const handlerSet = handlersRef.current.get(channel) ?? new Set();
      handlerSet.add(handler);
      handlersRef.current.set(channel, handlerSet);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
      }

      return () => {
        const set = handlersRef.current.get(channel);
        if (set) {
          set.delete(handler);
          if (set.size === 0) {
            handlersRef.current.delete(channel);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
            }
          }
        }
      };
    },
    [],
  );

  const send = useCallback((type: string, data?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...((data as Record<string, unknown>) ?? {}) }));
    }
  }, []);

  const sendTyping = useCallback(
    (conversationId: string) => {
      send('typing', { conversationId });
    },
    [send],
  );

  return {
    connected,
    subscribe,
    send,
    sendTyping,
    ws: wsRef.current,
  };
}
