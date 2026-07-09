// ─── Creator Monetization Preferences ─────────────────────────────────

import { getDb } from './db';
import type { MonetizationPreferences } from './types';

export async function saveMonetizationPreferences(prefs: MonetizationPreferences): Promise<void> {
  const db = await getDb();
  await db.put('monetization', { ...prefs, updatedAt: Date.now() });
}

export async function getMonetizationPreferences(
  identityId: string,
): Promise<MonetizationPreferences | undefined> {
  const db = await getDb();
  return (await db.get('monetization', identityId)) as MonetizationPreferences | undefined;
}

export function getDefaultMonetizationPreferences(identityId: string): MonetizationPreferences {
  return {
    identityId,
    updatedAt: Date.now(),
  };
}
