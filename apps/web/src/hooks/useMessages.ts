'use client';

import { getOfflineQueue } from '@degenfeed/degenchat';
import { CHANNELS, useRealtime } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useAnnouncer } from '../components/ScreenReaderAnnouncer';
import { getCached, setCache } from '../lib/fetchWithCache';
import { retryFetch, retryFetchJson } from '../lib/retryFetch';

/* === Types =================================================== */

export interface DeliveryBadge {
  protocol: string;
  ok: boolean;
  nativeId?: string;
  error?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  fromId: string;
  toId: string;
  protocol:
    | 'nostr'
    | 'farcaster'
    | 'lens'
    | 'mastodon'
    | 'bluesky'
    | 'matrix'
    | 'discord'
    | 'telegram';
  content: string;
  createdAt: number;
  read: boolean;
  encrypted: boolean;
  nativeId?: string;
  deliveryStatus?: DeliveryBadge[];
}

export interface ConversationListItem {
  conversationId: string;
  participants: string[];
  protocol: string;
  lastMessage: {
    id: string;
    content: string;
    fromId: string;
    createdAt: number;
    read: boolean;
  } | null;
  unreadCount: number;
  updatedAt: number;
}

export interface InboxThread {
  peerId: string;
  peerDisplayName?: string;
  peerAvatar?: string;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: number;
    protocol: string;
  };
  unreadCount: number;
  lastActivity: number;
  protocols: string[];
}

export interface TypingUser {
  conversationId: string;
  userId: string;
  timestamp: number;
}

const CONV_CACHE_KEY = 'messages_conversations';
const POLL_INTERVAL_MS = 30000;
const TYPING_TIMEOUT_MS = 4000;

/* === Helpers ================================================= */

export function getOtherParticipant(participants: string[]): string {
  return participants[1] ?? participants[0] ?? '';
}

export function shortId(id: string): string {
  if (!id) return 'Unknown';
  return id.length > 12 ? `${id.slice(0, 6)}\u2026${id.slice(-4)}` : id;
}

