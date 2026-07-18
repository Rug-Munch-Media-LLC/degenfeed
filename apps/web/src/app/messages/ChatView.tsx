'use client';

import { getProtocolColor, getProtocolLabel, ListSkeleton } from '@degenfeed/ui';
import { useEffect, useMemo, useRef } from 'react';
import {
  type ConversationListItem,
  getInitials,
  getOtherParticipant,
  type Message,
  shortId,
} from '../../hooks/useMessages';
import { ComposeBar } from './ComposeBar';
import { MessageBubble, TypingIndicator } from './MessageBubble';

/* ─── Props ─────────────────────────────────────────────────── */

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

/* ─── Component ─────────────────────────────────────────────── */

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Only auto-scroll if user is near the bottom
    const threshold = 100;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottom || messages.length === 0) {
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const isTyping = typingUsers.size > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-2.5 shrink-0">
        {/* Back button (mobile) */}
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
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${protocolColor}18`,
            color: protocolColor,
          }}
          aria-hidden="true"
        >
          {initials}
        </span>

        {/* Name + protocol */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-fg)] truncate">{otherShort}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            via {getProtocolLabel(conversation.protocol)}
            {conversation.protocol === 'nostr' && (
              <span className="ml-1.5 opacity-60" title="End-to-end encrypted">
                {'\u2022'} E2E
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scroll-smooth"
        role="log"
        aria-label={`Messages with ${otherShort}`}
        aria-live="polite"
      >
        {/* Loading state */}
        {loading && (
          <div className="py-4">
            <ListSkeleton count={4} leading={false} />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="mb-2 text-lg opacity-40" aria-hidden="true">
              {'⚠\uFE0F'}
            </span>
            <p className="text-sm text-[var(--color-muted)] mb-3">{error}</p>
            <button
              type="button"
              onClick={() => {
                /* refetch handled by parent */
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="mb-3 text-3xl opacity-30" aria-hidden="true">
              {'\u{1F4AC}'}
            </span>
            <p className="text-sm text-[var(--color-muted)]">No messages yet</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Send a message to start the conversation.
            </p>
          </div>
        )}

        {/* Messages list */}
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
                encrypted={msg.encrypted}
                isMe={isMe}
              />
            );
          })}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={msgEndRef} className="h-px" />
      </div>

      {/* ── Compose bar ─────────────────────────────────────── */}
      <ComposeBar
        value={composeText}
        onChange={onComposeChange}
        onSend={onSend}
        sending={sending}
        sendError={sendError}
        protocol={conversation.protocol}
        onTyping={onTyping}
      />
    </div>
  );
}
