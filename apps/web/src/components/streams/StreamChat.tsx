'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ChatMessage, useStreamChat } from './useStreamChat';

/* ─── Badge component ────────────────────────────────────────── */

function MessageBadge({ badge }: { badge: ChatMessage['badge'] }) {
  if (!badge) return null;
  const styles: Record<string, { label: string; className: string }> = {
    mod: { label: 'MOD', className: 'bg-green-500/15 text-green-400' },
    sub: { label: 'SUB', className: 'bg-purple-500/15 text-purple-400' },
    host: { label: 'HOST', className: 'bg-degen-500/15 text-degen-400' },
    verified: { label: '✓', className: 'bg-blue-500/15 text-blue-400' },
  };
  const s = styles[badge];
  if (!s) return null;
  return (
    <span
      className={`mr-1 rounded px-1 py-[1px] text-[8px] font-bold uppercase leading-none ${s.className}`}
    >
      {s.label}
    </span>
  );
}

/* ─── Chat message bubble ────────────────────────────────────── */

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isSystem = msg.userId === 'system';
  const isLocal = msg.userId === 'local-user';

  return (
    <div
      className={`flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--color-overlay)] ${
        isLocal ? 'bg-degen-500/5' : ''
      }`}
    >
      {/* Avatar */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400">
        {msg.avatarUrl ? (
          <img src={msg.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          msg.displayName[0]?.toUpperCase() || '?'
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span
            className={`truncate text-xs font-semibold ${
              isSystem ? 'text-degen-400' : isLocal ? 'text-degen-400' : 'text-[var(--color-fg)]'
            }`}
          >
            {msg.displayName}
          </span>
          <MessageBadge badge={msg.badge} />
          <span className="shrink-0 text-[9px] tabular-nums text-[var(--color-muted)]">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--color-muted)] break-words">{msg.text}</p>
      </div>
    </div>
  );
}

/* ─── Chat input ─────────────────────────────────────────────── */

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim()) return;
      onSend(value.trim());
      setValue('');
    },
    [value, onSend],
  );

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--color-border)] p-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? 'Connecting...' : 'Chat...'}
          disabled={disabled}
          maxLength={500}
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:shadow-[0_0_8px_var(--color-accent-glow)] disabled:opacity-50"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-degen-500 text-black transition-all hover:bg-degen-400 disabled:opacity-30"
          aria-label="Send message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>
    </form>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

interface StreamChatProps {
  streamId: string;
  maxHeight?: string;
}

export function StreamChat({ streamId, maxHeight = '400px' }: StreamChatProps) {
  const { messages, sendMessage, isConnected } = useStreamChat({ streamId });
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, autoScroll]);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(isAtBottom);
  }, []);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-fg)]">Stream Chat</span>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-degen-500' : 'bg-amber-500'
            }`}
            title={isConnected ? 'Connected' : 'Simulated'}
          />
        </div>
        <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-[var(--color-muted)]">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={false} />

      {/* Scroll-to-bottom button */}
      {!autoScroll && messages.length > 5 && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-14 right-4 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-lg transition-all hover:text-[var(--color-fg)]"
          aria-label="Scroll to bottom"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
