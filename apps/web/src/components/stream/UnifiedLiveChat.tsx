'use client';

/**
 * @degenfeed/web — Unified Cross-Protocol Live Chat Component
 *
 * ONE chat component for ALL protocols. Viewers from Nostr, Farcaster,
 * Bluesky, Mastodon, Telegram, DegenFeed all appear in ONE feed with
 * protocol badges showing where each viewer is from.
 *
 * Features:
 *   - Protocol badges with colors + emoji
 *   - Auto-scrolling with "new messages" indicator
 *   - Emote picker + reactions
 *   - Slow mode, sub-only, follower-only modes
 *   - Pin messages (host only)
 *   - Moderation: delete, timeout, ban
 *   - Gift notifications
 *   - Chat search
 *   - Protocol selector input (for multi-protocol users)
 *   - Viewer count with "watching on" breakdown
 *   - Premium: custom chat colors
 *   - Chat analytics panel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ChatMode,
  type ChatProtocol,
  getProtocolBadge,
  type LiveChatMessage,
  useUnifiedChat,
} from './useUnifiedChat';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const REACTION_EMOJIS = ['❤️', '🔥', '😱', '🚀', '💀', '👏', '🐂', '🐻', '🤡', '💎'];

const ALL_EMOTES: Array<{ id: string; name: string; src: string; category: string }> = [
  { id: 'e1', name: 'degenSmile', src: '😊', category: 'faces' },
  { id: 'e2', name: 'degenFire', src: '🔥', category: 'reactions' },
  { id: 'e3', name: 'degenMoon', src: '🚀', category: 'reactions' },
  { id: 'e4', name: 'degenLUL', src: '😂', category: 'faces' },
  { id: 'e5', name: 'degenW', src: '👋', category: 'greetings' },
  { id: 'e6', name: 'degenHeart', src: '❤️', category: 'reactions' },
  { id: 'e7', name: 'degenGlad', src: '😎', category: 'faces' },
  { id: 'e8', name: 'degenRIP', src: '💀', category: 'reactions' },
  { id: 'e9', name: 'degenClap', src: '👏', category: 'reactions' },
  { id: 'e10', name: 'degenSip', src: '☕', category: 'reactions' },
  { id: 'e11', name: 'degenBull', src: '🐂', category: 'crypto' },
  { id: 'e12', name: 'degenBear', src: '🐻', category: 'crypto' },
  { id: 'e13', name: 'degenDiamond', src: '💎', category: 'crypto' },
  { id: 'e14', name: 'degenBag', src: '💰', category: 'crypto' },
  { id: 'e15', name: 'degenPE', src: '👀', category: 'faces' },
  { id: 'e16', name: 'degen100', src: '💯', category: 'reactions' },
];

const PROTOCOL_OPTIONS: Array<{ protocol: ChatProtocol; label: string }> = [
  { protocol: 'degenfeed', label: '🌀 DegenFeed' },
  { protocol: 'nostr', label: '⚡ Nostr' },
  { protocol: 'farcaster', label: '📱 Farcaster' },
  { protocol: 'bluesky', label: '☁️ Bluesky' },
  { protocol: 'mastodon', label: '🐘 Mastodon' },
  { protocol: 'telegram', label: '✈️ Telegram' },
];

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function ProtocolBadge({ protocol, size = 'sm' }: { protocol: ChatProtocol; size?: 'sm' | 'xs' }) {
  const badge = getProtocolBadge(protocol);
  if (size === 'xs') {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px]"
        style={{ backgroundColor: badge.bgColor, color: badge.color }}
        title={badge.label}
      >
        {badge.emoji}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
      style={{ backgroundColor: badge.bgColor, color: badge.color }}
      title={badge.label}
    >
      <span className="text-[10px]">{badge.emoji}</span>
      <span>{badge.shortLabel}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════════

function MessageBubble({
  msg,
  isLocal,
  isCreator,
  pinnedIds,
  onReact,
  onDelete,
  onTimeout,
  onBan,
  onPin,
  onUnpin,
}: {
  msg: LiveChatMessage;
  isLocal: boolean;
  isCreator: boolean;
  pinnedIds: string[];
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msgId: string) => void;
  onDelete: (msgId: string) => void;
  onTimeout: (userId: string) => void;
  onBan: (userId: string) => void;
  onPin: (msgId: string) => void;
  onUnpin: (msgId: string) => void;
}) {
  const isPinned = pinnedIds.includes(msg.id);
  const badge = getProtocolBadge(msg.protocol);
  const initials = msg.displayName[0]?.toUpperCase() || '?';
  const [showActions, setShowActions] = useState(false);

  if (msg.isDeleted) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 opacity-40">
        <span className="text-[9px] italic text-white/30">[message deleted]</span>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-white/5 ${
        isLocal ? 'bg-degen-500/[0.03]' : ''
      } ${msg.isHighlighted ? 'bg-yellow-500/10 ring-1 ring-yellow-500/20' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="relative mt-0.5 shrink-0">
        <div
          className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[7px] font-bold"
          style={{ backgroundColor: `${badge.color}25`, color: badge.color }}
        >
          {msg.avatarUrl ? (
            <img src={msg.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        {msg.isBridged && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[6px] ring-1 ring-gray-900"
            style={{ backgroundColor: badge.bgColor, color: badge.color }}
            title={`via ${badge.label}`}
          >
            {badge.emoji}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={`truncate text-xs font-semibold ${
              msg.chatColor ? '' : isLocal ? 'text-degen-400' : 'text-white/90'
            }`}
            style={msg.chatColor ? { color: msg.chatColor } : undefined}
          >
            {msg.displayName}
          </span>

          {/* Badges */}
          {msg.badges?.map((b) => (
            <span
              key={b}
              className="rounded px-1 py-[1px] text-[7px] font-bold uppercase leading-none"
              style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
            >
              {b}
            </span>
          ))}

          {/* Protocol badge */}
          <ProtocolBadge protocol={msg.protocol} size="xs" />

          {/* Creator badge */}
          {msg.isCreator && (
            <span className="rounded bg-degen-500/20 px-1 py-[1px] text-[7px] font-bold text-degen-400">
              HOST
            </span>
          )}

          {/* Highlighted (gift) badge */}
          {msg.isHighlighted && msg.gift && (
            <span
              className="rounded bg-yellow-500/20 px-1 py-[1px] text-[7px] font-bold text-yellow-400"
              title={`${msg.gift.amount} ${msg.gift.symbol}`}
            >
              🎁 {msg.gift.amount} {msg.gift.symbol}
            </span>
          )}

          {/* Time */}
          <span className="ml-auto shrink-0 text-[8px] tabular-nums text-white/30">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Message text */}
        <p className="text-xs leading-relaxed text-white/70 break-words">{msg.message}</p>

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(msg.id, emoji)}
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[10px] transition-colors hover:bg-white/10"
                title={users.join(', ')}
              >
                {emoji}
                <span className="text-[8px] text-white/40">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pinned indicator */}
        {isPinned && (
          <div className="mt-0.5 flex items-center gap-1 text-[8px] text-yellow-400/60">
            <span>📌</span>
            <span>Pinned by host</span>
          </div>
        )}
      </div>

      {/* Action buttons (hover) */}
      {showActions && (
        <div className="absolute right-1 top-1 z-10 flex gap-0.5 rounded-lg border border-white/10 bg-gray-800/95 p-0.5 shadow-lg backdrop-blur-sm">
          {/* React */}
          <ReactionPopover onSelect={(emoji) => onReact(msg.id, emoji)}>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="React"
            >
              <svg
                aria-hidden="true"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>
          </ReactionPopover>

          {/* Reply */}
          {/* <ActionButton icon="↩️" title="Reply" onClick={() => onReply(msg.id)} /> */}

          {isCreator && (
            <>
              {isPinned ? (
                <ActionButton icon="📌" title="Unpin" onClick={() => onUnpin(msg.id)} />
              ) : (
                <ActionButton icon="📌" title="Pin" onClick={() => onPin(msg.id)} />
              )}
              <ActionButton icon="🗑️" title="Delete" onClick={() => onDelete(msg.id)} />
              <ActionButton icon="⏱️" title="Timeout 5m" onClick={() => onTimeout(msg.userId)} />
              <ActionButton icon="🚫" title="Ban" onClick={() => onBan(msg.userId)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      title={title}
    >
      {icon}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REACTION POPOVER
// ═══════════════════════════════════════════════════════════════════════════

function ReactionPopover({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <div onClick={() => setOpen(!open)}>{children}</div>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 flex gap-0.5 rounded-lg border border-white/10 bg-gray-800 p-1 shadow-xl">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-sm hover:bg-white/10 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMOTE PICKER
// ═══════════════════════════════════════════════════════════════════════════

function EmotePicker({
  onSelect,
  onClose,
}: {
  onSelect: (src: string) => void;
  onClose: () => void;
}) {
  const categories = [...new Set(ALL_EMOTES.map((e) => e.category))];
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const filtered = ALL_EMOTES.filter((e) => e.category === activeCategory);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl z-50">
      {/* Category tabs */}
      <div className="flex gap-1 border-b border-white/10 p-2 overflow-x-auto scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-lg px-2 py-1 text-[9px] font-medium capitalize transition-colors ${
              activeCategory === cat
                ? 'bg-degen-500/20 text-degen-400'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-6 gap-1 p-2 max-h-36 overflow-y-auto">
        {filtered.map((emote) => (
          <button
            key={emote.id}
            type="button"
            onClick={() => {
              onSelect(emote.src);
              onClose();
            }}
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

// ═══════════════════════════════════════════════════════════════════════════
// CHAT MODE INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

function ChatModeIndicator({ mode }: { mode: ChatMode }) {
  if (mode === 'normal') return null;

  const config: Record<ChatMode, { label: string; color: string; icon: string }> = {
    normal: { label: '', color: '', icon: '' },
    slow: { label: 'Slow Mode', color: '#f59e0b', icon: '🐢' },
    sub_only: { label: 'Sub Only', color: '#8B5CF6', icon: '⭐' },
    follower_only: { label: 'Followers Only', color: '#3B82F6', icon: '👤' },
  };

  const info = config[mode];
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-medium"
      style={{ backgroundColor: `${info.color}15`, color: info.color }}
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsPanel({
  analytics,
  onClose,
}: {
  analytics: NonNullable<ReturnType<typeof useUnifiedChat>['analytics']>;
  onClose: () => void;
}) {
  const protocolLabels: Record<string, string> = {
    degenfeed: '🌀 DegenFeed',
    nostr: '⚡ Nostr',
    farcaster: '📱 Farcaster',
    bluesky: '☁️ Bluesky',
    mastodon: '🐘 Mastodon',
    telegram: '✈️ Telegram',
  };

  return (
    <div className="absolute left-0 right-0 top-0 bottom-0 z-30 overflow-y-auto bg-gray-900/98 backdrop-blur-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white/80">Chat Analytics</h3>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-xs">
          ✕
        </button>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="MPM" value={analytics.messagesPerMinute} />
        <MetricCard label="Total" value={analytics.totalMessages} />
        <MetricCard label="Engagement" value={`${analytics.engagementRate}%`} />
        <MetricCard label="Active Chat" value={analytics.activeChatters} />
      </div>

      {/* Sentiment */}
      <div>
        <h4 className="text-[9px] font-semibold text-white/40 uppercase mb-1">Sentiment</h4>
        <div className="flex h-2 rounded-full overflow-hidden">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${analytics.sentiment.positive}%` }}
          />
          <div
            className="bg-gray-500 transition-all"
            style={{ width: `${analytics.sentiment.neutral}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${analytics.sentiment.negative}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5 text-[8px] text-white/30">
          <span>😊 {analytics.sentiment.positive}%</span>
          <span>😐 {analytics.sentiment.neutral}%</span>
          <span>😤 {analytics.sentiment.negative}%</span>
        </div>
      </div>

      {/* Platform breakdown */}
      <div>
        <h4 className="text-[9px] font-semibold text-white/40 uppercase mb-1">
          Where viewers chat from
        </h4>
        <div className="space-y-1">
          {Object.entries(analytics.platformBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([protocol, count]) => (
              <div key={protocol} className="flex items-center justify-between">
                <span className="text-[10px] text-white/60">
                  {protocolLabels[protocol] || protocol}
                </span>
                <span className="text-[10px] font-medium text-white/80 tabular-nums">
                  {count} msgs
                </span>
              </div>
            ))}
          {Object.keys(analytics.platformBreakdown).length === 0 && (
            <span className="text-[9px] text-white/30">No data yet</span>
          )}
        </div>
      </div>

      {/* Top chatters */}
      <div>
        <h4 className="text-[9px] font-semibold text-white/40 uppercase mb-1">Top Chatters</h4>
        <div className="space-y-0.5">
          {analytics.topChatters.slice(0, 10).map((chatter, i) => (
            <div key={chatter.userId} className="flex items-center justify-between">
              <span className="text-[10px] text-white/60">
                <span className="text-white/30 mr-1">#{i + 1}</span>
                {chatter.displayName}
              </span>
              <span className="text-[10px] text-white/40 tabular-nums">{chatter.count}</span>
            </div>
          ))}
        </div>
      </div>

      {analytics.peakMpm > 0 && (
        <div className="text-[8px] text-white/30">Peak: {analytics.peakMpm} msg/min</div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
      <div className="text-sm font-bold text-white tabular-nums">{value}</div>
      <div className="text-[8px] text-white/40 uppercase">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WATCHING BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════

function WatchingBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const protocolLabels: Record<string, string> = {
    degenfeed: '🌀 DegenFeed',
    nostr: '⚡ Nostr',
    farcaster: '📱 Farcaster',
    bluesky: '☁️ Bluesky',
    mastodon: '🐘 Mastodon',
    telegram: '✈️ Telegram',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5">
      <span className="text-[8px] text-white/30 uppercase tracking-wider">Watching on:</span>
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(breakdown)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([protocol, count]) => (
            <span
              key={protocol}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[8px] font-medium"
              style={{
                backgroundColor: `${getProtocolBadge(protocol as ChatProtocol).color}15`,
                color: getProtocolBadge(protocol as ChatProtocol).color,
              }}
            >
              {protocolLabels[protocol] || protocol}
              <span className="tabular-nums">{count}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT INPUT
// ═══════════════════════════════════════════════════════════════════════════

function ChatInput({
  onSend,
  disabled,
  slowMode,
  onToggleSlowMode,
  currentProtocol,
  onProtocolChange,
}: {
  onSend: (text: string, protocol?: ChatProtocol) => void;
  disabled?: boolean;
  slowMode: boolean;
  chatMode: ChatMode;
  onToggleSlowMode: () => void;
  currentProtocol: ChatProtocol;
  onProtocolChange: (p: ChatProtocol) => void;
}) {
  const [value, setValue] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [showProtocolSelect, setShowProtocolSelect] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim() || cooldown) return;

      // Command handling
      if (value.startsWith('/')) {
        const cmd = value.slice(1).split(' ').shift()?.toLowerCase() ?? '';
        if (cmd === 'slow') {
          onToggleSlowMode();
          setValue('');
          return;
        }
        if (cmd === 'clear') {
          setValue('');
          return;
        }
      }

      onSend(value.trim(), currentProtocol);
      setValue('');

      if (slowMode) {
        setCooldown(true);
        setTimeout(() => setCooldown(false), 3000);
      }
    },
    [value, onSend, cooldown, slowMode, onToggleSlowMode, currentProtocol],
  );

  const handleEmoteSelect = useCallback((emojiSrc: string) => {
    setValue((v) => `${v}${emojiSrc}`);
    inputRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/10 p-2">
      {/* Command hints */}
      {value.startsWith('/') && (
        <div className="mb-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
          <p className="text-[8px] text-white/40">
            /slow — Toggle slow mode | /clear — Clear local chat
          </p>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* Protocol selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProtocolSelect(!showProtocolSelect)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-white/10"
            style={{ color: getProtocolBadge(currentProtocol).color }}
            title={`Sending as ${currentProtocol}`}
          >
            {getProtocolBadge(currentProtocol).emoji}
          </button>

          {showProtocolSelect && (
            <div className="absolute bottom-full left-0 mb-1 w-40 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl z-50 py-1">
              {PROTOCOL_OPTIONS.map((opt) => (
                <button
                  key={opt.protocol}
                  type="button"
                  onClick={() => {
                    onProtocolChange(opt.protocol);
                    setShowProtocolSelect(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                    currentProtocol === opt.protocol
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            disabled
              ? 'Connecting...'
              : cooldown
                ? 'Slow mode...'
                : `Chat as ${getProtocolBadge(currentProtocol).label}...`
          }
          disabled={disabled || cooldown}
          maxLength={500}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-degen-500/40 focus:shadow-[0_0_8px_rgba(0,255,65,0.15)] disabled:opacity-50"
        />

        {/* Slow mode indicator */}
        {slowMode && (
          <span className="text-[10px] text-amber-400/60" title="Slow mode enabled">
            🐢
          </span>
        )}

        {/* Emote button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmotes(!showEmotes)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Emotes"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          {showEmotes && (
            <EmotePicker onSelect={handleEmoteSelect} onClose={() => setShowEmotes(false)} />
          )}
        </div>

        {/* Send */}
        <button
          type="submit"
          disabled={!value.trim() || disabled || cooldown}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500 text-black transition-all hover:bg-degen-400 disabled:opacity-30"
          aria-label="Send"
        >
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN UNIFIED LIVE CHAT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface UnifiedLiveChatProps {
  streamId: string;
  isCreator?: boolean;
  maxHeight?: string;
  initialViewerCount?: number;
}

export function UnifiedLiveChat({
  streamId,
  isCreator = false,
  maxHeight = 'calc(100vh - 80px)',
  initialViewerCount = 0,
}: UnifiedLiveChatProps) {
  const {
    messages,
    pinnedMessageIds,
    analytics,
    isConnected,
    error,
    sendMessage,
    toggleReaction,
    deleteMessage,
    timeoutUser,
    banUser,
    pinMessage,
    unpinMessage,
    setMyProtocol,
  } = useUnifiedChat({ streamId, isCreator });

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatMode, setChatMode] = useState<ChatMode>('normal');
  const [slowMode, setSlowMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentProtocol, setCurrentProtocol] = useState<ChatProtocol>('degenfeed');
  const [viewerCount, setViewerCount] = useState(initialViewerCount);
  const [platformBreakdown, _setPlatformBreakdown] = useState<Record<string, number>>({});

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  }, [autoScroll]);

  // Track unread when not auto-scrolling
  useEffect(() => {
    if (!autoScroll && messages.length > 0) {
      // Only increment for incoming messages (not our own)
    }
  }, [autoScroll, messages.length]);

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

  // Viewer count polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/viewers/${streamId}?streamId=${streamId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.[0]) {
            setViewerCount(data.data[0].viewerCount || 0);
          }
        }
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [streamId]);

  const toggleSlowMode = useCallback(() => {
    setSlowMode((v) => {
      const next = !v;
      setChatMode(next ? 'slow' : 'normal');
      return next;
    });
  }, []);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.message.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.protocol.toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden rounded-xl border border-white/10 bg-gray-900/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/90">
            Live Chat
            {viewerCount > 0 && (
              <span className="ml-1.5 text-[9px] font-normal text-white/40">
                {viewerCount.toLocaleString()} watching
              </span>
            )}
          </span>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.5)]' : 'bg-amber-500'
            }`}
            title={isConnected ? 'Connected' : 'Polling'}
          />
          <ChatModeIndicator mode={chatMode} />
        </div>

        <div className="flex items-center gap-1">
          {/* Search toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/60 transition-colors"
            title="Search chat"
          >
            <svg
              aria-hidden="true"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Analytics toggle */}
          {isCreator && (
            <button
              type="button"
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/60 transition-colors"
              title="Chat analytics"
            >
              <svg
                aria-hidden="true"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>
          )}

          {/* Unread count */}
          {unreadCount > 0 && (
            <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[8px] font-medium text-degen-400">
              +{unreadCount}
            </span>
          )}

          <span className="text-[9px] tabular-nums text-white/30">{messages.length}</span>
        </div>
      </div>

      {/* Watching-on breakdown */}
      {Object.keys(platformBreakdown).length > 0 && (
        <WatchingBreakdown breakdown={platformBreakdown} />
      )}

      {/* Search bar */}
      {showSearch && (
        <div className="border-b border-white/10 p-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/30 focus:border-degen-500/40"
          />
        </div>
      )}

      {/* Pinned messages banner */}
      {pinnedMessageIds.length > 0 && (
        <div className="border-b border-yellow-500/20 bg-yellow-500/5 px-3 py-1">
          {pinnedMessageIds.slice(0, 1).map((pinnedId) => {
            const pinnedMsg = messages.find((m) => m.id === pinnedId);
            return pinnedMsg ? (
              <div key={pinnedId} className="flex items-center gap-1.5">
                <span className="text-[9px]">📌</span>
                <span className="truncate text-[9px] text-yellow-400/80">
                  {pinnedMsg.displayName}: {pinnedMsg.message.slice(0, 80)}
                </span>
                <button
                  type="button"
                  onClick={() => unpinMessage(pinnedId)}
                  className="ml-auto shrink-0 text-[7px] text-yellow-400/40 hover:text-yellow-400"
                >
                  ✕
                </button>
              </div>
            ) : null;
          })}
          {pinnedMessageIds.length > 1 && (
            <div className="text-[7px] text-yellow-400/40 mt-0.5">
              +{pinnedMessageIds.length - 1} more pinned
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-16">
            <div className="text-center">
              {searchQuery ? (
                <>
                  <p className="text-xs text-white/40">No messages matching</p>
                  <p className="mt-1 text-[10px] text-white/20">&ldquo;{searchQuery}&rdquo;</p>
                </>
              ) : (
                <>
                  <div className="text-2xl mb-2 opacity-40">
                    <span className="inline-flex gap-1">
                      <span>🌀</span>
                      <span>⚡</span>
                      <span>📱</span>
                      <span>☁️</span>
                      <span>🐘</span>
                      <span>✈️</span>
                    </span>
                  </div>
                  <p className="text-xs text-white/40">No messages yet</p>
                  <p className="mt-1 text-[10px] text-white/20">
                    Viewers from all platforms appear here
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* System welcome message */}
            <div className="flex items-center gap-2 px-3 py-2 opacity-50">
              <span className="text-[8px] text-white/30">🌀⚡📱☁️🐘✈️</span>
              <span className="text-[9px] text-white/40">
                Unified chat — messages from all platforms appear here
              </span>
            </div>

            {filteredMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isLocal={msg.userId === 'local-user'}
                isCreator={isCreator}
                pinnedIds={pinnedMessageIds}
                onReact={toggleReaction}
                onReply={() => {}}
                onDelete={deleteMessage}
                onTimeout={(uid) => timeoutUser(uid, 300000)}
                onBan={banUser}
                onPin={pinMessage}
                onUnpin={unpinMessage}
              />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[9px] text-amber-400/80">
          {error}
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={false}
        slowMode={slowMode}
        chatMode={chatMode}
        onToggleSlowMode={toggleSlowMode}
        currentProtocol={currentProtocol}
        onProtocolChange={(p) => {
          setCurrentProtocol(p);
          setMyProtocol(p);
        }}
      />

      {/* Scroll to bottom */}
      {!autoScroll && filteredMessages.length > 5 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-14 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-gray-800 text-white/50 shadow-lg transition-all hover:text-white"
          aria-label="Scroll to bottom"
        >
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Analytics overlay */}
      {showAnalytics && analytics && (
        <AnalyticsPanel analytics={analytics} onClose={() => setShowAnalytics(false)} />
      )}
    </div>
  );
}
