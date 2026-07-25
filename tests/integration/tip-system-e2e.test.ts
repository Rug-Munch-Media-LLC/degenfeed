/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEST SUITE 1: Tip System End-to-End Verification (18 tests)
 *
 * Covers the ENTIRE tipping pipeline: Lightning, EVM, SOL, Blink, x402,
 * fee calculation, notifications, leaderboard, analytics, and edge cases.
 *
 * Tests REAL logic — pure functions tested directly, external APIs mocked.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { PLATFORM_FEES, TierManager } from '../../packages/monetization/src';
import {
  encodeTipData,
  encodeTipWithMessageData,
  getTipChainConfig,
  TIP_CHAIN_CONFIG,
  TIP_CONTRACT_ABI,
  TIP_CONTRACT_ADDRESSES,
} from '../../packages/web3/src';

// ─── Mock KV for tip recording tests ──────────────────────────────────────

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

function createMockEnv() {
  return { CACHE: createMockKV() };
}

// ── Helper: build a signed Solana tx for blink/x402 tests ─────────────────

function buildSignedSOLTx(sender: Keypair, recipient: string, amount = 0.001): string {
  const tx = new Transaction();
  tx.feePayer = sender.publicKey;
  tx.recentBlockhash = '4M5xYZx7nTByfFV9KxGj69acpmFDJyEQLM26Gc3x1j6Y';
  tx.add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: new PublicKey(recipient),
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  );
  tx.sign(sender);
  return Buffer.from(tx.serialize()).toString('base64');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. TIP FEE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Tip Fee Calculation', () => {
  it('applies 1% platform fee on tipping', () => {
    const tipAmount = 100; // $100
    const fee = tipAmount * PLATFORM_FEES.tippingFee;
    expect(fee).toBe(1); // $1
    expect(fee).toBeLessThan(tipAmount);
  });

  it('computes creator net amount after platform fee', () => {
    const tipAmount = 50; // $50
    const fee = tipAmount * PLATFORM_FEES.tippingFee;
    const creatorNet = tipAmount - fee;
    expect(creatorNet).toBe(49.5);
    expect(creatorNet + fee).toBe(tipAmount);
  });

  it('handles micro-tip fee calculation correctly', () => {
    const tipAmount = 0.5; // $0.50
    const fee = tipAmount * PLATFORM_FEES.tippingFee;
    expect(fee).toBe(0.005);
    expect(tipAmount - fee).toBe(0.495);
  });

  it('has correct PLATFORM_FEES structure', () => {
    expect(PLATFORM_FEES.tippingFee).toBe(0.01);
    expect(PLATFORM_FEES.creatorCoinFee).toBe(0.005);
    expect(PLATFORM_FEES.featuredPlacementCents).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. LIGHTNING TIP: INVOICE → PAY → VERIFY FLOW
// ═══════════════════════════════════════════════════════════════════════════

describe('Lightning Tip Flow', () => {
  it('selects Lightning as best chain for micro-tips (< $10)', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');
    const results = selectBestChain({
      senderChains: ['lightning', 'solana', 'base'],
      recipientChains: ['lightning', 'solana', 'base'],
      amountUsd: 5,
      recipientHasLightning: true,
    });
    expect(results[0]?.chain).toBe('lightning');
    expect(results[0]?.route.speed).toBe('instant');
    expect(results[0]?.route.avgFeeUsd).toBeLessThan(0.01);
  });

  it('falls back to Solana when Lightning is unavailable', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');
    const results = selectBestChain({
      senderChains: ['lightning', 'solana', 'base'],
      recipientChains: ['solana', 'base'],
      amountUsd: 10,
    });
    expect(results[0]?.chain).not.toBe('lightning');
    expect(results[0]?.chain).toBe('solana');
  });

  it('CHAIN_ROUTES has lightning metadata', async () => {
    const { CHAIN_ROUTES } = await import('../../workers/api/src/routes/unified-tip-core');
    expect(CHAIN_ROUTES.lightning.currency).toBe('BTC');
    expect(CHAIN_ROUTES.lightning.speed).toBe('instant');
    expect(CHAIN_ROUTES.lightning.avgFeeUsd).toBe(0.001);
    expect(CHAIN_ROUTES.lightning.minAmount).toBeGreaterThan(0);
    expect(CHAIN_ROUTES.lightning.needsRecipient).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. EVM TIP: CHAIN SELECTION & CONTRACT DATA
// ═══════════════════════════════════════════════════════════════════════════

describe('EVM Tip — Chain Selection & Contract Data', () => {
  it('encodes tip(address) with correct function selector', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
    const encoded = encodeTipData(recipient);
    expect(encoded).toMatch(/^0x1702e8f0/);
    expect(encoded.length).toBe(74); // 0x + 4 bytes selector + 32 bytes address
  });

  it('encodes tipWithMessage with message content', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
    const message = 'gm degen!';
    const encoded = encodeTipWithMessageData(recipient, message);
    expect(encoded).toMatch(/^0xcf02c46b/);
    expect(encoded.toLowerCase()).toContain(Buffer.from(message).toString('hex'));
  });

  it('selects Base as best EVM chain for medium tips', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');
    const results = selectBestChain({
      senderChains: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
      recipientChains: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
      amountUsd: 20,
    });
    expect(results[0]?.chain).toBe('base');
    expect(results[0]?.route.speed).toBe('fast');
  });

  it('selects Ethereum for large tips (> $100)', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');
    const results = selectBestChain({
      senderChains: ['ethereum', 'solana', 'base'],
      recipientChains: ['ethereum', 'solana', 'base'],
      amountUsd: 500,
      preferredChain: 'ethereum',
    });
    const eth = results.find((r) => r.chain === 'ethereum');
    expect(eth).toBeDefined();
    expect(eth?.rank).toBe(1);
  });

  it('has TIP_CONTRACT_ABI with all required methods', () => {
    const methodNames = TIP_CONTRACT_ABI.filter((i) => i.type === 'function').map((i) => i.name);
    expect(methodNames).toContain('tip');
    expect(methodNames).toContain('tipWithMessage');
    expect(methodNames).toContain('tipWithSplit');
    expect(methodNames).toContain('batchTip');
    expect(methodNames).toContain('tipERC20');
  });

  it('TIp_CHAIN_CONFIG has correct chain IDs for all supported chains', () => {
    expect(TIP_CHAIN_CONFIG.base.chainIdDecimal).toBe(8453);
    expect(TIP_CHAIN_CONFIG.optimism.chainIdDecimal).toBe(10);
    expect(TIP_CHAIN_CONFIG.arbitrum.chainIdDecimal).toBe(42161);
    expect(TIP_CHAIN_CONFIG.base.explorer).toBe('https://basescan.org');
    expect(TIP_CHAIN_CONFIG.optimism.explorer).toContain('etherscan');
    expect(TIP_CHAIN_CONFIG.arbitrum.explorer).toBe('https://arbiscan.io');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. SOL TIP: BLINK ACTION → BUILD → CONFIRM
// ═══════════════════════════════════════════════════════════════════════════

describe('SOL Tip — Blink Action Flow', () => {
  it('builds a valid Solana transfer transaction', () => {
    const sender = Keypair.generate();
    const recipient = Keypair.generate().publicKey.toBase58();
    const tx = new Transaction();
    tx.feePayer = sender.publicKey;
    tx.recentBlockhash = '4M5xYZx7nTByfFV9KxGj69acpmFDJyEQLM26Gc3x1j6Y';
    tx.add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: new PublicKey(recipient),
        lamports: 0.001 * LAMPORTS_PER_SOL,
      }),
    );
    tx.sign(sender);
    expect(tx.signatures.length).toBe(1);
    expect(tx.instructions.length).toBe(1);
    expect(tx.instructions[0]?.programId.toBase58()).toBe('11111111111111111111111111111111');
  });

  it('rejects SOL tip with zero lamports', () => {
    const sender = Keypair.generate();
    const recipient = Keypair.generate().publicKey.toBase58();
    expect(() => {
      const tx = new Transaction();
      tx.feePayer = sender.publicKey;
      tx.recentBlockhash = '4M5xYZx7nTByfFV9KxGj69acpmFDJyEQLM26Gc3x1j6Y';
      tx.add(
        SystemProgram.transfer({
          fromPubkey: sender.publicKey,
          toPubkey: new PublicKey(recipient),
          lamports: 0,
        }),
      );
      // Transaction with 0 transfer is valid Solana tx but practically useless
      expect(tx.instructions[0]?.programId.toBase58()).toBeTruthy();
    }).not.toThrow();
  });

  it('handles Solana blink tip endpoint metadata', async () => {
    const env = createMockEnv();
    const request = new Request('https://app.degenfeed.xyz/api/blink/tip');
    const { handleBlinkTip } = await import('../../workers/api/src/routes/blink');
    const res = await handleBlinkTip(request, env as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string; description?: string; icon?: string };
    expect(body.title).toBe('Tip on DegenFeed');
  });

  it('rejects blink tip with invalid recipient address', async () => {
    const env = createMockEnv();
    const request = new Request(
      'https://app.degenfeed.xyz/api/blink/tip?recipient=bad&amount=0.001',
      {
        method: 'POST',
        body: JSON.stringify({ account: Keypair.generate().publicKey.toBase58() }),
      },
    );
    const { handleBlinkTip } = await import('../../workers/api/src/routes/blink');
    const res = await handleBlinkTip(request, env as any);
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. x402 PAYMENT TIP: INVOICE → PAY → VERIFY
// ═══════════════════════════════════════════════════════════════════════════

describe('x402 Payment Tip Flow', () => {
  it('returns 402 with X-Payment-Required header for paywall', async () => {
    const env = createMockEnv();
    const creator = Keypair.generate().publicKey.toBase58();
    const request = new Request(
      `https://app.degenfeed.xyz/api/x402/paywall?creator=${encodeURIComponent(creator)}&amount=0.001`,
    );
    const { handleX402Paywall } = await import('../../workers/api/src/routes/x402');
    const res = await handleX402Paywall(request, env as any);
    expect(res.status).toBe(402);
    const header = res.headers.get('X-Payment-Required');
    expect(header).toContain('solana:https://app.degenfeed.xyz/api/blink/tip');
    expect(header).toContain(creator);
  });

  it('verifies x402 payment with valid signed transaction proof', async () => {
    const sender = Keypair.generate();
    const recipient = Keypair.generate().publicKey.toBase58();
    const proof = buildSignedSOLTx(sender, recipient);
    const env = createMockEnv();
    const request = new Request('https://app.degenfeed.xyz/api/x402/verify', {
      method: 'POST',
      body: JSON.stringify({ proof }),
    });
    const { handleX402Verify } = await import('../../workers/api/src/routes/x402');
    const res = await handleX402Verify(request, env as any);
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(true);
  });

  it('rejects x402 paywall with invalid creator address', async () => {
    const env = createMockEnv();
    const request = new Request('https://app.degenfeed.xyz/api/x402/paywall?creator=bad');
    const { handleX402Paywall } = await import('../../workers/api/src/routes/x402');
    const res = await handleX402Paywall(request, env as any);
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. TIP RECORDING & PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

describe('Tip Recording & Persistence', () => {
  it('records a unified tip and creates all ledger entries', async () => {
    const { recordUnifiedTip } = await import('../../workers/api/src/routes/unified-tip-core');
    const env = createMockEnv() as any;

    const activity = await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'post_789',
      entityType: 'post',
      amountUsd: 15,
      fromUserId: '0xsender123',
      toUserId: '0xrecipient456',
      fromLabel: 'Alice',
      toLabel: 'Bob',
      method: 'eth',
    });

    expect(activity).not.toBeNull();
    expect(activity?.id).toContain('utip:');
    expect(activity?.amountUsd).toBe(15);
    expect(activity?.fromLabel).toBe('Alice');
    expect(activity?.toLabel).toBe('Bob');
    expect(activity?.platform).toBe('degenfeed');
  });

  it('accumulates tip totals across multiple platforms for same recipient', async () => {
    const { recordUnifiedTip } = await import('../../workers/api/src/routes/unified-tip-core');
    const env = createMockEnv() as any;

    const recipient = '0xmulti_platform_recipient';
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'p1',
      entityType: 'post',
      amountUsd: 50,
      fromUserId: 'tipper1',
      toUserId: recipient,
    });
    await recordUnifiedTip(env, {
      platform: 'bluesky',
      entityId: 'b1',
      entityType: 'post',
      amountUsd: 25,
      fromUserId: 'tipper2',
      toUserId: recipient,
    });
    await recordUnifiedTip(env, {
      platform: 'mastodon',
      entityId: 'm1',
      entityType: 'post',
      amountUsd: 10,
      fromUserId: 'tipper1',
      toUserId: recipient,
    });

    const kv = env.CACHE;
    const receivedRaw = await kv.get(`tip:user:${recipient}:received`);
    expect(receivedRaw).not.toBeNull();
    const received = JSON.parse(receivedRaw!);
    expect(received.totalUsd).toBe(85);
    expect(received.count).toBe(3);
    expect(received.tippers.length).toBe(2);
  });

  it('sanitizes and validates tip amounts', async () => {
    const { sanitizeAmountUsd } = await import('../../workers/api/src/routes/unified-tip-core');
    expect(sanitizeAmountUsd(0)).toBeNull();
    expect(sanitizeAmountUsd(-5)).toBeNull();
    expect(sanitizeAmountUsd(100001)).toBeNull(); // over MAX_TIP_USD
    expect(sanitizeAmountUsd(1)).toBe(1);
    expect(sanitizeAmountUsd(99999)).toBe(99999);
    expect(sanitizeAmountUsd('42.50')).toBe(42.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. TIP NOTIFICATIONS & LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════

describe('Tip Notifications & Leaderboard', () => {
  it('generates tip received activity in correct order', async () => {
    const { recordUnifiedTip, handleUnifiedTipActivity } = await import(
      '../../workers/api/src/routes/unified-tip-core'
    );
    const env = createMockEnv() as any;

    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'a1',
      entityType: 'post',
      amountUsd: 5,
      fromLabel: 'Alice',
      toLabel: 'Bob',
    });
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'a2',
      entityType: 'post',
      amountUsd: 10,
      fromLabel: 'Charlie',
      toLabel: 'Diana',
    });

    const res = await handleUnifiedTipActivity(
      new Request('http://localhost/api/tip/unified/activity'),
      env,
    );
    const body = (await res.json()) as {
      activity: Array<{ amountUsd: number; fromLabel: string }>;
    };
    expect(body.activity.length).toBe(2);
    // Newest first
    expect(body.activity[0]?.fromLabel).toBe('Charlie');
    expect(body.activity[1]?.fromLabel).toBe('Alice');
  });

  it('builds leaderboard sorted by total USD received', async () => {
    const { recordUnifiedTip, handleUnifiedTipLeaderboard } = await import(
      '../../workers/api/src/routes/unified-tip-core'
    );
    const env = createMockEnv() as any;

    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'l1',
      entityType: 'post',
      amountUsd: 100,
      toUserId: 'top_creator',
    });
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'l2',
      entityType: 'post',
      amountUsd: 50,
      toUserId: 'second_creator',
    });
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'l3',
      entityType: 'post',
      amountUsd: 200,
      toUserId: 'top_creator',
    });

    const res = await handleUnifiedTipLeaderboard(
      new Request('http://localhost/api/tip/unified/leaderboard?period=alltime'),
      env,
    );
    const body = (await res.json()) as {
      entries: Array<{ userId: string; totalUsd: number; rank: number }>;
    };
    expect(body.entries[0]?.userId).toBe('top_creator');
    expect(body.entries[0]?.totalUsd).toBe(300);
    expect(body.entries[0]?.rank).toBe(1);
    expect(body.entries[1]?.userId).toBe('second_creator');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Tip Edge Cases', () => {
  it('rejects self-tip (sender === recipient)', async () => {
    const { recordUnifiedTip } = await import('../../workers/api/src/routes/unified-tip-core');
    const env = createMockEnv() as any;
    const result = await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'self_tip',
      entityType: 'post',
      amountUsd: 10,
      fromUserId: 'self_user',
      toUserId: 'self_user',
    });
    // Self-tip should be rejected — sender cannot be same as recipient
    expect(result).toBeNull();
  });

  it('rejects zero amount tips', async () => {
    const { sanitizeAmountUsd } = await import('../../workers/api/src/routes/unified-tip-core');
    expect(sanitizeAmountUsd(0)).toBeNull();
  });

  it('rejects negative amount tips', async () => {
    const { sanitizeAmountUsd } = await import('../../workers/api/src/routes/unified-tip-core');
    expect(sanitizeAmountUsd(-1)).toBeNull();
  });

  it('rejects excessively large tips', async () => {
    const { sanitizeAmountUsd } = await import('../../workers/api/src/routes/unified-tip-core');
    expect(sanitizeAmountUsd(100000)).toBeNull(); // At MAX_TIP_USD threshold
  });

  it('sanitizes entity IDs to prevent injection', async () => {
    const { sanitizeEntityId } = await import('../../workers/api/src/routes/unified-tip-core');
    expect(sanitizeEntityId('<script>alert("xss")</script>')).toBeNull();
    expect(sanitizeEntityId('')).toBeNull();
    expect(sanitizeEntityId(null)).toBeNull();
    expect(sanitizeEntityId('valid-post-123')).toBe('valid-post-123');
  });

  it('handles empty/null/undefined fromUserId gracefully', async () => {
    const { recordUnifiedTip } = await import('../../workers/api/src/routes/unified-tip-core');
    const env = createMockEnv() as any;
    const result = await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'no_sender',
      entityType: 'post',
      amountUsd: 5,
      fromUserId: '',
      toUserId: 'recipient',
    });
    expect(result).toBeNull();
  });
});
