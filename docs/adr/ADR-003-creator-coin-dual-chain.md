# ADR-003: Creator Coin Architecture — EVM + Solana Dual-Chain

**Status:** Accepted
**Date:** 2026-07-25
**Author:** Web3 Engineering
**Deciders:** @crmuncher, Web3 Team

---

## Context

DegenFeed's creator economy model allows any user to deploy a personal token through a bonding curve. User base spans both Solana (~60%) and EVM (~40%). Choosing a single chain would alienate a large portion. Requirements:

1. **Creator deployment on either chain** — Solana (cheap gas) or Base (EVM compatibility)
2. **Unified cross-chain identity** — Same asset on both chains via canonical source of truth
3. **Bonding curve economics** — Phased curve with graduation to AMM
4. **Anti-exploit safeguards** — No sniper bots, frontrunning, or whale manipulation
5. **DAO governance on graduation** — Auto-deployed with treasury, voting, timelock

## Decision

Dual-chain architecture with Solana (primary) and Base (secondary), connected via Wormhole.

### Architecture

```
Solana (Primary)                       Base / EVM (Wrapped)
  ┌─────────────────────┐              ┌───────────────────────┐
  │ Anchor Program      │              │ DegenFeedCoin.sol     │
  │ BondingCurve        │              │ - Bonding curve (5)   │
  │ CreatorVesting      │              │ - Anti-whale/sniper   │
  │ Token-2022 (SPL)    │              │ - CrossChainBridge    │
  └──────────┬──────────┘              └──────────┬────────────┘
             └──── Wormhole VAA ──────────────────┘
  ┌─────────────────────┐              ┌───────────────────────┐
  │ Jupiter DEX         │              │ Uniswap V4            │
  │ Squads/Realms DAO   │              │ OZ Governor DAO       │
  └─────────────────────┘              └───────────────────────┘
```

### Bonding Curve 2.0 — 5 Eras

| Era | Name | Price Formula | Trigger |
|-----|------|-------------|---------|
| 0 | Steal Deal | `P = S × 0.00000001` | First 500 holders or 24h |
| 1 | Early Bird | `P = S × 0.00000005` | 2,000 holders or 7 days |
| 2 | Cruise Control | `P = S² × 0.000000002` | 25% supply or 30 days |
| 3 | Final Call | `P = S³ × 0.00000000003` | 50% supply or 60 days |
| 4 | Moonshot | `P = S⁴ × 0.000000000001` | 80% supply → Graduation |

**Graduation:** Liquidity deployed to Jupiter (Solana) or Uniswap V4 (Base). LP tokens sent to DAO treasury.

### Anti-Exploit Measures

| Exploit | Solana | EVM |
|---|---|---|
| Sniper bots | Priority fee filter on Era 0-1 | `lastBuyBlock` cooldown (3 blocks) |
| Whale accumulation | Token-2022 hook: max 1% wallet Era 0-2, 3% Era 3-4 | `maxWalletPercent = 2%` |
| Rug pulls | `CreatorVesting` PDA — time-locked | `VestingWallet` contract |
| Flash loans | Not applicable (no Solana flash loans) | `ReentrancyGuard`, `Pausable` |

### DAO on Graduation

| Component | Solana | Base |
|---|---|---|
| Treasury | Squads multisig (3/5) | Safe (Gnosis) multisig |
| Voting | Realms (SPL Governance) | OZ Governor |
| Quorum | 5% supply | 5% supply |
| Voting period | 72 hours | 72 hours |
| Execution delay | 24h timelock | 24h TimelockController |

### Fee Structure
- Platform fee: 0.5% (50 bps) — DegenFeed treasury
- Creator fee: 0-2% (0-200 bps) — Creator wallet (max 2%)
- Max total: 2.5% (250 bps)

## Consequences

### Positive
1. **Maximum ecosystem reach** — Both Solana and EVM users served natively
2. **Bonding curve 2.0 creates clear UX** — 5-phase narrative drives participation
3. **Token-2022 hooks reduce attack surface** — Fee enforcement at protocol level
4. **DAO auto-deployment removes governance friction** — No manual setup needed
5. **Wormhole is battle-tested** — $50B+ cross-chain volume

### Negative
1. **Dual-chain doubles development complexity** — Two codebases, two testing frameworks
2. **Wormhole bridging latency** — VAA finality ~30s Solana, ~1-3min EVM
3. **Token-2022 not universally supported** — Fallback standard SPL wrapper provided
4. **Regulatory uncertainty** — Mitigated by geo-blocking, non-investment framing, legal counsel
5. **Gas costs on Base** — Small trades under $1 uneconomical; routed through Solana during bonding
