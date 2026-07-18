'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  walletAddress: string;
  handle: string;
  displayName: string;
  protocol: string;
  avatarUrl?: string;
  joinedAt: number;
  lastActive: number;
  postCount: number;
  tipCount: number;
  reputation: number;
  status: 'active' | 'suspended' | 'banned' | 'warned';
  banReason?: string;
  flags: string[];
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  mastodon: '🐘',
  threads: '🧵',
  reddit: '🔴',
  rss: '📡',
};

// ─── Mock data ────────────────────────────────────────────────────────

const HANDLES = [
  'alice_web3',
  'bob_nft',
  'crypto_kyle',
  'defi_dan',
  'metaverse_mary',
  'rug_police',
  'degendad',
  'solana_sam',
  'eth_maxi',
  'nofear_frank',
  'dao_voter',
  'yield_farmer',
  'airdrop_hunter',
  'punk_rock',
  'based_builder',
  'wizard_of_web3',
  'hodl_queen',
  'chain_link',
  'blockchain_bill',
  'token_tom',
];

const DISPLAY_NAMES = [
  'Alice Web3',
  'Bob NFT',
  'Crypto Kyle',
  'DeFi Dan',
  'Metaverse Mary',
  'Rug Police',
  'DegenDad',
  'Solana Sam',
  'ETH Maxi',
  'NoFear Frank',
  'DAO Voter',
  'Yield Farmer',
  'Airdrop Hunter',
  'Punk Rock',
  'Based Builder',
  'Wizard of Web3',
  'HODL Queen',
  'Chain Link',
  'Blockchain Bill',
  'Token Tom',
];

const PROTOCOLS_USER = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads', 'reddit'];

const MOCK_USERS: AdminUser[] = Array.from({ length: 45 }, (_, i) => ({
  id: `user-${i + 1}`,
  walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
  handle: HANDLES[i % 20] || 'unknown',
  displayName: DISPLAY_NAMES[i % 20] || 'Unknown',
  protocol: PROTOCOLS_USER[i % 7] || 'nostr',
  joinedAt: Date.now() - Math.random() * 90 * 86400000,
  lastActive: Date.now() - Math.random() * 48 * 3600000,
  postCount: Math.floor(Math.random() * 500),
  tipCount: Math.floor(Math.random() * 50),
  reputation: Math.random(),
  status: (i === 0
    ? 'suspended'
    : i === 1
      ? 'banned'
      : i === 2
        ? 'warned'
        : 'active') as AdminUser['status'],
  flags: i % 7 === 0 ? ['high_report_count'] : [],
}));

