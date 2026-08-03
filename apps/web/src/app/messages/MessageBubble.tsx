'use client';

/**
 * Enhanced Message Bubble — Reactions, Replies, Editing, Deletion
 */

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import { useCallback, useRef, useState } from 'react';
import { type DeliveryBadge, formatMessageTime } from '../../hooks/useMessages';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  me: boolean;
}

export interface EnrichedMessage {
  id: string;
  conversationId?: string;
  fromId: string;
  toId?: string;
  protocol: string;
  content: string;
  createdAt: number;
  read: boolean;
  encrypted: boolean;
  nativeId?: string;
  deliveryStatus?: DeliveryBadge[];
  /** Reply to message ID */
  replyTo?: {
    id: string;
    content: string;
    fromId: string;
  };
  /** Reactions on this message */
  reactions?: MessageReaction[];
  /** Whether this message has been edited */
  edited?: boolean;
  /** Edited timestamp */
  editedAt?: number;
  /** Whether this message is pinned */
  pinned?: boolean;
  /** File attachments */
  attachments?: Array<{
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    name: string;
    size?: number;
  }>;
  /** Voice message data (base64 audio) */
  voiceMessage?: {
    duration: number;
    waveform?: number[];
    blob?: string;
  };
}

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface MessageBubbleProps {
  content: string;
  fromId: string;
  protocol: string;
  createdAt: number;
  encrypted: boolean;
  isMe: boolean;
  deliveryStatus?: DeliveryBadge[];
  showSender?: boolean;
  disappearingTimer?: number;
  /** Rich features */
  replyTo?: EnrichedMessage['replyTo'];
  reactions?: MessageReaction[];
  edited?: boolean;
  pinned?: boolean;
  attachments?: EnrichedMessage['attachments'];
  voiceMessage?: EnrichedMessage['voiceMessage'];
  /** Actions */
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onEdit?: (newContent: string) => void;
  onDelete?: (forEveryone: boolean) => void;
  onPin?: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function ProtocolBadge({ protocol, ok }: { protocol: string; ok: boolean }) {
  const color = ok ? getProtocolColor(protocol) : '#ef4444';
  const icon = getProtocolIcon(protocol);
  const label = getProtocolLabel(protocol);
  const title = ok ? `Delivered via ${label}` : `${label} failed`;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[8px] border border-[var(--color-border)]"
      style={{
        width: '14px',
        height: '14px',
        backgroundColor: ok ? `${color}30` : '#ef444420',
        color: ok ? color : '#ef4444',
      }}
      role="img"
      title={title}
      aria-label={title}
    >
      {icon}
    </span>
  );
}

function DeliveryBadges({ statuses }: { statuses: DeliveryBadge[] }) {
  if (!statuses || statuses.length === 0) return null;
  const delivered = statuses.filter((s) => s.ok);
  const failed = statuses.filter((s) => !s.ok);

  return (
    <div className="flex items-center gap-0.5" role="list" aria-label="Delivery status">
      {delivered.length > 0 && (
        <span className="text-[8px] text-[var(--color-muted)] mr-0.5">✓</span>
      )}
      {delivered.map((s) => (
        <ProtocolBadge key={`ok-${s.protocol}`} protocol={s.protocol} ok={true} />
      ))}
      {failed.length > 0 && (
        <span
          className="text-[8px] text-red-400 ml-0.5"
          role="img"
          aria-label={`${failed.length} failed`}
        >
          ✗
        </span>
      )}
    </div>
  );
}

