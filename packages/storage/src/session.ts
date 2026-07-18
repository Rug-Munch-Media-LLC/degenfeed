// ─── Active Session (in-memory only) ───────────────────────────────────

import type { ActiveSession } from '@degenfeed/types';

// ActiveSession is defined in @degenfeed/types (via StoredIdentity) to prevent
// a conceptual circular dependency between @degenfeed/auth and @degenfeed/storage.
// We import and re-export it here for package-level accessibility.
export type { ActiveSession };

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
