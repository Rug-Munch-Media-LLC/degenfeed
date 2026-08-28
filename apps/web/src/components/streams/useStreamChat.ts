'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* === Types ==================================================== */

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  timestamp: number;
  isMod?: boolean;
  isSubscriber?: boolean;
  badge?: 'mod' | 'sub' | 'host' | 'verified';
}

export interface UseStreamChatOptions {
  streamId: string;
  maxMessages?: number;
}

export interface UseStreamChatResult {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  isConnected: boolean;
  error: string | null;
  clearMessages: () => void;
}

/* === Hook ===================================================== */

export function useStreamChat({
  streamId,
  maxMessages = 100,
}: UseStreamChatOptions): UseStreamChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect to WebSocket or fall back to mock
  useEffect(() => {
    if (!streamId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/streams/${streamId}/chat`;

    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        // Clear mock fallback if connected
        if (mockIntervalRef.current) {
          clearInterval(mockIntervalRef.current);
          mockIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as ChatMessage;
          setMessages((prev) => {
            const next = [...prev, { ...parsed, timestamp: parsed.timestamp || Date.now() }];
            return next.length > maxMessages ? next.slice(-maxMessages) : next;
          });
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        startMockFallback();
      };

      ws.onerror = () => {
        setError('Connection error. Using simulated chat.');
        ws.close();
        startMockFallback();
      };
    } catch {
      startMockFallback();
    }

    function startMockFallback() {
      if (mockIntervalRef.current) return;
      setIsConnected(false);
      setError(null); // silent fallback

      // Seed with a couple messages
      setMessages([
        {
          id: 'welcome-1',
          userId: 'system',
          displayName: 'DegenFeed',
          text: 'Welcome to the stream! Chat is in simulated mode.',
          timestamp: Date.now(),
          badge: 'host',
        },
      ]);

      mockIntervalRef.current = setInterval(
        () => {
          setMessages((prev) => {
            const next = [...prev];
            return next.length > maxMessages ? next.slice(-maxMessages) : next;
          });
        },
        3000 + Math.random() * 4000,
      );
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
      }
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
        mockIntervalRef.current = null;
      }
    };
  }, [streamId, maxMessages]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'message', text: text.trim() }));
      } else {
        // Optimistic local send in mock mode
        const msg: ChatMessage = {
          id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId: 'local-user',
          displayName: 'You',
          text: text.trim(),
          timestamp: Date.now(),
        };
        setMessages((prev) => {
          const next = [...prev, msg];
          return next.length > maxMessages ? next.slice(-maxMessages) : next;
        });
      }
    },
    [maxMessages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
    error,
    clearMessages,
  };
}
