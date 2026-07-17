'use client';

import { getProtocolColor, getProtocolLabel, ListSkeleton } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

interface Message {
  id: string;
  conversationId: string;
  fromId: string;
  toId: string;
  protocol: 'nostr' | 'farcaster' | 'lens' | 'mastodon';
  content: string;
  createdAt: number;
  read: boolean;
  encrypted: boolean;
}

interface ConversationListItem {
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

const PROTOCOL_ICON: Record<string, string> = {
  nostr: '🟣',
  farcaster: '🔵',
  lens: '🟢',
  mastodon: '🐘',
};

function timeAgo(ts: number): string {
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

function getInitials(name: string): string {
  return (
    name
      .split(/[\s:@]+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function getOtherParticipant(participants: string[]): string {
  return participants[1] ?? participants[0] ?? '';
}

/* ─── Messages Page ─────────────────────────────────────────── */

export default function MessagesPage() {
  const { ready, signedInProtocols, tokens } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [sendProtocol, setSendProtocol] = useState<string>('nostr');
  const [sendToId, setSendToId] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const msgEndRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch conversations ────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages/conversations', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { conversations: ConversationListItem[] };
        setConversations(data.conversations ?? []);
        const total = (data.conversations ?? []).reduce((s, c) => s + (c.unreadCount ?? 0), 0);
        setUnreadTotal(total);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch messages for selected conversation ────────────────
  const fetchMessages = useCallback(
    async (convId: string) => {
      setMsgLoading(true);
      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(convId)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as { messages: Message[] };
          setMessages(data.messages ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setMsgLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (hasSignedIn) {
      fetchConversations();
      const interval = setInterval(fetchConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [hasSignedIn, fetchConversations]);

  useEffect(() => {
    if (selectedConvId && hasSignedIn) {
      fetchMessages(selectedConvId);
    }
  }, [selectedConvId, hasSignedIn, fetchMessages]);

  // Scroll to bottom when messages load
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Select conversation ─────────────────────────────────────
  const selectConv = useCallback((convId: string) => {
    setSelectedConvId(convId);
    setShowCompose(false);
  }, []);

  // ── Send message ────────────────────────────────────────────
  const handleSend = useCallback(
    async (protocolOverride?: string) => {
      const text = composeText.trim();
      const protocol = protocolOverride || sendProtocol;
      if (!text || sending) return;

      setSending(true);
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            toId: sendToId,
            protocol,
            content: text,
            nostrPubkey: tokens.nostr_pubkey,
            auth: tokens,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; message: Message; error?: string };
          if (data.ok && data.message) {
            setComposeText('');
            setSendToId('');
            setShowCompose(false);
            // Refresh conversations and messages
            await fetchConversations();
            if (selectedConvId) {
              await fetchMessages(selectedConvId);
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        setSending(false);
      }
    },
    [composeText, sendProtocol, sendToId, sending, tokens, selectedConvId, fetchConversations, fetchMessages],
  );

  // ── Keyboard shortcut for send ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === composeRef.current) {
        e.preventDefault();
        const _ = handleSend();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSend]);

  // ── Select conversation handler ─────────────────────────────
  const handleConvClick = useCallback(
    (conv: ConversationListItem) => {
      selectConv(conv.conversationId);
      // Fill send fields from conversation
      const other = getOtherParticipant(conv.participants);
      setSendToId(other);
      setSendProtocol(conv.protocol);
    },
    [selectConv],
  );

  const selectedConv = useMemo(
    () => conversations.find((c) => c.conversationId === selectedConvId),
    [conversations, selectedConvId],
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-[1280px] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-fg)] leading-none">Messages</h1>
            <p className="text-[10px] text-[var(--color-muted)]">
              {unreadTotal > 0 ? `${unreadTotal} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCompose(!showCompose)}
          className="rounded-lg border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/20"
        >
          {showCompose ? '× Close' : '+ New Message'}
        </button>
      </div>

      {/* New Message Compose */}
      {showCompose && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <select
              value={sendProtocol}
              onChange={(e) => setSendProtocol(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg)]"
              aria-label="Protocol"
            >
              {['nostr', 'farcaster', 'lens', 'mastodon'].map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_ICON[p] ?? ''} {getProtocolLabel(p)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={sendToId}
              onChange={(e) => setSendToId(e.target.value)}
              placeholder="Recipient (pubkey, fid, handle…)"
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <textarea
            ref={composeRef}
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="Write a message…"
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!composeText.trim() || !sendToId.trim() || sending}
              className="rounded-lg bg-degen-500 px-4 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Main split view */}
      {!hasSignedIn ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <span className="mb-3 inline-block text-3xl opacity-30">💬</span>
            <p className="text-base font-medium text-[var(--color-muted)]">Sign in to use DMs</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Cross-protocol direct messages across Nostr, Farcaster, Lens, and Mastodon.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Conversation list sidebar */}
          <div
            className={`w-full flex-shrink-0 overflow-y-auto border-r border-[var(--color-border)] sm:w-80 ${
              selectedConvId ? 'hidden sm:block' : ''
            }`}
          >
            {loading && conversations.length === 0 ? (
              <ListSkeleton count={5} leading trailing />
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8">
                <span className="mb-3 text-3xl opacity-30">💬</span>
                <p className="text-sm text-[var(--color-muted)]">No conversations yet</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Send a message to get started
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.conversationId === selectedConvId;
                const protocolColor = getProtocolColor(conv.protocol);
                const other = getOtherParticipant(conv.participants);
                return (
                  <button
                    key={conv.conversationId}
                    type="button"
                    onClick={() => handleConvClick(conv)}
                    className={`flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-overlay)] ${
                      isSelected ? 'bg-[var(--color-overlay)]' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
                      >
                        {getInitials(other)}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
                        {PROTOCOL_ICON[conv.protocol] ?? ''}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm font-medium ${
                            conv.unreadCount > 0
                              ? 'text-[var(--color-fg)]'
                              : 'text-[var(--color-muted)]'
                          }`}
                        >
                          {shortId(other)}
                        </span>
                        {conv.lastMessage && (
                          <span className="flex-shrink-0 text-[10px] text-[var(--color-muted)]">
                            {timeAgo(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="line-clamp-1 text-xs text-[var(--color-muted)]">
                          {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold text-black">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {/* Protocol badge */}
                      <span
                        className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ backgroundColor: `${protocolColor}14`, color: protocolColor }}
                      >
                        {getProtocolLabel(conv.protocol)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Message thread */}
          <div
            className={`flex flex-1 flex-col overflow-hidden ${
              !selectedConvId ? 'hidden sm:flex' : ''
            }`}
          >
            {!selectedConvId ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <span className="mb-3 inline-block text-4xl opacity-30">💬</span>
                  <p className="text-sm text-[var(--color-muted)]">
                    Select a conversation to view messages
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedConvId(null)}
                    className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)] sm:hidden"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-label="Back"
                    >
                      <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
                    </svg>
                  </button>
                  {selectedConv && (
                    <>
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: `${getProtocolColor(selectedConv.protocol)}18`,
                          color: getProtocolColor(selectedConv.protocol),
                        }}
                      >
                        {getInitials(getOtherParticipant(selectedConv.participants))}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-fg)]">
                          {shortId(getOtherParticipant(selectedConv.participants))}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">
                          via {getProtocolLabel(selectedConv.protocol)}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {msgLoading ? (
                    <ListSkeleton count={4} leading={false} />
                  ) : messages.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-16">
                      <p className="text-sm text-[var(--color-muted)]">No messages yet</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.fromId === (tokens.nostr_pubkey || '');
                      const protocolColor = getProtocolColor(msg.protocol);
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                              isMe
                                ? 'bg-degen-500/20 text-[var(--color-fg)] rounded-br-md'
                                : 'bg-[var(--color-card)] text-[var(--color-fg)] rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className="flex items-center justify-end gap-2 mt-1.5">
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                                style={{
                                  backgroundColor: `${protocolColor}14`,
                                  color: protocolColor,
                                }}
                              >
                                {getProtocolLabel(msg.protocol)}
                                {msg.encrypted ? ' 🔒' : ''}
                              </span>
                              <span className="text-[9px] text-[var(--color-muted)]">
                                {timeAgo(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={msgEndRef} />
                </div>

                {/* Compose bar */}
                {selectedConv && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-glass-bg)] p-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (composeText.trim() && !sending) {
                              setSendToId(getOtherParticipant(selectedConv.participants));
                              setSendProtocol(selectedConv.protocol);
                              const _ = handleSend(selectedConv.protocol);
                            }
                          }
                        }}
                        placeholder="Write a message…"
                        rows={1}
                        className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSendToId(getOtherParticipant(selectedConv.participants));
                          setSendProtocol(selectedConv.protocol);
                          const _ = handleSend(selectedConv.protocol);
                        }}
                        disabled={!composeText.trim() || sending}
                        className="flex-shrink-0 rounded-xl bg-degen-500 px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {sending ? '…' : '→'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
