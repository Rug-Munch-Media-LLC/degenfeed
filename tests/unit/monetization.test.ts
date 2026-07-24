/**
 * ═════════════════════════════════════════════════════════════════════════════
 * MONETIZATION UNIT TESTS — 10 tests
 *
 * Covers:
 *   - Tier management: upgrade, downgrade, expire
 *   - Feature gating: premium features blocked for free users
 *   - Subscription lifecycle
 *   - Monetization preferences CRUD
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSubscriptionRecord,
  getTier,
  isCreator,
  isPremium,
  isSubscriptionActive,
} from '../../packages/storage/src/subscription';
import type { SubscriptionRecord } from '../../packages/storage/src/types';

describe('Subscription Tier Management', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a free subscription record with immediate expiry', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const record = buildSubscriptionRecord('user-1', 'free');
    expect(record.identityId).toBe('user-1');
    expect(record.tier).toBe('free');
    // Free tier has 0 TTL, so expiresAt === startedAt
    expect(record.expiresAt).toBe(now);
    expect(isSubscriptionActive(record)).toBe(false);
  });

  it('should create a pro subscription record with 30-day expiry', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const record = buildSubscriptionRecord('user-1', 'pro');
    expect(record.tier).toBe('pro');
    expect(record.expiresAt).toBe(now + 30 * 24 * 60 * 60 * 1000);
    expect(record.startedAt).toBe(now);
  });

  it('should create a creator subscription record with 30-day expiry', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const record = buildSubscriptionRecord('user-1', 'creator');
    expect(record.tier).toBe('creator');
    expect(record.expiresAt).toBe(now + 30 * 24 * 60 * 60 * 1000);
  });

  it('should return free tier for undefined record', () => {
    expect(getTier(undefined)).toBe('free');
    expect(isPremium(undefined)).toBe(false);
    expect(isCreator(undefined)).toBe(false);
  });

  it('should detect expired subscription and return free tier', () => {
    const expiredRecord: SubscriptionRecord = {
      identityId: 'user-1',
      tier: 'pro',
      startedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      expiresAt: Date.now() - 1, // expired 1ms ago
    };
    expect(isSubscriptionActive(expiredRecord)).toBe(false);
    expect(getTier(expiredRecord)).toBe('free');
    expect(isPremium(expiredRecord)).toBe(false);
  });

  it('should detect active premium subscription', () => {
    const activeRecord: SubscriptionRecord = {
      identityId: 'user-1',
      tier: 'pro',
      startedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    expect(isSubscriptionActive(activeRecord)).toBe(true);
    expect(getTier(activeRecord)).toBe('pro');
    expect(isPremium(activeRecord)).toBe(true);
    expect(isCreator(activeRecord)).toBe(false);
  });

  it('should detect active creator subscription', () => {
    const activeRecord: SubscriptionRecord = {
      identityId: 'user-1',
      tier: 'creator',
      startedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    expect(isSubscriptionActive(activeRecord)).toBe(true);
    expect(getTier(activeRecord)).toBe('creator');
    expect(isPremium(activeRecord)).toBe(true);
    expect(isCreator(activeRecord)).toBe(true);
  });

  it('should downgrade from creator to free when expired', () => {
    vi.setSystemTime(1000000);
    const record = buildSubscriptionRecord('user-1', 'creator');
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
    expect(isSubscriptionActive(record)).toBe(false);
    expect(getTier(record)).toBe('free');
    expect(isPremium(record)).toBe(false);
  });
});

describe('Feature Gating', () => {
  it('should block premium features for free users with no record', () => {
    const features = {
      crossPosting: isPremium(undefined),
      analytics: isCreator(undefined),
      customDomain: isPremium(undefined),
    };
    expect(features.crossPosting).toBe(false);
    expect(features.analytics).toBe(false);
    expect(features.customDomain).toBe(false);
  });

  it('should block premium features for expired subscription', () => {
    const expired: SubscriptionRecord = {
      identityId: 'user-1',
      tier: 'pro',
      startedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      expiresAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    };
    expect(isPremium(expired)).toBe(false);
  });

  it('should allow premium features for active subscription', () => {
    const active: SubscriptionRecord = {
      identityId: 'user-1',
      tier: 'pro',
      startedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    expect(isPremium(active)).toBe(true);
  });

  it('should include txSignature and paymentAddress when provided', () => {
    const record = buildSubscriptionRecord('user-1', 'pro', 'sig_abc123', '0x123abc');
    expect(record.txSignature).toBe('sig_abc123');
    expect(record.paymentAddress).toBe('0x123abc');
  });
});
