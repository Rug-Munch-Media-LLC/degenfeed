'use client';

/**
 * @degenfeed/web — Unified Cross-Protocol Live Chat Hook
 *
 * Connects to the unified live chat via WebSocket, polling, and REST.
 * Supports: DegenFeed, Nostr, Farcaster, Bluesky, Mastodon, Telegram
 * Message types include reactions, pin, delete, ban, timeout, gift.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ChatProtocol =
  | 'degenfeed'
  | 'nostr'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'telegram'
  | 'lens'
  | 'zora'
  | 'activitypub';

export interface ProtocolBadgeConfig {
  protocol: ChatProtocol;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  shortLabel: string;
}

const PROTOCOL_BADGES: Record<ChatProtocol, ProtocolBadgeConfig> = {
  degenfeed: { protocol: 'degenfeed', label: 'DegenFeed', emoji: '🌀', color: '#00ff41', bgColor: 'rgba(0,255,65,0.12)', shortLabel: 'DF' },
  nostr: { protocol: 'nostr', label: 'Nostr', emoji: '⚡', color: '#E87928', bgColor: 'rgba(232,121,40,0.12)', shortLabel: 'NSTR' },
  farcaster: { protocol: 'farcaster', label: 'Farcaster', emoji: '📱', color: '#8A63D2', bgColor: 'rgba(138,99,210,0.12)', shortLabel: 'FC' },
  bluesky: { protocol: 'bluesky', label: 'Bluesky', emoji: '☁️', color: '#0285FF', bgColor: 'rgba(2,133,255,0.12)', shortLabel: 'BSKY' },
  mastodon: { protocol: 'mastodon', label: 'Mastodon', emoji: '🐘', color: '#6364FF', bgColor: 'rgba(99,100,255,0.12)', shortLabel: 'MAST' },
  telegram: { protocol: 'telegram', label: 'Telegram', emoji: '✈️', color: '#0088cc', bgColor: 'rgba(0,136,204,0.12)', shortLabel: 'TG' },
  lens: { protocol: 'lens', label: 'Lens', emoji: '👁️', color: '#ABFE2C', bgColor: 'rgba(171,254,44,0.12)', shortLabel: 'LENS' },
  zora: { protocol: 'zora', label: 'Zora', emoji: '🎨', color: '#FF6B35', bgColor: 'rgba(255,107,53,0.12)', shortLabel: 'ZORA' },
  activitypub: { protocol: 'activitypub', label: 'ActivityPub', emoji: '🌐', color: '#00BCD4', bgColor: 'rgba(0,188,212,0.12)', shortLabel: 'AP' },
};

export function getProtocolBadge(protocol: ChatProtocol): ProtocolBadgeConfig {
  return PROTOCOL_BADGES[protocol] || PROTOCOL_BADGES.degenfeed;
}

export type ChatMode = 'normal' | 'slow' | 'sub_only' | 'follower_only';

export interface LiveChatMessage {
  id: string;
  streamId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  timestamp: number;
  protocol: ChatProtocol;
  isCreator?: boolean;
  isHighlighted?: boolean;
  gift?: { amount: string; symbol: string; chain?: string };
  badges?: string[];
  reactions?: Record<string, string[]>;
  isBridged?: boolean;
  bridgedFrom?: ChatProtocol;
  replyTo?: string;
  isPinned?: boolean;
  isDeleted?: boolean;
  chatColor?: string;
}

export interface ChatAnalytics {
  messagesPerMinute: number;
  totalMessages: number;
  topChatters: Array<{ userId: string; displayName: string; count: number; protocol: string }>;
  sentiment: { positive: number; neutral: number; negative: number; total: number };
  platformBreakdown: Record<string, number>;
  viewerPlatformBreakdown: Record<string, number>;
  engagementRate: number;
  peakMpm: number;
  activeChatters: number;
  timestamp: number;
}

interface WsMessage {
  type: string;
  streamId: string;
  message?: LiveChatMessage;
  badge?: ProtocolBadgeConfig;
  messageId?: string;
  userId?: string;
  emoji?: string;
  reactions?: Record<string, string[]>;
  pinned?: boolean;
  moderatorId?: string;
  durationMs?: number;
  analytics?: ChatAnalytics;
}

export interface UseUnifiedChatOptions {
  streamId: string;
  /** Whether this user is the stream creator/host */
  isCreator?: boolean;
  /** Max messages to keep in memory */
  maxMessages?: number;
  /** Poll interval for REST fallback (ms) */
  pollInterval?: number;
}