export function getInitials(name: string): string {
  return (
    name
      .split(/[\s:@]+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '\uFFFD'
  );
}

export function formatMessageTime(ts: number): string {
  const msgDate = new Date(ts);
  const today = new Date();

  // Same day → HH:MM
  if (
    msgDate.getDate() === today.getDate() &&
    msgDate.getMonth() === today.getMonth() &&
    msgDate.getFullYear() === today.getFullYear()
  ) {
    return msgDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  // This year → month + day
  if (msgDate.getFullYear() === today.getFullYear()) {
    return msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Older → full date
  return msgDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* === useMessages Hook ======================================== */

export function useMessages() {
  const { ready, signedInProtocols, tokens } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const {
    subscribe,
    sendTyping: wsSendTyping,
    connected,
  } = useRealtime(tokens.nostr_pubkey || undefined);
  const { announce } = useAnnouncer();

  // Conversations
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Selected conversation
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const selectedConv = useMemo(
    () => conversations.find((c) => c.conversationId === selectedConvId),
    [conversations, selectedConvId],
  );

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Sending
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Typing state — maps conversationId → Set of userIds who are typing
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // New message compose state
  const [sendProtocol, setSendProtocol] = useState<string>('nostr');
  const [sendToId, setSendToId] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeText, setComposeText] = useState('');

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const other = getOtherParticipant(c.participants);
      return (
        other.toLowerCase().includes(q) ||
        c.protocol.toLowerCase().includes(q) ||
        c.lastMessage?.content.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery]);

  // == Fetch conversations ====================================
  const fetchConversations = useCallback(async () => {
    if (!hasSignedIn) return;
    setConvLoading(true);
    setConvError(null);
    try {
      const data = await retryFetchJson<{ conversations: ConversationListItem[] }>(
        '/api/messages/conversations',
        { maxRetries: 2 },
      );
      const convs = data.conversations ?? [];
      setConversations(convs);
      setCache(CONV_CACHE_KEY, convs);
      const total = convs.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
      setUnreadTotal(total);
    } catch (err) {
      setConvError(err instanceof Error ? err.message : 'Failed to load conversations');
      // Graceful degradation: show cached
      const cached = getCached<ConversationListItem[]>(CONV_CACHE_KEY);
      if (cached && conversations.length === 0) {
        setConversations(cached);
      }
    } finally {
      setConvLoading(false);
    }
  }, [hasSignedIn, conversations.length]);

  // == Fetch messages for conversation ========================
  const fetchMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    setMsgError(null);
    try {
      const data = await retryFetchJson<{ messages: Message[] }>(
        `/api/messages/${encodeURIComponent(convId)}`,
        { maxRetries: 2 },
      );
      setMessages(data.messages ?? []);
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  }, []);

  // == Send message ===========================================
  const handleSend = useCallback(
    async (opts?: { protocol?: string; toId?: string; content?: string }) => {
      const text = (opts?.content ?? composeText).trim();
      const protocol = opts?.protocol ?? sendProtocol;
      const toId = opts?.toId ?? sendToId;
      if (!text || !toId || sending) return;

      setSending(true);
      setSendError(null);
      try {
        const res = await retryFetch('/api/messages/send', {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              to: toId,
              body: text,
              preferredProtocol: protocol,
              nostrPubkey: tokens.nostr_pubkey,
              auth: tokens,
            }),
          },
        });
        const data = (await res.json()) as { ok: boolean; message?: Message; error?: string };
        if (res.ok && data.ok && data.message) {
          setComposeText('');
          // Optimistically add message to current view
          if (selectedConvId) {
            setMessages((prev) => [...prev, data.message!]);
          }
          announce('Message sent', 'polite');
          await fetchConversations();
        } else {
          setSendError(data.error || 'Failed to send');
        }
      } catch (err) {
        // Transport-level failure (network down, bridge unreachable): stash
        // the message in the DegenChat offline queue so it replays on
        // reconnect instead of silently vanishing.
        try {
          getOfflineQueue().enqueue({
            id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conversationId: selectedConvId ?? '',
            toId,
            body: text,
            protocol,
            protocols: [protocol],
            timestamp: Date.now(),
          });
          window.dispatchEvent(new CustomEvent('degenchat:offline-queue'));
        } catch {
          // queue write failed too — surface the original error
        }
        setSendError(err instanceof Error ? err.message : 'Failed to send');
      } finally {
        setSending(false);
      }
    },
    [
      composeText,
      sendProtocol,
      sendToId,
      sending,
      tokens,
      selectedConvId,
      fetchConversations,
      announce,
    ],
  );

  // == Select conversation ====================================
  const selectConv = useCallback(
    (convId: string) => {
      setSelectedConvId(convId);
      setShowCompose(false);
      setSendError(null);
      const conv = conversations.find((c) => c.conversationId === convId);
      if (conv) {
        setSendToId(getOtherParticipant(conv.participants));
        setSendProtocol(conv.protocol);
        // Clear unread count optimistically
        if (conv.unreadCount > 0) {
          setConversations((prev) =>
            prev.map((c) => (c.conversationId === convId ? { ...c, unreadCount: 0 } : c)),
          );
          setUnreadTotal((prev) => Math.max(0, prev - conv.unreadCount));
        }
      }
    },
    [conversations],
  );

  const clearSelectedConv = useCallback(() => {
    setSelectedConvId(null);
    setMessages([]);
    setMsgError(null);
  }, []);

  // == Typing indicator =======================================
  const handleTyping = useCallback(
    (conversationId: string) => {
      wsSendTyping(conversationId);
    },
    [wsSendTyping],
  );

  // Clean up old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const changed = false;
        for (const [_convId] of next) {
          // Clean up via timeout check
        }
        // Timeout-based cleanup
        for (const [_key, _timer] of typingTimeoutsRef.current) {
          // entries are cleaned up in the timeout callback
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // == Handle incoming realtime DM ============================
  useEffect(() => {
    if (!hasSignedIn || !subscribe) return;

    const unsubDm = subscribe(CHANNELS.DM_NEW, (data: unknown) => {
      const msg = data as Message;
      if (!msg?.conversationId) return;

      // If this conversation is currently selected, append the message
      if (msg.conversationId === selectedConvId) {
        setMessages((prev) => {
          // Deduplicate
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      // Refresh conversations list to update last message + unread
      fetchConversations();
    });

    const unsubTyping = subscribe(CHANNELS.DM_TYPING, (data: unknown) => {
      const typing = data as { conversationId: string; userId: string };
      if (!typing?.conversationId || !typing?.userId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        const existing = new Set(next.get(typing.conversationId) ?? []);
        existing.add(typing.userId);
        next.set(typing.conversationId, existing);
        return next;
      });

      // Clear typing after timeout
      const key = `${typing.conversationId}:${typing.userId}`;
      const existing = typingTimeoutsRef.current.get(key);
      if (existing) clearTimeout(existing);
      typingTimeoutsRef.current.set(
        key,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            const existingSet = new Set(next.get(typing.conversationId) ?? []);
            existingSet.delete(typing.userId);
            if (existingSet.size === 0) {
              next.delete(typing.conversationId);
            } else {
              next.set(typing.conversationId, existingSet);
            }
            return next;
          });
          typingTimeoutsRef.current.delete(key);
        }, TYPING_TIMEOUT_MS),
      );
    });

    return () => {
      unsubDm();
      unsubTyping();
      // Clean up all typing timeouts
      for (const timer of typingTimeoutsRef.current.values()) {
        clearTimeout(timer);
      }
      typingTimeoutsRef.current.clear();
    };
  }, [hasSignedIn, subscribe, selectedConvId, fetchConversations]);

  // == Initial fetch + polling ================================
  useEffect(() => {
    if (!hasSignedIn) {
      setConversations([]);
      setUnreadTotal(0);
      return;
    }
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasSignedIn, fetchConversations]);

  // == Fetch messages when selected conversation changes ======
  useEffect(() => {
    if (selectedConvId && hasSignedIn) {
      fetchMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, hasSignedIn, fetchMessages]);

  // == Keyboard nav ===========================================
  const [focusedConvIndex, setFocusedConvIndex] = useState(-1);

  const focusConvByIndex = useCallback(
    (index: number, listRef: React.RefObject<HTMLDivElement | null>) => {
      const convs = filteredConversations;
      if (index < 0 || index >= convs.length) return;
      setFocusedConvIndex(index);
      const convId = convs[index]?.conversationId;
      if (!convId) return;
      const el = listRef.current?.querySelector<HTMLElement>(`[data-conversation-id="${convId}"]`);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [filteredConversations],
  );

  return {
    // State
    hasSignedIn,
    conversations,
    filteredConversations,
    convLoading,
    convError,
    unreadTotal,
    selectedConvId,
    selectedConv,
    messages,
    msgLoading,
    msgError,
    sending,
    sendError,
    sendingProtocol: sendProtocol,
    sendToId,
    showCompose,
    composeText,
    searchQuery,
    typingUsersForSelected: selectedConvId
      ? (typingUsers.get(selectedConvId) ?? new Set<string>())
      : new Set<string>(),
    realtimeConnected: connected,

    // Setters
    setComposeText,
    setSendProtocol,
    setSendToId,
    setShowCompose,
    setSearchQuery,
    setFocusedConvIndex,

    // Actions
    fetchConversations,
    fetchMessages,
    selectConv,
    clearSelectedConv,
    handleSend,
    handleTyping,
    focusConvByIndex,
    focusedConvIndex,
  };
}
