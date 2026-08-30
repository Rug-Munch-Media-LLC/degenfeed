'use client';

/**
 * LiveShortsChat — Real-time chat overlay for live short sessions.
 *
 * Features:
 *   - Auto-scrolling message list
 *   - Protocol badges on messages (Farcaster, Nostr, Lens, etc.)
 *   - Tip highlights (green background for tipped messages)
 *   - Emoji support
 *   - Message input (requires auth)
 *
 * Auto-scrolls to bottom on new messages unless user has scrolled up.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';

// === Types =============================================================

interface ChatMessage {
  id: string;
  sender: string;
  senderAvatar?: string;
  text: string;
  timestamp: number;
  protocol?: string;
  isTip?: boolean;
  tipAmount?: string;
}

// === Mock messages (dev/fallback) ======================================

// === Protocol badge colors ============================================

const PROTOCOL_COLORS: Record<string, { label: string; color: string }> = {
  ethereum: { label: 'ETH', color: '#627eea' },
  solana: { label: 'SOL', color: '#9945ff' },
  farcaster: { label: 'FC', color: '#8a63d2' },
  nostr: { label: 'Nostr', color: '#8b5cf6' },
  lens: { label: 'Lens', color: '#abfe2c' },
  bluesky: { label: 'BSky', color: '#1185fe' },
  degenfeed: { label: 'DF', color: '#00ff41' },
};

function ProtocolBadge({ protocol }: { protocol?: string }) {
  if (!protocol) return null;
  const meta = PROTOCOL_COLORS[protocol] ?? { label: protocol, color: '#888' };
  return (
    <span
      className="inline-flex items-center rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none"
      style={{ backgroundColor: `${meta.color}30`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

// === Tip indicator ====================================================

function TipIndicator({ amount }: { amount?: string }) {
  if (!amount) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-degen-500/20 px-1 py-0.5 text-[9px] font-bold text-degen-400">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      {amount}
    </span>
  );
}

// === Single message ===================================================

function ChatMessageItem({ message }: { message: ChatMessage }) {
  return (
    <div
      className={`flex items-start gap-1.5 px-3 py-1.5 text-xs leading-relaxed ${
        message.isTip ? 'bg-degen-500/5' : ''
      }`}
    >
      {/* Avatar */}
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400"
        style={
          message.senderAvatar
            ? {
                backgroundImage: `url(${message.senderAvatar})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {message.senderAvatar ? '' : message.sender[0]?.toUpperCase() || '?'}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px] font-semibold text-white/90">{message.sender}</span>
          <ProtocolBadge protocol={message.protocol} />
          {message.isTip && <TipIndicator amount={message.tipAmount} />}
        </div>
        <span className="text-[11px] text-white/70">{message.text}</span>
      </div>
    </div>
  );
}

// === Message input ====================================================

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue('');
    },
    [value, disabled, onSend],
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 p-3">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={disabled ? 'Sign in to chat' : 'Type a message...'}
        disabled={disabled}
        maxLength={200}
        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/50 disabled:opacity-40"
        aria-label="Chat message"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500 text-black transition-all hover:bg-degen-400 disabled:opacity-40"
        aria-label="Send message"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}

// === Main Chat Component ==============================================

interface LiveShortsChatProps {
  sessionId: string;
}

export function LiveShortsChat({ sessionId: _sessionId }: LiveShortsChatProps) {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!autoScroll || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [autoScroll]);

  // Detect manual scroll-up (pause auto-scroll)
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(isNearBottom);
  }, []);

  // Periodically add mock messages for demo
  useEffect(() => {
    if (messages.length > 100) return;
    const msgOptions = ['nice!', '🔥', 'wgmi', '💎🙌', 'lfg', 'based', 'gm'];
    const protoOptions = ['ethereum', 'solana', 'farcaster', 'nostr', 'lens'];
    const interval = setInterval(() => {
      const msgIdx = Math.floor(Math.random() * msgOptions.length);
      const protoIdx = Math.floor(Math.random() * protoOptions.length);
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-${Date.now()}`,
          sender: `user_${Math.random().toString(36).slice(2, 6)}`,
          text: msgOptions[msgIdx] ?? 'gm',
          timestamp: Date.now(),
          protocol: protoOptions[protoIdx] ?? 'ethereum',
        },
      ]);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  const handleSend = useCallback(
    (_text: string) => {
      if (!hasSignedIn) return;
      // Would send to API
    },
    [hasSignedIn],
  );

  return (
    <div className="flex h-full flex-col bg-black/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-semibold text-white/80">Live Chat</span>
        <span className="text-[10px] text-white/40">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-none"
        role="log"
        aria-label="Live chat messages"
        aria-live="polite"
      >
        <div className="space-y-px py-2">
          {messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* New message indicator when scrolled up */}
      {!autoScroll && messages.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-1 text-[10px] font-semibold text-black shadow-lg transition-all hover:bg-degen-400"
        >
          New messages ↓
        </button>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={!hasSignedIn} />
    </div>
  );
}
