export async function acquireInviteCode(pool?: KVNamespace): Promise<string | null> {
  if (!pool) return null;
  try {
    const raw = await pool.get('bluesky:invite-codes');
    if (!raw) return null;
    const codes: string[] = JSON.parse(raw);
    const code = codes.shift();
    if (!code) return null;
    await pool.put('bluesky:invite-codes', JSON.stringify(codes));
    const usedRaw = await pool.get('bluesky:invite-codes-used');
    await pool.put(
      'bluesky:invite-codes-used',
      String((usedRaw ? Number.parseInt(usedRaw, 10) : 0) + 1),
    );
    return code;
  } catch {
    return null;
  }
}

export async function returnInviteCode(code: string, pool?: KVNamespace): Promise<void> {
  if (!pool) return;
  try {
    const raw = await pool.get('bluesky:invite-codes');
    const codes: string[] = raw ? JSON.parse(raw) : [];
    codes.unshift(code);
    await pool.put('bluesky:invite-codes', JSON.stringify(codes));
  } catch {
    /* best-effort */
  }
}

export async function getBlueskyInvitePoolStats(
  pool?: KVNamespace,
): Promise<{ available: number; used: number }> {
  if (!pool) return { available: 0, used: 0 };
  try {
    const raw = await pool.get('bluesky:invite-codes');
    const codes: string[] = raw ? JSON.parse(raw) : [];
    const usedRaw = await pool.get('bluesky:invite-codes-used');
    return { available: codes.length, used: usedRaw ? Number.parseInt(usedRaw, 10) : 0 };
  } catch {
    return { available: 0, used: 0 };
  }
}

export async function addInviteCodesToPool(codes: string[], pool?: KVNamespace): Promise<number> {
  if (!pool || codes.length === 0) return 0;
  try {
    const raw = await pool.get('bluesky:invite-codes');
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const deduped = [...new Set([...existing, ...codes])];
    await pool.put('bluesky:invite-codes', JSON.stringify(deduped));
    return deduped.length;
  } catch {
    return 0;
  }
}
