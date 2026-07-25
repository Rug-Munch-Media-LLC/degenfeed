'use client';

import { useMemo, useState } from 'react';
import { MOCK_DAO } from '../layout';
import type { TokenBalance, Transaction, StreamCard, GrantCard, IncomeExpense } from '../../../../components/dao-treasury/_helpers';
import { OverviewTab, HistoryTab, StreamsTab, GrantsTab, AnalyticsTab } from '../../../../components/dao-treasury';

const MOCK_TOKENS: TokenBalance[] = [
  { symbol: 'ETH', name: 'Ether', amount: 180.5, usdValue: 613_700, color: '#627EEA', location: 'treasury' },
  { symbol: 'USDC', name: 'USD Coin', amount: 320_000, usdValue: 320_000, color: '#2775CA', location: 'treasury' },
  { symbol: 'DEGEN', name: 'DegenFeed Token', amount: 1_200_000, usdValue: 180_000, color: '#FF6B35', location: 'treasury' },
  { symbol: 'SOL', name: 'Solana', amount: 1_200, usdValue: 128_000, color: '#9945FF', location: 'treasury' },
  { symbol: 'stETH', name: 'Lido Staked ETH', amount: 50.2, usdValue: 170_680, color: '#00A3FF', location: 'investment' },
  { symbol: 'AERO', name: 'Aerodrome LP', amount: 12_500, usdValue: 45_000, color: '#0052FF', location: 'investment' },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', date: Date.now() - 7200000, type: 'stream', amount: '250 USDC', usdValue: 250, recipient: '0x742d35Cc6634C0532925a3b844Bc4aD1', status: 'completed', description: 'Contributor stream payment' },
  { id: '2', date: Date.now() - 86400000, type: 'grant', amount: '5,000 USDC', usdValue: 5000, recipient: '0x8fC5bD2E6cBc5AaD6fB6fC5', status: 'completed', description: 'Q3 Development Grant' },
  { id: '3', date: Date.now() - 172800000, type: 'swap', amount: '10 ETH → 34,000 USDC', usdValue: 34000, recipient: '---', status: 'completed', description: 'Treasury rebalancing via Aerodrome' },
  { id: '4', date: Date.now() - 259200000, type: 'transfer', amount: '2.5 ETH', usdValue: 8500, recipient: '0x1FcE9FcB6cFfDF1234', status: 'completed', description: 'Security audit payment' },
  { id: '5', date: Date.now() - 345600000, type: 'investment', amount: '50 ETH', usdValue: 170_000, recipient: 'Lido Staking', status: 'completed', description: 'Stake 50 ETH in Lido' },
  { id: '6', date: Date.now() - 432000000, type: 'stream', amount: '1,200 USDC', usdValue: 1200, recipient: '0xAbcDeF1234567890', status: 'pending', description: 'Monthly contributor payroll' },
  { id: '7', date: Date.now() - 518400000, type: 'grant', amount: '10,000 USDC', usdValue: 10000, recipient: '0xFfGgHh123456', status: 'pending', description: 'Marketing Grant — Awaiting approval' },
  { id: '8', date: Date.now() - 604800000, type: 'swap', amount: '5 ETH → 1,250 DEGEN', usdValue: 17000, recipient: '---', status: 'failed', description: 'DEGEN buy — slippage exceeded' },
];

const MOCK_STREAMS: StreamCard[] = [
  { id: 's1', recipient: '0x742d35Cc6634C0532925a3b844Bc4aD1', label: 'Lead Developer', tokenSymbol: 'USDC', flowRateFormatted: '0.001157/sec', monthlyFormatted: '3,000 USDC/mo', totalStreamed: '12,500', totalStreamedUsd: 12500, duration: 7776000000, startedAt: Date.now() - 7776000000, paused: false },
  { id: 's2', recipient: '0x8fC5bD2E6cBc5AaD6fB6fC5', label: 'Community Manager', tokenSymbol: 'USDC', flowRateFormatted: '0.000579/sec', monthlyFormatted: '1,500 USDC/mo', totalStreamed: '4,500', totalStreamedUsd: 4500, duration: null, startedAt: Date.now() - 2592000000, paused: false },
  { id: 's3', recipient: '0xAbcDeF1234567890', label: 'Designer', tokenSymbol: 'ETH', flowRateFormatted: '0.000002/sec', monthlyFormatted: '5 ETH/mo', totalStreamed: '8.2', totalStreamedUsd: 27880, duration: 5184000000, startedAt: Date.now() - 5184000000, paused: true },
];

const MOCK_GRANTS: GrantCard[] = [
  { id: 'g1', title: 'Cross-Chain Bridge Development', applicant: '0x7a2E...cF41', requestedAmount: '25,000 USDC', category: 'Development', status: 'Funded', progress: 66, submittedAt: Date.now() - 7776000000 },
  { id: 'g2', title: 'Community Growth Campaign', applicant: '0x3F1b...9A02', requestedAmount: '10,000 USDC', category: 'Marketing', status: 'Under Review', progress: 0, submittedAt: Date.now() - 2592000000 },
  { id: 'g3', title: 'Protocol Research Paper', applicant: '0x9D8e...4B77', requestedAmount: '5,000 USDC', category: 'Research', status: 'Approved', progress: 0, submittedAt: Date.now() - 864000000 },
  { id: 'g4', title: 'Bug Bounty Program', applicant: '0xE5f6...1C33', requestedAmount: '15,000 USDC', category: 'Development', status: 'Completed', progress: 100, submittedAt: Date.now() - 15552000000 },
];

const MOCK_INCOME_EXPENSE: IncomeExpense[] = [
  { month: 'Jan', income: 18500, expenses: 12500 },
  { month: 'Feb', income: 22300, expenses: 14800 },
  { month: 'Mar', income: 19100, expenses: 16200 },
  { month: 'Apr', income: 27600, expenses: 15800 },
  { month: 'May', income: 30400, expenses: 17300 },
  { month: 'Jun', income: 25800, expenses: 19100 },
];

export default function TreasuryPage() {
  const [txFilter, setTxFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'streams' | 'grants' | 'analytics'>('overview');

  const filteredTxs = useMemo(() => {
    if (txFilter === 'All') return MOCK_TRANSACTIONS;
    return MOCK_TRANSACTIONS.filter((tx) => tx.type === txFilter.toLowerCase());
  }, [txFilter]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black">Treasury</h1>
        <p className="text-sm text-[var(--color-muted)]">Manage DAO funds, streams, grants, and investments</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        {(['overview', 'transactions', 'streams', 'grants', 'analytics'] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'transactions' ? 'History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab tokens={MOCK_TOKENS} incomeExpense={MOCK_INCOME_EXPENSE} treasuryAssetCount={MOCK_DAO.treasuryTokens.length} />}
      {activeTab === 'transactions' && <HistoryTab transactions={filteredTxs} filter={txFilter} setFilter={setTxFilter} />}
      {activeTab === 'streams' && <StreamsTab streams={MOCK_STREAMS} />}
      {activeTab === 'grants' && <GrantsTab grants={MOCK_GRANTS} />}
      {activeTab === 'analytics' && <AnalyticsTab data={MOCK_INCOME_EXPENSE} />}
    </div>
  );
}
