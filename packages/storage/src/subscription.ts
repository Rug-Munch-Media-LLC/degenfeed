import { getDb } from './db';
import type { SubscriptionRecord, SubscriptionTier } from './types';

const SUBSCRIPTION_TTL_MS = {
  free: 0,
  pro: 30 * 24 * 60 * 60 * 1000,
  creator: 30 * 24 * 60 * 60 * 1000,
};

export async function saveSubscription(record: SubscriptionRecord): Promise<void> {
  const db = await getDb();
  await db.put('subscriptions', record);
}

export async function getSubscription(identityId: string): Promise<SubscriptionRecord | undefined> {
  const db = await getDb();
  return (await db.get('subscriptions', identityId)) as SubscriptionRecord | undefined;
}

export function isSubscriptionActive(record?: SubscriptionRecord): boolean {
  if (!record) return false;
  return record.expiresAt > Date.now();
}

export function getTier(record?: SubscriptionRecord): SubscriptionTier {
  if (!record) return 'free';
  return isSubscriptionActive(record) ? record.tier : 'free';
}

export function isPremium(record?: SubscriptionRecord): boolean {
  return getTier(record) === 'pro' || getTier(record) === 'creator';
}

export function isCreator(record?: SubscriptionRecord): boolean {
  return getTier(record) === 'creator';
}

export function buildSubscriptionRecord(
  identityId: string,
  tier: SubscriptionTier,
  txSignature?: string,
  paymentAddress?: string,
): SubscriptionRecord {
  const now = Date.now();
  return {
    identityId,
    tier,
    startedAt: now,
    expiresAt: now + (SUBSCRIPTION_TTL_MS[tier] || 0),
    txSignature,
    paymentAddress,
  };
}
