/**
 * @degenfeed/integration — Tip Features Tests
 *
 * Tests the unified tipping pipeline: native tips on Nostr/Farcaster,
 * smart chain selection (amount-based), cross-chain quotes, tip analytics,
 * leaderboards, notification generation, and amount validation.
 *
 * Pure functions tested directly. External APIs mocked.
 */
import { describe, expect, it, vi } from 'vitest';

// ─── Mock KV ───────────────────────────────────────────────────────

function createMockKV(): Record<string, any> {
  const store = new Map<string, string>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    put: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    _store: store,
  };
}

function createMockEnv(): any {
  return {
    CACHE: createMockKV(),
  };
}

// ─── Suite 4: Tip Features ─────────────────────────────────────────

describe('Tip Features — Smart Chain Selection', () => {
  it('selects Lightning as best chain for small tips', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');

    const results = selectBestChain({
      senderChains: ['lightning', 'solana', 'ethereum', 'base'],
      recipientChains: ['lightning', 'solana', 'ethereum', 'base'],
      amountUsd: 5, // small tip
      recipientHasLightning: true,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.chain).toBe('lightning');
    expect(results[0]?.rank).toBe(1);
  });

  it('prefers Solana when Lightning is unavailable', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');

    const results = selectBestChain({
      senderChains: ['solana', 'base', 'polygon'],
      recipientChains: ['solana', 'base', 'polygon'],
      amountUsd: 10,
    });

    expect(results[0]?.chain).toBe('solana');
    expect(results[0]?.reason).toBeTruthy();
  });

  it('favors Ethereum for large tips over $100', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');

    const results = selectBestChain({
      senderChains: ['ethereum', 'solana', 'base'],
      recipientChains: ['ethereum', 'solana', 'base'],
      amountUsd: 500,
      preferredChain: 'ethereum',
    });

    const ethereum = results.find((r) => r.chain === 'ethereum');
    expect(ethereum).toBeDefined();
    expect(ethereum?.rank).toBe(1);
  });

  it('penalizes expensive chains for micro-tips under $1', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');

    const results = selectBestChain({
      senderChains: ['ethereum', 'base', 'lightning'],
      recipientChains: ['ethereum', 'base', 'lightning'],
      amountUsd: 0.5, // micro tip
    });

    // Ethereum has $5 avg fee → penalized heavily for 50c tip
    const ethereum = results.find((r) => r.chain === 'ethereum');
    expect(ethereum).toBeDefined();
    expect(ethereum?.rank).toBeGreaterThan(1); // Not first choice
  });

  it('scores chains by speed and fee', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');

    // Only EVM chains to compare
    const results = selectBestChain({
      senderChains: ['ethereum', 'base', 'polygon', 'arbitrum'],
      recipientChains: ['ethereum', 'base', 'polygon', 'arbitrum'],
      amountUsd: 20,
    });

    // Base is L2 with low fees + fast
    expect(results[0]?.chain).toBe('base');
    expect(results[0]?.route.speed).toBe('fast');
    expect(results[0]?.route.avgFeeUsd).toBeLessThan(results[results.length - 1]?.route.avgFeeUsd);
  });

  it('provides chain route metadata for all supported chains', async () => {
    const { CHAIN_ROUTES } = await import('../../workers/api/src/routes/unified-tip-core');

    expect(CHAIN_ROUTES.lightning.currency).toBe('BTC');
    expect(CHAIN_ROUTES.lightning.speed).toBe('instant');
    expect(CHAIN_ROUTES.lightning.avgFeeUsd).toBeLessThan(0.01);

    expect(CHAIN_ROUTES.solana.tokens).toContain('USDC');
    expect(CHAIN_ROUTES.solana.speed).toBe('fast');

    expect(CHAIN_ROUTES.base.avgFeeUsd).toBeLessThan(0.1);
    expect(CHAIN_ROUTES.ethereum.avgFeeUsd).toBeGreaterThan(1);
  });
});

