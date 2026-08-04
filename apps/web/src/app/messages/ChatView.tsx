'use client';

/**
 * Enhanced Chat View — Online status, read receipts, search, export, themes
 */

import { getProtocolColor, getProtocolLabel, ListSkeleton } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatFeatures } from '../../hooks/useChatFeatures';
import {
  type ConversationListItem,
  getInitials,
  getOtherParticipant,
  type Message,
  shortId,
} from '../../hooks/useMessages';
import { ComposeBar } from './ComposeBar';
import { MessageBubble, TypingIndicator } from './MessageBubble';

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface ChatViewProps {
  conversation: ConversationListItem;
  messages: Message[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  sendError: string | null;
  composeText: string;
  onComposeChange: (text: string) => void;
  onSend: () => void;
  onTyping: () => void;
  onBack: () => void;
  typingUsers: Set<string>;
  myIds: string[];
}

/* ─── Chat Theme Colors ─────────────────────────────────────────────── */

const CHAT_THEMES = [
  { name: 'Default', sent: 'var(--color-msg-sent)', received: 'var(--color-msg-received)' },
  { name: 'Ocean', sent: '#1e40af', received: '#1e3a5f' },
  { name: 'Forest', sent: '#166534', received: '#1a3a2a' },
  { name: 'Lavender', sent: '#6b21a8', received: '#3b1f6e' },
  { name: 'Rose', sent: '#9f1239', received: '#4a1d2e' },
  { name: 'Cyberpunk', sent: '#00ff41', received: '#0a2a1a' },
] as const;

/* ─── Encryption Badge ──────────────────────────────────────────────── */

function EncryptionBadge({ encrypted }: { encrypted: boolean }) {
  if (!encrypted) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-2">
        <span className="text-yellow-400 text-[10px]">⚠</span>
        <span className="text-[9px] text-yellow-400/80">Not encrypted</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-degen-500/8 border border-degen-500/20 mb-2">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect
          x="3"
          y="7"
          width="10"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-degen-400"
        />
        <path
          d="M5 7V4a3 3 0 016 0v3"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          className="text-degen-400"
        />
      </svg>
      <span className="text-[10px] font-medium text-degen-400">End-to-end encrypted</span>
      <span className="text-[8px] text-degen-400/50">·</span>
      <span className="text-[8px] text-degen-400/60">Signal protocol</span>
    </div>
  );
}

/* ─── Safety Numbers Modal ──────────────────────────────────────────── */

function SafetyNumbersModal({
  open,
  onClose,
  safetyNumbers,
}: {
  open: boolean;
  onClose: () => void;
  safetyNumbers: { numeric: string; shortCode: string } | null;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-[var(--color-fg)] mb-3">Verify Identity</h3>
        <p className="text-[10px] text-[var(--color-muted)] mb-4 leading-relaxed">
          Compare these numbers with your contact out-of-band. Matching numbers means your messages
          are truly end-to-end encrypted.
        </p>
        {safetyNumbers ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[8px] text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
                Safety Number
              </p>
              <p className="font-mono text-sm tracking-wider text-[var(--color-fg)] break-all leading-relaxed">
                {safetyNumbers.numeric}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2.5">
              <span className="text-[10px] text-[var(--color-muted)]">Short code</span>
              <span className="font-mono text-sm font-bold text-degen-400">
                {safetyNumbers.shortCode}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)] text-center py-4">
            Safety numbers not available.
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-[var(--color-overlay)] py-2 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-border)] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ─── Disappearing Timer ─────────────────────────────────────────────── */

const DISAPPEAR_TIMERS = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 5 },
  { label: '1 hr', value: 60 },
  { label: '24 hr', value: 1440 },
  { label: '7 days', value: 10080 },
];

function DisappearingTimerSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = DISAPPEAR_TIMERS.find((t) => t.value === value)?.label ?? 'Off';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
        title="Disappearing messages"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span>{currentLabel}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
            {DISAPPEAR_TIMERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  onChange(t.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[10px] transition-colors ${t.value === value ? 'text-degen-400 bg-degen-500/10' : 'text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Online Status Dot ──────────────────────────────────────────────── */

function OnlineStatusDot({ status }: { status: 'online' | 'away' | 'offline' }) {
  const colors = {
    online: 'bg-degen-500',
    away: 'bg-amber-400',
    offline: 'bg-[var(--color-muted)]',
  };
  const label = { online: 'Online', away: 'Away', offline: 'Offline' };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status]}`}
      role="status"
      aria-label={label[status]}
      title={label[status]}
    />
  );
}

/* ─── Message Search ─────────────────────────────────────────────────── */

function MessageSearch({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ id: string; content: string; fromId: string; createdAt: number }>
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/messages/search?q=${encodeURIComponent(query)}&conversationId=${encodeURIComponent(conversationId)}`,
        );
        const data = (await res.json()) as { results: typeof results };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, conversationId]);

  return (
    <div className="absolute left-0 right-0 top-full z-50 mx-3 mt-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-[var(--color-border)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-[var(--color-muted)] shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ESC
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {searching && (
          <p className="text-[10px] text-[var(--color-muted)] text-center py-4">Searching...</p>
        )}
        {results.length === 0 && query && !searching && (
          <p className="text-[10px] text-[var(--color-muted)] text-center py-4">No results</p>
        )}
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            className="w-full px-3 py-2 text-left hover:bg-[var(--color-overlay)] transition-colors border-b border-[var(--color-border)] last:border-0"
          >
            <p className="text-[10px] text-[var(--color-muted)]">
              {shortId(r.fromId)} · {new Date(r.createdAt).toLocaleString()}
            </p>
            <p className="text-xs text-[var(--color-fg)] truncate">{r.content}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Chat Theme Selector ────────────────────────────────────────────── */

function ChatThemeSelector({
  current,
  onChange,
}: {
  current: string;
  onChange: (theme: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg px-1.5 py-1 text-[9px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
        title="Chat theme"
      >
        🎨
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg">
            {CHAT_THEMES.map((theme) => (
              <button
                key={theme.name}
                type="button"
                onClick={() => {
                  onChange(theme.name);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors ${current === theme.name ? 'text-degen-400 bg-degen-500/10' : 'text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'}`}
              >
                <span className="flex gap-0.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.sent }} />
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: theme.received }}
                  />
                </span>
                {theme.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

export function ChatView({
  conversation,
  messages,
  loading,
  error,
  sending,
  sendError,
  composeText,
  onComposeChange,
  onSend,
  onTyping,
  onBack,
  typingUsers,
  myIds,
}: ChatViewProps) {
  const msgEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const other = useMemo(
    () => getOtherParticipant(conversation.participants),
    [conversation.participants],
  );
  const protocolColor = getProtocolColor(conversation.protocol);
  const initials = useMemo(() => getInitials(other), [other]);
  const otherShort = useMemo(() => shortId(other), [other]);

  // Encryption state
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyNumbersCache, setSafetyNumbersCache] = useState<
    Record<string, { numeric: string; shortCode: string }>
  >({});
  const [disappearingTimer, setDisappearingTimer] = useState(0);
  const [encryptionStatus, setEncryptionStatus] = useState<'loading' | 'enabled' | 'disabled'>(
    'loading',
  );
  const [onlineStatus, setOnlineStatus] = useState<'online' | 'away' | 'offline'>('offline');
  const [showSearch, setShowSearch] = useState(false);
  const [chatTheme, setChatTheme] = useState('Default');

  // Rich features
  const convId = conversation?.conversationId;
  const { toggleReaction, editMessage, deleteMessage, pinMessage } = useChatFeatures(convId);

  // Online status polling (simulated — would use WebSocket in production)
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/identity/profile?wallet=${encodeURIComponent(other)}`);
        if (res.ok) {
          const data = (await res.json()) as { online?: boolean; lastSeen?: number };
          if (data.online) setOnlineStatus('online');
          else if (data.lastSeen && Date.now() - data.lastSeen < 300000) setOnlineStatus('away');
          else setOnlineStatus('offline');
        }
      } catch {
        setOnlineStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [other]);

  // Fetch safety numbers
  const fetchSafetyNumbers = useCallback(async () => {
    if (!other || conversation.protocol !== 'nostr') {
      setEncryptionStatus('disabled');
      return;
    }
    try {
      const res = await fetch('/api/messages/keys/safety-numbers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ peerId: other }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          safetyNumbers: { numeric: string; shortCode: string };
        };
        if (data.safetyNumbers) {
          setSafetyNumbersCache((prev) => ({ ...prev, [other]: data.safetyNumbers }));
          setEncryptionStatus('enabled');
        }
      }
    } catch {
      /* best-effort */
    }
  }, [other, conversation.protocol]);

  useEffect(() => {
    if (other) fetchSafetyNumbers();
  }, [other, fetchSafetyNumbers]);

  // Auto-scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottom || messages.length === 0) {
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const isTyping = typingUsers.size > 0;
  const isEncrypted = encryptionStatus === 'enabled' || conversation.protocol === 'nostr';

  // Chat export
  const handleExport = useCallback(async () => {
    const jsonStr = JSON.stringify({ conversation: conversation, messages }, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${otherShort}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversation, messages, otherShort]);

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={
        {
          '--color-msg-sent':
            CHAT_THEMES.find((t) => t.name === chatTheme)?.sent ?? 'var(--color-msg-sent)',
          '--color-msg-received':
            CHAT_THEMES.find((t) => t.name === chatTheme)?.received ?? 'var(--color-msg-received)',
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-2.5 shrink-0 relative">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] sm:hidden transition-colors"
          aria-label="Back to conversations"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
          </svg>
        </button>

        {/* Avatar + online status */}
        <div className="relative shrink-0">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
            aria-hidden="true"
          >
            {initials}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5">
            <OnlineStatusDot status={onlineStatus} />
          </span>
        </div>

        {/* Name + status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-fg)] truncate">{otherShort}</p>
            <OnlineStatusDot status={onlineStatus} />
          </div>
          <p className="text-[10px] text-[var(--color-muted)] flex items-center gap-1">
            <span>via {getProtocolLabel(conversation.protocol)}</span>
            {isEncrypted && (
              <span
                className="inline-flex items-center gap-0.5 text-degen-400"
                title="End-to-end encrypted"
              >
                <span>·</span>
                <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect
                    x="3"
                    y="7"
                    width="10"
                    height="7"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M5 7V4a3 3 0 016 0v3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[9px]">E2EE</span>
              </span>
            )}
          </p>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-0.5">
          <DisappearingTimerSelector value={disappearingTimer} onChange={setDisappearingTimer} />

          {/* Search */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`rounded-lg px-1.5 py-1 text-[9px] transition-colors ${showSearch ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
            title="Search messages"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Chat theme */}
          <ChatThemeSelector current={chatTheme} onChange={setChatTheme} />

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg px-1.5 py-1 text-[9px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
            title="Export chat"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Verify identity */}
          {isEncrypted && (
            <button
              type="button"
              onClick={() => setShowSafetyModal(true)}
              className="rounded-lg px-1.5 py-1 text-[9px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-degen-400 transition-colors flex items-center gap-1"
              title="Verify identity"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 1l2.5 2.5L13 3l.5 2.5L16 8l-2.5 2.5L13 13l-2.5-.5L8 15l-2.5-2.5L3 13l-.5-2.5L0 8l2.5-2.5L3 3l2.5.5L8 1z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
                <path
                  d="M6 8l1.5 1.5L10 6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Search overlay */}
        {showSearch && conversation && (
          <MessageSearch
            conversationId={conversation.conversationId}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scroll-smooth"
        role="log"
        aria-label={`Messages with ${otherShort}`}
        aria-live="polite"
      >
        <div className="px-1 py-1">
          <EncryptionBadge encrypted={isEncrypted} />
        </div>

        {loading && (
          <div className="py-4">
            <ListSkeleton count={4} leading={false} />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="mb-2 text-lg opacity-40" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-sm text-[var(--color-muted)] mb-3">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="mb-3 text-3xl opacity-30" aria-hidden="true">
              💬
            </span>
            <p className="text-sm text-[var(--color-muted)]">No messages yet</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Send the first message to start the conversation.
            </p>
          </div>
        )}

        {!loading &&
          messages.map((msg) => {
            const isMe = myIds.some((id) => id && msg.fromId === id);
            return (
              <MessageBubble
                key={msg.id}
                content={msg.content}
                fromId={msg.fromId}
                protocol={msg.protocol}
                createdAt={msg.createdAt}
                encrypted={msg.encrypted || isEncrypted}
                isMe={isMe}
                deliveryStatus={
                  (
                    msg as {
                      deliveryStatus?: Array<{
                        protocol: string;
                        ok: boolean;
                        nativeId?: string;
                        error?: string;
                      }>;
                    }
                  ).deliveryStatus
                }
                disappearingTimer={disappearingTimer}
                onReact={(emoji) => toggleReaction(msg.id, emoji)}
                onEdit={(newContent) => editMessage(msg.id, newContent)}
                onDelete={(forEveryone) => deleteMessage(msg.id, forEveryone)}
                onPin={() => pinMessage(msg.id, true)}
              />
            );
          })}

        {isTyping && <TypingIndicator />}
        <div ref={msgEndRef} className="h-px" />
      </div>

      {/* Compose bar */}
      <ComposeBar
        value={composeText}
        onChange={onComposeChange}
        onSend={onSend}
        sending={sending}
        sendError={sendError}
        protocol={conversation.protocol}
        onTyping={onTyping}
        encrypted={isEncrypted}
      />

      {/* Safety numbers modal */}
      <SafetyNumbersModal
        open={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        safetyNumbers={safetyNumbersCache[other] ?? null}
      />
    </div>
  );
}
