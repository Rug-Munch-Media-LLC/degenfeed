export type VoteChoice = 'for' | 'against' | 'abstain';

export interface VoteEntry {
  voter: string;
  voterAvatar: string;
  choice: VoteChoice;
  votingPower: number;
  reason?: string;
  timestamp: number;
  delegated: boolean;
}

export interface ProposalDetail {
  id: string;
  title: string;
  type: 'standard' | 'treasury' | 'constitutional' | 'signaling';
  status: 'active' | 'passed' | 'failed' | 'executed';
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  totalVotingPower: number;
  endTime: number;
  createdTime: number;
  proposer: string;
  proposerAvatar: string;
  description: string;
  discussionLink?: string;
  recipient?: string;
  amount?: string;
  token?: string;
  paymentType?: string;
  queuedTime?: number;
  executeTime?: number;
  txHash?: string;
}
