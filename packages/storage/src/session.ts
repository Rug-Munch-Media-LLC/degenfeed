// ─── Active Session (in-memory only) ───────────────────────────────────

import type { StoredIdentity } from './types';
export interface ActiveSession {
  identity: StoredIdentity;
  /** Decrypted key material. NEVER written to disk. */
  decryptedSecret: string | null;
  unlockedAt: number;
}

const activeSessions = new Map<string, ActiveSession>();

export function setActiveSession(identityId: string, session: ActiveSession): void {
  activeSessions.set(identityId, session);
}

export function getActiveSession(identityId: string): ActiveSession | undefined {
  return activeSessions.get(identityId);
}

export function clearActiveSession(identityId: string): void {
  activeSessions.delete(identityId);
}

export function clearAllSessions(): void {
  activeSessions.clear();
}
