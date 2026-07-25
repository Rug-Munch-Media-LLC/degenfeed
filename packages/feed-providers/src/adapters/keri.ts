/**
 * KERI (Key Event Receipt Infrastructure) Adapter
 *
 * KERI is a secure key management infrastructure for decentralised identity.
 * Uses Key Event Logs (KELs) and Autonomic Identifiers (AIDs).
 *
 * API: KERIA agent — /identifiers/{name}, /schema/{said}, /credentials/{said}
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

export async function resolveKERI(aid: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await $fetch(`https://keri.link/oobi/${encodeURIComponent(aid)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchKERIPosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // KERI is identity infrastructure, no social feed
}
