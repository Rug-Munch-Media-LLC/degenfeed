/**
 * @degenfeed/api-worker — Typed KV JSON access
 *
 * Own JSON (de)serialization instead of the fragile `kv.get(key, 'json')`
 * string-overload resolution in workers-types, which fails under strict mode.
 * Plain text `get` + JSON.parse — stable across type versions.
 *
 * Read semantics are fail-open: missing binding, missing key, or malformed
 * JSON all return null (matching the dominant `.catch(() => null)` intent).
 *
 * Consolidates the per-file kvGetJson copies previously scattered across
 * lens-coin.ts, live-tiktok-core.ts, unified-tip-core.ts, farcaster-coin.ts,
 * cross-protocol-coin/utils.ts, and tip-streaks.ts.
 */

export async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvPutJson(
  kv: KVNamespace | undefined,
  key: string,
  value: unknown,
  options?: { expirationTtl?: number },
): Promise<void> {
  if (!kv) return;
  await kv.put(key, JSON.stringify(value), options);
}
