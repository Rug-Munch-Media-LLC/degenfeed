'use client';

import type { StoredBlockedCommunity, StoredBlockedUser, StoredMutedCommunity } from '@degenfeed/storage';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Local types (mirroring @degenfeed/storage internals) ─────────────

interface MutedUserEntry {
  targetId: string;
  targetHandle: string;
  protocol: string;
  mutedAt: number;
}

interface MutedCommunityEntry {
  communityId: string;
  communityName: string;
  instance: string;
}

interface BlockedCommunityEntry {
  communityId: string;
  communityName: string;
  instance: string;
}

interface MuteConfig {
  words: string[];
  users: MutedUserEntry[];
  communities: MutedCommunityEntry[];
  blockedUsers: StoredBlockedUser[];
  blockedCommunities: BlockedCommunityEntry[];
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function MutedSettingsPage() {
  const [config, setConfig] = useState<MuteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [addingWord, setAddingWord] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { getMuteConfig } = await import('@degenfeed/storage');
      const cfg = await getMuteConfig();
      setConfig(cfg as MuteConfig);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleAddWord = useCallback(async () => {
    const word = newWord.trim();
    if (!word || addingWord) return;
    setAddingWord(true);
    try {
      const { addMutedWord } = await import('@degenfeed/storage');
      await addMutedWord(word);
      setNewWord('');
      await loadConfig();
    } catch {
      /* ignore */
    }
    setAddingWord(false);
  }, [newWord, addingWord, loadConfig]);

  const handleRemoveWord = useCallback(
    async (word: string) => {
      try {
        const { removeMutedWord } = await import('@degenfeed/storage');
        await removeMutedWord(word);
        await loadConfig();
      } catch {
        /* ignore */
      }
    },
    [loadConfig],
  );

  const handleUnmuteUser = useCallback(
    async (userId: string) => {
      try {
        const { unmuteUser } = await import('@degenfeed/storage');
        await unmuteUser(userId);
        await loadConfig();
      } catch {
        /* ignore */
      }
    },
    [loadConfig],
  );

  const handleUnmuteCommunity = useCallback(
    async (communityId: string) => {
      try {
        const { unmuteCommunity } = await import('@degenfeed/storage');
        await unmuteCommunity(communityId);
        await loadConfig();
      } catch {
        /* ignore */
      }
    },
    [loadConfig],
  );

  const handleUnblock = useCallback(
    async (targetId: string) => {
      try {
        const { removeBlockedUser } = await import('@degenfeed/storage');
        await removeBlockedUser(targetId, 'self');
        await loadConfig();
      } catch {
        /* ignore */
      }
    },
    [loadConfig],
  );

  const handleUnblockCommunity = useCallback(
    async (communityId: string) => {
      try {
        const { unblockCommunity } = await import('@degenfeed/storage');
        await unblockCommunity(communityId);
        await loadConfig();
      } catch {
        /* ignore */
      }
    },
    [loadConfig],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Settings</p>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Muted &amp; Blocked</h1>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse p-4">
              <div className="mb-2 h-4 w-48 rounded bg-[var(--color-muted)]" />
              <div className="h-3 w-32 rounded bg-[var(--color-muted)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cfg = config ?? {
    words: [],
    users: [],
    communities: [],
    blockedUsers: [],
    blockedCommunities: [],
  };

  const totalMuted = cfg.words.length + cfg.users.length + cfg.communities.length;
  const totalBlocked = cfg.blockedUsers.length + cfg.blockedCommunities.length;
  const hasContent = totalMuted > 0 || totalBlocked > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Settings</p>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Muted &amp; Blocked</h1>
        </div>
        <Link href="/profile" className="text-sm text-gray-500 hover:text-[var(--color-fg)] transition-colors">
          &larr; Profile
        </Link>
      </div>

      {/* Summary bar */}
      <div className="card mb-6 flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-gray-400">
        <span>
          <strong className="text-[var(--color-fg)]">{cfg.words.length}</strong> muted word{cfg.words.length !== 1 ? 's' : ''}
        </span>
        <span className="text-gray-600">|</span>
        <span>
          <strong className="text-[var(--color-fg)]">{cfg.users.length}</strong> muted user{cfg.users.length !== 1 ? 's' : ''}
        </span>
        <span className="text-gray-600">|</span>
        <span>
          <strong className="text-[var(--color-fg)]">{cfg.communities.length}</strong> muted communit{cfg.communities.length !== 1 ? 'ies' : 'y'}
        </span>
        <span className="text-gray-600">|</span>
        <span>
          <strong className="text-red-400">{totalBlocked}</strong> blocked
        </span>
      </div>

      {!hasContent && (
        <div className="card py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-muted)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-gray-500">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-gray-500">Nothing muted or blocked yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Mute words, users, or communities from the three-dot menu on any post.
          </p>
          <Link href="/home" className="btn-primary mt-4 inline-block text-sm">
            Browse the feed
          </Link>
        </div>
      )}

      {hasContent && (
        <div className="space-y-8">
          {/* ── Muted Words ── */}
          <SectionHeading
            title="Muted Words"
            count={cfg.words.length}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            iconColor="text-orange-400"
          >
            {/* Add word */}
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddWord();
                }}
                placeholder="Add a word to mute..."
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500 focus:outline-none"
                maxLength={100}
              />
              <button
                type="button"
                onClick={handleAddWord}
                disabled={!newWord.trim() || addingWord}
                className="btn-primary shrink-0 text-xs disabled:opacity-50"
              >
                {addingWord ? '...' : 'Add'}
              </button>
            </div>
            {cfg.words.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">
                No muted words. Add words like &quot;spam&quot; or &quot;scam&quot; above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cfg.words.map((word: string) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-900/20 px-3 py-1.5 text-sm text-orange-300"
                  >
                    {word}
                    <button
                      type="button"
                      onClick={() => handleRemoveWord(word)}
                      className="ml-0.5 rounded-full p-0.5 text-orange-500 hover:bg-orange-800/40 hover:text-orange-200 transition-colors"
                      aria-label={`Remove muted word "${word}"`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </SectionHeading>

          {/* ── Muted Users ── */}
          <SectionHeading
            title="Muted Users"
            count={cfg.users.length}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            iconColor="text-gray-400"
          >
            {cfg.users.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">
                No muted users. Mute users from the three-dot menu on any post.
              </p>
            ) : (
              <div className="space-y-2">
                {cfg.users.map((user: MutedUserEntry) => (
                  <MutedUserRow key={user.targetId} user={user} onUnmute={handleUnmuteUser} />
                ))}
              </div>
            )}
          </SectionHeading>

          {/* ── Muted Communities ── */}
          <SectionHeading
            title="Muted Communities"
            count={cfg.communities.length}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
            iconColor="text-purple-400"
          >
            {cfg.communities.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">
                No muted communities. Mute communities from the three-dot menu on Lemmy posts.
              </p>
            ) : (
              <div className="space-y-2">
                {cfg.communities.map((comm: MutedCommunityEntry) => (
                  <CommunityRow key={comm.communityId} entry={comm} onAction={handleUnmuteCommunity} actionLabel="Unmute" />
                ))}
              </div>
            )}
          </SectionHeading>

          {/* ── Blocked Users ── */}
          <SectionHeading
            title="Blocked Users"
            count={cfg.blockedUsers.length}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            iconColor="text-red-400"
          >
            {cfg.blockedUsers.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">
                No blocked users. Block users from the three-dot menu on any post.
              </p>
            ) : (
              <div className="space-y-2">
                {cfg.blockedUsers.map((b: StoredBlockedUser) => (
                  <BlockedUserRow key={b.targetId} entry={b} onUnblock={handleUnblock} />
                ))}
              </div>
            )}
          </SectionHeading>

          {/* ── Blocked Communities ── */}
          <SectionHeading
            title="Blocked Communities"
            count={(cfg.blockedCommunities || []).length}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <line x1="4" y1="4" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
              </svg>
            }
            iconColor="text-red-500"
          >
            {!cfg.blockedCommunities || cfg.blockedCommunities.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">
                No blocked communities.
              </p>
            ) : (
              <div className="space-y-2">
                {cfg.blockedCommunities.map((comm: BlockedCommunityEntry) => (
                  <CommunityRow key={comm.communityId} entry={comm} onAction={handleUnblockCommunity} actionLabel="Unblock" />
                ))}
              </div>
            )}
          </SectionHeading>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function SectionHeading({
  title,
  count,
  icon,
  iconColor,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <h2 className="text-sm font-medium uppercase tracking-widest text-gray-400">
          {title}
        </h2>
        <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {count}
        </span>
      </div>
      <div className="card p-4">{children}</div>
    </section>
  );
}

