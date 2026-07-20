'use client';

/**
 * @components/join/GuestChat — Guest-mode chat overlay.
 *
 * Wraps the existing StreamChat with guest identity support:
 * - Generates a temporary guest name from the source platform
 * - Persists guest identity in sessionStorage
 * - Labels messages with "Guest via [Platform]" badge
 * - Works without any authentication
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../streams/useStreamChat';
import { useStreamChat } from '../streams/useStreamChat';
import { type GuestIdentity, PLATFORM_CONFIG, type SourcePlatform } from './types';

/* ─── Constants ─────────────────────────────────────────────────── */

const STORAGE_KEY = 'df_guest_identity';

const GUEST_ADJECTIVES = [
  'Bold', 'Clever', 'Swift', 'Brave', 'Calm', 'Eager', 'Fancy', 'Grand',
  'Happy', 'Jolly', 'Keen', 'Lively', 'Mellow', 'Noble', 'Proud', 'Quick',
  'Rapid', 'Sharp', 'Sure', 'Wise',
];

const GUEST_NOUNS = [
  'Degen', 'Maxi', 'Whale', 'Shark', 'Fox', 'Owl', 'Bear', 'Wolf',
  'Lynx', 'Hawk', 'Ape', 'Bull', 'Koala', 'Panda', 'Raven',
];

/* ─── Helpers ───────────────────────────────────────────────────── */

function generateGuestName(): string {
  const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)] ?? 'Guest';
  const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)] ?? 'Degen';
  return `${adj}${noun}${Math.floor(Math.random() * 99) + 1}`;
}

function generateGuestId(): string {
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadGuestIdentity(platform: SourcePlatform, instance?: string): GuestIdentity {
  if (typeof window === 'undefined') {
    return { id: generateGuestId(), displayName: 'Guest', platform, instance };
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as GuestIdentity;
      if (parsed.platform === platform) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  const identity: GuestIdentity = {
    id: generateGuestId(),
    displayName: generateGuestName(),
    platform,
    instance,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Storage full or unavailable — proceed with ephemeral identity
  }
  return identity;
}

/* ─── Props ─────────────────────────────────────────────────────── */

interface GuestChatProps {
  streamId: string;
  sourcePlatform: SourcePlatform;
  /** Optional instance domain, e.g. "mastodon.social" */
  sourceInstance?: string;
  /** Maximum height of the chat container. */
  maxHeight?: string;
  /** If true, renders in a compact mode. */
  compact?: boolean;
}

/* ─── Message Bubble (guest-aware) ─────────────────────────────── */

function GuestMessageBubble({
  msg,
  isGuest,
  platformIcon,
}: {
  msg: ChatMessage;
  isGuest: boolean;
  platformIcon?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--color-muted)]/5 ${
        isGuest ? 'bg-[var(--color-glass-bg)]/30' : ''
      }`}
    >
      {/* Avatar */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400">
        {msg.avatarUrl ? (
          <img src={msg.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span aria-hidden="true">{msg.displayName[0]?.toUpperCase() ?? '?'}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span
            className={`truncate text-xs font-semibold ${
              isGuest ? 'text-degen-400' : 'text-[var(--color-fg)]/90'
            }`}
          >
            {msg.displayName}
          </span>

          {/* Guest badge */}
          {isGuest && platformIcon && (
            <span
              className="shrink-0 rounded px-1 py-[1px] text-[8px] font-medium leading-none"
              style={{
                backgroundColor: 'var(--color-muted)',
                color: 'var(--color-bg)',
              }}
              title={`Guest via ${msg.displayName.split('via ')[1] ?? 'external platform'}`}
            >
              Guest {platformIcon}
            </span>
          )}

          <span className="shrink-0 text-[9px] tabular-nums text-[var(--color-muted)]">
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--color-fg)]/70 break-words">
          {msg.text}
        </p>
      </div>
    </div>
  );
}

/* ─── Guest Chat Input ─────────────────────────────────────────── */

function GuestChatInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim() || disabled) return;
      onSend(value.trim());
      setValue('');
    },
    [value, onSend, disabled],
  );

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--color-glass-border)] p-2">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? 'Chat as guest...'}
          disabled={disabled}
          maxLength={500}
          className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:shadow-[0_0_8px_rgba(0,255,65,0.15)] disabled:opacity-50"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500 text-black transition-all hover:bg-degen-400 disabled:opacity-30"
          aria-label="Send message"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>

      {/* Guest notice */}
      <p className="mt-1 text-[9px] text-[var(--color-muted)]">
        Chatting as guest. Messages are public.
      </p>
    </form>
  );
}

/* ─── Main Component ───────────────────────────────────────────── */

export function GuestChat({
  streamId,
  sourcePlatform,
  sourceInstance,
  maxHeight = 'calc(100vh - 80px)',
  compact = false,
}: GuestChatProps) {
  const { messages, sendMessage, isConnected } = useStreamChat({ streamId });
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Guest identity — stable for the session
  const guest = useMemo<GuestIdentity>(
    () => loadGuestIdentity(sourcePlatform, sourceInstance),
    [sourcePlatform, sourceInstance],
  );

  const platformCfg = PLATFORM_CONFIG[sourcePlatform];

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

  const handleSend = useCallback(
    (text: string) => {
      // Send with guest identity metadata
      sendMessage(text);
      // The backend will associate this message with the guest identity
    },
    [sendMessage],
  );

  // Wrap each message with guest detection
  const guestUserId = guest.id;

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] ${
        compact ? '' : 'h-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-fg)]/90">
            {platformCfg ? `${platformCfg.icon} Guest Chat` : 'Guest Chat'}
          </span>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isConnected
                ? 'bg-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.5)]'
                : 'bg-amber-500'
            }`}
            title={isConnected ? 'Connected' : 'Offline'}
          />
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[9px] font-medium text-degen-400">
              +{unreadCount}
            </span>
          )}
          <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
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
              <p className="text-xs text-[var(--color-muted)]">No messages yet</p>
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                Be the first to say something!
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <GuestMessageBubble
              key={msg.id}
              msg={msg}
              isGuest={msg.userId === guestUserId || msg.userId.startsWith('guest-')}
              platformIcon={platformCfg?.icon}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <GuestChatInput
        onSend={handleSend}
        disabled={false}
        placeholder={
          platformCfg
            ? `Chat as ${guest.displayName}...`
            : 'Chat as guest...'
        }
      />

      {/* Scroll to bottom */}
      {!autoScroll && messages.length > 5 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-14 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-muted)] shadow-lg transition-all hover:text-[var(--color-fg)]"
          aria-label="Scroll to bottom"
        >
          <svg
            width="12"
            height="12"
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
