'use client';

import { getProtocolColor, getProtocolLabel } from '@degenfeed/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

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

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { tokens } = useAuth();
  const conversationId = decodeURIComponent(id ?? '');

  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [convMeta, setConvMeta] = useState<{
    participants: string[];
    protocol: string;
  } | null>(null);

  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(conversationId)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as { messages: Message[] };
          setMessages(data.messages ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };

    const fetchConvs = async () => {
      try {
        const res = await fetch('/api/messages/conversations', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as {
            conversations: Array<{
              conversationId: string;
              participants: string[];
              protocol: string;
            }>;
          };
          const conv = (data.conversations ?? []).find(
            (c) => c.conversationId === conversationId,
          );
          if (conv) {
            setConvMeta({ participants: conv.participants, protocol: conv.protocol });
          }
        }
      } catch {
        /* ignore */
      }
    };

    fetchConvs();
    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = composeText.trim();
    if (!text || sending || !convMeta) return;

    setSending(true);
    try {
      const other = (convMeta.participants[1] ?? convMeta.participants[0] ?? '');
      const res = await fetch('/api/messages/send', {
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
      });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; message: Message; error?: string };
        if (data.ok && data.message) {
          setComposeText('');
          setMessages((prev) => [...prev, data.message]);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-muted)]">Invalid conversation</p>
      </div>
    );
  }

  const other = convMeta?.participants[1] ?? convMeta?.participants[0] ?? '';
  const protocol = convMeta?.protocol || '';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-3">
        <Link
          href="/messages"
          className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-label="Back to messages"
          >
            <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
          </svg>
        </Link>
        {convMeta && (
          <>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: `${getProtocolColor(protocol)}18`,
                color: getProtocolColor(protocol),
              }}
            >
              {shortId(other).slice(0, 2)}
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-fg)]">{shortId(other)}</p>
              <p className="text-[10px] text-[var(--color-muted)]">
                via {getProtocolLabel(protocol)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-[var(--color-muted)]">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.fromId === (tokens.nostr_pubkey || '');
            const protocolColor = getProtocolColor(msg.protocol);
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
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
                      style={{ backgroundColor: `${protocolColor}14`, color: protocolColor }}
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
      {convMeta && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-glass-bg)] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Send a message via ${getProtocolLabel(protocol)}…`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!composeText.trim() || sending}
              className="flex-shrink-0 rounded-xl bg-degen-500 px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {sending ? '…' : '→'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