function MutedUserRow({ user, onUnmute }: { user: MutedUserEntry; onUnmute: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs text-gray-500">
          {user.targetHandle.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-fg)]">
            {user.targetHandle || user.targetId.slice(0, 20)}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            {user.protocol && (
              <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-400">
                {user.protocol}
              </span>
            )}
            <span>Muted {new Date(user.mutedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUnmute(user.targetId)}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-[var(--color-muted)] transition-colors"
      >
        Unmute
      </button>
    </div>
  );
}

function BlockedUserRow({
  entry,
  onUnblock,
}: {
  entry: StoredBlockedUser;
  onUnblock: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-900/20 text-xs text-red-400">
          {entry.targetHandle.charAt(0).toUpperCase() || '!'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-fg)]">
            {entry.targetHandle || entry.targetId.slice(0, 20)}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            {entry.protocol && (
              <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-400">
                {entry.protocol}
              </span>
            )}
            <span>Blocked {new Date(entry.blockedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUnblock(entry.targetId)}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/20 transition-colors"
      >
        Unblock
      </button>
    </div>
  );
}

function CommunityRow({
  entry,
  onAction,
  actionLabel,
}: {
  entry: MutedCommunityEntry | BlockedCommunityEntry;
  onAction: (id: string) => void;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-900/20 text-xs text-purple-400">
          #
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-fg)]">
            {entry.communityName || entry.communityId}
          </p>
          {entry.instance && (
            <p className="text-[11px] text-gray-500">{entry.instance}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAction(entry.communityId)}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-[var(--color-muted)] transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}
