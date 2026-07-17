'use client';

/**
 * @degenfeed/ui — LiveReactionOverlay
 *
 * TikTok/YouTube Live-style reaction overlay for PeerTube live streams.
 * Floating emoji reactions, real-time chat feed, and tip explosions.
 *
 * ─── SUBCOMPONENTS ───────────────────────────────────────────────────
 * - LiveReactionOverlay    Full-screen overlay on top of the video
 * - FloatingEmoji          Single animated emoji that floats up + fades
 * - LiveChatFeed           Scrolling chat messages (right sidebar)
 * - TipExplosion           Animated full-screen tip alert (+ particles)
 * - QuickReactionBar       5 emoji buttons at bottom center
 * - ViewerCounter          Live viewer count badge
 *
 * ─── REAL-TIME INTEGRATION ──────────────────────────────────────────
 * Uses @degenfeed/realtime WebSocket for live chat (`space:update`)
 * and tip alerts (`tip:received`). Falls back to polling if WebSocket
 * is unavailable.
 */

import { CHANNELS, useRealtime } from '@degenfeed/realtime';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  username: string;
  avatarUrl?: string;
  text: string;
  timestamp: number;
  /** Protocol identifier for cross-protocol badge */
  protocol?: string;
  /** If this is a tip alert, the USD amount */
  tipAmount?: number;
  /** Whether this message is from the current user */
  isOwn?: boolean;
}

