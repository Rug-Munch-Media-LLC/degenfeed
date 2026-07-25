import type { ConstitutionalParam, ProposalType } from './types';

export const PROPOSAL_TYPES: {
  value: ProposalType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Simple majority vote for general decisions',
    icon: '📋',
  },
  {
    value: 'treasury',
    label: 'Treasury',
    description: 'Spending proposal with amount and recipient',
    icon: '💰',
  },
  {
    value: 'constitutional',
    label: 'Constitutional',
    description: 'Parameter changes to DAO governance',
    icon: '⚖️',
  },
  {
    value: 'signaling',
    label: 'Signaling',
    description: 'Non-binding temperature check',
    icon: '📡',
  },
];

export const CONSTITUTIONAL_PARAMS: ConstitutionalParam[] = [
  {
    key: 'quorum',
    label: 'Quorum Threshold',
    currentValue: '10%',
    description: 'Minimum voting power required for a valid vote',
    unit: '%',
  },
  {
    key: 'threshold',
    label: 'Approval Threshold',
    currentValue: '60%',
    description: 'Percentage of FOR votes required to pass',
    unit: '%',
  },
  {
    key: 'votingPeriod',
    label: 'Voting Period',
    currentValue: '7 days',
    description: 'Duration of the voting window',
    unit: 'days',
  },
  {
    key: 'timelock',
    label: 'Timelock Duration',
    currentValue: '48 hours',
    description: 'Delay before execution after passing',
    unit: 'hours',
  },
  {
    key: 'delegation',
    label: 'Delegation Enabled',
    currentValue: 'Yes',
    description: 'Allow voting power delegation',
    unit: '',
  },
];

export const MOCK_TOKENS = ['ETH', 'USDC', 'DEGEN', 'SOL', 'ARB', 'OP'];