// ─── Component ────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  type UserAction = 'ban' | 'suspend' | 'warn';
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: UserAction } | null>(
    null,
  );
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as UsersResponse;
        setUsers(data.users);
        return;
      }
    } catch {
      // fall through to defaults
    }
    // Fallback: filter mock data
    let filtered = [...MOCK_USERS];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.handle.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.walletAddress.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter((u) => u.status === statusFilter);
    if (protocolFilter !== 'all') filtered = filtered.filter((u) => u.protocol === protocolFilter);
    setUsers(filtered);
  }, [search, statusFilter, protocolFilter, page]);

  useEffect(() => {
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const handleUserAction = useCallback(
    async (userId: string, action: 'ban' | 'suspend' | 'warn') => {
      if (action === 'ban' && !banReason.trim()) return;
      setActionLoading(userId);
      try {
        const res = await fetch(`/api/admin/users/${userId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: banReason.trim() || `${action} by admin` }),
        });
        if (res.ok) {
          const statusMap: Record<string, AdminUser['status']> = {
            ban: 'banned',
            suspend: 'suspended',
            warn: 'warned',
          };
          showToast(`User ${action}ed successfully`);
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, status: statusMap[action] ?? u.status } : u,
            ),
          );
          if (selectedUser?.id === userId) {
            const statusMap: Record<string, AdminUser['status']> = {
              ban: 'banned',
              suspend: 'suspended',
              warn: 'warned',
            };
            setSelectedUser((prev) =>
              prev ? { ...prev, status: statusMap[action] ?? prev.status } : null,
            );
          }
          setConfirmAction(null);
          setBanReason('');
        } else {
          showToast(`Failed to ${action} user`, 'error');
        }
      } catch {
        showToast('Network error', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [banReason, showToast, selectedUser],
  );

  const statusCounts = useMemo(() => {
    const counts = { active: 0, suspended: 0, banned: 0, warned: 0 };
    for (const u of MOCK_USERS) {
      if (counts[u.status] !== undefined) counts[u.status]++;
    }
    return counts;
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading users…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${
            toast.kind === 'success'
              ? 'border border-green-500/30 bg-green-900/40 text-green-300'
              : 'border border-red-500/30 bg-red-900/40 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Users</h1>
        <p className="mt-1 text-sm text-gray-500">Manage platform users, bans, and warnings</p>
      </div>

      {/* Stats chips */}
      <div className="mb-6 flex flex-wrap gap-3">
        {Object.entries(statusCounts).map(([key, count]) => (
          <div
            key={key}
            className={`rounded-xl border px-4 py-2 ${
              key === 'active'
                ? 'border-green-500/20 bg-green-500/5'
                : key === 'banned'
                  ? 'border-red-500/20 bg-red-500/5'
                  : key === 'suspended'
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : 'border-orange-500/20 bg-orange-500/5'
            }`}
          >
            <span className="text-xs font-medium capitalize text-[var(--color-fg)]">{key}</span>
            <span className="ml-2 text-sm font-bold text-[var(--color-fg)]">{count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by handle, name, or wallet…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 pl-9 text-sm text-[var(--color-fg)] placeholder-gray-500 focus:border-degen-500 focus:outline-none"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            🔍
          </span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="warned">Warned</option>
        </select>

        <select
          value={protocolFilter}
          onChange={(e) => {
            setProtocolFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
        >
          <option value="all">All Protocols</option>
          {['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads', 'reddit'].map((p) => (
            <option key={p} value={p}>
              {PROTOCOL_ICONS[p]} {p}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => fetchUsers()}
          className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-muted)]"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* User table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  User
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Protocol
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Posts
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Tips
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Rep
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Last Active
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="bg-[var(--color-card)] transition-colors hover:bg-[var(--color-card-hover)] cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-[var(--color-fg)]">
                          {user.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-fg)]">
                            {user.displayName}
                          </p>
                          <p className="text-[10px] text-gray-500">@{user.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">
                        {PROTOCOL_ICONS[user.protocol] || ''} {user.protocol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatCount(user.postCount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatCount(user.tipCount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--color-muted)]">
                          <div
                            className={`h-full rounded-full ${user.reputation > 0.7 ? 'bg-degen-500' : user.reputation > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${user.reputation * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {(user.reputation * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          user.status === 'active'
                            ? 'bg-green-500/15 text-green-400'
                            : user.status === 'suspended'
                              ? 'bg-yellow-500/15 text-yellow-400'
                              : user.status === 'banned'
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-orange-500/15 text-orange-400'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-gray-500">
                      {formatTime(user.lastActive)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {user.status !== 'banned' && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmAction({ userId: user.id, action: 'ban' });
                              setSelectedUser(user);
                            }}
                            className="rounded-lg border border-red-500/30 px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            Ban
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmAction({ userId: user.id, action: 'suspend' });
                              setSelectedUser(user);
                            }}
                            className="rounded-lg border border-yellow-500/30 px-2 py-1 text-[10px] text-yellow-400 transition-colors hover:bg-yellow-500/10"
                          >
                            Suspend
                          </button>
                        )}
                        {user.flags.length > 0 && (
                          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                            {user.flags.length}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>{users.length} users</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="flex items-center px-2">Page {page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── User detail modal ── */}
      {selectedUser && (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => {
            if (!actionLoading) setSelectedUser(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !actionLoading) setSelectedUser(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="User details"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="none"
          >
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-lg font-bold text-[var(--color-fg)]">
                  {selectedUser.displayName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-fg)]">
                    {selectedUser.displayName}
                  </h2>
                  <p className="text-sm text-gray-500">@{selectedUser.handle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <DetailItem label="Status" value={selectedUser.status} />
              <DetailItem
                label="Protocol"
                value={`${PROTOCOL_ICONS[selectedUser.protocol] || ''} ${selectedUser.protocol}`}
              />
              <DetailItem
                label="Wallet"
                value={`${selectedUser.walletAddress.slice(0, 10)}…${selectedUser.walletAddress.slice(-6)}`}
              />
              <DetailItem label="Posts" value={formatCount(selectedUser.postCount)} />
              <DetailItem label="Tips Given" value={formatCount(selectedUser.tipCount)} />
              <DetailItem
                label="Reputation"
                value={`${(selectedUser.reputation * 100).toFixed(0)}%`}
              />
              <DetailItem label="Joined" value={formatTime(selectedUser.joinedAt)} />
              <DetailItem label="Last Active" value={formatTime(selectedUser.lastActive)} />
            </div>

            {selectedUser.banReason && (
              <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-xs text-red-400">
                <span className="font-semibold">Ban reason: </span>
                {selectedUser.banReason}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
              {selectedUser.status !== 'banned' && selectedUser.status !== 'suspended' && (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ userId: selectedUser.id, action: 'suspend' })}
                  className="rounded-xl border border-yellow-500/30 px-4 py-2 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/10"
                >
                  ⏸ Suspend
                </button>
              )}
              {selectedUser.status !== 'banned' && (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ userId: selectedUser.id, action: 'ban' })}
                  className="rounded-xl border border-red-500/30 px-4 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  🚫 Ban
                </button>
              )}
              <button
                type="button"
                onClick={() => handleUserAction(selectedUser.id, 'warn')}
                disabled={actionLoading === selectedUser.id}
                className="rounded-xl border border-orange-500/30 px-4 py-2 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/10 disabled:opacity-40"
              >
                ⚠️ Send Warning
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Confirm action modal ── */}
      {confirmAction && (
        <section
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => {
            if (!actionLoading) setConfirmAction(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !actionLoading) setConfirmAction(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm ${confirmAction.action}`}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="none"
          >
            <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)] capitalize">
              {confirmAction.action} User
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              This will {confirmAction.action} the user{' '}
              <span className="font-medium text-[var(--color-fg)]">@{selectedUser?.handle}</span>.
              {confirmAction.action === 'ban' && ' This action is irreversible.'}
            </p>
            <div className="mb-4">
              <label
                htmlFor="action-reason"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Reason
              </label>
              <textarea
                id="action-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Required — explain why…"
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setBanReason('');
                }}
                disabled={Boolean(actionLoading)}
                className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-gray-400 transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUserAction(confirmAction.userId, confirmAction.action)}
                disabled={actionLoading === confirmAction.userId || !banReason.trim()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLoading === confirmAction.userId
                  ? 'Processing…'
                  : `Confirm ${confirmAction.action}`}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-sm font-medium text-[var(--color-fg)] capitalize">{value}</p>
    </div>
  );
}
