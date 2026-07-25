'use client';

export type EcoPreset = 'fast' | 'standard' | 'trustless';

export interface CoinFormState {
  name: string;
  symbol: string;
  description: string;
  imagePreview: string;
  tags: string[];
  ecoPreset: EcoPreset;
  treasuryAllocation: number;
  creatorAllocation: number;
  antiSniper: boolean;
  antiWhale: boolean;
  cooldownPeriod: 30 | 60 | 120;
  bundlerDetection: boolean;
  mevProtection: boolean;
  tokenGatedContent: boolean;
  minTokensForAccess: string;
  revenueShare: boolean;
  revenueSharePercent: number;
  governanceEnabled: boolean;
  communityAccess: boolean;
  communityLink: string;
  amaScheduling: boolean;
  deployTarget: 'base' | 'solana' | 'both';
  deploying: boolean;
  deployProgress: number;
  deployed: boolean;
  deployedAddress: string;
  txHash: string;
  daoEnabled: boolean;
  daoVotingModel: 'token' | 'quadratic';
  daoProposalThreshold: number;
  daoQuorumPercent: number;
  daoVotingPeriodDays: number;
  daoTimelockDelayHours: number;
  daoSingerCount: number;
  daoThreshold: number;
  daoStreamingEnabled: boolean;
  daoGrantProgramEnabled: boolean;
  daoDeploying: boolean;
  daoDeployProgress: number;
  daoDeployed: boolean;
  daoAddress: string;
  daoTxHash: string;
  daoSkipped: boolean;
}
