export type ProposalType = 'standard' | 'treasury' | 'constitutional' | 'signaling';

export interface Milestone {
  id: string;
  description: string;
  amount: string;
  token: string;
}

export interface ConstitutionalParam {
  key: string;
  label: string;
  currentValue: string;
  description: string;
  unit: string;
}