function EncryptedLock() {
  return (
    <span
      className="inline-flex items-center text-[9px] text-degen-400"
      role="img"
      aria-label="End-to-end encrypted"
      title="End-to-end encrypted"
    >
      <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M5 7V4a3 3 0 016 0v3"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function DisappearingIcon({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  const label =
    minutes >= 10080 ? '7d' : minutes >= 1440 ? '24h' : minutes >= 60 ? '1h' : `${minutes}m`;
  return (
    <span
      className="inline-flex items-center text-[8px] text-[var(--color-muted)]"
      role="img"
      title={`Disappears after ${label}`}
      aria-label={`Disappears after ${label}`}
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="mr-0.5"
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

function ReadReceipts({ status }: { read: boolean; status?: string }) {
  const color =
    status === 'read'
      ? '#60a5fa'
      : status === 'delivered'
        ? 'var(--color-muted)'
        : 'var(--color-muted)';
  return (
    <span
      className="inline-flex text-[9px]"
      style={{ color }}
      role="img"
      aria-label={status ?? 'sent'}
    >
      {status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : '✓'}
    </span>
  );
}

/* ─── Reaction Picker ───────────────────────────────────────────────── */

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👍', '👎', '🎉'];

function ReactionPicker({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-1 shadow-lg">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact(emoji);
          }}
          className="rounded-full px-1 py-0.5 text-sm hover:bg-[var(--color-overlay)] hover:scale-125 transition-all"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ─── Reply Preview ─────────────────────────────────────────────────── */

function ReplyPreview({
  replyTo,
  onJump,
}: {
  replyTo: NonNullable<EnrichedMessage['replyTo']>;
  onJump?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="flex items-start gap-2 mb-1.5 rounded-lg border-l-2 border-degen-500/50 bg-[var(--color-overlay)] px-2.5 py-1.5 text-left w-full hover:bg-[var(--color-border)] transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-medium text-degen-400">
          Replying to {replyTo.fromId.slice(0, 8)}
        </p>
        <p className="text-[10px] text-[var(--color-muted)] truncate">
          {replyTo.content.slice(0, 80)}
        </p>
      </div>
    </button>
  );
}

/* ─── File/Image Attachment ──────────────────────────────────────────── */

function Attachment({
  attachment,
}: {
  attachment: NonNullable<EnrichedMessage['attachments']>[number];
}) {
  if (attachment.type === 'image') {
    return (
      <div className="mb-1.5 rounded-xl overflow-hidden border border-[var(--color-border)]">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-48 w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  if (attachment.type === 'video') {
    return (
      <div className="mb-1.5 rounded-xl overflow-hidden border border-[var(--color-border)]">
        <video
          src={attachment.url}
          controls
          className="max-h-48 w-full"
          aria-label={attachment.name}
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 hover:bg-[var(--color-border)] transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="shrink-0 text-[var(--color-muted)]"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-fg)] truncate">{attachment.name}</p>
        {attachment.size && (
          <p className="text-[9px] text-[var(--color-muted)]">
            {(attachment.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>
    </a>
  );
}

/* ─── Voice Message Waveform ────────────────────────────────────────── */

function VoiceMessageBubble({ duration }: { duration: number }) {
  const bars = Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="flex items-center gap-3 mb-1">
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-degen-400 hover:bg-degen-500/30 transition-colors"
        aria-label="Play voice message"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </button>
      <div className="flex items-end gap-0.5 h-8 flex-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-degen-400/60 transition-all"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
      <span className="text-[10px] text-[var(--color-muted)] shrink-0">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

/* ─── Context Menu ──────────────────────────────────────────────────── */

function MessageContextMenu({
  isMe,
  onReply,
  onEdit,
  onDelete,
  onPin,
  pinned,
  onClose,
  style,
}: {
  isMe: boolean;
  pinned?: boolean;
  onReply?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: (forEveryone: boolean) => void;
  onPin?: () => void;
  onClose: () => void;
  style: React.CSSProperties;
}) {
  const [_editing, setEditing] = useState(false);
  const [_editText, setEditText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="absolute z-50 min-w-[140px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-2xl"
        style={style}
      >
        <button
          type="button"
          onClick={() => {
            onReply?.();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
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
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Reply
        </button>
        {isMe && onEdit && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setEditText('');
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
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
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        )}
        {onPin && (
          <button
            type="button"
            onClick={() => {
              onPin();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
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
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0015 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 00-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
            </svg>
            {pinned ? 'Unpin' : 'Pin'}
          </button>
        )}
        {isMe && onDelete && (
          <>
            <div className="my-1 border-t border-[var(--color-border)]" />
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
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
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>
            {showDeleteConfirm && (
              <div className="border-t border-[var(--color-border)] px-3 py-2 space-y-1">
                <p className="text-[9px] text-[var(--color-muted)]">Delete for...</p>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(false);
                    onClose();
                  }}
                  className="w-full rounded-lg bg-[var(--color-overlay)] px-2 py-1 text-[10px] text-[var(--color-fg)] hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  Delete for me
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(true);
                    onClose();
                  }}
                  className="w-full rounded-lg bg-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Delete for everyone
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

export function MessageBubble({
  content,
  protocol,
  createdAt,
  encrypted,
  isMe,
  deliveryStatus,
  disappearingTimer = 0,
  replyTo,
  reactions,
  edited,
  pinned,
  attachments,
  voiceMessage,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onJumpToMessage,
}: MessageBubbleProps) {
  const protocolColor = getProtocolColor(protocol);
  const protocolIcon = getProtocolIcon(protocol);
  const protocolLabel = getProtocolLabel(protocol);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (editText.trim() && editText !== content) {
      onEdit?.(editText.trim());
    }
    setIsEditing(false);
  }, [editText, content, onEdit]);

  return (
    <div
      className={`group relative flex ${isMe ? 'justify-end' : 'justify-start'} animate-message-enter`}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 ${
          isMe
            ? 'bg-[var(--color-msg-sent)] text-[var(--color-fg)] rounded-br-md'
            : 'bg-[var(--color-msg-received)] text-[var(--color-fg)] rounded-bl-md'
        } ${encrypted && isMe ? 'ring-1 ring-degen-500/20' : ''} ${pinned ? 'ring-2 ring-amber-500/40' : ''}`}
        style={{
          border: `1px solid ${protocolColor}26`,
          ...(isMe
            ? { borderRight: `3px solid ${protocolColor}` }
            : { borderLeft: `3px solid ${protocolColor}` }),
          backgroundColor: `color-mix(in srgb, ${protocolColor} 7%, ${
            isMe ? 'var(--color-msg-sent)' : 'var(--color-msg-received)'
          })`,
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Pinned indicator */}
        {pinned && (
          <div className="flex items-center gap-1 mb-1 text-[9px] text-amber-400">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0015 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 00-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
            </svg>
            Pinned message
          </div>
        )}

        {/* Encrypted indicator */}
        {encrypted && !isMe && (
          <div className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-degen-500/20 border border-degen-500/30">
            <svg
              width="7"
              height="7"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="text-degen-400"
            >
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
          </div>
        )}

        {/* Reply preview */}
        {replyTo && <ReplyPreview replyTo={replyTo} onJump={() => onJumpToMessage?.(replyTo.id)} />}

        {/* Attachments (image/file) */}
        {attachments?.map((att, i) => (
          <Attachment key={i} attachment={att} />
        ))}

        {/* Voice message */}
        {voiceMessage && <VoiceMessageBubble duration={voiceMessage.duration} />}

        {/* Editing mode */}
        {isEditing ? (
          <div className="flex gap-2">
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSubmit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-fg)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30"
            />
            <button
              type="button"
              onClick={handleEditSubmit}
              className="rounded-lg bg-degen-500 px-2 py-1 text-xs font-bold text-black"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* Message text */}
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>
          </>
        )}

        {/* Reactions */}
        {reactions && reactions.length > 0 && !isEditing && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map((r) => (
              <span
                key={r.emoji}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] transition-all ${
                  r.me
                    ? 'border-degen-500/40 bg-degen-500/10'
                    : 'border-[var(--color-border)] bg-[var(--color-overlay)]'
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && (
                  <span className="text-[9px] text-[var(--color-muted)]">{r.count}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        {!isEditing && (
          <div
            className={`flex items-center gap-1.5 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
          >
            {encrypted && <EncryptedLock />}
            {/* Read receipts */}
            {isMe && deliveryStatus && (
              <ReadReceipts
                read={true}
                status={deliveryStatus.some((s) => s.ok) ? 'delivered' : 'sent'}
              />
            )}
            {isMe && deliveryStatus && <DeliveryBadges statuses={deliveryStatus} />}
            <DisappearingIcon minutes={disappearingTimer} />
            {edited && <span className="text-[8px] text-[var(--color-muted)] italic">edited</span>}
            {pinned && !isEditing && <span className="text-[8px] text-amber-400/60">📌</span>}
            <span
              className="text-[10px] leading-none"
              style={{ color: protocolColor }}
              role="img"
              title={protocolLabel}
              aria-label={`via ${protocolLabel}`}
            >
              {protocolIcon}
            </span>
            <time
              className="text-[9px] text-[var(--color-muted)]"
              dateTime={new Date(createdAt).toISOString()}
              title={new Date(createdAt).toLocaleString()}
            >
              {formatMessageTime(createdAt)}
            </time>
          </div>
        )}

        {/* Hover actions */}
        {!isEditing && (
          <div
            className={`absolute top-0 ${isMe ? 'left-0 -translate-x-full pl-1' : 'right-0 translate-x-full pr-1'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-0.5`}
          >
            {/* React button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactions(!showReactions)}
                className="rounded-full bg-[var(--color-card)] border border-[var(--color-border)] p-1 shadow-md hover:bg-[var(--color-overlay)] transition-colors"
                aria-label="Add reaction"
                title="Add reaction"
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              {showReactions && (
                <div className={`absolute ${isMe ? 'right-0' : 'left-0'} top-full mt-1 z-40`}>
                  <ReactionPicker
                    onReact={(emoji) => {
                      onReact?.(emoji);
                      setShowReactions(false);
                    }}
                  />
                </div>
              )}
            </div>
            {/* Reply button */}
            <button
              type="button"
              onClick={() => onReply?.()}
              className="rounded-full bg-[var(--color-card)] border border-[var(--color-border)] p-1 shadow-md hover:bg-[var(--color-overlay)] transition-colors"
              aria-label="Reply"
              title="Reply"
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
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <MessageContextMenu
          isMe={isMe}
          pinned={pinned}
          onReply={onReply}
          onEdit={(text) => {
            setIsEditing(true);
            setEditText(text);
          }}
          onDelete={onDelete}
          onPin={onPin}
          onClose={() => setShowContextMenu(false)}
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            transform: 'translate(-50%, -100%)',
          }}
        />
      )}
    </div>
  );
}

/* ─── Typing Indicator ──────────────────────────────────────────────── */

export function TypingIndicator({ names }: { names?: string[] }) {
  const label =
    names && names.length > 0
      ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} others` : ''} typing`
      : 'Someone is typing';

  return (
    <div className="flex justify-start animate-message-enter">
      <div className="bg-[var(--color-msg-received)] rounded-2xl rounded-bl-md px-4 py-3">
        {names && names.length > 0 && (
          <p className="text-[9px] text-[var(--color-muted)] mb-1">
            {names.slice(0, 2).join(', ')}
            {names.length > 2 ? ` +${names.length - 2}` : ''} typing
          </p>
        )}
        <div className="flex items-center gap-1" role="status" aria-label={label}>
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