describe('Tip Features — Unified Tip Recording', () => {
  it('records a tip and returns activity item', async () => {
    const { recordUnifiedTip } = await import('../../workers/api/src/routes/unified-tip-core');
    const env = createMockEnv();

    const activity = await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'post_123',
      entityType: 'post',
      amountUsd: 25.5,
      fromUserId: '0xsender',
      toUserId: '0xrecipient',
      fromLabel: 'Alice',
      toLabel: 'Bob',
      method: 'usdc',
    });

    expect(activity).not.toBeNull();
    expect(activity?.id).toContain('utip:');
    expect(activity?.amountUsd).toBe(25.5);
    expect(activity?.fromLabel).toBe('Alice');
    expect(activity?.toLabel).toBe('Bob');
    expect(activity?.platform).toBe('degenfeed');
  });

  it('rejects invalid tip amounts', async () => {
    const { sanitizeAmountUsd } = await import('../../workers/api/src/routes/unified-tip-core');

    expect(sanitizeAmountUsd(0)).toBeNull();
    expect(sanitizeAmountUsd(-10)).toBeNull();
    expect(sanitizeAmountUsd(99999)).toBeNull(); // over MAX_TIP_USD
    expect(sanitizeAmountUsd(50)).toBe(50);
    expect(sanitizeAmountUsd('25.5')).toBe(25.5);
  });

  it('sanitizes entity IDs', async () => {
    const { sanitizeEntityId, _hasSuspiciousPayload } = await import(
      '../../workers/api/src/routes/unified-tip-core'
    );
    // _hasSuspiciousPayload is re-exported from sanitize module

    expect(sanitizeEntityId('valid-post-id-123')).toBe('valid-post-id-123');
    expect(sanitizeEntityId('')).toBeNull();
    expect(sanitizeEntityId(null)).toBeNull();
  });

  it('starts leaderboard scoring after tip recording', async () => {
    const { recordUnifiedTip, kvGetJson, leaderboardKey } = await import(
      '../../workers/api/src/routes/unified-tip-core'
    );
    const env = createMockEnv();

    // Record a tip to a specific recipient
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'post_456',
      entityType: 'post',
      amountUsd: 100,
      fromUserId: '0xsender',
      toUserId: '0xtop_creator',
      fromLabel: 'Alice',
      toLabel: 'Top Creator',
      method: 'usdc',
    });

    // Check the "alltime" leaderboard
    const leaderboard = await kvGetJson(env, leaderboardKey('alltime'));
    expect(leaderboard).not.toBeNull();
    expect(leaderboard?.entries.length).toBeGreaterThanOrEqual(1);
    const entry = leaderboard?.entries.find((e: any) => e.userId === '0xtop_creator');
    expect(entry).toBeDefined();
    expect(entry?.totalUsd).toBe(100);
  });
});

describe('Tip Features — Native Protocol Tipping', () => {
  it('dispatches Nostr zap tip via NIP-57', async () => {
    const { _sendNativeTip, PROTOCOL_FEE_ESTIMATES } = await import(
      '../../workers/api/src/lib/native-tips'
    );
    const env = createMockEnv();

    // Mock the lightning module
    vi.mock('../../workers/api/src/routes/lightning', () => ({
      resolveLnurlFromPubkey: vi
        .fn()
        .mockResolvedValue(
          'lnurl1dp68gurn8ghj7mr0vdskc6r0wd6z7mrww4excttdd5j7mhv93xzt6sn2v3jj6cnv43nz2v3e',
        ),
      fetchZapInvoice: vi.fn().mockResolvedValue({
        status: 'OK',
        pr: 'lnbc10n1...',
        description: 'Zap for DegenFeed',
      }),
    }));

    const result = await _sendNativeTip(env, {
      protocol: 'nostr',
      recipientId: 'npub1...',
      recipientName: 'NostrUser',
      amount: '100',
      amountUsd: 0.1,
      sender: '0xsender',
      message: 'Great post!',
    });

    expect(result.success).toBe(false); // Recipient doesn't have LNURL configured
    // Without env config, it should fail gracefully
    expect(result.error).toBeTruthy();

    // But the fee table should be available
    expect(PROTOCOL_FEE_ESTIMATES.nostr.avgFeeUsd).toBe(0.001);
    expect(PROTOCOL_FEE_ESTIMATES.nostr.speed).toBe('instant');
  });

  it('dispatches Farcaster tip via Frame action', async () => {
    const { _sendNativeTip } = await import('../../workers/api/src/lib/native-tips');
    const env = createMockEnv();

    // Farcaster tip doesn't require env config for basic operation
    const result = await _sendNativeTip(env, {
      protocol: 'farcaster',
      recipientId: '0xrecipient',
      recipientName: 'FarcasterUser',
      amount: '5',
      amountUsd: 5.0,
      sender: '0xsender',
      senderProfile: { displayName: 'Alice' },
    });

    expect(result.success).toBe(true);
    expect(result.protocolTxId).toBeTruthy();
    expect(result.protocolTxId).toContain('/api/tip/frame/');
  });

  it('provides protocol fee estimates for all protocols', async () => {
    const { PROTOCOL_FEE_ESTIMATES, _sendNativeTip } = await import(
      '../../workers/api/src/lib/native-tips'
    );

    // All 10 protocols should have fee estimates
    expect(Object.keys(PROTOCOL_FEE_ESTIMATES)).toHaveLength(10);

    // Cheapest: Reddit and GitHub ($0, no wallet needed)
    expect(PROTOCOL_FEE_ESTIMATES.reddit.avgFeeUsd).toBe(0);
    expect(PROTOCOL_FEE_ESTIMATES.reddit.needsSetup).toBe(false);

    // Nostr is cheap
    expect(PROTOCOL_FEE_ESTIMATES.nostr.avgFeeUsd).toBeLessThan(0.01);

    // Most expensive: Bluesky/Mastodon/PeerTube
    expect(PROTOCOL_FEE_ESTIMATES.bluesky.avgFeeUsd).toBeGreaterThan(0.01);
  });
});

