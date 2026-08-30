/**
 * @degenfeed/creator-coin — DegenFeedCoinV4 Artifact Tests
 *
 * Guards against drift between the embedded ABI/bytecode constants
 * (used by the API routes for deploy/trade/reads) and the compiled
 * Foundry artifact in `contracts/out/`.
 *
 * Foundry tooling was de-coupled from this repo (see
 * `contracts/MIGRATION-NOTE.md`): the compiled artifact only exists when
 * someone rebuilds the contracts out-of-repo
 * (`contextcrypto/reference/toolchain`). The drift-guard test therefore
 * SKIPS when the artifact is absent instead of failing the suite; the
 * embedded-constant checks below always run.
 *
 * If `forge build` is re-run out-of-repo and the contract changes, the
 * drift-guard fails until `src/evm/degenfeed-coin-v4.ts` is regenerated:
 *   python3 /tmp/opencode/cc-gen/gen-v4-artifact.py
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEGENFEED_COIN_V4_ABI,
  DEGENFEED_COIN_V4_BYTECODE,
  DEGENFEED_COIN_V4_READ_ABI,
} from '../evm/degenfeed-coin-v4';

const ARTIFACT_PATH = resolve(
  import.meta.dirname ?? __dirname,
  '..',
  '..',
  'contracts',
  'out',
  'DegenFeedCoinV4.sol',
  'DegenFeedCoinV4.json',
);

const ARTIFACT_AVAILABLE = existsSync(ARTIFACT_PATH);

function loadArtifact(): { abi: unknown[]; bytecode: string } {
  const raw = readFileSync(ARTIFACT_PATH, 'utf8');
  const artifact = JSON.parse(raw) as { abi: unknown[]; bytecode: { object: string } };
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

describe('DegenFeedCoinV4 artifact constants', () => {
  // Drift-guard: only meaningful when a compiled artifact is present.
  it.skipIf(!ARTIFACT_AVAILABLE)('bytecode matches the compiled Foundry artifact', () => {
    const { bytecode } = loadArtifact();
    expect(DEGENFEED_COIN_V4_BYTECODE).toBe(bytecode);
    expect(DEGENFEED_COIN_V4_BYTECODE.startsWith('0x')).toBe(true);
  });

  it('bytecode is well-formed (0x-prefixed, non-trivial size)', () => {
    expect(DEGENFEED_COIN_V4_BYTECODE.startsWith('0x')).toBe(true);
    expect(DEGENFEED_COIN_V4_BYTECODE.length).toBeGreaterThan(100);
  });

  it('full ABI contains the methods the client calls', () => {
    const names = DEGENFEED_COIN_V4_ABI.filter(
      (item) => item.type === 'function' && 'name' in item,
    ).map((item) => (item as { name: string }).name);

    for (const fn of [
      'buy',
      'sell',
      'getCurrentPrice',
      'getProgressBps',
      'getCurrentPhase',
      'getTokenAmount',
      'getEthAmount',
      'totalRaised',
      'uniqueBuyers',
      'graduated',
      'creator',
      'createdAt',
      'totalSupply',
      'name',
      'symbol',
      'decimals',
      'platformFeeReceiver',
      'isPreBonding',
      'preBondingEnd',
      'initialBuy',
    ]) {
      expect(names).toContain(fn);
    }
  });

  it('full ABI includes the constructor with CreatorParameters + DAOConfig', () => {
    const ctor = DEGENFEED_COIN_V4_ABI.find((item) => item.type === 'constructor');
    expect(ctor).toBeDefined();
    const inputs = (ctor as unknown as { inputs: Array<{ name: string }> }).inputs.map(
      (i) => i.name,
    );
    expect(inputs).toContain('name_');
    expect(inputs).toContain('creator_');
    expect(inputs).toContain('cParams');
    expect(inputs).toContain('dConfig');
  });

  it('read ABI covers all state the onchain route needs', () => {
    const names = DEGENFEED_COIN_V4_READ_ABI.map((item) => item.name);
    for (const fn of [
      'getCurrentPrice',
      'getProgressBps',
      'getCurrentPhase',
      'uniqueBuyers',
      'graduated',
    ]) {
      expect(names).toContain(fn);
    }
  });

  it('read ABI has no unknown function names vs full ABI', () => {
    const full = new Set(
      DEGENFEED_COIN_V4_ABI.filter((item) => item.type === 'function' && 'name' in item).map(
        (item) => (item as { name: string }).name,
      ),
    );
    for (const item of DEGENFEED_COIN_V4_READ_ABI) {
      expect(full.has(item.name), `read ABI references ${item.name}`).toBe(true);
    }
  });
});