export interface LiveReactionOverlayProps {
  /** Unique identifier for the live room (video UUID) */
  roomId: string;
  /** Video title shown in the overlay header */
  title?: string;
  /** Creator/channel display name */
  creatorName?: string;
  /** Current viewer count (can be updated externally) */
  viewerCount?: number;
  /** Current user's display name (for marking own messages) */
  currentUserName?: string;
  /** Current user's avatar URL */
  currentUserAvatarUrl?: string;
  /** If true, renders the overlay in visible state */
  isActive?: boolean;
  /** Additional class name */
  className?: string;
  /** Callback when reaction emoji is sent */
  onReaction?: (emoji: string) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['😂', '❤️', '🔥', '🚀', '💎'] as const;

const MAX_FLOATING_EMOJIS = 20;
const FLOAT_DURATION_MS = 3200;
const CHAT_MAX_VISIBLE = 100;
const VIEWER_POLL_INTERVAL = 15000;

// ─── Emoji animations ─────────────────────────────────────────────────────

interface FloatingEmojiData {
  id: string;
  emoji: string;
  left: number; // percentage
  fontSize: number; // px
  drift: number; // random horizontal offset keyframe
  createdAt: number;
}

// ─── FloatingEmoji subcomponent ──────────────────────────────────────────

const FloatingEmoji = memo(function FloatingEmoji({
  emoji,
  left,
  fontSize,
  drift,
  onDone,
}: {
  emoji: string;
  left: number;
  fontSize: number;
  drift: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, FLOAT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <span
      className="pointer-events-none absolute z-20 select-none"
      style={
        {
          left: `${left}%`,
          bottom: '60px',
          fontSize: `${fontSize}px`,
          animation: `rmi-float-up ${FLOAT_DURATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
          '--rmi-drift': `${drift}px`,
          willChange: 'transform, opacity',
          transform: 'translateZ(0)',
          filter: 'drop-shadow(0 0 6px rgba(0, 255, 65, 0.3))',
        } as React.CSSProperties & Record<string, string | number>
      }
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
});

// ─── TipExplosion subcomponent ───────────────────────────────────────────

interface TipExplosionData {
  id: string;
  amount: number;
  username: string;
  createdAt: number;
}

function Particle({ index, color }: { index: number; color: string }) {
  const angle = (index / 12) * 360;
  const distance = 60 + Math.random() * 80;
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
      style={
        {
          backgroundColor: color,
          animation: `rmi-particle 1200ms ease-out forwards`,
          '--rmi-tx': `${Math.cos((angle * Math.PI) / 180) * distance}px`,
          '--rmi-ty': `${Math.sin((angle * Math.PI) / 180) * distance}px`,
          animationDelay: `${index * 30}ms`,
          willChange: 'transform, opacity',
        } as React.CSSProperties & Record<string, string | number>
      }
      aria-hidden="true"
    />
  );
}

const TipExplosion = memo(function TipExplosion({
  amount,
  username,
  onDone,
}: {
  amount: number;
  username: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const isBigTip = amount >= 50;
  const colors = ['#00ff41', '#ff6b35', '#ffd700', '#ff3bf0', '#00d4ff'];

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center ${
        isBigTip
          ? 'animate-in fade-in zoom-in-150 duration-500'
          : 'animate-in fade-in zoom-in duration-300'
      }`}
      aria-live="polite"
      role="status"
    >
      {/* Backdrop glow */}
      <div
        className={`absolute inset-0 ${
          isBigTip
            ? 'bg-gradient-to-br from-amber-500/20 via-red-500/10 to-yellow-500/20'
            : 'bg-gradient-to-br from-degen-500/10 to-transparent'
        }`}
        style={{
          maskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
        }}
      />

      {/* Particles for big tips */}
      {isBigTip &&
        Array.from({ length: 12 }).map((_, i) => (
          <Particle
            // biome-ignore lint/suspicious/noArrayIndexKey: static 12-element list, never reorders
            key={`particle-${i}`}
            index={i}
            color={colors[i % colors.length] ?? '#00ff41'}
          />
        ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        {/* Amount */}
        <div
          className={`font-black tracking-tight ${
            isBigTip
              ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-red-400 bg-clip-text text-transparent text-6xl sm:text-7xl'
              : 'text-degen-400 text-5xl sm:text-6xl'
          }`}
          style={{
            textShadow: isBigTip
              ? '0 0 40px rgba(255, 215, 0, 0.5), 0 0 80px rgba(255, 215, 0, 0.2)'
              : '0 0 30px rgba(0, 255, 65, 0.4)',
          }}
        >
          ${amount.toFixed(0)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-sm font-semibold text-white/90 drop-shadow-lg">{username}</span>
          {isBigTip && <span className="text-xl">🔥</span>}
        </div>
        {isBigTip && (
          <span className="mt-1 rounded-full bg-gradient-to-r from-amber-500/30 to-red-500/30 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
            Super Tip!
          </span>
        )}
      </div>
    </div>
  );
});

// ─── LiveChatFeed subcomponent ───────────────────────────────────────────

export interface LiveChatFeedProps {
  messages: ChatMessage[];
  maxVisible?: number;
}

/**
 * Scrolling chat feed sidebar. Messages auto-scroll to bottom.
 * New messages slide in from the right. Tip messages are highlighted.
 * Max 100 visible messages (oldest trimmed).
 */
export const LiveChatFeed = memo(function LiveChatFeed({
  messages,
  maxVisible = CHAT_MAX_VISIBLE,
}: LiveChatFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  }, []);

  const visible = messages.slice(-maxVisible);

  if (visible.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-center text-[11px] text-gray-500">
          No messages yet.
          <br />
          <span className="text-degen-400">Be the first to chat!</span>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-3 py-2"
      onScroll={handleScroll}
      role="log"
      aria-label="Live chat messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="space-y-1.5">
        {visible.map((msg) => (
          <div
            key={msg.id}
            className={`animate-in slide-in-from-right-2 fade-in duration-200 rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.tipAmount
                ? msg.tipAmount >= 50
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30'
                  : 'bg-degen-500/10 border border-degen-500/20'
                : msg.isOwn
                  ? 'bg-degen-500/8 border border-degen-500/15'
                  : 'bg-white/5 hover:bg-white/[0.07]'
            }`}
          >
            {/* Header row */}
            <div className="mb-0.5 flex items-center gap-1.5">
              {/* Avatar */}
              {msg.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: chat avatar URLs are dynamic user-provided
                <img
                  src={msg.avatarUrl}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-muted)] text-[7px] font-bold text-gray-500">
                  {msg.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              {/* Username */}
              <span
                className={`text-[10px] font-semibold ${
                  msg.isOwn ? 'text-degen-400' : 'text-white/80'
                }`}
              >
                {msg.username}
              </span>
              {/* Protocol badge */}
              {msg.protocol && (
                <span className="rounded-full bg-purple-900/30 px-1.5 py-0.5 text-[8px] font-medium text-purple-400">
                  {msg.protocol}
                </span>
              )}
              {/* Timestamp */}
              <span className="ml-auto text-[8px] text-gray-600">
                {formatChatTime(msg.timestamp)}
              </span>
            </div>
            {/* Message text */}
            <p className="text-white/70 break-words">{msg.text}</p>
            {/* Tip amount highlight */}
            {msg.tipAmount && (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[10px]">⚡</span>
                <span
                  className={`text-[10px] font-bold ${
                    msg.tipAmount >= 50 ? 'text-yellow-400' : 'text-degen-400'
                  }`}
                >
                  {msg.tipAmount >= 50 && 'SUPER TIP — '}${msg.tipAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {/* "New messages" indicator when auto-scroll is off */}
      {!autoScroll && messages.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="sticky bottom-2 left-1/2 -translate-x-1/2 mt-1 rounded-full bg-degen-500/20 px-3 py-1 text-[10px] font-medium text-degen-400 backdrop-blur-sm hover:bg-degen-500/30 transition-colors"
        >
          New messages ↓
        </button>
      )}
    </div>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Main component ───────────────────────────────────────────────────────

export function LiveReactionOverlay({
  roomId,
  title,
  creatorName: _creatorName,
  viewerCount: externalViewerCount,
  currentUserName,
  currentUserAvatarUrl,
  isActive = true,
  className = '',
  onReaction,
}: LiveReactionOverlayProps) {
  // ── State ──
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmojiData[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [tipExplosions, setTipExplosions] = useState<TipExplosionData[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [viewerCount, setViewerCount] = useState(externalViewerCount ?? 0);
  const [showChat, setShowChat] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Real-time WebSocket ──
  const { connected, subscribe, send } = useRealtime();

  // Subscribe to space:update (chat messages)
  useEffect(() => {
    if (!isActive || !roomId) return;

    const unsub = subscribe(`${CHANNELS.SPACE_UPDATE}:${roomId}`, (data: unknown) => {
      const payload = data as {
        type?: string;
        message?: ChatMessage;
        viewerCount?: number;
      };

      if (payload.type === 'chat' && payload.message) {
        const msg = payload.message;
        setChatMessages((prev) => [...prev.slice(-CHAT_MAX_VISIBLE + 1), msg]);
      }

      if (payload.viewerCount != null) {
        setViewerCount(payload.viewerCount);
      }
    });

    return unsub;
  }, [isActive, roomId, subscribe]);

  // Subscribe to tip:received (tip explosions)
  useEffect(() => {
    if (!isActive || !roomId) return;

    const unsub = subscribe(`${CHANNELS.TIP_RECEIVED}:${roomId}`, (data: unknown) => {
      const payload = data as {
        amount: number;
        username?: string;
        message?: string;
      };

      const amount = payload.amount ?? 0;
      const username = payload.username ?? 'Anonymous';

      // Add tip explosion animation
      setTipExplosions((prev) =>
        [...prev, { id: generateId(), amount, username, createdAt: Date.now() }].slice(-3),
      );

      // Also add as chat message
      const tipMsg: ChatMessage = {
        id: generateId(),
        username,
        text: payload.message ?? 'Sent a tip!',
        timestamp: Date.now(),
        tipAmount: amount,
      };
      setChatMessages((prev) => [...prev.slice(-CHAT_MAX_VISIBLE + 1), tipMsg]);
    });

    return unsub;
  }, [isActive, roomId, subscribe]);

  // ── Poll viewer count as fallback ──
  useEffect(() => {
    if (!isActive || !roomId || externalViewerCount != null) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/peertube/live/stats?videoId=${encodeURIComponent(roomId)}`);
        if (res.ok) {
          const data = (await res.json()) as { viewers: number };
          setViewerCount(data.viewers);
        }
      } catch {
        // silent
      }
    };
    void poll();
    const interval = setInterval(poll, VIEWER_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isActive, roomId, externalViewerCount]);

  // Update external viewer count when prop changes
  useEffect(() => {
    if (externalViewerCount != null) {
      setViewerCount(externalViewerCount);
    }
  }, [externalViewerCount]);

  // ── Send emoji reaction ──
  const sendReaction = useCallback(
    (emoji: string) => {
      // Add to floating emojis
      const floatEmoji: FloatingEmojiData = {
        id: generateId(),
        emoji,
        left: 10 + Math.random() * 75,
        fontSize: 22 + Math.random() * 24,
        drift: (Math.random() - 0.5) * 60,
        createdAt: Date.now(),
      };

      setFloatingEmojis((prev) => {
        const next = [...prev, floatEmoji];
        if (next.length > MAX_FLOATING_EMOJIS) {
          return next.slice(next.length - MAX_FLOATING_EMOJIS);
        }
        return next;
      });

      // Send via WebSocket
      send('reaction', { roomId, emoji });

      // Callback
      onReaction?.(emoji);
    },
    [roomId, send, onReaction],
  );

  // ── Remove floating emoji by ID ──
  const removeFloatingEmoji = useCallback((id: string) => {
    setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── Remove tip explosion by ID ──
  const removeTipExplosion = useCallback((id: string) => {
    setTipExplosions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── Send chat message ──
  const handleSendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;

    const msg: ChatMessage = {
      id: generateId(),
      username: currentUserName ?? 'Anonymous',
      avatarUrl: currentUserAvatarUrl,
      text,
      timestamp: Date.now(),
      isOwn: true,
    };

    setChatMessages((prev) => [...prev.slice(-CHAT_MAX_VISIBLE + 1), msg]);

    send('chat', { roomId, message: msg });

    setChatInput('');
  }, [chatInput, currentUserName, currentUserAvatarUrl, roomId, send]);

  // ── Keyboard handler for chat input ──
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChat();
      }
    },
    [handleSendChat],
  );

  // ── Render ──

  if (!isActive) return null;

  return (
    <section
      aria-label="Live stream reactions overlay"
      className={`pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl ${className}`}
    >
      {/* ───────── Floating emojis layer ───────── */}
      {floatingEmojis.map((fe) => (
        <FloatingEmoji
          key={fe.id}
          emoji={fe.emoji}
          left={fe.left}
          fontSize={fe.fontSize}
          drift={fe.drift}
          onDone={() => removeFloatingEmoji(fe.id)}
        />
      ))}

      {/* ───────── Tip explosions ───────── */}
      {tipExplosions.map((te) => (
        <TipExplosion
          key={te.id}
          amount={te.amount}
          username={te.username}
          onDone={() => removeTipExplosion(te.id)}
        />
      ))}

      {/* ───────── Gradient overlays (visual depth) ───────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />

      {/* ───────── Top bar: title + viewer count ───────── */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 flex items-center gap-2 px-3 py-2">
        {/* Live badge */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </span>

        {/* Title */}
        {title && (
          <span className="truncate text-xs font-semibold text-white/90 drop-shadow-lg">
            {title}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Viewer count */}
        {viewerCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-white/60"
            >
              <path
                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {viewerCount}
          </span>
        )}

        {/* Connection status */}
        <span
          role="status"
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            connected ? 'bg-degen-500' : 'bg-yellow-500'
          }`}
          title={connected ? 'Connected' : 'Reconnecting...'}
          aria-label={connected ? 'Real-time connected' : 'Real-time reconnecting'}
        />
      </div>

      {/* ───────── Chat feed (right side) ───────── */}
      {showChat && (
        <div className="pointer-events-auto absolute bottom-20 right-2 top-12 w-72 max-w-[calc(100vw-4rem)] rounded-xl border border-white/10 bg-black/30 backdrop-blur-md">
          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-[11px] font-semibold text-white/70">Live Chat</span>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <LiveChatFeed messages={chatMessages} />

          {/* Chat input */}
          <div className="border-t border-white/10 p-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Say something..."
                maxLength={280}
                className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:bg-white/15 focus:ring-1 focus:ring-degen-400/50 transition-all"
                aria-label="Chat message"
              />
              <button
                type="button"
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-degen-500/20 text-degen-400 hover:bg-degen-500/30 disabled:opacity-30 transition-all"
                aria-label="Send message"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Quick reaction bar (bottom center) ───────── */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md shadow-lg">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all hover:scale-125 hover:bg-white/10 active:scale-90 focus:outline-none focus:ring-2 focus:ring-degen-400/50"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {/* Toggle chat button */}
          <div className="ml-1 h-6 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-all hover:bg-white/10 hover:text-white/90"
            aria-label={showChat ? 'Hide chat' : 'Show chat'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ────── Injected keyframes ────── */}
      <style>{`
        /* Emoji float-up animation */
        @keyframes rmi-float-up {
          0% {
            transform: translateY(0) translateX(0) scale(0.4);
            opacity: 0;
          }
          15% {
            transform: translateY(-10px) translateX(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateY(-45vh) translateX(var(--rmi-drift, 20px)) scale(1.15);
            opacity: 0.85;
          }
          100% {
            transform: translateY(-85vh) translateX(calc(var(--rmi-drift, 20px) * 0.5)) scale(0.7);
            opacity: 0;
          }
        }

        /* Particle burst for large tips */
        @keyframes rmi-particle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--rmi-tx, 50px), var(--rmi-ty, -80px)) scale(0);
            opacity: 0;
          }
        }

        /* Thin scrollbar for chat */
        .scrollbar-thin::-webkit-scrollbar {
          width: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </section>
  );
}
