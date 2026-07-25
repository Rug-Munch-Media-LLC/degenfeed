'use client';

import { getProtocolColor, getProtocolIcon, getProtocolLabel, ListSkeleton } from '@degenfeed/ui';
import { useRef } from 'react';
import {
  type ConversationListItem,
  getInitials,
  getOtherParticipant,
  shortId,
  timeAgo,
} from '../../hooks/useMessages';
import { useMessagesKeyboardNav } from '../../hooks/useMessagesKeyboardNav';

/* === Props =================================================== */

export interface ConversationListProps {
  conversations: ConversationListItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  unreadTotal: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (conv: ConversationListItem) => void;
  onNewMessage: () => void;
  onRetry: () => void;
}

/* === Component =============================================== */

export function ConversationList({
  conversations,
  loading,
  error,
  selectedId,
  unreadTotal,
  searchQuery,
  onSearchChange,
  onSelect,
  onNewMessage,
  onRetry,
}: ConversationListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const convIds = conversations.map((c) => c.conversationId);

  useMessagesKeyboardNav(
    convIds,
    {
      onSelectConversation: (convId: string) => {
        const conv = conversations.find((c) => c.conversationId === convId);
        if (conv) onSelect(conv);
      },
      onCloseConversation: () => {},
    },
    true,
    listRef as React.RefObject<HTMLElement | null>,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] p-3 space-y-2">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-muted)] pointer-events-none"
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
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations\u2026"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
          />
        </div>

        <button
          type="button"
          onClick={onNewMessage}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 hover:bg-degen-500/5 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Message
        </button>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Conversations"
        aria-activedescendant={selectedId ? `conv-${selectedId}` : undefined}
        tabIndex={0}
      >
        {loading && conversations.length === 0 && (
          <div className="p-2">
            <ListSkeleton count={6} leading trailing />
          </div>
        )}

        {!loading && error && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="mb-2 text-lg opacity-40" aria-hidden="true">{'⚠\uFE0F'}</span>
            <p className="text-xs text-[var(--color-muted)] mb-3">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="mb-3 text-3xl opacity-30" aria-hidden="true">{'\u{1F4AC}'}</span>
            <p className="text-sm text-[var(--color-muted)]">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Send a message to get started. 🔒 All messages are end-to-end encrypted.
              </p>
            )}
          </div>
        )}

        {conversations.map((conv) => {
          const isSelected = conv.conversationId === selectedId;
          const protocolColor = getProtocolColor(conv.protocol);
          const protocolIcon = getProtocolIcon(conv.protocol);
          const protocolLabel = getProtocolLabel(conv.protocol);
          const other = getOtherParticipant(conv.participants);
          const initials = getInitials(other);
          const otherDisplay = shortId(other);
          const hasUnread = conv.unreadCount > 0;

          // Encryption status: E2E for Nostr, not for others
          const isE2E = conv.protocol === 'nostr';
          const lastMessageText = conv.lastMessage?.content ?? '';

          return (
            <button
              key={conv.conversationId}
              id={`conv-${conv.conversationId}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-conversation-id={conv.conversationId}
              onClick={() => onSelect(conv)}
              className={`flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-overlay)] focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-[-2px] ${
                isSelected
                  ? 'bg-[var(--color-overlay)] after:absolute after:left-0 after:top-0 after:h-full after:w-0.5 after:bg-degen-500 after:rounded-r'
                  : ''
              }`}
              style={isSelected ? { position: 'relative' } : undefined}
            >
              {/* Avatar */}
              <div className="relative shrink-0 mt-0.5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
                >
                  {initials}
                </span>
                {/* Protocol badge */}
                <span
                  className="absolute -bottom-[2px] -right-[2px] flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] border-2 border-[var(--color-bg)]"
                  style={{ backgroundColor: protocolColor }}
                  role="img"
                  title={protocolLabel}
                  aria-label={protocolLabel}
                >
                  {protocolIcon}
                </span>
                {/* E2E lock badge */}
                {isE2E && (
                  <span
                    className="absolute -top-[2px] -right-[2px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-degen-500 border border-black text-black"
                    title="End-to-end encrypted"
                    aria-label="End-to-end encrypted"
                  >
                    <svg width="6" height="6" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 7V4a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${hasUnread ? 'font-bold text-[var(--color-fg)]' : 'font-medium text-[var(--color-fg)]'}`}>
                    {otherDisplay}
                  </span>
                  {conv.lastMessage && (
                    <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                      {timeAgo(conv.lastMessage.createdAt)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  {/* E2E lock on preview */}
                  {isE2E && (
                    <svg width="6" height="6" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-degen-400">
                      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M5 7V4a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  )}
                  <span className={`line-clamp-1 text-xs ${hasUnread ? 'text-[var(--color-fg)] font-medium' : 'text-[var(--color-muted)]'}`}>
                    {lastMessageText || '\u2014'}
                  </span>
                </div>
              </div>

              {/* Unread badge */}
              {hasUnread && (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold text-black">
                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                  </span>
                </div>
              )}

              {!hasUnread && conv.lastMessage && !conv.lastMessage.read && (
                <div className="shrink-0 pt-2">
                  <span className="block h-2 w-2 rounded-full bg-degen-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {unreadTotal > 0 && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2 text-[10px] text-[var(--color-muted)] text-center">
          {unreadTotal} unread {unreadTotal === 1 ? 'message' : 'messages'}
        </div>
      )}
    </div>
  );
}
