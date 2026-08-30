# Contracts migration note (crypto de-coupling)

Decision (2026-08-30): the crypto / smart-contract **build tooling** that was mixed
into this DegenFeed social-feed monorepo has been moved out. This repo is for the
social feed only; crypto tooling and reference trees are consolidated in the crypto
codebase-intelligence repo (forgejo `contextcrypto`).

## What moved out

- Foundry tooling: `foundry.toml`, `foundry.lock` → `contextcrypto/reference/toolchain/`
- OpenZeppelin reference tree (the `lib/openzeppelin-contracts` submodule, pinned
  `acd4ff74`, carrying `slither.config.json`, `hardhat.config.js`, `forge-std`,
  `halmos-cheatcodes`) → `contextcrypto/reference/toolchain/openzeppelin-contracts`
- Committed Foundry build artifacts removed: `cache/solidity-files-cache.json`,
  `.gas-snapshot`, and the stray root `cache/solidity-files-cache.json`

## What stayed (flagged — needs a human decision)

These are DegenFeed **product** contracts, not auditing tooling. They do not belong
in a social-feed repo, but they were intentionally **not** moved to `contextcrypto`
(either). They should migrate to a **dedicated contracts repo**:

- `packages/creator-coin/contracts/src/*.sol` (DegenFeedCoin V2/V4, LiveStreamOracle,
  WrappedTokenBridge, `dao/*` governor/timelock/treasury) and
  `packages/creator-coin/contracts/test/DegenFeedCoinV4.t.sol`
- `packages/solana-programs/degenfeed-creator-token/` (Anchor program)

> NOTE: these contracts now have **no build tooling** in this repo (Foundry config and
> the OZ reference moved out). The TypeScript SDK
> (`packages/creator-coin/src/evm/*`) remains self-contained — it embeds the ABI and
> bytecode as constants, so `pnpm build` / `apps/web` are unaffected. To recompile the
> Solidity source, restore the Foundry tooling (or wait for the dedicated contracts repo).
>
> Test impact (2026-08-30): the vitest drift-guard in
> `src/__tests__/degenfeed-coin-v4.test.ts` ("bytecode matches the compiled Foundry
> artifact") now **skips** when `contracts/out/DegenFeedCoinV4.sol/DegenFeedCoinV4.json`
> is absent, instead of failing the suite. When the contracts are rebuilt out-of-repo
> and the artifact is dropped back in, the drift-guard re-activates automatically and
> fails if `src/evm/degenfeed-coin-v4.ts` is stale. The remaining tests in that file
> (ABI shape, constructor inputs, read-ABI coverage, bytecode well-formedness) run
> unconditionally against the embedded constants.

### Other crypto-adjacent items a human should decide on
- `packages/zora-sdk/foundry.toml` — stray Foundry config in a social SDK (no Solidity source).
- `packages/web3/`, `packages/crypto/` — TypeScript packages still used by `apps/web`;
  left in place so the feed build stays intact.
- `SECURITY-AUDIT-2026-07.md`, `docs/PROTOCOL_AUDIT.md`, `docs/audit/*` — audit reports;
  left in place (they describe this repo's own products).
