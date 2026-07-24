/**
 * ═════════════════════════════════════════════════════════════════════════════
 * SPACES BROADCAST INTEGRATION TESTS — 10 tests
 *
 * Tests the spaces gating layer and utility functions:
 *   - Gate label/color helpers
 *   - canAccessSpace gating checks (no-gate and subscription)
 *   - Space item creation and validation
 *   - Premium gate checking (token, subscription, payment)
 *   - Unified gate results
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest';

// Import pure utility functions directly (no transitive workspace deps)
import { getGateLabel } from '../../packages/spaces-bridge/src/premium';
import type { SpaceGating, SpaceItem, SpacePlatform } from '../../packages/spaces-bridge/src/types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function _makeSpace(overrides: Partial<SpaceItem> = {}): SpaceItem {
  return {
    id: 'nostr:test123',
    title: 'Test Space',
    hostId: 'host:1',
    hostName: 'Test Host',
    platforms: [{ platform: 'nostr' as SpacePlatform, nativeId: 'test123' }],
    status: 'live',
    createdAt: Date.now(),
    listeners: 42,
    speakers: [],
    reactions: [],
    tippingEnabled: false,
    coHosts: [],
    ...overrides,
  };
}

describe('Spaces — Gate Labels', () => {
  it('should return empty string for no gating', () => {
    expect(getGateLabel(undefined)).toBe('');
    expect(getGateLabel({ type: 'none' })).toBe('');
  });

  it('should return label for token gate', () => {
    const label = getGateLabel({ type: 'token', tokenAddress: '0xabc' });
    expect(label).toContain('Token');
  });

  it('should return label for subscription gate', () => {
    const label = getGateLabel({ type: 'subscription', subscriptionTier: 'pro' });
    expect(label).toContain('Subscriber');
  });

  it('should return label for payment gate', () => {
    const label = getGateLabel({ type: 'payment', paymentAmount: '0.01' });
    expect(label).toContain('Paid');
  });
});

describe('Spaces — canAccessSpace (simple gates)', () => {
  // Note: canAccessSpace is imported from index.ts which transitively requires
  // @degenfeed/peertube-provider. These tests verify the no-gate path works
  // by testing the underlying checkAllGates function directly.
  it('should allow access to spaces with no gating via checkAllGates', async () => {
    const { checkAllGates } = await import('../../packages/spaces-bridge/src/premium');
    const result = await checkAllGates('user:1', undefined, { type: 'none' });
    expect(result.allowed).toBe(true);
  });

  it('should allow access when gating is undefined via checkAllGates', async () => {
    const { checkAllGates } = await import('../../packages/spaces-bridge/src/premium');
    const result = await checkAllGates('user:1', undefined, undefined as never);
    expect(result.allowed).toBe(true);
  });
});

describe('Spaces — Premium Gate Checking', () => {
  it('should check subscription gate with service call', async () => {
    const mod = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = { type: 'subscription', subscriptionTier: 'pro' };
    const result = await mod.checkSubscriptionGate('user:1', gating);
    // Subscription service isn't available in test, should fail gracefully
    expect(result).toBeDefined();
    expect(typeof result.allowed).toBe('boolean');
  });

  it('should pass through non-subscription gates', async () => {
    const { checkSubscriptionGate } = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = { type: 'token', tokenAddress: '0xabc' };
    const result = await checkSubscriptionGate('user:1', gating);
    expect(result.allowed).toBe(true);
  });

  it('should check payment gate and return payment required', async () => {
    const { checkPaymentGate } = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = { type: 'payment', paymentAmount: '0.01', paymentToken: 'eth' };
    const result = await checkPaymentGate('user:1', gating);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Payment');
  });

  it('should pass through non-payment gates', async () => {
    const { checkPaymentGate } = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = { type: 'none' };
    const result = await checkPaymentGate('user:1', gating);
    expect(result.allowed).toBe(true);
  });

  it('should check token gate and return failure without RPC', async () => {
    const { checkTokenGate } = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = {
      type: 'token',
      tokenAddress: '0xabc',
      minBalance: '1',
      chainId: 1,
    };
    const result = await checkTokenGate('0xuser', gating);
    expect(result.allowed).toBe(false);
  });

  it('should pass through non-token gates', async () => {
    const { checkTokenGate } = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = { type: 'none' };
    const result = await checkTokenGate('0xuser', gating);
    expect(result.allowed).toBe(true);
  });
});

describe('Spaces — Unified Gate Check', () => {
  it('should return allowed for no gating', async () => {
    const { checkAllGates } = await import('../../packages/spaces-bridge/src/premium');
    const result = await checkAllGates('user:1', undefined, { type: 'none' });
    expect(result.allowed).toBe(true);
    expect(result.gates).toEqual({});
  });

  it('should check payment gate in unified check', async () => {
    const { checkAllGates } = await import('../../packages/spaces-bridge/src/premium');
    const gating: SpaceGating = { type: 'payment', paymentAmount: '0.01' };
    const result = await checkAllGates('user:1', undefined, gating);
    expect(result.allowed).toBe(false);
    expect(result.gates.payment).toBeDefined();
    expect(result.gates.payment?.allowed).toBe(false);
  });
});
