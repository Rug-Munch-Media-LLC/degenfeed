'use client';

/**
 * @degenfeed/web — DAO Governance API hook
 *
 * Frontend client for the DAO backend API (/api/dao/*).
 * All endpoints require session auth handled by the worker cookies.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

// ─── Types ─────────────────────────────────────────────────────────────

export type DaoVisibility = 'public' | 'private' | 'unlisted';
export type ProposalStatus = 'active' | 'passed' | 'failed' | 'cancelled' | 'queued' | 'executed';
export type ProposalType =
  | 'text'
  | 'transfer'
  | 'config_change'
  | 'membership'
  | 'grant'
  | 'stream'
  | 'custom';
export type VoteChoice = 'for' | 'against' | 'abstain';
export type ActivityType =
  | 'proposal_created'
  | 'proposal_passed'
  | 'proposal_failed'
  | 'proposal_executed'
  | 'vote_cast'
  | 'member_joined'
  | 'member_left'
  | 'treasury_transfer'
  | 'treasury_stream_started'
  | 'delegation_changed'
  | 'grant_created'
  | 'grant_milestone_completed';

export interface GovernanceParams {
  votingPeriod: number;
  quorumPercent: number;
  minDelay: number;
  executeWindow: number;
  proposalThreshold: number;
  votingDelay: number;
}

export interface Dao {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  banner?: string;
  creator: string;
  createdAt: number;
  chain: 'ethereum' | 'solana' | 'base' | 'polygon';
  contractAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  visibility: DaoVisibility;
  memberCount: number;
  proposalCount: number;
  treasuryValue?: string;
  tags?: string[];
  website?: string;
  discord?: string;
  twitter?: string;
  governance: GovernanceParams;
}

export interface Proposal {
  id: string;
  daoId: string;
  title: string;
  description: string;
  creator: string;
  createdAt: number;
  startAt: number;
  endAt: number;
  status: ProposalStatus;
  type: ProposalType;
  targets?: string[];
  values?: string[];
  calldatas?: string[];
  descriptionHash?: string;
  voteSummary?: {
    for: number;
    against: number;
    abstain: number;
    totalPower: number;
  };
  executedAt?: number;
  executionTxHash?: string;
  queuedAt?: number;
}

export interface VoteRecord {
  votes: Array<{
    voter: string;
    choice: VoteChoice;
    power: number;
    timestamp: number;
  }>;
  totals: { for: number; against: number; abstain: number };
  totalPowerParticipated: number;
}

export interface Delegation {
  delegator: string;
  delegate: string;
  amount: number;
  timestamp: number;
}

export interface MemberInfo {
  address: string;
  votingPower: number;
  delegation: Delegation | null;
  isCreator: boolean;
}

export interface TreasuryOverview {
  totalBalance: string;
  tokenCount: number;
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    balance: string;
    valueUsd: number;
  }>;
  nativeBalance: string;
  nativeValueUsd: number;
  updatedAt: number;
}

export interface TreasuryTransaction {
  id: string;
  daoId: string;
  type: 'transfer' | 'stream' | 'grant' | 'deposit' | 'swap';
  from: string;
  to: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  amount: string;
  valueUsd: number;
  txHash?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  proposalId?: string;
}

export interface DaoStats {
  daoId: string;
  displayName: string;
  members: number;
  proposals: number;
  activeProposals: number;
  passedProposals: number;
  totalVotes: number;
  treasuryValue: string;
  treasuryTokens: number;
  treasuryNativeValue: number;
  createdAt: number;
}

export interface MemberListResponse {
  data: MemberInfo[];
  meta: { total: number; daoId: string; totalVotingPower: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; limit: number; nextCursor?: string };
}

// ─── API Helpers ──────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `API error: ${res.status}`);
  return body as T;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useDaoList() {
  const [daos, setDaos] = useState<Dao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDaos = useCallback(
    async (params?: { search?: string; tag?: string; chain?: string; sort?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.search) qs.set('search', params.search);
        if (params?.tag) qs.set('tag', params.tag);
        if (params?.chain) qs.set('chain', params.chain);
        if (params?.sort) qs.set('sort', params.sort);
        const res = await apiFetch<PaginatedResponse<Dao>>(
          `/api/dao/discover${qs.toString() ? `?${qs}` : ''}`,
        );
        setDaos(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load DAOs');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { daos, loading, error, fetchDaos };
}

export function useMyDaos() {
  const { primaryIdentity: user } = useAuth();
  const [daos, setDaos] = useState<Dao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiFetch<{ data: Dao[] }>('/api/dao/mine')
      .then((res) => setDaos(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return { daos, loading };
}

export function useDao(daoId: string | undefined) {
  const [dao, setDao] = useState<Dao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDao = useCallback(async () => {
    if (!daoId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ dao: Dao }>(`/api/dao/${daoId}`);
      setDao(res.dao);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DAO');
    } finally {
      setLoading(false);
    }
  }, [daoId]);

  useEffect(() => {
    fetchDao();
  }, [fetchDao]);

  return { dao, loading, error, refetch: fetchDao };
}

export function useDaoStats(daoId: string | undefined) {
  const [stats, setStats] = useState<DaoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!daoId) return;
    apiFetch<DaoStats>(`/api/dao/${daoId}/stats`)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [daoId]);

  return { stats, loading };
}

export function useDaoMembers(daoId: string | undefined) {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [meta, setMeta] = useState<MemberListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!daoId) return;
    setLoading(true);
    try {
      const res = await apiFetch<MemberListResponse>(`/api/dao/${daoId}/members`);
      setMembers(res.data);
      setMeta(res.meta);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [daoId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, meta, loading, refetch: fetchMembers };
}

export function useDaoProposals(daoId: string | undefined) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(
    async (status?: ProposalStatus) => {
      if (!daoId) return;
      setLoading(true);
      try {
        const qs = status ? `?status=${status}` : '';
        const res = await apiFetch<PaginatedResponse<Proposal>>(`/api/dao/${daoId}/proposals${qs}`);
        setProposals(res.data);
        setMeta(res.meta);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [daoId],
  );

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { proposals, meta, loading, refetch: fetchProposals };
}

export function useDaoProposal(daoId: string | undefined, proposalId: string | undefined) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!daoId || !proposalId) return;
    apiFetch<{ proposal: Proposal }>(`/api/dao/${daoId}/proposals/${proposalId}`)
      .then((res) => setProposal(res.proposal))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [daoId, proposalId]);

  return { proposal, loading };
}

export function useDaoProposalVotes(daoId: string | undefined, proposalId: string | undefined) {
  const [voteRecord, setVoteRecord] = useState<VoteRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!daoId || !proposalId) return;
    apiFetch<VoteRecord>(`/api/dao/${daoId}/proposals/${proposalId}/votes`)
      .then(setVoteRecord)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [daoId, proposalId]);

  return { voteRecord, loading };
}

// ─── Action Functions (for calling from event handlers) ──────────────

export const daoActions = {
  async create(data: {
    name: string;
    displayName?: string;
    description: string;
    chain?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    visibility?: DaoVisibility;
    icon?: string;
    banner?: string;
    tags?: string[];
    website?: string;
    discord?: string;
    twitter?: string;
    governance?: Partial<GovernanceParams>;
  }): Promise<Dao> {
    const res = await apiFetch<{ dao: Dao }>('/api/dao/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.dao;
  },

  async update(daoId: string, data: Partial<Dao>): Promise<Dao> {
    const res = await apiFetch<{ dao: Dao }>(`/api/dao/${daoId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.dao;
  },

  async join(daoId: string): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/join`, { method: 'POST' });
  },

  async leave(daoId: string): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/leave`, { method: 'POST' });
  },

  async createProposal(
    daoId: string,
    data: {
      title: string;
      description: string;
      type?: ProposalType;
      targets?: string[];
      values?: string[];
      calldatas?: string[];
    },
  ): Promise<Proposal> {
    const res = await apiFetch<{ proposal: Proposal }>(`/api/dao/${daoId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.proposal;
  },

  async cancelProposal(daoId: string, proposalId: string): Promise<Proposal> {
    const res = await apiFetch<{ proposal: Proposal }>(
      `/api/dao/${daoId}/proposals/${proposalId}`,
      {
        method: 'DELETE',
      },
    );
    return res.proposal;
  },

  async vote(daoId: string, proposalId: string, choice: VoteChoice): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/proposals/${proposalId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ choice }),
    });
  },

  async queueProposal(daoId: string, proposalId: string): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/proposals/${proposalId}/queue`, { method: 'POST' });
  },

  async executeProposal(daoId: string, proposalId: string): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/proposals/${proposalId}/execute`, { method: 'POST' });
  },

  async delegate(daoId: string, delegate: string, amount?: number): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/delegate`, {
      method: 'POST',
      body: JSON.stringify({ delegate, amount }),
    });
  },

  async revokeDelegation(daoId: string): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/revoke-delegation`, { method: 'POST' });
  },

  async getTreasury(daoId: string): Promise<TreasuryOverview> {
    const res = await apiFetch<{ data: TreasuryOverview }>(`/api/dao/${daoId}/treasury`);
    return res.data;
  },

  async getTreasuryTransactions(daoId: string): Promise<TreasuryTransaction[]> {
    const res = await apiFetch<{ data: TreasuryTransaction[] }>(
      `/api/dao/${daoId}/treasury/transactions`,
    );
    return res.data;
  },

  async transferTreasury(
    daoId: string,
    data: { to: string; amount: string; tokenAddress?: string; tokenSymbol?: string },
  ): Promise<void> {
    await apiFetch(`/api/dao/${daoId}/treasury/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
