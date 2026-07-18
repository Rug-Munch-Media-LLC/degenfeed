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

// ─── Helpers ────────────────────────────────────────────────────────

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡', farcaster: '🟣', lens: '🌿', bluesky: '🦋',
  mastodon: '🐘', threads: '🧵', reddit: '🔴',
};

function protocolLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── UI Components ──────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-16">
      <span className="mb-3 text-3xl opacity-30">{icon}</span>
      <p className="text-sm font-medium text-[var(--color-muted)]">{title}</p>
      <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
    </div>
  );
}

function WordChip({ word, onRemove }: { word: string; onRemove: (w: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-xs text-[var(--color-fg)]">
      {word}
      <button type="button" onClick={() => onRemove(word)}
        className="text-gray-500 hover:text-red-400 transition-colors" aria-label={`Remove ${word}`}
      >
        ×
      </button>
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function MutedSettingsPage() {
  const [config, setConfig] = useState<MuteConfig>({
    words: [], users: [], communities: [],
    blockedUsers: [], blockedCommunities: [],
  });
  const [loading, setLoading] = useState(true);
  const [wordInput, setWordInput] = useState('');
  const [activeTab, setActiveTab] = useState<'words' | 'users' | 'communities' | 'blocked'>('words');
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/mutes', { credentials: 'include' });
      if (res.ok) setConfig((await res.json()).config ?? config);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchConfig();
    intervalRef.current = setInterval(fetchConfig, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchConfig]);

  const addWord = useCallback(async () => {
    const word = wordInput.trim().toLowerCase();
    if (!word || config.words.includes(word)) return;
    try {
      const res = await fetch('/api/settings/mutes/words', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      if (res.ok) { setWordInput(''); fetchConfig(); }
    } catch { /* ignore */ }
  }, [wordInput, config.words, fetchConfig]);

  const removeWord = useCallback(async (word: string) => {
    try {
      await fetch(`/api/settings/mutes/words/${encodeURIComponent(word)}`, { method: 'DELETE' });
      fetchConfig();
    } catch { /* ignore */ }
  }, [fetchConfig]);

  const unmuteUser = useCallback(async (targetId: string) => {
    try {
      await fetch(`/api/settings/mutes/users/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      fetchConfig();
    } catch { /* ignore */ }
  }, [fetchConfig]);

  const unmuteCommunity = useCallback(async (communityId: string) => {
    try {
      await fetch(`/api/settings/mutes/communities/${encodeURIComponent(communityId)}`, { method: 'DELETE' });
      fetchConfig();
    } catch { /* ignore */ }
  }, [fetchConfig]);

  const unblockUser = useCallback(async (targetId: string) => {
    try {
      await fetch(`/api/settings/blocks/users/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      fetchConfig();
    } catch { /* ignore */ }
  }, [fetchConfig]);

  const unblockCommunity = useCallback(async (communityId: string) => {
    try {
      await fetch(`/api/settings/blocks/communities/${encodeURIComponent(communityId)}`, { method: 'DELETE' });
      fetchConfig();
    } catch { /* ignore */ }
  }, [fetchConfig]);

  const tabs = [
    { id: 'words' as const, label: `Words (${config.words.length})` },
    { id: 'users' as const, label: `Users (${config.users.length})` },
    { id: 'communities' as const, label: `Communities (${config.communities.length})` },
    { id: 'blocked' as const, label: `Blocked (${config.blockedUsers.length + config.blockedCommunities.length})` },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Muted & Blocked</h1>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Manage muted words, users, and communities across protocols.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`pb-3 pt-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-degen-500 text-[var(--color-fg)]'
                : 'border-transparent text-gray-500 hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      )}

      {/* Tab content */}
      {!loading && activeTab === 'words' && (
        <div>
          <div className="mb-4 flex gap-2">
            <input type="text" value={wordInput} onChange={(e) => setWordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWord()}
              placeholder="Add a word or phrase to mute..."
              className="input flex-1"
            />
            <button type="button" onClick={addWord} disabled={!wordInput.trim()}
              className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-degen-400 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
          {config.words.length === 0 ? (
            <EmptyState icon="🔇" title="No muted words" subtitle="Add words or phrases to hide from your feed" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {config.words.map((w) => (
                <WordChip key={w} word={w} onRemove={removeWord} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'users' && (
        config.users.length === 0 ? (
          <EmptyState icon="🙊" title="No muted users" subtitle="Muted users will appear here" />
        ) : (
          <div className="space-y-2">
            {config.users.map((u) => (
              <div key={u.targetId} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">{u.targetHandle}</p>
                  <p className="text-xs text-gray-500">
                    {PROTOCOL_ICONS[u.protocol] || ''} {protocolLabel(u.protocol)} · Muted {formatDate(u.mutedAt)}
                  </p>
                </div>
                <button type="button" onClick={() => unmuteUser(u.targetId)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && activeTab === 'communities' && (
        config.communities.length === 0 ? (
          <EmptyState icon="🔕" title="No muted communities" subtitle="Mute communities to hide their posts" />
        ) : (
          <div className="space-y-2">
            {config.communities.map((c) => (
              <div key={c.communityId} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">{c.communityName}</p>
                  {c.instance && <p className="text-xs text-gray-500">{c.instance}</p>}
                </div>
                <button type="button" onClick={() => unmuteCommunity(c.communityId)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && activeTab === 'blocked' && (
        config.blockedUsers.length === 0 && config.blockedCommunities.length === 0 ? (
          <EmptyState icon="🚫" title="No blocked users or communities" subtitle="Blocked accounts and communities will appear here" />
        ) : (
          <div className="space-y-4">
            {config.blockedUsers.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Blocked Users</h3>
                <div className="space-y-2">
                  {config.blockedUsers.map((u) => (
                    <div key={u.blockedTargetId} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                      <p className="text-sm font-medium text-[var(--color-fg)]">{u.blockedTargetHandle || u.blockedTargetId}</p>
                      <button type="button" onClick={() => unblockUser(u.blockedTargetId)}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 transition-colors"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {config.blockedCommunities.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Blocked Communities</h3>
                <div className="space-y-2">
                  {config.blockedCommunities.map((c) => (
                    <div key={c.communityId} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-fg)]">{c.communityName}</p>
                        {c.instance && <p className="text-xs text-gray-500">{c.instance}</p>}
                      </div>
                      <button type="button" onClick={() => unblockCommunity(c.communityId)}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 transition-colors"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">About Muting & Blocking</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Muted words hide posts containing those terms. Muted users and communities collapse their content. Blocking prevents all interaction. These settings sync across all protocols where supported.
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link href="/settings" className="text-xs text-degen-400 hover:text-degen-300 transition-colors">
          ← Back to Settings
        </Link>
      </div>
    </div>
  );
}
