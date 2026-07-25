'use client';

import type { CoinFormState, EcoPreset } from './types';

export const ECO_PRESETS: Record<
  EcoPreset,
  { label: string; description: string; initialUnlock: string; vestingPeriod: string; risk: string }
> = {
  fast: {
    label: 'FAST',
    description: '20% initial unlock, 7-day vesting — get your tokens fast',
    initialUnlock: '20%',
    vestingPeriod: '7 days',
    risk: 'Higher sell pressure risk',
  },
  standard: {
    label: 'STANDARD',
    description: '10% initial unlock, 90-day linear vesting — balanced approach',
    initialUnlock: '10%',
    vestingPeriod: '90 days',
    risk: 'Standard market risk',
  },
  trustless: {
    label: 'TRUSTLESS',
    description: '0% initial unlock, 730-day vesting — maximum trust signal',
    initialUnlock: '0%',
    vestingPeriod: '730 days (2 years)',
    risk: 'Maximizes holder confidence',
  },
};

export const CATEGORY_TAGS = [
  'meme',
  'defi',
  'nft',
  'gaming',
  'social',
  'creator',
  'music',
  'art',
  'sports',
];

export const BONDING_PHASES_DISPLAY = [
  { name: 'Steal Deal', range: '0-20%', color: '#00ff41', desc: 'Lowest price entry' },
  { name: 'Early Bird', range: '20-40%', color: '#22dd88', desc: 'Still early' },
  { name: 'Cruise Control', range: '40-60%', color: '#ffcc00', desc: 'Steady growth' },
  { name: 'Final Call', range: '60-80%', color: '#ff8800', desc: 'Last chance' },
  { name: 'Moonshot', range: '80-100%', color: '#ff4444', desc: 'Graduation imminent' },
];

export const INITIAL_STATE: CoinFormState = {
  name: '',
  symbol: '',
  description: '',
  imagePreview: '',
  tags: [],
  ecoPreset: 'standard',
  treasuryAllocation: 5,
  creatorAllocation: 10,
  antiSniper: true,
  antiWhale: true,
  cooldownPeriod: 30,
  bundlerDetection: true,
  mevProtection: true,
  tokenGatedContent: false,
  minTokensForAccess: '1000',
  revenueShare: false,
  revenueSharePercent: 5,
  governanceEnabled: false,
  communityAccess: false,
  communityLink: '',
  amaScheduling: false,
  deployTarget: 'base',
  deploying: false,
  deployProgress: 0,
  deployed: false,
  deployedAddress: '',
  txHash: '',
  daoEnabled: false,
  daoVotingModel: 'token',
  daoProposalThreshold: 0.5,
  daoQuorumPercent: 15,
  daoVotingPeriodDays: 7,
  daoTimelockDelayHours: 24,
  daoSingerCount: 3,
  daoThreshold: 2,
  daoStreamingEnabled: false,
  daoGrantProgramEnabled: false,
  daoDeploying: false,
  daoDeployProgress: 0,
  daoDeployed: false,
  daoAddress: '',
  daoTxHash: '',
  daoSkipped: false,
};
