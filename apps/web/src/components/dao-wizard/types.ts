'use client';

export type VotingModel = 'token' | 'quadratic';
export type VotingPeriod = 1 | 3 | 7 | 14;
export type TimelockDelay = 0 | 24 | 48 | 168;

export interface SignerEntry {
  address: string;
  label: string;
}

export interface DAOFormState {
  name: string;
  description: string;
  avatarUrl: string;
  tags: string[];
  twitter: string;
  discord: string;
  telegram: string;
  website: string;
  votingTokenType: 'existing' | 'new';
  existingCoinId: string;
  newTokenName: string;
  newTokenSymbol: string;
  newTokenSupply: string;
  votingModel: VotingModel;
  proposalThreshold: number;
  quorumPercent: number;
  votingPeriodDays: VotingPeriod;
  timelockDelayHours: TimelockDelay;
  initialFunding: string;
  signers: SignerEntry[];
  threshold: number;
  opsPercent: number;
  grantsPercent: number;
  reservePercent: number;
  streamingEnabled: boolean;
  grantProgramEnabled: boolean;
  deploying: boolean;
  deployProgress: number;
  deployed: boolean;
  deployedAddress: string;
  txHash: string;
  snapshotSpaceId: string;
  selectedTemplate: string | null;
}
