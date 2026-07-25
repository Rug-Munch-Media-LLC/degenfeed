# Open Source DAO Framework Research

**Research Date:** 2026-07-25  
**Objective:** Extract best security patterns, missing features, and anti-patterns from the DAO ecosystem

---

## 1. Aragon OSx

**Repo:** [aragon/osx](https://github.com/aragon/osx)  
**Type:** Plugin-based modular DAO framework  
**Language:** Solidity  

### Best Patterns to Adopt

| Pattern | Description | Adopt? |
|---------|-------------|--------|
| **Plugin Registry** | DAO functionality packaged as installable plugins (voting, treasury, membership). Enables clean upgrades without proxy migration. | ✅ **Yes** — Break monolithic governor into plugins |
| **Permission Manager** | `PermissionManager` with `grantPermission` / `revokePermission` replaces custom `hasRole` logic. Oracle-based permission checking is gas-efficient. | ✅ **Yes** — Replace our custom `hasRole` |
| **DAO Factory with CREATE3** | Deterministic address deployment via CREATE3, used to predict plugin addresses before deployment. | ✅ **Yes** — Our factory already uses CREATE2-like pattern |
| **Multisig Plugin** | Built-in multisig with signing threshold and execution, separate from governance voting. | ✅ **Yes** — Aligns with our MultiSigTreasury |
| **Governance Wrapped ERC20** | Similar to our DAOTokenWrapper — lock tokens for voting power. | Already implemented |

### Missing Features vs Aragon

| Feature | Aragon | DegenFeed |
|---------|--------|-----------|
| Protocol-managed DAO | ✅ Native | ❌ Not available |
| Plugin upgradeability | ✅ PluginDAO pattern | ❌ Monolithic contracts |
| Permission oracles | ✅ Oracle-based access | ❌ Custom hasRole |
| Membership NFTs | ✅ Subdomain NFTs | ❌ Not implemented |

### Anti-Patterns to Avoid

| Anti-Pattern | Why |
|-------------|-----|
| **Over-abstracted permission system** | Aragon's `PermissionOracle` can be confusing. Use simple roles for typical use cases. |
| **Complex upgrade paths** | Plugin upgrade hooks need careful state migration. Simpler is safer. |

---

## 2. Compound Governor (Bravo)

**Repo:** [compound-finance/compound-protocol](https://github.com/compound-finance/compound-protocol)  
**Type:** De facto standard for on-chain governance  
**Language:** Solidity  

### Best Patterns to Adopt

| Pattern | Description | Adopt? |
|---------|-------------|--------|
| **Proposal Lifecycle** | Pending → Active → Defeated/Succeeded → Queued → Executed — clean state machine | ✅ **Yes** — Already using this model |
| **Timelock Integration** | Proposals queued through TimelockController, with mandatory delay | ✅ **Yes** — Already implemented |
| **Vote Weight Calculation** | Votes computed at proposal creation snapshot, preventing flash loans | ⚠️ **Partial** — Need snapshot-based check |
| **Proposal Threshold Tiers** | Higher proposal thresholds for governors with more supply | ✅ **Yes** — Already implemented |
| **Emergency Governance** | `__acceptAdmin()` pattern with 2-step timelock admin transfer | ✅ **Yes** — Should adopt for admin changes |

### Missing Features vs Compound

| Feature | Compound | DegenFeed |
|---------|----------|-----------|
| Dynamic quorum | ✅ v2: `quorumVotes()` scales with total supply | ❌ Static percentage only |
| Proposal cancel by anyone (below proposer threshold) | ✅ Anyone can cancel if proposer drops below threshold | ❌ Only creator can cancel |
| Vote delegation | ✅ COMP delegation | ⚠️ Partial via DAOTokenWrapper |
| Off-chain voting compatible | ✅ Snapshot integration | ❌ Requires separate Snapshot setup |

### Anti-Patterns to Avoid

| Anti-Pattern | Why |
|-------------|-----|
| **Single contract upgrade** | Compound Governor Bravo replaced Alpha in-place. Risk of storage collisions. Use proxy patterns. |
| **Static quorum** | Compound v1 used 400K COMP quorum regardless of total supply. Dynamic quorum is better. |
| **No veto mechanism** | Compound had no veto, making governance slow to respond to malicious proposals. |

---

## 3. OpenZeppelin Governor v5

**Repo:** [OpenZeppelin/openzeppelin-contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)  
**Type:** Reference implementation — inherited by our contracts  
**Language:** Solidity  

### Best Patterns to Adopt

| Pattern | Description | Status |
|---------|-------------|--------|
| **Modular Extensions** | GovernorCountingSimple, GovernorVotes, GovernorTimelockControl as mixins | ✅ **Used** |
| **GovernorSettings** | Configurable voting delay, period, threshold via governance | ✅ **Used** |
| **GovernorPreventLateQuorum** | Extends deadline when quorum is met near the end | ✅ **Already implemented manually** |
| **GovernorCompatibilityBravo** | Compound Bravo compatibility for frontends | ❌ Not needed |
| **`_cancel` Override** | Proper cancellation with description hash | ✅ **Used** |
| **GovernorStorage** | Stores proposal data in storage instead of events | ❌ Not used — should consider for gas optimization |

### Key Gaps in Our Usage

| Gap | Impact | Fix |
|-----|--------|-----|
| Not using `GovernorStorage` | Proposal details only in events, not accessible on-chain | Add GovernorStorage extension |
| Custom `hasRole` bypass | Breaks AccessControl abstraction, EIP-7201 conflict | Use `AccessControlDefaultAdminRules` |
| Manual late quorum | Duplicates OZ GovernorPreventLateQuorum | Use official extension instead |

---

## 4. Realms / SPL Governance (Solana)

**Repo:** [solana-labs/solana-program-library](https://github.com/solana-labs/solana-program-library)  
**Type:** Solana-native governance standard  
**Language:** Rust (Solana BPF)  

### Best Patterns to Adopt (Conceptual)

| Pattern | Description | Adopt for EVM? |
|---------|-------------|---------------|
| **Voter Weight Addins** | Customizable voting power calculation (e.g., quadratic, conviction) | ✅ **Yes** — Already doing quadratic voting |
| **Proposal Instruction Design** | Proposals bundle actual instructions, not just descriptions | ✅ **Yes** — Our `targets/values/calldatas` does this |
| **Governance Parameters** | `minInstructionHoldUpTime`, `maxVotingTime`, `voteThresholdPercentage` | ✅ **Yes** — Already configurable |
| **Multi-sig vs Governance** | Realms distinguishes council (multi-sig) from community (democratic) governance | ✅ **Yes** — Should adopt this split |

### Missing Features

| Feature | Realms (Solana) | DegenFeed |
|---------|-----------------|-----------|
| **Multi-option voting** | ✅ Ranked choice, multiple choice | ❌ Only for/against/abstain |
| **Voter weight addins** | ✅ Customizable per DAO | ⚠️ Quadratic is hardcoded |
| **Council multi-sig** | ✅ Separate from community vote | ⚠️ Guardian pattern is close |
| **Spending limits** | ✅ Per-token per-role limits | ✅ Implemented |

### Key Learning
Realms' architecture of separating execution council (multi-sig) from governance voting (community) is a strong pattern. Our current model merges both into the Governor, which is less flexible.

---

## 5. Moloch v3 (Baal)

**Repo:** [Moloch-Mystics/Baal](https://github.com/Moloch-Mystics/Baal)  
**Type:** Minimal Viable DAO  
**Language:** Solidity  

### Best Patterns to Adopt

| Pattern | Description | Adopt? |
|---------|-------------|--------|
| **Rage Quit** | Members can exit with their share of treasury before a proposal is executed. Prevents 51% attacks from stealing funds. | ✅ **Critical** — Should implement! |
| **Guild Bank** | Separate contract holds all treasury assets, with `rageQuit` and `withdraw` functions | ✅ **Yes** — Our MultiSigTreasury can add rage quit |
| **Loot (Non-voting shares)** | Two-tier: voting shares + non-voting loot for contributors | ✅ **Yes** — Adds contributor incentive without governance dilution |
| **Approval-Based Voting** | Members vote on proposals; non-voters are presumed consent (optimistic governance) | ⚠️ Optional for efficiency |
| **Proposal Cancellation via Guild Kick** | Member can be expelled by proposal | ✅ **Yes** — Should add as Constitutional proposal type |

### Anti-Patterns to Avoid

| Anti-Pattern | Why |
|-------------|-----|
| **No timelock** | Moloch has rage quit instead of timelock. Both should be used. |
| **No delegation** | Moloch doesn't support delegation. We should keep it. |
| **Token non-transferability** | Moloch shares are non-transferable. Less liquid. |

### Rage Quit Implementation Worth Adopting
```solidity
// Simplified rage quit — member exits with proportional treasury share
function rageQuit(uint256 tokenAmount) external {
    require(tokenAmount > 0, "Treasury: zero amount");
    // Burn member tokens
    _burn(msg.sender, tokenAmount);
    // Calculate treasury share
    uint256 share = (tokenAmount * treasuryBalance) / totalSupply;
    // Send proportional treasury
    token.safeTransfer(msg.sender, share);
}
```

---

## 6. Nouns DAO

**Repo:** [nounsDAO/nouns-monorepo](https://github.com/nounsDAO/nouns-monorepo)  
**Type:** Auction-based DAO with fork mechanism  
**Language:** Solidity  

### Best Patterns to Adopt

| Pattern | Description | Adopt? |
|---------|-------------|--------|
| **Fork Mechanism** | If governance becomes adversarial, a minority can fork: split treasury proportionally based on votes. Powerful anti-51% attack mechanism. | ✅ **Consider** for high-value DAOs |
| **Dynamic Quorum** | Quorum adjusts based on recent participation — prevents low-turnout attacks | ✅ **Yes** — Should implement |
| **Proposal Threshold Adjustment** | Threshold adjusts based on total supply | ✅ **Yes** — Already implemented via tiers |
| **Auction-Based Distribution** | Continuous token distribution via auctions (not our model) | ❌ Not applicable |

### Missing Features for Us

| Feature | Nouns | DegenFeed |
|---------|-------|-----------|
| Fork mechanism | ✅ Native | ❌ Not implemented |
| Dynamic quorum | ✅ Adjusts with participation | ❌ Static percentage |
| Prop threshold in ETH terms | ✅ Threshold based on treasury value | ❌ Token-based only |
| Committee veto | ✅ Founder veto with expiry | ⚠️ Veto with expiry exists |

### Key Learning
The fork mechanism is Nouns' standout innovation. For creator coin DAOs with significant treasury value, implementing a fork (or at minimum rage quit) is critical for member protection.

---

## 7. Safe (formerly Gnosis Safe)

**Repo:** [safe-global/safe-contracts](https://github.com/safe-global/safe-contracts)  
**Type:** Multi-signature wallet standard  
**Language:** Solidity  

### Best Patterns to Adopt

| Pattern | Description | Status |
|---------|-------------|--------|
| **Module System** | Plugins that can execute transactions through the Safe | ❌ Not implemented |
| **Guard System** | Pre/post transaction hooks for validation | ❌ Not implemented |
| **Fallback Handler** | Delegate calls to handler contracts for extensibility | ❌ Not implemented |
| **Contract Registry** | Singleton factory + proxy pattern for low gas | ✅ Similar to our factory |
| **Allowance Module** | Spending limits per address | ✅ **Already implemented** |
| **Recovery Module** | Social recovery for signer keys | ❌ Should add |

### Security Observations for Our MultiSigTreasury

| Observation | Our Status | Fix |
|-------------|-----------|-----|
| **Not using EIP-1271** signature validation | ❌ Missing | Add isValidSignature for contract wallets |
| **No nonce tracking on operations** | ⚠️ Basic | Add operation IDs to prevent replay |
| **No guard/plugin system** | ❌ Missing | Consider module pattern for extensibility |
| **Safe's `execTransaction` requires all signatures first** | ✅ Already done | confirm → execute flow |
| **Safe has `domainSeparator` for off-chain approvals** | ❌ Missing | Add EIP-712 domain to MultiSig |

---

## 8. Tally

**URL:** [tally.xyz](https://tally.xyz)  
**Type:** Governance UI / dashboard  
**Language:** TypeScript  

### Best Patterns to Adopt

| Pattern | Description | Adopt? |
|---------|-------------|--------|
| **API-Based Proposal Format** | Tally's GraphQL schema for proposals is a standard | ✅ **Yes** — Our API types are compatible |
| **Delegate Registry** | Central registry for delegation across DAOs | ✅ **Yes** — Already have delegation |
| **Strategy Contracts** | Custom voting power calculation on-chain | ✅ **Yes** — Quadratic voting strategy |
| **Multi-Chain Support** | Tally supports 10+ chains | ✅ **Yes** — Already support multi-chain |
| **Proposal Simulator** | Preview on-chain effects before voting | ✅ **Yes** — Should add preview endpoint |

### API Comparison

| Feature | Tally | DegenFeed API |
|---------|-------|-------------|
| Proposal list with filters | ✅ GraphQL | ✅ REST |
| Vote delegation | ✅ Per-DAO | ✅ Per-DAO |
| Treasury analytics | ✅ Dashboard | ✅ Analytics endpoint |
| Proposal execution | ✅ On-chain only | ⚠️ Off-chain + tracking |
| Real-time updates | ✅ WebSocket | ❌ Not implemented |

---

## 9. Snapshot

**URL:** [snapshot.org](https://snapshot.org)  
**Type:** Off-chain voting platform  
**Language:** TypeScript  

### Best Patterns to Adopt

| Pattern | Description | Adopt? |
|---------|-------------|--------|
| **Off-Chain Voting** | Gasless voting via signed messages | ✅ **Yes** — Already have `castVoteBySig` |
| **EIP-712 Typed Data** | Standard signing format for off-chain votes | ✅ **Yes** — Should use EIP-712, not ECDSA |
| **Voting Strategies** | Multiple voting power calculation strategies (balance, delegation, quadratic) | ✅ **Yes** — Already implementing |
| **Space Configuration** | Per-DAO voting parameters as JSON | ✅ **Yes** — Already configurable |
| **Vote Validation** | Signature verification + strategy check | ⚠️ Need EIP-1271 for contract wallets |

### Gaps vs Snapshot

| Feature | Snapshot | DegenFeed |
|---------|----------|-----------|
| EIP-712 domain separator | ✅ Standard | ❌ Using personal_sign format |
| Multi-choice voting | ✅ Yes | ❌ For/against/abstain only |
| Ranked choice | ✅ Yes | ❌ Not available |
| Strategy composition | ✅ Compose multiple strategies | ⚠️ Single strategy |
| Delegation off-chain | ✅ Off-chain without tx | ❌ On-chain only |

---

## CROSS-DAO COMPARISON TABLE

| Feature | Aragon | Compound | OZ Gov | Realms | Moloch | Nouns | Safe | Our DAO |
|---------|--------|----------|--------|--------|--------|-------|------|---------|
| **Rage Quit** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | **❌** |
| **Fork** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | **❌** |
| **Dynamic Quorum** | ✅ | v2+ | ❌ | ✅ | ❌ | ✅ | ❌ | **❌** |
| **Flash Loan Protection** | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | **❌** |
| **Veto Guardian** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | **⚠️ Partial** |
| **Plugin System** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | **❌** |
| **EIP-1271** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | **❌** |
| **EIP-712 Votes** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | **⚠️ Partial** |
| **Multi-Option Vote** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | **❌** |
| **Delegation** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | **✅** |
| **Timelock** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | **✅** |
| **Proxy/Upgradeable** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | **❌** |
| **Cloud/API Layer** | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |

---

## PRIORITY FEATURE RECOMMENDATIONS

Based on cross-DAO analysis, here are our prioritized gaps:

### P0 — Must Implement (Security Critical)
1. **Flash loan protection** — Token holding period before voting (Compound)
2. **Dynamic quorum** — Based on recent participation (Nouns, Realms)
3. **Rage quit** — Exit with treasury share (Moloch, Nouns)

### P1 — Should Implement (Governance Health)
1. **Multi-option voting** — Ranked choice or multiple choice (Realms)
2. **EIP-712 typed signing** — Replace personal_sign with typed data (Snapshot)
3. **Plugin architecture** — Modular governance extensions (Aragon)
4. **EIP-1271 contract signature** — Support smart contract wallets (Safe)

### P2 — Nice to Have (Feature Completeness)
1. **Fork mechanism** — Minority exit with treasury (Nouns)
2. **Delegation off-chain** — Gasless delegation (Snapshot)
3. **Real-time WebSocket** — Live vote updates (Tally)
4. **Proposal simulator** — Preview on-chain effects (Tally)

---

## IMPLEMENTATION NOTES

### Adopted Patterns in This Audit
1. ✅ **Flash loan protection** — MIN_HOLDING_PERIOD (3 days) before voting
2. ✅ **Veto guardian** — Multi-sig veto (3-of-N) instead of single creator
3. ✅ **Dynamic quorum** — Based on recent proposal participation
4. ✅ **EIP-712 signatures** — Proper typed data for gasless voting
5. ✅ **Emergency pause cooldown** — 7-day timelock to unpause
6. ✅ **AccessControl** — Replace custom hasRole with OZ AccessControl
7. ✅ **RageQuit-ready treasury** — Proportional withdrawal in MultiSigTreasury
8. ✅ **Proposal rate limiting** — API-level spam protection

### Deferred (Future Iterations)
- Plugin architecture — Major refactor, next version
- Fork mechanism — Complex, evaluate after rage quit
- Ranked choice voting — Requires significant on-chain changes
- WebSocket real-time — Infrastructure investment needed

---

*Research completed 2026-07-25. Sources: official repos, whitepapers, and protocol documentation.*
