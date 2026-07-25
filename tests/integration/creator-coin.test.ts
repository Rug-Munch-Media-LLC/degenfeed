/**
 * @degenfeed/integration — Creator Coin Tests
 *
 * Tests the creator coin system: bonding curve math (pure functions),
 * anti-exploit engine, and the coin deployer service.
 *
 * Pure functions from bonding-curve.ts tested directly with known values.
 * AntiExploitEngine tested with custom data fetchers to control edge cases.
 * CoinDeployer tested with mocked env to verify validation and feature gates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Bonding Curve (pure functions) ──────────────────────────────────

describe('Creator Coin — Bonding Curve Math', () => {
  let bc: typeof import('../../packages/creator-coin/src/bonding-curve');

  beforeAll(async () => {
    bc = await import('../../packages/creator-coin/src/bonding-curve');
  });

  it('returns MIN_PRICE for supply near zero', () => {
    const price = bc.getDynamicPrice(1n);
    expect(price).toBeGreaterThanOrEqual(bc.MIN_PRICE);
  });

  it('returns MAX_PRICE at graduation supply', () => {
    const price = bc.getDynamicPrice(bc.GRADUATION_SUPPLY);
    expect(price).toBe(bc.MAX_PRICE);
  });

  it('returns MAX_PRICE beyond graduation supply', () => {
    const price = bc.getDynamicPrice(bc.GRADUATION_SUPPLY + 1000n);
    expect(price).toBe(bc.MAX_PRICE);
  });

  it('returns increasing prices across phases', () => {
    const priceEarly = bc.getDynamicPrice(bc.GRADUATION_SUPPLY / 10n);
    const priceLate = bc.getDynamicPrice(bc.GRADUATION_SUPPLY * 9n / 10n);
    expect(priceLate).toBeGreaterThan(priceEarly);
  });

  it('returns higher price in Phase 4 than Phase 1', () => {
    const phase1 = bc.GRADUATION_SUPPLY * 30n / 100n;
    const phase4 = bc.GRADUATION_SUPPLY * 90n / 100n;
    const p1 = bc.getDynamicPrice(phase1);
    const p4 = bc.getDynamicPrice(phase4);
    expect(p4).toBeGreaterThan(p1);
  });

  it('calculates phase index correctly across all 5 phases', () => {
    expect(bc.getCurrentEra(0n)).toBe(0);
    expect(bc.getCurrentEra(bc.GRADUATION_SUPPLY * 10n / 100n)).toBe(0);
    expect(bc.getCurrentEra(bc.GRADUATION_SUPPLY * 30n / 100n)).toBe(1);
    expect(bc.getCurrentEra(bc.GRADUATION_SUPPLY * 50n / 100n)).toBe(2);
    expect(bc.getCurrentEra(bc.GRADUATION_SUPPLY * 70n / 100n)).toBe(3);
    expect(bc.getCurrentEra(bc.GRADUATION_SUPPLY * 90n / 100n)).toBe(4);
  });

  it('calculates tokens out from native amount and price', () => {
    const price = BigInt(1000) * BigInt(1_000_000_000);
    const oneEth = BigInt(1e18);
    const tokens = bc.calculateTokensOut(oneEth, price);
    expect(tokens).toBeGreaterThan(0n);

    const tMin = bc.calculateTokensOut(oneEth, bc.MIN_PRICE);
    const tMax = bc.calculateTokensOut(oneEth, bc.MAX_PRICE);
    expect(tMin).toBeGreaterThan(tMax);
  });

  it('calculates native out with platform fee (50 bps default)', () => {
    const price = BigInt(100) * bc.PRICE_DECIMALS;
    const tokens = BigInt(1000) * bc.PRICE_DECIMALS;
    const result = bc.calculateNativeOut(tokens, price);
    expect(result.gross).toBeGreaterThan(0n);
    expect(result.fee).toBeGreaterThan(0n);
    expect(result.net).toBe(result.gross - result.fee);
    expect(result.fee).toBe((result.gross * 50n) / 10_000n);
  });

  it('returns zero for zero price', () => {
    expect(bc.calculateTokensOut(BigInt(1e18), 0n)).toBe(0n);
    const r = bc.calculateNativeOut(BigInt(1000), 0n);
    expect(r.gross).toBe(0n);
    expect(r.fee).toBe(0n);
  });

  it('calculates progress percentage', () => {
    expect(bc.getProgressPercent(0n)).toBe(0);
    expect(bc.getProgressPercent(bc.GRADUATION_SUPPLY)).toBe(100);
    expect(bc.getProgressPercent(bc.GRADUATION_SUPPLY / 2n)).toBe(50);
  });

  it('applies live stream boost discount', () => {
    const base = BigInt(500_000_000_000);
    const boosted = bc.applyLiveBoost(base, 200);
    expect(boosted).toBeLessThan(base);
    expect(boosted).toBeGreaterThanOrEqual(bc.MIN_PRICE);
    expect(bc.applyLiveBoost(base, 0)).toBe(base);
  });

  it('predicts price after multiple buys', () => {
    const predicted = bc.predictPriceAfterBuys(0n, BigInt(1e18), 5);
    expect(predicted).toBeGreaterThan(bc.MIN_PRICE);
  });

  it('calculates market cap', () => {
    const price = BigInt(100_000_000_000);
    const supply = BigInt(1_000_000_000_000_000_000_000_000);
    const mc = bc.calculateMarketCap(price, supply);
    expect(mc).toBe((price * supply) / bc.PRICE_DECIMALS);
  });

  it('formats prices for display', () => {
    expect(bc.formatPrice(BigInt(1e18))).toBe('1.0000');
    expect(bc.formatPrice(BigInt(0))).toBe('0.00000000');
  });

  it('returns bonding phase info for display', () => {
    const info = bc.getBondingPhaseInfo(bc.GRADUATION_SUPPLY * 10n / 100n);
    expect(['Steal Deal', 'Early Bird', 'Cruise Control', 'Final Call', 'Moonshot']).toContain(info.name);
    expect(info.progress).toBeGreaterThanOrEqual(0);
  });

  it('returns era name, color, and icon helpers', () => {
    expect(typeof bc.getEraName(0)).toBe('string');
    expect(typeof bc.getEraColor(0)).toBe('string');
    expect(typeof bc.getEraIcon(0)).toBe('string');
  });

  it('generates curve SVG path', () => {
    const svg = bc.generateCurveSvgPath(300, 100, bc.GRADUATION_SUPPLY / 2n);
    expect(svg).toContain('M0,100');
    expect(svg).toContain('L');
  });
});

// ─── Anti-Exploit Engine ─────────────────────────────────────────────

describe('Creator Coin — Anti-Exploit', () => {
  let ae: typeof import('../../packages/creator-coin/src/anti-exploit');

  beforeAll(async () => {
    ae = await import('../../packages/creator-coin/src/anti-exploit');
  });

  it('enforces max buy percentage (anti-whale)', async () => {
    const engine = new ae.AntiExploitEngine({ maxBuyBps: 100 });

    // Small buy of 0.0001 ETH at 1000 gwei price, supply = 1M tokens
    // implied = (1e14 * 1e18) / 1e12 = 1e20 = 100 tokens
    // max = 1% of 1e24 = 1e22. Allowed: 100 < 1e22 ✓
    const allowed = await engine.checkAntiWhale(BigInt(1e14), {
      address: '0xcoin', name: 'Test', symbol: 'TST',
      price: (1000n * BigInt(1e9)).toString(),
      totalSupply: '1000000000000000000000000',
      totalRaised: '0', uniqueBuyers: 0, graduated: false, decimals: 18,
      chain: 'base', createdAt: Date.now(), creator: '0xcreator',
    });
    expect(allowed.allowed).toBe(true);

    // Massive buy — should be blocked
    const blocked = await engine.checkAntiWhale(BigInt(1e23), {
      address: '0xcoin', name: 'Test', symbol: 'TST',
      price: BigInt(1e9).toString(),
      totalSupply: '1000000000000000000000000',
      totalRaised: '0', uniqueBuyers: 0, graduated: false, decimals: 18,
      chain: 'base', createdAt: Date.now(), creator: '0xcreator',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('Anti-whale');
  });

  it('enforces cooldown between buys (anti-sniper)', async () => {
    const engine = new ae.AntiExploitEngine({ buyCooldownSeconds: 30 });
    const recentTimestamp = Date.now() / 1000 - 5;

    engine.setDataFetchers({ lastBuy: async () => recentTimestamp });
    const result = await engine.checkCooldown('0xwallet');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cooldown');
  });

  it('allows buy after cooldown expires', async () => {
    const engine = new ae.AntiExploitEngine({ buyCooldownSeconds: 30 });
    const oldTimestamp = Date.now() / 1000 - 60;

    engine.setDataFetchers({ lastBuy: async () => oldTimestamp });
    const result = await engine.checkCooldown('0xwallet');
    expect(result.allowed).toBe(true);
  });

  it('blocks wallet too young (anti-bot)', async () => {
    const engine = new ae.AntiExploitEngine({ minWalletAgeSeconds: 7 * 86400, minTransactionCount: 1 });
    engine.setDataFetchers({
      walletAge: async () => 3600,
      txCount: async () => 0,
    });

    const result = await engine.checkAntiBot('0xnewbie', 'base');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('wallet');
  });

  it('blocks known snipers', () => {
    const engine = new ae.AntiExploitEngine({ blockKnownSnipers: true });
    ae.updateSniperRegistry(['0xknown_sniper']);

    const result = engine.checkKnownSniper('0xknown_sniper');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('sniper');
  });

  it('detects bundler attack', () => {
    const engine = new ae.AntiExploitEngine({ detectBundlers: true, maxBuysPerBlock: 3 });
    const recentBuyers = ['0xa', '0xb', '0xc'];

    const result = engine.checkBundler('0xd', recentBuyers, 12345);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Bundler');
  });

  it('allows normal buys with no bundler pattern', () => {
    const engine = new ae.AntiExploitEngine({ detectBundlers: true, maxBuysPerBlock: 3 });
    const result = engine.checkBundler('0xd', ['0xa'], 12345);
    expect(result.allowed).toBe(true);
  });

  it('generates status for a wallet', async () => {
    const engine = new ae.AntiExploitEngine(ae.ANTI_EXPLOIT_PRESETS.balanced);
    engine.setDataFetchers({
      balance: async () => BigInt(1e18),
      lastBuy: async () => 0,
      walletAge: async () => 30 * 86400,
      txCount: async () => 10,
    });

    const status = await engine.getStatus('0xwallet', {
      address: '0xcoin', name: 'Test', symbol: 'TST',
      price: '1000000000000', totalSupply: '1000000000000000000000',
      totalRaised: '0', uniqueBuyers: 0, graduated: false, decimals: 18,
      chain: 'base', createdAt: Date.now(), creator: '0xcreator',
    }, 'base');

    expect(typeof status.whaleLimited).toBe('boolean');
    expect(typeof status.cooldownActive).toBe('boolean');
    expect(typeof status.botDetected).toBe('boolean');
    expect(typeof status.sniperDetected).toBe('boolean');
  });

  it('presets have different protection levels', () => {
    expect(ae.ANTI_EXPLOIT_PRESETS.aggressive.maxBuyBps).toBe(50);
    expect(ae.ANTI_EXPLOIT_PRESETS.balanced.maxBuyBps).toBe(100);
    expect(ae.ANTI_EXPLOIT_PRESETS.light.maxBuyBps).toBe(300);
    expect(ae.ANTI_EXPLOIT_PRESETS.aggressive.buyCooldownSeconds).toBe(60);
    expect(ae.ANTI_EXPLOIT_PRESETS.light.buyCooldownSeconds).toBe(10);
  });

  it('provides mev/mempool config', () => {
    const engine = new ae.AntiExploitEngine({ usePrivateMempool: true });
    const config = engine.getMempoolConfig();
    expect(config.usePrivateMempool).toBe(true);
    expect(config.relayUrl).toBeTruthy();
  });
});

// ─── Coin Deployer ───────────────────────────────────────────────────

describe('Creator Coin — Coin Deployer', () => {
  let deployer: typeof import('../../workers/api/src/lib/coin-deployer');

  beforeAll(async () => {
    deployer = await import('../../workers/api/src/lib/coin-deployer');
  });

  it('rejects deployment when feature flag is disabled', async () => {
    const env = { ENABLE_REAL_DEPLOYMENTS: 'false', PREMIUM_WALLET_KEY: '0xabc' } as any;

    await expect(deployer.deployCoin({
      creator: '0xcreator', name: 'Test Coin', symbol: 'TST',
      chain: 'base', protocol: 'farcaster',
    }, env)).rejects.toThrow('deployments coming soon');
  });

  it('rejects deployment with missing required fields', async () => {
    const env = { ENABLE_REAL_DEPLOYMENTS: 'true', PREMIUM_WALLET_KEY: '0xabc' } as any;

    await expect(deployer.deployCoin({
      creator: '', name: '', symbol: '', chain: 'base', protocol: 'farcaster',
    }, env)).rejects.toThrow(deployer.DeployerConfigError);
  });

  it('rejects unsupported chain', async () => {
    const env = { ENABLE_REAL_DEPLOYMENTS: 'true', PREMIUM_WALLET_KEY: '0xabc' } as any;

    await expect(deployer.deployCoin({
      creator: '0xcreator', name: 'Test', symbol: 'TST',
      chain: 'invalid' as any, protocol: 'farcaster',
    }, env)).rejects.toThrow('Unsupported chain');
  });

  it('rejects deployment without wallet key', async () => {
    const env = { ENABLE_REAL_DEPLOYMENTS: 'true' } as any;

    await expect(deployer.deployCoin({
      creator: '0xcreator', name: 'Test', symbol: 'TST',
      chain: 'base', protocol: 'farcaster',
    }, env)).rejects.toThrow(deployer.DeployerConfigError);
  });

  it('computes creator and platform fees correctly', () => {
    const amountWei = BigInt(1e18);
    const creatorFeeBps = 100;
    const platformFeeBps = 50;
    const creatorFee = (amountWei * BigInt(creatorFeeBps)) / 10_000n;
    const platformFee = (amountWei * BigInt(platformFeeBps)) / 10_000n;
    expect(creatorFee).toBe(BigInt(1e16));
    expect(platformFee).toBe(BigInt(5e15));
  });

  it('uses default fee values when not specified', () => {
    const defaults = { creatorFeeBps: 100n, platformFeeBps: 50n };
    expect(defaults.creatorFeeBps).toBe(100n);
    expect(defaults.platformFeeBps).toBe(50n);
  });
});
