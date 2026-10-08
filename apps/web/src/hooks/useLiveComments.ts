'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

/* === Types ============================================ */

export interface TokenComment {
  id: string;
  tokenAddress: string;
  author: string;
  authorHandle?: string;
  authorAvatar?: string;
  text: string;
  parentId?: string;
  holderAmount: string;
  isHolder: boolean;
  isCreator: boolean;
  timestamp: number;
  badges: string[];
}

export interface UseLiveCommentsResult {
  comments: TokenComment[];
  sendComment: (text: string) => Promise<void>;
  isConnected: boolean;
  onlineCount: number;
  isLoading: boolean;
  isError: boolean;
}

interface CommentsResponse {
  comments: TokenComment[];
  nextCursor?: string;
  total: number;
}

/* === Hook ============================================= */

const WS_BASE =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `ws://${window.location.host}/ws/token`  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
    : `wss://api.degenfeed.xyz/ws/token`;

export function useLiveComments(tokenAddress: string): UseLiveCommentsResult {
  const [comments, setComments] = useState<TokenComment[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectRef = useRef<number>(0);
  const maxReconnect = useRef(5);

  // Fetch initial comments via HTTP
  const { error, isLoading } = useSWR<CommentsResponse>(
    tokenAddress ? `/api/token/${tokenAddress}/comments?limit=50` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json() as Promise<CommentsResponse>;
    },
    {
      refreshInterval: 0, // No polling — WebSocket is real-time
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onSuccess: (fetched: CommentsResponse) => {
        setComments(fetched.comments || []);
      },
    },
  );

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!tokenAddress) return;

    let ws: WebSocket | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    function connect() {
      if (!mounted) return;

      try {
        ws = new WebSocket(`${WS_BASE}/${tokenAddress}`);

        ws.onopen = () => {
          if (!mounted) return;
          setIsConnected(true);
          reconnectRef.current = 0;

          // Heartbeat every 30s
          heartbeatInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
          }, 30000);
        };

        ws.onmessage = (event) => {
          if (!mounted) return;
          try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
          } catch (err) {
            console.warn('[useLiveComments] Malformed WS message:', err);
          }
        };

        ws.onclose = () => {
          if (!mounted) return;
          setIsConnected(false);
          if (heartbeatInterval) clearInterval(heartbeatInterval);

          // Reconnect with exponential backoff
          if (reconnectRef.current < maxReconnect.current) {
            const delay = Math.min(1000 * 2 ** reconnectRef.current, 30000);
            reconnectRef.current += 1;
            reconnectTimer = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          // onclose will fire after this
          ws?.close();
        };
      } catch {
        // WebSocket not supported — fall back to polling handled by SWR
        setIsConnected(false);
      }
    }

    function handleMessage(msg: { type: string; [key: string]: unknown }) {
      switch (msg.type) {
        case 'comment': {
          const comment = msg.comment as TokenComment;
          setComments((prev) => {
            // Avoid duplicates
            if (prev.some((c) => c.id === comment.id)) return prev;
            return [comment, ...prev].slice(0, 200);
          });
          break;
        }
        case 'online_count':
          setOnlineCount(msg.count as number);
          break;
        case 'stream_started':
          // This is handled by the stream hook
          break;
        case 'pong':
          // Heartbeat acknowledged
          break;
        case 'milestone_reached':
          // Could trigger confetti/notification
          break;
        default:
          break;
      }
    }

    connect();

    return () => {
      mounted = false;
      setIsConnected(false);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on intentional close
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress]);

  // Send a new comment via HTTP POST (WebSocket is receive-only for comments)
  const sendComment = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || !tokenAddress) return;

      try {
        const res = await fetch(`/api/token/${tokenAddress}/comments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error((errBody as { error?: string }).error || `HTTP ${res.status}`);
        }

        // The posted comment will arrive via WebSocket broadcast
      } catch (err) {
        console.error('Failed to send comment:', err);
        throw err;
      }
    },
    [tokenAddress],
  );

  return {
    comments,
    sendComment,
    isConnected,
    onlineCount,
    isLoading,
    isError: !!error,
  };
}
