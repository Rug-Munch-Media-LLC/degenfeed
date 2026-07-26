/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Utilities
 */

import type { Env } from '../../index';
import { COIN_PREFIX, type CrossProtocolCoinRecord, TTL_1Y } from './types';

// ─── KV Helpers ────────────────────────────────────────────────────────────

export async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvPutJson(
  kv: KVNamespace | undefined,
  key: string,
  value: unknown,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn(`[cross-protocol-coin] KV put failed for ${key}:`, String(err));
  }
}

// ─── KV Adapter for CrossChainRegistry ────────────────────────────────────

export function createKvAdapter(kv: KVNamespace | undefined): {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
} {
  return {
    async get(key: string): Promise<string | null> {
      if (!kv) return null;
      try {
        return await kv.get(key);
      } catch {
        return null;
      }
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      if (!kv) return;
      try {
        await kv.put(key, value, {
          expirationTtl: options?.expirationTtl ?? TTL_1Y,
        });
      } catch (err) {
        console.warn(`[cross-protocol-coin] KV put failed for ${key}:`, String(err));
      }
    },
  };
}

// ─── Protocol Identity Resolution ─────────────────────────────────────────

/**
 * Resolve the protocol-native creator ID from the user's session.
 * Checks the linked identity store (IDENTITIES KV) for the given protocol.
 */
export async function getProtocolCreatorId(
  session: { address: string; chain: string },
  protocol: string,
  env: Env,
): Promise<string | null> {
  const walletAddress = session.address.toLowerCase();

  try {
    const identityKey = `identity:${walletAddress}`;
    const raw = await env.IDENTITIES?.get(identityKey);
    if (!raw) return null;

    const identity = JSON.parse(raw) as Record<string, unknown>;
    const protocolData = identity[protocol] as Record<string, unknown> | undefined;
    if (!protocolData) return null;

    switch (protocol) {
      case 'farcaster':
        return protocolData.fid ? String(protocolData.fid) : null;
      case 'nostr':
        return (protocolData.pubkey as string) || null;
      case 'bluesky':
        return (protocolData.did as string) || null;
      case 'lens':
        return (protocolData.profileId as string) || null;
      case 'threads':
        return (protocolData.id as string) || null;
      case 'mastodon':
      case 'activitypub':
        return (protocolData.id as string) || null;
      default:
        return (protocolData.id as string) || null;
    }
  } catch {
    return null;
  }
}

// ─── Fallback KV Scan ────────────────────────────────────────────────────

/**
 * Fallback scan when the CrossChainRegistry is unavailable.
 * Lists all coin records in KV and filters by protocol + creatorId.
 */
export async function findCoinsByProtocolCreator(
  env: Env,
  protocol: string,
  creatorId: string,
): Promise<CrossProtocolCoinRecord[]> {
  if (!env.CACHE) return [];

  const results: CrossProtocolCoinRecord[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page = await env.CACHE.list({
        prefix: COIN_PREFIX,
        cursor,
        limit: 100,
      });

      for (const key of page.keys) {
        try {
          const raw = await env.CACHE.get(key.name);
          if (!raw) continue;
          const record = JSON.parse(raw) as CrossProtocolCoinRecord;
          if (record.originProtocol === protocol && record.originCreatorId === creatorId) {
            results.push(record);
          }
        } catch {
          // skip unparseable entries
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && results.length < 50);
  } catch {
    // KV scan failed
  }

  return results;
}
