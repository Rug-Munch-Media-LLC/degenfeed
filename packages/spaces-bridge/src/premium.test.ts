import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @degenfeed/token-gate with default success
vi.mock('@degenfeed/token-gate', () => ({
  checkTokenGate: vi.fn().mockResolvedValue(true),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  checkAllGates,
  checkPaymentGate,
  checkSubscriptionGate,
  checkTokenGate,
  getGateColor,
  getGateLabel,
} from './premium';
import type { SpaceGating } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function tokenGate(overrides: Partial<SpaceGating> = {}): SpaceGating {
  return {
    type: 'token',
    tokenAddress: '0x1234',
    minBalance: '100',
    chainId: 1,
    ...overrides,
  };
}

function subscriptionGate(overrides: Partial<SpaceGating> = {}): SpaceGating {
  return {
    type: 'subscription',
    subscriptionTier: 'premium',
    ...overrides,
  };
}

function paymentGate(overrides: Partial<SpaceGating> = {}): SpaceGating {
  return {
    type: 'payment',
    paymentAmount: '1000000000000000',
    paymentToken: 'eth',
    ...overrides,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── getGateLabel ─────────────────────────────────────────────────────────

describe('getGateLabel()', () => {
  it('should return empty string for no gating', () => {
    expect(getGateLabel()).toBe('');
    expect(getGateLabel({ type: 'none' })).toBe('');
  });

  it('should return label for token gate', () => {
    expect(getGateLabel({ type: 'token' })).toContain('Token');
  });

  it('should return label for subscription gate', () => {
    expect(getGateLabel({ type: 'subscription' })).toContain('Subscriber');
  });

  it('should return label for payment gate', () => {
    expect(getGateLabel({ type: 'payment' })).toContain('Paid');
  });
});

// ─── getGateColor ────────────────────────────────────────────────────────

describe('getGateColor()', () => {
  it('should return empty string for no gating', () => {
    expect(getGateColor()).toBe('');
    expect(getGateColor({ type: 'none' })).toBe('');
  });

  it('should return amber for token gate', () => {
    expect(getGateColor({ type: 'token' })).toBe('amber');
  });

  it('should return purple for subscription gate', () => {
    expect(getGateColor({ type: 'subscription' })).toBe('purple');
  });

  it('should return emerald for payment gate', () => {
    expect(getGateColor({ type: 'payment' })).toBe('emerald');
  });
});

// ─── checkTokenGate ──────────────────────────────────────────────────────

describe('checkTokenGate()', () => {
  it('should allow access for non-token gating', async () => {
    const result = await checkTokenGate('0xuser', { type: 'none' });
    expect(result.allowed).toBe(true);
  });

  it('should allow access when tokenAddress is missing', async () => {
    const result = await checkTokenGate('0xuser', { type: 'token' });
    expect(result.allowed).toBe(true);
  });

  it('should check token gate for valid gating (default mock returns true)', async () => {
    const result = await checkTokenGate('0xuser', tokenGate());
    expect(result.allowed).toBe(true);
  });

  it('should work with Base chain ID', async () => {
    const result = await checkTokenGate('0xuser', tokenGate({ chainId: 8453 }));
    expect(result.allowed).toBe(true);
  });

  it('should set reason when token gate check fails', async () => {
    // Override mock for this test only — must also reset after
    const tokenGateMod = await import('@degenfeed/token-gate');
    vi.mocked(tokenGateMod.checkTokenGate).mockRejectedValue(new Error('RPC error'));

    const result = await checkTokenGate('0xuser', tokenGate());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Gate check unavailable');

    // Reset mock so subsequent tests aren't affected
    vi.mocked(tokenGateMod.checkTokenGate).mockResolvedValue(true);
  });
});

// ─── checkSubscriptionGate ───────────────────────────────────────────────

describe('checkSubscriptionGate()', () => {
  it('should allow access for non-subscription gating', async () => {
    const result = await checkSubscriptionGate('user:abc', { type: 'none' });
    expect(result.allowed).toBe(true);
  });

  it('should return allowed when subscription is active', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ active: true, tier: 'premium', expiresAt: Date.now() + 86400000 }),
    });

    const result = await checkSubscriptionGate('user:abc', subscriptionGate());
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('premium');
  });

  it('should reject when subscription is inactive', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ active: false }),
    });

    const result = await checkSubscriptionGate('user:abc', subscriptionGate());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('subscription');
  });

  it('should reject on API failure', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const result = await checkSubscriptionGate('user:abc', subscriptionGate());
    expect(result.allowed).toBe(false);
  });

  it('should reject on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkSubscriptionGate('user:abc', subscriptionGate());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('unavailable');
  });
});

// ─── checkPaymentGate ────────────────────────────────────────────────────

describe('checkPaymentGate()', () => {
  it('should allow access for non-payment gating', async () => {
    const result = await checkPaymentGate('user:abc', { type: 'none' });
    expect(result.allowed).toBe(true);
  });

  it('should return allowed when payment receipt found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ paid: true }),
    });

    const result = await checkPaymentGate('user:abc', paymentGate());
    expect(result.allowed).toBe(true);
  });

  it('should require payment when no receipt found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ paid: false }),
    });

    const result = await checkPaymentGate('user:abc', paymentGate());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Payment required');
  });

  it('should require payment on API failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkPaymentGate('user:abc', paymentGate());
    expect(result.allowed).toBe(false);
    expect(result.paymentUrl).toBeDefined();
    expect(result.amount).toBe('1000000000000000');
  });
});

// ─── checkAllGates ──────────────────────────────────────────────────────

describe('checkAllGates()', () => {
  it('should allow when no gating configured', async () => {
    const result = await checkAllGates('user:abc', '0xuser', { type: 'none' });
    expect(result.allowed).toBe(true);
    expect(result.gates).toEqual({});
  });

  it('should allow when gating is undefined', async () => {
    const result = await checkAllGates('user:abc', '0xuser', undefined as any);
    expect(result.allowed).toBe(true);
  });

  it('should check token gate only (default mock returns true)', async () => {
    const result = await checkAllGates('user:abc', '0xuser', tokenGate());
    expect(result.allowed).toBe(true);
    expect(result.gates.token?.allowed).toBe(true);
  });

  it('should check subscription gate only', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ active: true }),
    });

    const result = await checkAllGates('user:abc', '0xuser', subscriptionGate());
    expect(result.allowed).toBe(true);
    expect(result.gates.subscription?.allowed).toBe(true);
  });

  it('should deny when token gate fails', async () => {
    const tokenGateMod = await import('@degenfeed/token-gate');
    vi.mocked(tokenGateMod.checkTokenGate).mockRejectedValue(new Error('RPC error'));

    const result = await checkAllGates('user:abc', '0xuser', tokenGate());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Gate check unavailable');

    // Reset mock so subsequent tests aren't affected
    vi.mocked(tokenGateMod.checkTokenGate).mockResolvedValue(true);
  });
});
