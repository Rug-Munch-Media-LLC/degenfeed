'use client';

import { CHANNELS, useRealtime } from '@degenfeed/ui';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useAnnouncer } from '../../../components/ScreenReaderAnnouncer';
import {
  type ConversationListItem,
  getOtherParticipant,
  type Message,
} from '../../../hooks/useMessages';
import { getCached } from '../../../lib/fetchWithCache';
import { retryFetchJson } from '../../../lib/retryFetch';
import { ChatView } from '../ChatView';

/* === Page ==================================================== */

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { tokens } = useAuth();
  const { announce } = useAnnouncer();
  const { subscribe, sendTyping } = useRealtime(tokens.nostr_pubkey || undefined);
  const conversationId = decodeURIComponent(id ?? '');

  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [convMeta, setConvMeta] = useState<ConversationListItem | null>(null);

  const myIds = useMemo(
    () =>
      [
        tokens.nostr_pubkey,
        tokens.fid,
        tokens.lensProfileId,
        tokens.did,
        tokens.evmAddress,
        tokens.solanaAddress,
      ].filter(Boolean) as string[],
    [tokens],
  );

  // == Fetch conversation metadata ==========================
  useEffect(() => {
    if (!conversationId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [msgData, convData] = await Promise.all([
          retryFetchJson<{ messages: Message[] }>(
            `/api/messages/${encodeURIComponent(conversationId)}`,
          ),
          retryFetchJson<{ conversations: ConversationListItem[] }>('/api/messages/conversations'),
        ]);

        setMessages(msgData.messages ?? []);

        const conv = (convData.conversations ?? []).find(
          (c) => c.conversationId === conversationId,
        );
        if (conv) {
          setConvMeta(conv);
        } else {
          // Partial from cache
          const cached = getCached<ConversationListItem[]>('messages_conversations');
          const cachedConv = cached?.find((c) => c.conversationId === conversationId);
          if (cachedConv) setConvMeta(cachedConv);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [conversationId]);

  // == Realtime: incoming messages ==========================
  useEffect(() => {
    if (!subscribe || !conversationId) return;
    return subscribe(CHANNELS.DM_NEW, (data: unknown) => {
      const msg = data as Message;
      if (msg?.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
  }, [subscribe, conversationId]);

  // == Send message =========================================
  const handleSend = useCallback(async () => {
    const text = composeText.trim();
    if (!text || sending || !convMeta) return;

    setSending(true);
    setSendError(null);
    try {
      const other = getOtherParticipant(convMeta.participants);
      const res = await retryFetchJson<{ ok: boolean; message?: Message; error?: string }>(
        '/api/messages/send',
        {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              toId: other,
              protocol: convMeta.protocol,
              content: text,
              nostrPubkey: tokens.nostr_pubkey,
              auth: tokens,
            }),
          },
        },
      );
      if (res.ok && res.message) {
        setComposeText('');
        setMessages((prev) => [...prev, res.message as Message]);
        announce('Message sent', 'polite');
      } else {
        setSendError(res.error || 'Failed to send');
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [composeText, sending, convMeta, tokens, announce]);

  // == Typing ===============================================
  const handleTyping = useCallback(() => {
    if (conversationId) {
      sendTyping(conversationId);
    }
  }, [conversationId, sendTyping]);

  // == Guard ================================================
  if (!conversationId) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Invalid conversation</p>
      </div>
    );
  }

  // Build a minimal ConversationListItem if we have messages but no metadata
  let effectiveConv: ConversationListItem;
  if (convMeta) {
    effectiveConv = convMeta;
  } else {
    const lastMsg: {
      id: string;
      content: string;
      fromId: string;
      createdAt: number;
      read: boolean;
    } | null = messages.length > 0
      ? {
          id: messages[0]!.id,
          content: messages[0]!.content ?? '',
          fromId: messages[0]!.fromId ?? '',
          createdAt: messages[0]!.createdAt ?? Date.now(),
          read: true,
        }
      : null;

    effectiveConv = {
      conversationId,
      participants: [],
      protocol: 'nostr',
      lastMessage: lastMsg,
      unreadCount: 0,
      updatedAt: Date.now(),
    };
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <ChatView
        conversation={effectiveConv}
        messages={messages}
        loading={loading}
        error={error}
        sending={sending}
        sendError={sendError}
        composeText={composeText}
        onComposeChange={setComposeText}
        onSend={handleSend}
        onTyping={handleTyping}
        onBack={() => window.history.back()}
        typingUsers={new Set()}
        myIds={myIds}
      />
    </div>
  );
}
