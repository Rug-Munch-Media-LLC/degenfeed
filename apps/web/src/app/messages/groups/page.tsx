'use client';

/**
 * Group Chat Management — DegenFeed Groups
 *
 * Discord/Telegram-style group chat with encrypted messaging.
 * Builds on the existing E2E group chat infrastructure.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useAnnouncer } from '../../../components/ScreenReaderAnnouncer';
import { useMessages } from '../../../hooks/useMessages';
import { retryFetchJson } from '../../../lib/retryFetch';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  lastActivity: number;
  unreadCount: number;
}

interface GroupInfo {
  name: string;
  description: string;
  members: Array<{
    walletAddress: string;
    displayName?: string;
    joinedAt: number;
    role: 'admin' | 'member';
  }>;
}

interface GroupMessage {
  id: string;
  groupId: string;
  fromId: string;
  content: string;
  createdAt: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function shortAddr(addr: string): string {
  if (!addr) return 'Unknown';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function getInitials(name: string): string {
  return name
    .split(/[\s:@]+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

/* ─── Create Group Modal ────────────────────────────────────────────── */

function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: GroupSummary) => void;
}) {
  const { tokens } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { announce } = useAnnouncer();

  const addMember = useCallback(() => {
    const addr = memberInput.trim().toLowerCase();
    if (!addr || members.includes(addr)) return;
    if (addr === tokens.evmAddress?.toLowerCase()) return; // Can't add self
    setMembers((prev) => [...prev, addr]);
    setMemberInput('');
  }, [memberInput, members, tokens.evmAddress]);

  const removeMember = useCallback((addr: string) => {
    setMembers((prev) => prev.filter((m) => m !== addr));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    if (members.length < 1) {
      setError('Add at least one member');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const data = await retryFetchJson<{ ok: boolean; group: GroupSummary }>(
        '/api/messages/groups/create',
        {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim(),
              memberIds: members,
            }),
          },
        },
      );
      if (data.ok && data.group) {
        announce(`Group "${name}" created`, 'polite');
        onCreated(data.group);
        onClose();
        setName('');
        setDescription('');
        setMembers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }, [name, description, members, announce, onCreated, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-group-title"
      >
        <h2 id="create-group-title" className="text-lg font-bold text-[var(--color-fg)] mb-5">
          Create Group
        </h2>

        {/* Group name */}
        <div className="mb-4">
          <label htmlFor="group-name" className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
            Group Name
          </label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crypto Traders"
            maxLength={100}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label htmlFor="group-desc" className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            id="group-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            rows={2}
            maxLength={500}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow resize-none"
          />
        </div>

        {/* Add members */}
        <div className="mb-4">
          <label htmlFor="member-input" className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
            Add Members ({members.length})
          </label>
          <div className="flex gap-2">
            <input
              id="member-input"
              type="text"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }}
              placeholder="Wallet address or handle..."
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
            />
            <button
              type="button"
              onClick={addMember}
              disabled={!memberInput.trim()}
              className="rounded-xl bg-degen-500/20 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 disabled:opacity-30 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Member tags */}
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {members.map((addr) => (
                <span
                  key={addr}
                  className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2.5 py-1 text-[10px] text-degen-400"
                >
                  {shortAddr(addr)}
                  <button
                    type="button"
                    onClick={() => removeMember(addr)}
                    className="hover:text-red-400 transition-colors"
                    aria-label={`Remove ${shortAddr(addr)}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-xs text-red-400 flex items-center gap-1.5" role="alert">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim() || members.length === 0}
            className="flex-1 rounded-xl bg-degen-500 py-2.5 text-sm font-bold text-black hover:bg-degen-400 disabled:opacity-30 transition-all disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Group Chat View ──────────────────────────────────────────────── */

function GroupChatView({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
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

  // Fetch group info & messages
  const fetchData = useCallback(async () => {
    if (!groupId) return;
    try {
      const [infoData, msgData] = await Promise.all([
        retryFetchJson<GroupInfo>(`/api/messages/groups/${groupId}/info`, { maxRetries: 2 }),
        retryFetchJson<{ messages: GroupMessage[] }>(`/api/messages/groups/${groupId}/messages`, { maxRetries: 2 }),
      ]);
      setInfo(infoData);
      setMessages(msgData.messages ?? []);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-scroll
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
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
      // Handle silently
    } finally {
      setSending(false);
    }
  }, [composeText, groupId, sending, announce]);

  // Add member
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
      // Handle error
    }
  }, [newMemberInput, groupId, fetchData, announce]);

  // Remove member
  const handleRemoveMember = useCallback(async (addr: string) => {
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
      // Handle error
    }
  }, [groupId, fetchData]);

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
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-2.5 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
          aria-label="Back to groups"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
          </svg>
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-degen-500/15 text-sm font-bold text-degen-400">
          {info ? getInitials(info.name) : '?'}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-fg)] truncate">{info?.name ?? 'Group'}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {info?.members.length ?? 0} members &middot; E2E encrypted
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showInfo
              ? 'bg-degen-500/15 text-degen-400'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
          }`}
          aria-label="Group info"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {/* Encryption banner */}
            <div className="flex items-center gap-1.5 rounded-lg bg-degen-500/8 border border-degen-500/20 px-3 py-1.5 mb-2">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-degen-400">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 7V4a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="text-[9px] text-degen-400/80">End-to-end encrypted group</span>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="mb-3 text-3xl opacity-30" aria-hidden="true">👥</span>
                <p className="text-sm text-[var(--color-muted)]">No messages yet</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Send the first message in this encrypted group.</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.fromId === userId;
              const sender = info?.members.find((m) => m.walletAddress === msg.fromId);
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-message-enter`}>
                  <div
                    className={`relative max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                      isMe
                        ? 'bg-[var(--color-msg-sent)] rounded-br-md'
                        : 'bg-[var(--color-msg-received)] rounded-bl-md'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-[10px] font-medium text-degen-400 mb-1">
                        {sender?.displayName ?? shortAddr(msg.fromId)}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <time className="text-[9px] text-[var(--color-muted)]" dateTime={new Date(msg.createdAt).toISOString()}>
                        {formatTime(msg.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={msgEndRef} className="h-px" />
          </div>

          {/* Compose bar */}
          <div className="border-t border-[var(--color-border)] bg-[var(--color-compose-bg)] px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
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
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Group info sidebar */}
        {showInfo && info && (
          <aside className="w-72 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-card)] overflow-y-auto hidden md:block">
            <div className="p-4">
              <h3 className="text-sm font-bold text-[var(--color-fg)] mb-1">{info.name}</h3>
              {info.description && (
                <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">{info.description}</p>
              )}

              {/* Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                    Members ({info.members.length})
                  </h4>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { const a = prompt('Enter wallet address to add:'); if (a) { handleAddMember(); setNewMemberInput(a); } }}
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
                          {member.role === 'admin' ? 'Admin' : 'Member'} &middot; {timeAgo(member.joinedAt)}
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
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile info panel */}
      {showInfo && info && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowInfo(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-[var(--color-card)] border-l border-[var(--color-border)] p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mb-4 rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
              aria-label="Close info"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

/* ─── Main Page ────────────────────────────────────────────────────── */

export default function GroupsPage() {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!hasSignedIn) return;
    setLoading(true);
    try {
      const data = await retryFetchJson<{ groups: GroupSummary[] }>(
        '/api/messages/groups/list',
        { maxRetries: 2 },
      );
      setGroups(data.groups ?? []);
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const totalUnread = useMemo(() => groups.reduce((s, g) => s + (g.unreadCount ?? 0), 0), [groups]);

  if (!hasSignedIn) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col items-center justify-center p-6 lg:h-[calc(100dvh-4rem)]">
        <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl bg-[var(--color-overlay)] text-[var(--color-muted)]" aria-hidden="true">👥</span>
        <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use Group Chats</p>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">Create and join encrypted group conversations.</p>
      </div>
    );
  }

  // Show selected group chat
  if (selectedGroupId) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
        <GroupChatView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">👥</span>
          <div>
            <h1 className="text-base font-bold text-[var(--color-fg)] leading-tight">Groups</h1>
            <p className="text-[10px] text-[var(--color-muted)]">
              {totalUnread > 0 ? `${totalUnread} unread` : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-degen-500 px-3 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Group
        </button>
      </header>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <span className="mb-4 text-4xl opacity-30" aria-hidden="true">👥</span>
            <p className="text-sm font-medium text-[var(--color-fg)]">No groups yet</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Create or join an encrypted group to start chatting.</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-degen-500 px-4 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
            >
              Create Your First Group
            </button>
          </div>
        )}

        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedGroupId(group.id)}
            className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-overlay)] transition-colors"
          >
            <div className="relative shrink-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/15 text-sm font-bold text-degen-400">
                {getInitials(group.name)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm ${group.unreadCount > 0 ? 'font-bold' : 'font-medium'} text-[var(--color-fg)]`}>
                  {group.name}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{timeAgo(group.lastActivity)}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] text-[var(--color-muted)]">
                  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--color-muted)]">·</span>
                <svg width="8" height="8" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-degen-400">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 7V4a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="text-[9px] text-degen-400">E2EE</span>
              </div>
            </div>

            {group.unreadCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold text-black">
                {group.unreadCount > 99 ? '99+' : group.unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Create group modal */}
      <CreateGroupModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(g) => {
          setGroups((prev) => [g, ...prev]);
          setSelectedGroupId(g.id);
        }}
      />
    </div>
  );
}