export interface UseUnifiedChatResult {
  messages: LiveChatMessage[];
  pinnedMessageIds: string[];
  analytics: ChatAnalytics | null;
  isConnected: boolean;
  error: string | null;
  sendMessage: (text: string, protocol?: ChatProtocol) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  banUser: (userId: string) => Promise<void>;
  timeoutUser: (userId: string, durationMs: number) => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  clearMessages: () => void;
  /** Set the viewer's protocol for the platform breakdown */
  setMyProtocol: (protocol: ChatProtocol) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useUnifiedChat({
  streamId,
  isCreator = false,
  maxMessages = 200,
  pollInterval = 5000,
}: UseUnifiedChatOptions): UseUnifiedChatResult {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<ChatAnalytics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myProtocolRef = useRef<ChatProtocol>('degenfeed');

  const setMyProtocol = useCallback((protocol: ChatProtocol) => {
    myProtocolRef.current = protocol;
  }, []);

  // Initialize: fetch existing messages + connect WebSocket
  useEffect(() => {
    if (!streamId) return;

    let mounted = true;

    // 1. Fetch existing messages
    const fetchMessages = async () => {
      try {
        const [msgRes, pinnedRes] = await Promise.all([
          fetch(`/api/live/chat/${streamId}/messages?limit=50`),
          fetch(`/api/live/chat/${streamId}/pinned`),
        ]);

        if (msgRes.ok) {
          const data = await msgRes.json();
          if (data.messages) {
            setMessages(data.messages.slice(-maxMessages));
          } else if (data.data) {
            setMessages(Array.isArray(data.data) ? data.data.slice(-maxMessages) : []);
          }
        }

        if (pinnedRes.ok) {
          const data = await pinnedRes.json();
          if (data.messageIds) setPinnedMessageIds(data.messageIds);
        }
      } catch {
        // Silent — fall back to WebSocket
      }
    };
    fetchMessages();

    // 2. Connect WebSocket
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/live/chat/${streamId}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) { ws?.close(); return; }
          setIsConnected(true);
          setError(null);
          // Clear any poll fallback
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          if (!mounted) return;
          try {
            const parsed = JSON.parse(event.data) as WsMessage;

            switch (parsed.type) {
              case 'live_chat_message':
                if (parsed.message) {
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === parsed.message!.id)) return prev;
                    const next = [...prev, parsed.message!];
                    return next.length > maxMessages ? next.slice(-maxMessages) : next;
                  });
                }
                break;

              case 'live_chat_delete':
                setMessages((prev) =>
                  prev.map((m) => (m.id === parsed.messageId ? { ...m, isDeleted: true } : m)),
                );
                break;

              case 'live_chat_pin':
                setPinnedMessageIds((prev) => {
                  if (parsed.pinned) {
                    return prev.includes(parsed.messageId!) ? prev : [...prev, parsed.messageId!];
                  }
                  return prev.filter((id) => id !== parsed.messageId);
                });
                break;

              case 'live_chat_reaction':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === parsed.messageId ? { ...m, reactions: parsed.reactions } : m,
                  ),
                );
                break;

              case 'live_chat_ban':
              case 'live_chat_timeout':
                // Could show a system notification
                break;

              case 'live_chat_analytics':
                if (parsed.analytics) {
                  setAnalytics(parsed.analytics);
                }
                break;
            }
          } catch {
            // Non-JSON message
          }
        };

        ws.onclose = () => {
          if (!mounted) return;
          setIsConnected(false);
          startPollFallback();
          // Reconnect after 3s
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setError('Chat connection error. Using polling.');
          ws?.close();
        };
      } catch {
        startPollFallback();
      }
    };

    const startPollFallback = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        if (!mounted) return;
        try {
          const res = await fetch(`/api/live/chat/${streamId}/messages?limit=50`);
          if (res.ok) {
            const data = await res.json();
            const msgs: LiveChatMessage[] = data.messages || data.data || [];
            setMessages(msgs.slice(-maxMessages));
          }
        } catch {
          // Silent
        }
      }, pollInterval);
    };

    connect();

    // Analytics polling
    const analyticsInterval = setInterval(async () => {
      if (!mounted) return;
      try {
        const res = await fetch(`/api/live/chat/${streamId}/analytics`);
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data as ChatAnalytics);
        }
      } catch {
        // Silent
      }
    }, 10000);

    return () => {
      mounted = false;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(analyticsInterval);
    };
  }, [streamId, maxMessages, pollInterval]);

  // ─── Actions ───────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string, protocol?: ChatProtocol) => {
      if (!text.trim()) return;

      // Optimistic local add
      const optimistic: LiveChatMessage = {
        id: `local:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        streamId,
        userId: 'local-user',
        displayName: 'You',
        message: text.trim(),
        timestamp: Date.now(),
        protocol: protocol || myProtocolRef.current,
        isCreator,
      };
      setMessages((prev) => [...prev, optimistic]);

      // Send via WebSocket or REST
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message',
          text: text.trim(),
          protocol: protocol || myProtocolRef.current,
        }));
      } else {
        try {
          await fetch(`/api/live/chat/${streamId}/message`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              message: text.trim(),
              protocol: protocol || myProtocolRef.current,
            }),
          });
        } catch {
          // Optimistic message stays
        }
      }
    },
    [streamId, isCreator],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await fetch(`/api/live/chat/${streamId}/react`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId, emoji }),
        });
      } catch {
        // Silent
      }
    },
    [streamId],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await fetch(`/api/live/chat/${streamId}/delete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId }),
        });
      } catch {
        // Silent
      }
    },
    [streamId],
  );

  const banUser = useCallback(
    async (userId: string) => {
      try {
        await fetch(`/api/live/chat/${streamId}/ban`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch {
        // Silent
      }
    },
    [streamId],
  );

  const timeoutUser = useCallback(
    async (userId: string, durationMs: number) => {
      try {
        await fetch(`/api/live/chat/${streamId}/timeout`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId, durationMs }),
        });
      } catch {
        // Silent
      }
    },
    [streamId],
  );

  const pinMessage = useCallback(
    async (messageId: string) => {
      try {
        await fetch(`/api/live/chat/${streamId}/pin`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId }),
        });
        setPinnedMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]));
      } catch {
        // Silent
      }
    },
    [streamId],
  );

  const unpinMessage = useCallback(
    async (messageId: string) => {
      try {
        await fetch(`/api/live/chat/${streamId}/pin`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId }),
        });
        setPinnedMessageIds((prev) => prev.filter((id) => id !== messageId));
      } catch {
        // Silent
      }
    },
    [streamId],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    pinnedMessageIds,
    analytics,
    isConnected,
    error,
    sendMessage,
    toggleReaction,
    deleteMessage,
    banUser,
    timeoutUser,
    pinMessage,
    unpinMessage,
    clearMessages,
    setMyProtocol,
  };
}
