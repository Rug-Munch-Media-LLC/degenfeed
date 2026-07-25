'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatTimeAgo, shortAddr } from '../layout';

// ─── Types ─────────────────────────────────────────────────────────────

interface Member {
  id: string;
  address: string;
  avatar: string;
  votingPower: number;
  votingPowerPct: number;
  joinDate: number;
  lastActive: number;
  proposalsCreated: number;
  votesCast: number;
  delegatedFrom: number; // number of delegators
  delegatedTo: string | null; // address of delegate
  badges: string[];
  isCreator: boolean;
}

interface DelegationEntry {
  id: string;
  delegator: string;
  delegatorAvatar: string;
  votingPower: number;
  delegatedAt: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

const MOCK_MEMBERS: Member[] = [
  {
    id: '1',
    address: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b',
    avatar: '🧠',
    votingPower: 520_000,
    votingPowerPct: 10,
    joinDate: Date.now() - 86400000 * 180,
    lastActive: Date.now() - 3600,
    proposalsCreated: 12,
    votesCast: 87,
    delegatedFrom: 24,
    delegatedTo: null,
    badges: ['Founder', 'Top Voter'],
    isCreator: true,
  },
  {
    id: '2',
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958D2D3a8b8b8b8b',
    avatar: '⚡',
    votingPower: 380_000,
    votingPowerPct: 7.3,
    joinDate: Date.now() - 86400000 * 150,
    lastActive: Date.now() - 7200,
    proposalsCreated: 8,
    votesCast: 64,
    delegatedFrom: 15,
    delegatedTo: null,
    badges: ['Core Contributor'],
    isCreator: false,
  },
  {
    id: '3',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    avatar: '🐋',
    votingPower: 290_000,
    votingPowerPct: 5.6,
    joinDate: Date.now() - 86400000 * 120,
    lastActive: Date.now() - 14400,
    proposalsCreated: 3,
    votesCast: 42,
    delegatedFrom: 8,
    delegatedTo: '0x742d...8b8b',
    badges: ['Whale'],
    isCreator: false,
  },
  {
    id: '4',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    avatar: '🦊',
    votingPower: 210_000,
    votingPowerPct: 4,
    joinDate: Date.now() - 86400000 * 90,
    lastActive: Date.now() - 36000,
    proposalsCreated: 5,
    votesCast: 38,
    delegatedFrom: 12,
    delegatedTo: '0x742d...8b8b',
    badges: ['Active Voter'],
    isCreator: false,
  },
  {
    id: '5',
    address: '0x9876543210fedcba9876543210fedcba98765432',
    avatar: '🐻',
    votingPower: 180_000,
    votingPowerPct: 3.5,
    joinDate: Date.now() - 86400000 * 60,
    lastActive: Date.now() - 72000,
    proposalsCreated: 1,
    votesCast: 12,
    delegatedFrom: 3,
    delegatedTo: null,
    badges: [],
    isCreator: false,
  },
  {
    id: '6',
    address: '0x1111222233334444555566667777888899990000',
    avatar: '🦅',
    votingPower: 120_000,
    votingPowerPct: 2.3,
    joinDate: Date.now() - 86400000 * 45,
    lastActive: Date.now() - 108000,
    proposalsCreated: 0,
    votesCast: 8,
    delegatedFrom: 0,
    delegatedTo: '0x742d...8b8b',
    badges: [],
    isCreator: false,
  },
  {
    id: '7',
    address: '0xaaaabbbbccccddddeeeeffff0000111122223333',
    avatar: '🤖',
    votingPower: 85_000,
    votingPowerPct: 1.6,
    joinDate: Date.now() - 86400000 * 30,
    lastActive: Date.now() - 86400,
    proposalsCreated: 2,
    votesCast: 15,
    delegatedFrom: 5,
    delegatedTo: null,
    badges: ['Builder'],
    isCreator: false,
  },
  {
    id: '8',
    address: '0xccccddddeeeeffff0000111122223333aaaabbbb',
    avatar: '👾',
    votingPower: 45_000,
    votingPowerPct: 0.9,
    joinDate: Date.now() - 86400000 * 20,
    lastActive: Date.now() - 172800,
    proposalsCreated: 0,
    votesCast: 3,
    delegatedFrom: 0,
    delegatedTo: '0x8f3C...8b8b',
    badges: [],
    isCreator: false,
  },
];

const MOCK_DELEGATIONS_TO_ME: DelegationEntry[] = [
  {
    id: 'd1',
    delegator: '0x1234...5678',
    delegatorAvatar: '🐋',
    votingPower: 290_000,
    delegatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'd2',
    delegator: '0xabcd...ef01',
    delegatorAvatar: '🦊',
    votingPower: 210_000,
    delegatedAt: Date.now() - 86400000 * 45,
  },
  {
    id: 'd3',
    delegator: '0x1111...0000',
    delegatorAvatar: '🦅',
    votingPower: 120_000,
    delegatedAt: Date.now() - 86400000 * 60,
  },
  {
    id: 'd4',
    delegator: '0x9876...5432',
    delegatorAvatar: '🐻',
    votingPower: 180_000,
    delegatedAt: Date.now() - 86400000 * 15,
  },
];

// ─── Member Row ────────────────────────────────────────────────────────

function MemberRow({
  member,
  rank,
  onDelegate,
  onMessage,
}: {
  member: Member;
  rank: number;
  onDelegate: (addr: string) => void;
  onMessage: (addr: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/20">
      {/* Rank */}
      <span className="w-5 text-center text-[10px] font-bold text-[var(--color-muted)]">
        {rank}
      </span>

      {/* Avatar + Address */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-glass-border)] text-sm">
          {member.avatar}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-fg)]">
              {shortAddr(member.address)}
            </span>
            {member.isCreator && (
              <span className="rounded bg-degen-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-degen-400">
                Creator
              </span>
            )}
            {member.badges.map((badge) => (
              <span
                key={badge}
                className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[8px] text-purple-400"
              >
                {badge}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[9px] text-[var(--color-muted)]">
            <span>{member.proposalsCreated} proposals</span>
            <span>·</span>
            <span>{member.votesCast} votes</span>
            <span>·</span>
            <span>Active {formatTimeAgo(member.lastActive)}</span>
          </div>
        </div>
      </div>

      {/* Voting Power */}
      <div className="hidden sm:block w-28 text-right">
        <div className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
          {member.votingPower.toLocaleString()}
        </div>
        <div className="text-[9px] text-[var(--color-muted)]">
          {member.votingPowerPct.toFixed(1)}% of supply
        </div>
      </div>

      {/* Delegation info */}
      <div className="hidden md:block w-20 text-right text-[10px]">
        {member.delegatedFrom > 0 ? (
          <span className="text-amber-400">{member.delegatedFrom} delegators</span>
        ) : (
          <span className="text-[var(--color-muted)]">—</span>
        )}
        {member.delegatedTo && (
          <div className="text-[8px] text-[var(--color-muted)]">
            → {shortAddr(member.delegatedTo)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDelegate(member.address)}
          className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          Delegate
        </button>
        <button
          type="button"
          onClick={() => onMessage(member.address)}
          className="rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1.5 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Message
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE — Member Directory
// ══════════════════════════════════════════════════════════════════════

export default function MembersPage({ params }: { params: { id: string } }) {
  const [members] = useState<Member[]>(MOCK_MEMBERS);
  const [sortBy, setSortBy] = useState<'votingPower' | 'joinDate' | 'activity'>('votingPower');
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState('');
  const [delegateAddress, setDelegateAddress] = useState('');
  const [showMyDelegation, setShowMyDelegation] = useState(false);

  const sortedMembers = useMemo(() => {
    const sorted = [...members];
    switch (sortBy) {
      case 'votingPower':
        sorted.sort((a, b) => b.votingPower - a.votingPower);
        break;
      case 'joinDate':
        sorted.sort((a, b) => a.joinDate - b.joinDate);
        break;
      case 'activity':
        sorted.sort((a, b) => a.lastActive - b.lastActive);
        break;
    }
    return sorted;
  }, [members, sortBy]);

  // Stats
  const totalMembers = members.length;
  const activeLast30 = members.filter((m) => m.lastActive > Date.now() - 86400000 * 30).length;
  const delegationRate =
    (members.filter((m) => m.delegatedFrom > 0 || m.delegatedTo).length / totalMembers) * 100;

  // Voting power buckets
  const buckets = useMemo(() => {
    const b = { whale: 0, large: 0, medium: 0, small: 0 };
    members.forEach((m) => {
      if (m.votingPower >= 200_000) b.whale++;
      else if (m.votingPower >= 100_000) b.large++;
      else if (m.votingPower >= 50_000) b.medium++;
      else b.small++;
    });
    return b;
  }, [members]);

  // Top contributors
  const topProposers = [...members]
    .sort((a, b) => b.proposalsCreated - a.proposalsCreated)
    .slice(0, 3);
  const topVoters = [...members].sort((a, b) => b.votesCast - a.votesCast).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
          DAO
        </Link>
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
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--color-fg)]">Members</span>
      </div>

      {/* ═══ Header ═══ */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-black text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Members
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {totalMembers} members · {activeLast30} active (30d) · {delegationRate.toFixed(0)}%
            delegation rate
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowMyDelegation(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-xs font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          My Delegation
        </button>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Total Members
          </div>
          <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-fg)]">
            {totalMembers}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Active Voters (30d)
          </div>
          <div className="mt-1 text-xl font-black tabular-nums text-degen-400">{activeLast30}</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Delegation Rate
          </div>
          <div className="mt-1 text-xl font-black tabular-nums text-amber-400">
            {delegationRate.toFixed(0)}%
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Power Concentration
          </div>
          <div className="mt-1 text-[10px] text-[var(--color-fg)]">
            🐋 {buckets.whale} · 🐘 {buckets.large} · 🐭 {buckets.small}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ═══ Member List (spans 2 cols) ═══ */}
        <section aria-label="Member list" className="lg:col-span-2">
          {/* Sort controls */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[10px] font-medium text-[var(--color-muted)]">Sort by:</span>
            <div className="flex gap-1 rounded-lg border border-[var(--color-glass-border)] p-0.5">
              {[
                { key: 'votingPower' as const, label: 'Voting Power' },
                { key: 'joinDate' as const, label: 'Join Date' },
                { key: 'activity' as const, label: 'Activity' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortBy(opt.key)}
                  className={`rounded-md px-2.5 py-1 text-[9px] font-medium transition-colors ${
                    sortBy === opt.key
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {sortedMembers.map((member, i) => (
              <MemberRow
                key={member.id}
                member={member}
                rank={i + 1}
                onDelegate={(addr) => {
                  setDelegateTarget(addr);
                  setShowDelegateModal(true);
                }}
                onMessage={(addr) => {
                  // In a real app, this would open a DM interface
                  alert(`DM to ${shortAddr(addr)} — coming soon`);
                }}
              />
            ))}
          </div>
        </section>

        {/* ═══ Right Sidebar: Stats + Top Contributors ═══ */}
        <div className="space-y-6">
          {/* Voting Power Distribution */}
          <section
            aria-label="Voting power distribution"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Power Distribution</h2>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[var(--color-fg)]">🐋 Whales ({'>'}200K)</span>
                  <span className="font-mono text-[var(--color-muted)]">
                    {buckets.whale} members
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                  <div
                    className="h-full rounded-full bg-degen-500"
                    style={{ width: `${(buckets.whale / totalMembers) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[var(--color-fg)]">🐘 Large (100K-200K)</span>
                  <span className="font-mono text-[var(--color-muted)]">
                    {buckets.large} members
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{ width: `${(buckets.large / totalMembers) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[var(--color-fg)]">🐭 Small ({'<'}50K)</span>
                  <span className="font-mono text-[var(--color-muted)]">
                    {buckets.small} members
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-muted)]"
                    style={{ width: `${(buckets.small / totalMembers) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Top Contributors */}
          <section
            aria-label="Top contributors"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🏆 Top Contributors</h2>

            <div className="mb-3">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Most Proposals
              </h3>
              <div className="space-y-1.5">
                {topProposers.map((m, _i) => (
                  <div key={m.id} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{m.avatar}</span>
                      <span className="text-[var(--color-fg)]">{shortAddr(m.address)}</span>
                    </div>
                    <span className="font-mono text-[var(--color-muted)]">
                      {m.proposalsCreated} props
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Most Votes Cast
              </h3>
              <div className="space-y-1.5">
                {topVoters.map((m, _i) => (
                  <div key={m.id} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{m.avatar}</span>
                      <span className="text-[var(--color-fg)]">{shortAddr(m.address)}</span>
                    </div>
                    <span className="font-mono text-[var(--color-muted)]">{m.votesCast} votes</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ═══ Delegate Modal ═══ */}
      {showDelegateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Delegate voting power"
        >
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl">
            <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
              Delegate Voting Power
            </h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              {delegateTarget
                ? `Delegate your voting power to ${shortAddr(delegateTarget)}`
                : 'Enter the address of the member you want to delegate your voting power to.'}
            </p>

            <div className="mb-4">
              <label
                htmlFor="delegate-addr"
                className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]"
              >
                Delegate Address
              </label>
              <input
                id="delegate-addr"
                type="text"
                value={delegateAddress || delegateTarget}
                onChange={(e) => setDelegateAddress(e.target.value)}
                placeholder="0x... or ens.eth"
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors"
              />
            </div>

            <div className="mb-4 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
              <p className="text-[9px] text-amber-400">
                ⚠️ Delegating transfers your voting power to the selected address. You can revoke or
                change your delegation at any time.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDelegateModal(false);
                  setDelegateTarget('');
                }}
                className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelegateModal(false);
                  setDelegateTarget('');
                  alert('✅ Delegation submitted! (mock)');
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:from-amber-400 hover:to-orange-400 active:scale-95"
              >
                Confirm Delegation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ My Delegation Panel ═══ */}
      {showMyDelegation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="My delegation"
        >
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--color-fg)]">My Delegation</h3>
              <button
                type="button"
                onClick={() => setShowMyDelegation(false)}
                className="rounded-lg p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Who I delegate to */}
            <div className="mb-4 rounded-lg border border-[var(--color-glass-border)] p-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                I Delegate To
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧠</span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      0x742d...8b8b
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      12,500 votes · since March 2026
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Revoke delegation?')) alert('✅ Delegation revoked');
                  }}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Revoke
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMyDelegation(false);
                  setShowDelegateModal(true);
                }}
                className="mt-3 w-full rounded-lg border border-dashed border-[var(--color-glass-border)] py-2 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                + Change Delegate
              </button>
            </div>

            {/* Delegated to me */}
            <div className="rounded-lg border border-[var(--color-glass-border)] p-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Delegated to Me ({MOCK_DELEGATIONS_TO_ME.length} delegators)
              </h4>
              <div className="space-y-2">
                {MOCK_DELEGATIONS_TO_ME.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{d.delegatorAvatar}</span>
                      <span className="font-mono text-[var(--color-fg)]">{d.delegator}</span>
                    </div>
                    <div className="text-right">
                      <span className="tabular-nums text-[var(--color-fg)]">
                        {d.votingPower.toLocaleString()} votes
                      </span>
                      <div className="text-[8px] text-[var(--color-muted)]">
                        {formatTimeAgo(d.delegatedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
