'use client';

import type { DAOFormState, TimelockDelay, VotingModel, VotingPeriod } from './types';

export const CATEGORY_TAGS = [
  'defi',
  'nft',
  'social',
  'gaming',
  'grant',
  'investment',
  'protocol',
  'creator',
  'music',
  'art',
];

export const VOTING_MODEL_DESCRIPTIONS: Record<
  VotingModel,
  { label: string; description: string; bestFor: string }
> = {
  token: {
    label: '1 Token = 1 Vote',
    description: 'Standard weighted voting. More tokens = more voting power.',
    bestFor: 'Treasury management, parameter changes, investment decisions',
  },
  quadratic: {
    label: 'Quadratic Voting',
    description: 'Voting power = sqrt(tokens). Reduces whale dominance.',
    bestFor: 'Community grants, content decisions, social proposals',
  },
};

export const TIMELOCK_OPTIONS: { value: TimelockDelay; label: string }[] = [
  { value: 0, label: 'No timelock' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 168, label: '7 days' },
];

export const VOTING_PERIOD_OPTIONS: { value: VotingPeriod; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
];

export const MOCK_USER_COINS: { id: string; name: string; symbol: string; balance: string }[] = [
  { id: '0x1234...abcd', name: 'Alice Coin', symbol: 'ALICE', balance: '1000000' },
  { id: '0x5678...ef01', name: 'Bob Token', symbol: 'BOB', balance: '500000' },
  { id: '0x9012...3456', name: 'Creator Fund', symbol: 'CFND', balance: '2000000' },
];

export const INITIAL_STATE: DAOFormState = {
  name: '',
  description: '',
  avatarUrl: '',
  tags: [],
  twitter: '',
  discord: '',
  telegram: '',
  website: '',
  votingTokenType: 'existing',
  existingCoinId: '',
  newTokenName: '',
  newTokenSymbol: '',
  newTokenSupply: '1000000',
  votingModel: 'token',
  proposalThreshold: 1,
  quorumPercent: 15,
  votingPeriodDays: 7,
  timelockDelayHours: 24,
  initialFunding: '0.1',
  signers: [{ address: '', label: '' }],
  threshold: 1,
  opsPercent: 50,
  grantsPercent: 30,
  reservePercent: 20,
  streamingEnabled: false,
  grantProgramEnabled: false,
  deploying: false,
  deployProgress: 0,
  deployed: false,
  deployedAddress: '',
  txHash: '',
  snapshotSpaceId: '',
  selectedTemplate: null,
};
