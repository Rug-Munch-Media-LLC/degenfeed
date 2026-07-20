'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_BADGES, type ChatBadge, DEFAULT_EMOTES, type Emote } from './types';
import type { ChatMessage } from '../streams/useStreamChat';
import { useStreamChat } from '../streams/useStreamChat';

/* === Badge display ============================================ */

function ChatBadgeDisplay({ badge }: { badge?: ChatBadge | string }) {
  if (!badge) return null;
  const info = CHAT_BADGES[badge as ChatBadge];
  if (!info) return null;
  return (
    <span
      className="mr-1 inline-flex items-center rounded px-1 py-[1px] text-[8px] font-bold uppercase leading-none"
      style={{ backgroundColor: `${info.color}20`, color: info.color }}
      title={info.tooltip}
    >
      {info.label}
    </span>
  );
}

/* === Emote Picker ============================================= */

function EmotePicker({ onSelect, onClose }: { onSelect: (emote: Emote) => void; onClose: () => void }) {
  const categories = Array.from(new Set(DEFAULT_EMOTES.map((e) => e.category ?? 'other')));
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  const filtered = DEFAULT_EMOTES.filter((e) => (e.category ?? 'other') === activeCategory);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl animate-slide-up">
      {/* Category tabs */}
      <div className="flex gap-1 border-b border-white/10 p-2 overflow-x-auto scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
              activeCategory === cat ? 'bg-degen-500/20 text-degen-400' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emote grid */}
      <div className="grid grid-cols-6 gap-1 p-2 max-h-40 overflow-y-auto">
        {filtered.map((emote) => (
          <button
            key={emote.id}
            type="button"
            onClick={() => { onSelect(emote); onClose(); }}
            className="flex aspect-square items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10"
            title={emote.name}
          >
            {emote.src}
          </button>
        ))}
      </div>
    </div>
  );
}

/* === Message Bubble =========================================== */

function ChatMessageBubble({ msg, isLocal }: { msg: ChatMessage; isLocal: boolean }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-white/5 ${isLocal ? 'bg-degen-500/5' : ''}`}>
      {/* Avatar */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400">
        {msg.avatarUrl ? (
          <img src={msg.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          msg.displayName[0]?.toUpperCase() || '?'
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className={`truncate text-xs font-semibold ${isLocal ? 'text-degen-400' : 'text-white/90'}`}>
            {msg.displayName}
          </span>
          {(msg as ChatMessage & { badge?: string }).badge && (
            <ChatBadgeDisplay badge={(msg as ChatMessage & { badge?: string }).badge as ChatBadge} />
          )}
          <span className="shrink-0 text-[9px] tabular-nums text-white/30">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-white/70 break-words">{msg.text}</p>
      </div>
    </div>
  );
}

/* === Chat Input =============================================== */

function ChatInputField({ onSend, disabled, onSlowMode: onSlowModeProp }: {
  onSend: (text: string) => void;
  disabled?: boolean;
  onSlowMode?: (v: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || cooldown) return;
    if (value.startsWith('/')) {
      // Command handling
      const cmd = value.slice(1).split(' ').shift()?.toLowerCase() ?? '';
      if (cmd === 'slow') {
        setSlowMode((v) => { onSlowModeProp?.(!v); return !v; });
        setValue('');
        return;
      }
      if (cmd === 'clear') {
        setValue('');
        return;
      }
    }
    onSend(value.trim());
    setValue('');
    if (slowMode) {
      setCooldown(true);
      setTimeout(() => setCooldown(false), 3000);
    }
  }, [value, onSend, cooldown, slowMode, onSlowModeProp]);

  const handleEmoteSelect = useCallback((emote: Emote) => {
    setValue((v) => v + ' ' + emote.src + ' ');
    inputRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/10 p-2">
      <div className="flex items-center gap-1.5">
        {/* Emote button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmotes((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Emotes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          {showEmotes && (
            <EmotePicker
              onSelect={handleEmoteSelect}
              onClose={() => setShowEmotes(false)}
            />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? 'Connecting...' : cooldown ? 'Slow mode...' : 'Chat...'}
          disabled={disabled || cooldown}
          maxLength={500}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-degen-500/40 focus:shadow-[0_0_8px_rgba(0,255,65,0.15)] disabled:opacity-50"
          aria-label="Chat message"
        />

        {/* Slow mode indicator */}
        {slowMode && (
          <span className="text-[9px] text-amber-400/60 font-medium" title="Slow mode enabled">
            🐢
          </span>
        )}

        <button
          type="submit"
          disabled={!value.trim() || disabled || cooldown}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500 text-black transition-all hover:bg-degen-400 disabled:opacity-30"
          aria-label="Send message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>

      {/* Commands hint */}
      {value.startsWith('/') && (
        <div className="mt-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
          <p className="text-[9px] text-white/40">
            Available commands: /slow — Toggle slow mode | /clear — Clear chat
          </p>
        </div>
      )}
    </form>
  );
}

/* === Main StreamChat Component ================================ */

interface StreamChatProps {
  streamId: string;
  maxHeight?: string;
  onSlowMode?: (v: boolean) => void;
}

export function StreamChat({ streamId, maxHeight = 'calc(100vh - 80px)', onSlowMode }: StreamChatProps) {
  const { messages, sendMessage, isConnected } = useStreamChat({ streamId });
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  }, [messages, autoScroll]);

  // Track unread when not auto-scrolling
  useEffect(() => {
    if (!autoScroll) {
      setUnreadCount((c) => c + 1);
    }
  }, [messages.length, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(isAtBottom);
    if (isAtBottom) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    setAutoScroll(true);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  }, []);

  return (
    <div className="relative flex flex-col h-full overflow-hidden rounded-xl border border-white/10 bg-gray-900/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/90">Stream Chat</span>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.5)]' : 'bg-amber-500'
            }`}
            title={isConnected ? 'Connected' : 'Simulated'}
          />
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[9px] font-medium text-degen-400">
              +{unreadCount}
            </span>
          )}
          <span className="text-[10px] tabular-nums text-white/40">
            {messages.length}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="text-xs text-white/40">No messages yet</p>
              <p className="mt-1 text-[10px] text-white/20">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              msg={msg}
              isLocal={msg.userId === 'local-user'}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInputField onSend={sendMessage} disabled={false} onSlowMode={onSlowMode} />

      {/* Scroll to bottom */}
      {!autoScroll && messages.length > 5 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-14 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-gray-800 text-white/50 shadow-lg transition-all hover:text-white"
          aria-label="Scroll to bottom"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
