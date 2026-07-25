'use client';

/**
 * Group Chat Management — DegenFeed Groups
 * Discord/Telegram-style group chat with encrypted messaging.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { retryFetchJson } from '../../../lib/retryFetch';
import { CreateGroupModal } from './_components/CreateGroupModal';
import { GroupChatView } from './_components/GroupChatView';
import { getInitials, timeAgo } from './helpers';
import type { GroupSummary } from './types';

export default function GroupsPage() {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!hasSignedIn) return;
    setLoading(true);
    try {
      const data = await retryFetchJson<{ groups: GroupSummary[] }>('/api/messages/groups/list', {
        maxRetries: 2,
      });
      setGroups(data.groups ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const totalUnread = useMemo(() => groups.reduce((s, g) => s + (g.unreadCount ?? 0), 0), [groups]);

  if (!hasSignedIn) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col items-center justify-center p-6 lg:h-[calc(100dvh-4rem)]">
        <span
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl bg-[var(--color-overlay)] text-[var(--color-muted)]"
          aria-hidden="true"
        >
          👥
        </span>
        <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use Group Chats</p>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Create and join encrypted group conversations.
        </p>
      </div>
    );
  }

  if (selectedGroupId) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
        <GroupChatView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">
            👥
          </span>
          <div>
            <h1 className="text-base font-bold text-[var(--color-fg)] leading-tight">Groups</h1>
            <p className="text-[10px] text-[var(--color-muted)]">
              {totalUnread > 0
                ? `${totalUnread} unread`
                : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-degen-500 px-3 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Group
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <span className="mb-4 text-4xl opacity-30" aria-hidden="true">
              👥
            </span>
            <p className="text-sm font-medium text-[var(--color-fg)]">No groups yet</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Create or join an encrypted group to start chatting.
            </p>
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
                <span
                  className={`truncate text-sm ${group.unreadCount > 0 ? 'font-bold' : 'font-medium'} text-[var(--color-fg)]`}
                >
                  {group.name}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                  {timeAgo(group.lastActivity)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] text-[var(--color-muted)]">
                  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--color-muted)]">·</span>
                <svg
                  width="8"
                  height="8"
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