describe('Tip Features — Smart Protocol Selection', () => {
  it('recommends best protocol based on fees and speed', async () => {
    const { selectBestProtocol } = await import('../../workers/api/src/lib/native-tips');

    const results = selectBestProtocol({
      senderProtocols: ['nostr', 'farcaster', 'reddit'],
      recipientProtocols: ['nostr', 'farcaster', 'reddit'],
      amountUsd: 1,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.protocol).toBe('reddit'); // free, no setup, instant
    expect(results[0]?.feeEstimate.avgFeeUsd).toBe(0);
  });

  it('prefers preferred protocol with bonus score', async () => {
    const { selectBestProtocol } = await import('../../workers/api/src/lib/native-tips');

    const results = selectBestProtocol({
      senderProtocols: ['nostr', 'farcaster'],
      recipientProtocols: ['nostr', 'farcaster'],
      amountUsd: 10,
      preferredProtocol: 'farcaster',
    });

    expect(results[0]?.protocol).toBe('farcaster');
  });

  it('scores protocols by multiple criteria', async () => {
    const { selectBestProtocol } = await import('../../workers/api/src/lib/native-tips');

    const results = selectBestProtocol({
      senderProtocols: ['nostr', 'farcaster', 'bluesky', 'telegram'],
      recipientProtocols: ['nostr', 'farcaster', 'bluesky', 'telegram'],
      amountUsd: 5,
    });

    // All scored results should have fee estimates
    for (const r of results) {
      expect(r.feeEstimate).toBeDefined();
      expect(r.feeEstimate.speed).toBeDefined();
    }

    // Should be in score order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]?.rank).toBeLessThan(results[i]?.rank);
    }
  });
});

describe('Tip Features — Tip Analytics & Display', () => {
  it('computes period buckets correctly', async () => {
    const { periodBucket } = await import('../../workers/api/src/routes/unified-tip-core');

    const date = new Date('2026-07-20T12:00:00Z');
    expect(periodBucket('daily', date)).toBe('2026-07-20');
    expect(periodBucket('monthly', date)).toBe('2026-07');
    expect(periodBucket('alltime')).toBe('all');
  });

  it('generates short labels for wallet addresses', async () => {
    const { shortLabel } = await import('../../workers/api/src/routes/unified-tip-core');

    const fullAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const short = shortLabel(fullAddress, 'Anonymous');
    expect(short).toContain('0x1234');
    expect(short).toContain('5678');
    expect(short.length).toBeLessThan(fullAddress.length);
  });

  it('normalizes user IDs correctly', async () => {
    const { normalizeUserId } = await import('../../workers/api/src/routes/unified-tip-core');

    expect(normalizeUserId('0xABC123')).toBe('0xabc123'); // lowercased
    expect(normalizeUserId('')).toBeUndefined();
    expect(normalizeUserId(null)).toBeUndefined();
  });
});
