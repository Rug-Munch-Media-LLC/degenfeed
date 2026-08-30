'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../../components/AuthProvider';
import { useAnnouncer } from '../../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../../lib/retryFetch';
import { formatTime, getInitials, shortAddr, timeAgo } from '../helpers';
import type { GroupInfo, GroupMessage } from '../types';

export function GroupChatView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { announce } = useAnnouncer();
  const { tokens } = useAuth();
  const userId = tokens.evmAddress?.toLowerCase() ?? '';

  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [newMemberInput, setNewMemberInput] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    try {
      const [infoData, msgData] = await Promise.all([
        retryFetchJson<GroupInfo>(`/api/messages/groups/${groupId}/info`, { maxRetries: 2 }),
        retryFetchJson<{ messages: GroupMessage[] }>(`/api/messages/groups/${groupId}/messages`, {
          maxRetries: 2,
        }),
      ]);
      setInfo(infoData);
      setMessages(msgData.messages ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = useCallback(async () => {
    const text = composeText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const data = await retryFetchJson<{ ok: boolean; message: GroupMessage }>(
        `/api/messages/groups/${groupId}/send`,
        {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content: text }),
          },
        },
      );
      if (data.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setComposeText('');
        announce('Message sent', 'polite');
      }
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  }, [composeText, groupId, sending, announce]);

  const handleAddMember = useCallback(async () => {
    const addr = newMemberInput.trim().toLowerCase();
    if (!addr) return;
    try {
      await retryFetchJson(`/api/messages/groups/${groupId}/add-member`, {
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ memberId: addr }),
        },
      });
      setNewMemberInput('');
      fetchData();
      announce(`Added ${shortAddr(addr)}`, 'polite');
    } catch {
      /* silent */
    }
  }, [newMemberInput, groupId, fetchData, announce]);

  const handleRemoveMember = useCallback(
    async (addr: string) => {
      try {
        await retryFetchJson(`/api/messages/groups/${groupId}/remove-member`, {
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ memberId: addr }),
          },
        });
        fetchData();
      } catch {
        /* silent */
      }
    },
    [groupId, fetchData],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="text-xs text-[var(--color-muted)]">Loading group...</p>
        </div>
      </div>
    );
  }

  const isAdmin = info?.members.some((m) => m.walletAddress === userId && m.role === 'admin');

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-2.5 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
          aria-label="Back to groups"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
          </svg>
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-degen-500/15 text-sm font-bold text-degen-400">
          {info ? getInitials(info.name) : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-fg)] truncate">
            {info?.name ?? 'Group'}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {info?.members.length ?? 0} members &middot; E2E encrypted
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${showInfo ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
          aria-label="Group info"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-degen-500/8 border border-degen-500/20 px-3 py-1.5 mb-2">
              <svg
                width="10"
                height="10"
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
              <span className="text-[9px] text-degen-400/80">End-to-end encrypted group</span>
            </div>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="mb-3 text-3xl opacity-30" aria-hidden="true">
                  👥
                </span>
                <p className="text-sm text-[var(--color-muted)]">No messages yet</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Send the first message in this encrypted group.
                </p>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.fromId === userId;
              const sender = info?.members.find((m) => m.walletAddress === msg.fromId);
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-message-enter`}
                >
                  <div
                    className={`relative max-w-[80%] rounded-2xl px-3.5 py-2.5 ${isMe ? 'bg-[var(--color-msg-sent)] rounded-br-md' : 'bg-[var(--color-msg-received)] rounded-bl-md'}`}
                  >
                    {!isMe && (
                      <p className="text-[10px] font-medium text-degen-400 mb-1">
                        {sender?.displayName ?? shortAddr(msg.fromId)}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                    <div
                      className={`flex items-center gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <time
                        className="text-[9px] text-[var(--color-muted)]"
                        dateTime={new Date(msg.createdAt).toISOString()}
                      >
                        {formatTime(msg.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={msgEndRef} className="h-px" />
          </div>
          <div className="border-t border-[var(--color-border)] bg-[var(--color-compose-bg)] px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message group..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
                style={{ maxHeight: '120px' }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!composeText.trim() || sending}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-degen-500 font-bold text-black hover:bg-degen-400 disabled:opacity-30 transition-all"
                aria-label="Send message"
              >
                {sending ? (
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {showInfo && info && (
          <aside className="w-72 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-card)] overflow-y-auto hidden md:block p-4">
            <h3 className="text-sm font-bold text-[var(--color-fg)] mb-1">{info.name}</h3>
            {info.description && (
              <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
                {info.description}
              </p>
            )}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Members ({info.members.length})
                </h4>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const a = prompt('Enter wallet address to add:');
                      if (a) {
                        handleAddMember();
                        setNewMemberInput(a);
                      }
                    }}
                    className="text-[10px] text-degen-400 hover:underline"
                  >
                    + Add
                  </button>
                )}
              </div>
              {info.members.map((member) => (
                <div key={member.walletAddress} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-[9px] font-bold text-degen-400">
                      {getInitials(member.displayName ?? member.walletAddress)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--color-fg)] truncate">
                        {member.displayName ?? shortAddr(member.walletAddress)}
                      </p>
                      <p className="text-[9px] text-[var(--color-muted)]">
                        {member.role === 'admin' ? 'Admin' : 'Member'} &middot;{' '}
                        {timeAgo(member.joinedAt)}
                      </p>
                    </div>
                  </div>
                  {isAdmin && member.walletAddress !== userId && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.walletAddress)}
                      className="text-[var(--color-muted)] hover:text-red-400 transition-colors p-1"
                      aria-label={`Remove ${shortAddr(member.walletAddress)}`}
                    >
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {showInfo && info && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onPointerDown={() => setShowInfo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 h-full w-72 bg-[var(--color-card)] border-l border-[var(--color-border)] p-4 overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mb-4 rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
              aria-label="Close info"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-sm font-bold text-[var(--color-fg)] mb-1">{info.name}</h3>
            {info.description && (
              <p className="text-xs text-[var(--color-muted)] mb-4">{info.description}</p>
            )}
            <h4 className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
              Members ({info.members.length})
            </h4>
            <div className="space-y-2">
              {info.members.map((member) => (
                <div key={member.walletAddress} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-[9px] font-bold text-degen-400">
                    {getInitials(member.displayName ?? member.walletAddress)}
                  </span>
                  <p className="text-xs text-[var(--color-fg)] truncate">
                    {member.displayName ?? shortAddr(member.walletAddress)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
