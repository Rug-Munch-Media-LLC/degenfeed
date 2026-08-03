import type { ProposalDetail, VoteEntry } from './types';

export const MOCK_DETAIL: ProposalDetail = {
  id: '1',
  title: 'DIP-12: Fund Cross-Protocol Bridge Development',
  type: 'treasury',
  status: 'active',
  forVotes: 1_240_000,
  againstVotes: 320_000,
  abstainVotes: 80_000,
  quorum: 1_000_000,
  totalVotingPower: 5_200_000,
  endTime: Date.now() + 86400000 * 3,
  createdTime: Date.now() - 86400000 * 4,
  proposer: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b',
  proposerAvatar: '🧠',
  description: `## Summary

This proposal seeks funding for the development of a cross-protocol bridge that will enable seamless communication and asset transfer between Nostr, Farcaster, Lens, and Bluesky.

## Motivation

Currently, each protocol operates in isolation. Creators and users are locked into single ecosystems. A cross-protocol bridge would:

- Allow cross-posting with identity verification
- Enable unified reputation scoring
- Facilitate cross-protocol tipping
- Create a more connected web3 social graph

## Specification

The bridge will consist of:

1. **Relayer Nodes** — Infrastructure to watch events on each protocol
2. **Verification Contract** — Smart contract on Base to verify cross-protocol messages
3. **API Layer** — Unified REST API for querying cross-protocol data
4. **SDK** — Developer toolkit for integrating the bridge

## Budget Breakdown

| Item | Amount |
|------|--------|
| Smart Contract Development | 15 ETH |
| Relayer Infrastructure (6mo) | 20 ETH |
| API & SDK Development | 10 ETH |
| Security Audit | 5 ETH |
| **Total** | **50 ETH** |

## Timeline

- Month 1-2: Smart contract development and audit
- Month 3-4: Relayer nodes and API layer
- Month 5: SDK and documentation
- Month 6: Launch and monitoring`,
  discussionLink: 'https://forum.degenfeed.xyz/t/dip-12-cross-protocol-bridge',
  recipient: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b',
  amount: '50',
  token: 'ETH',
  paymentType: 'Milestone-based',
};

export const MOCK_VOTES: VoteEntry[] = [
  {
    voter: '0x1234...5678',
    voterAvatar: '🐋',
    choice: 'for',
    votingPower: 450_000,
    reason:
      'Essential infrastructure for the ecosystem. The cross-protocol bridge will unlock massive value.',
    timestamp: Date.now() - 3600000 * 12,
    delegated: false,
  },
  {
    voter: '0xabcd...ef01',
    voterAvatar: '🦊',
    choice: 'for',
    votingPower: 280_000,
    reason: 'We need this yesterday. Great proposal, well scoped.',
    timestamp: Date.now() - 3600000 * 10,
    delegated: true,
  },
  {
    voter: '0x9876...5432',
    voterAvatar: '🐻',
    choice: 'against',
    votingPower: 190_000,
    reason: 'Too expensive. We should start with an MVP at 20 ETH max.',
    timestamp: Date.now() - 3600000 * 8,
    delegated: false,
  },
  {
    voter: '0x2468...1357',
    voterAvatar: '🦅',
    choice: 'for',
    votingPower: 150_000,
    reason: '',
    timestamp: Date.now() - 3600000 * 6,
    delegated: false,
  },
  {
    voter: '0x1357...2468',
    voterAvatar: '🤖',
    choice: 'abstain',
    votingPower: 80_000,
    reason: 'Need more technical details before deciding.',
    timestamp: Date.now() - 3600000 * 4,
    delegated: true,
  },
  {
    voter: '0x1122...3344',
    voterAvatar: '👾',
    choice: 'for',
    votingPower: 60_000,
    reason: "Let's build!",
    timestamp: Date.now() - 3600000 * 2,
    delegated: false,
  },
];
