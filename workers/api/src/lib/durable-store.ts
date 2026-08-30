/**
 * @degenfeed/api-worker — DegenFeed-owned durable state store
 *
 * Self-contained Cloudflare KV backed persistence for DegenFeed's durable
 * product state. DegenFeed does NOT consult rmi-backend for any of this
 * data — a rmi-backend outage cannot affect DegenFeed's account, identity,
 * or session state.
 *
 *   IDENTITIES (KV) — persistent identity mapping (address → JSON):
 *       key: `identity:{address}`   (identityKey from @degenfeed/utils)
 *
 * This module used to be a typed client for rmi-backend's `/api/v1`
 * KV-migration API, which persisted the namespaces that used to live in
 * Cloudflare KV. The rmi persistence path has been removed entirely; the
 * DegenFeed-owned KV namespaces declared in wrangler.toml are now the
 * single source of truth.
 *
 * Related DegenFeed-owned stores (not handled here):
 *   - BOOKMARKS (KV) — per-address bookmark list  (routes/bookmarks.ts)
 *   - CACHE (KV)     — live chat history          (live-chat/unified-chat.ts)
 *   - IDENTITIES (KV)— SSO session blobs          (lib/sso-bridge/implementation.ts)
 *   - CACHE (KV)     — auth session revocations   (session.ts)
 */

import { identityKey } from '@degenfeed/utils';
import type { Env } from '../types';

// ─── Identities ─────────────────────────────────────────────────────────
// KV: IDENTITIES. Key: `identity:${address}`. Persistent (no TTL).

/**
 * Read the persistent identity mapping for a wallet address from DegenFeed's
 * OWN IDENTITIES KV namespace. Returns `null` when absent or on any storage
 * error (never throws). Never consults rmi-backend.
 */
export async function getIdentity(
  env: Env,
  address: string,
): Promise<Record<string, unknown> | null> {
  if (!env.IDENTITIES) return null;
  try {
    const raw = await env.IDENTITIES.get(identityKey(address));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // malformed entry or storage hiccup — treat as absent
    return null;
  }
}

/**
 * Persist the identity mapping to DegenFeed's OWN IDENTITIES KV namespace.
 * Throws when IDENTITIES is unbound (local/dev) or the write fails, so
 * callers can decide how to surface the failure.
 */
export async function setIdentity(
  env: Env,
  address: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!env.IDENTITIES) throw new Error('IDENTITIES KV not configured');
  await env.IDENTITIES.put(identityKey(address), JSON.stringify(data));
}
