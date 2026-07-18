/**
 * @degenfeed/crossplatform-register — Bluesky invite code pool management
 *
 * Manages a pool of Bluesky invite codes stored in KV for premium users.
 * Auto-refills via Bluesky account growth; tracks usage for analytics.
 *
 * KV structure:
 *   bluesky:invite-codes       — JSON array of available invite codes
 *   bluesky:invite-codes-used  — counter of codes used
 *   bluesky:invite-codes-log   — JSON array of usage log entries
 */

export interface InviteCodeEntry {
  code: string;
  acquiredAt: number;
  usedAt?: number;
  usedBy?: string;
}

export const BLUESKY_INVITE_CODES_KEY = 'bluesky:invite-codes';
export const BLUESKY_INVITE_USED_KEY = 'bluesky:invite-codes-used';
export const BLUESKY_INVITE_LOG_KEY = 'bluesky:invite-codes-log';
export const BLUESKY_INVITE_REFILL_KEY = 'bluesky:invite-last-refill';

/**
 * Acquire an invite code from the pool.
 * Removes it from available and increments the usage counter.
 */
export async function acquireInviteCode(pool?: KVNamespace): Promise<string | null> {
  if (!pool) return null;

  try {
    const raw = await pool.get(BLUESKY_INVITE_CODES_KEY);
    if (!raw) return null;

    const codes: string[] = JSON.parse(raw);
    const code = codes.shift();
    if (!code) return null;

    await pool.put(BLUESKY_INVITE_CODES_KEY, JSON.stringify(codes));

    // Increment usage counter
    const usedRaw = await pool.get(BLUESKY_INVITE_USED_KEY);
    const used = usedRaw ? Number.parseInt(usedRaw, 10) : 0;
    await pool.put(BLUESKY_INVITE_USED_KEY, String(used + 1));

    // Log usage
    await appendInviteLog(pool, { code, acquiredAt: Date.now(), usedAt: Date.now() });

    return code;
  } catch {
    return null;
  }
}

/**
 * Return an unused invite code to the pool (e.g. if account creation fails).
 */
export async function returnInviteCode(code: string, pool?: KVNamespace): Promise<void> {
  if (!pool) return;

  try {
    const raw = await pool.get(BLUESKY_INVITE_CODES_KEY);
    const codes: string[] = raw ? JSON.parse(raw) : [];
    if (!codes.includes(code)) {
      codes.unshift(code);
      await pool.put(BLUESKY_INVITE_CODES_KEY, JSON.stringify(codes));
    }
  } catch {
    // Best-effort
  }
}

/**
 * Get pool statistics.
 */
export async function getInvitePoolStats(pool?: KVNamespace): Promise<{
  available: number;
  used: number;
  lastRefill: number | null;
}> {
  if (!pool) return { available: 0, used: 0, lastRefill: null };

  try {
    const raw = await pool.get(BLUESKY_INVITE_CODES_KEY);
    const codes: string[] = raw ? JSON.parse(raw) : [];
    const usedRaw = await pool.get(BLUESKY_INVITE_USED_KEY);
    const used = usedRaw ? Number.parseInt(usedRaw, 10) : 0;
    const refillRaw = await pool.get(BLUESKY_INVITE_REFILL_KEY);
    const lastRefill = refillRaw ? Number.parseInt(refillRaw, 10) : null;
    return { available: codes.length, used, lastRefill };
  } catch {
    return { available: 0, used: 0, lastRefill: null };
  }
}

/**
 * Add invite codes to the pool (deduplicates).
 * Returns the total number of codes now available.
 */
export async function addInviteCodes(
  codes: string[],
  pool?: KVNamespace,
): Promise<number> {
  if (!pool || codes.length === 0) return 0;

  try {
    const raw = await pool.get(BLUESKY_INVITE_CODES_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const deduped = [...new Set([...existing, ...codes])];
    await pool.put(BLUESKY_INVITE_CODES_KEY, JSON.stringify(deduped));
    await pool.put(BLUESKY_INVITE_REFILL_KEY, String(Date.now()));
    return deduped.length;
  } catch {
    return 0;
  }
}

/**
 * Get the invite code usage log.
 */
export async function getInviteLog(pool?: KVNamespace): Promise<InviteCodeEntry[]> {
  if (!pool) return [];

  try {
    const raw = await pool.get(BLUESKY_INVITE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function appendInviteLog(pool: KVNamespace, entry: InviteCodeEntry): Promise<void> {
  try {
    const raw = await pool.get(BLUESKY_INVITE_LOG_KEY);
    const log: InviteCodeEntry[] = raw ? JSON.parse(raw) : [];
    log.push(entry);
    // Keep only the last 1000 entries
    const trimmed = log.slice(-1000);
    await pool.put(BLUESKY_INVITE_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort
  }
}
