'use client';

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import { formatMessageTime } from '../../hooks/useMessages';

/* ─── Props ─────────────────────────────────────────────────── */

export interface MessageBubbleProps {
  content: string;
  fromId: string;
  protocol: string;
  createdAt: number;
  encrypted: boolean;
  isMe: boolean;
  /** Pass user label (shortId) for the other side on 1st message of a group */
  showSender?: boolean;
}

/* ─── Component ─────────────────────────────────────────────── */

export function MessageBubble({
  content,
  protocol,
  createdAt,
  encrypted,
  isMe,
}: MessageBubbleProps) {
  const protocolColor = getProtocolColor(protocol);
  const protocolIcon = getProtocolIcon(protocol);
  const protocolLabel = getProtocolLabel(protocol);

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-message-enter`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 ${
          isMe
            ? 'bg-[var(--color-msg-sent)] text-[var(--color-fg)] rounded-br-md'
            : 'bg-[var(--color-msg-received)] text-[var(--color-fg)] rounded-bl-md'
        }`}
      >
        {/* Message text */}
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>

        {/* Footer: time + protocol + lock */}
        <div
          className={`flex items-center gap-1.5 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
        >
          {/* Encrypted indicator */}
          {encrypted && (
            <span className="inline-flex items-center text-[9px] opacity-60" role="img" aria-label="Encrypted">
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
            </span>
          )}

          {/* Protocol icon */}
          <span
            className="text-[10px] leading-none"
            style={{ color: protocolColor }}
            role="img"
            title={protocolLabel}
            aria-label={`via ${protocolLabel}`}
          >
            {protocolIcon}
          </span>

          {/* Timestamp */}
          <time
            className="text-[9px] text-[var(--color-muted)]"
            dateTime={new Date(createdAt).toISOString()}
            title={new Date(createdAt).toLocaleString()}
          >
            {formatMessageTime(createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}

/* ─── Typing Indicator ──────────────────────────────────────── */

export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-message-enter">
      <div className="bg-[var(--color-msg-received)] rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1" role="status" aria-label="Someone is typing">
          <span
            className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] animate-typing-dot"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] animate-typing-dot"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] animate-typing-dot"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
