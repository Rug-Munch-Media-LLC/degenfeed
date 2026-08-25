'use client';

/**
 * useMessageSync — Cross-device message sync
 *
 * Tracks last read position per conversation. Performs full sync
 * on login to fetch messages missed since last session.
 * Handles conflict resolution when same message sent from 2 devices.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

export interface SyncState {
  /** Per-conversation last read cursor (timestamp) */
  lastRead: Record<string, number>;
  /** Last full sync timestamp */
  lastSyncAt: number;
  /** Device ID for conflict resolution */
  deviceId: string;
  /** Synced message IDs (for dedup) */
  syncedIds: string[];
}

export interface SyncResult {
  newMessages: number;
  conflicts: number;
  resolvedConflicts: Array<{ messageId: string; kept: string; discarded?: string }>;
}

/* ─── Constants ───────────────────────────────────────────────── */

const STORAGE_KEY = 'degenfeed_sync_state';
const SYNC_INTERVAL_MS = 60000; // 1 minute

/* ─── Helpers ─────────────────────────────────────────────────── */

function generateDeviceId(): string {
  try {
    const stored = localStorage.getItem('degenfeed_device_id');
    if (stored) return stored;
    const id = `device_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem('degenfeed_device_id', id);
    return id;
  } catch {
    return `device_${crypto.randomUUID().slice(0, 8)}`;
  }
}

function loadSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { lastRead: {}, lastSyncAt: 0, deviceId: generateDeviceId(), syncedIds: [] };
    }
    return { ...JSON.parse(raw), deviceId: generateDeviceId() } as SyncState;
  } catch {
    return { lastRead: {}, lastSyncAt: 0, deviceId: generateDeviceId(), syncedIds: [] };
  }
}

function saveSyncState(state: SyncState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-critical
  }
}

/* ─── Conflict Resolution ─────────────────────────────────────── */

function resolveConflict(
  messages: Array<{ id: string; fromId: string; content: string; createdAt: number }>,
): Array<{
  id: string;
  fromId: string;
  content: string;
  createdAt: number;
  conflict?: { duplicateOf: string };
}> {
  const seen = new Map<string, { msg: (typeof messages)[0]; count: number }>();
  const resolved: Array<(typeof messages)[0] & { conflict?: { duplicateOf: string } }> = [];

  // Group by content + within 5 second window
  for (const msg of messages) {
    const key = `${msg.fromId}:${msg.content}`;
    const existing = seen.get(key);

    if (existing) {
      const timeDiff = Math.abs(msg.createdAt - existing.msg.createdAt);
      if (timeDiff < 5000) {
        // Same message sent from different devices — keep the one with earlier ID (lexicographic)
        if (msg.id < existing.msg.id) {
          resolved.push({ ...msg, conflict: { duplicateOf: existing.msg.id } });
          seen.set(key, { msg, count: existing.count + 1 });
        } else {
          resolved.push({ ...msg, conflict: { duplicateOf: msg.id } });
        }
        continue;
      }
    } else {
      seen.set(key, { msg, count: 1 });
    }
    resolved.push(msg);
  }

  return resolved;
}

/* ─── Hook ────────────────────────────────────────────────────── */

export function useMessageSync(userId: string | undefined) {
  const [state, setState] = useState<SyncState>(loadSyncState);
  const [syncing, setSyncing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist state changes
  useEffect(() => {
    saveSyncState(state);
  }, [state]);

  /** Mark a conversation as read up to a given timestamp */
  const markRead = useCallback((conversationId: string, timestamp: number) => {
    setState((prev) => ({
      ...prev,
      lastRead: {
        ...prev.lastRead,
        [conversationId]: Math.max(prev.lastRead[conversationId] ?? 0, timestamp),
      },
    }));
  }, []);

  /** Full sync: fetch messages since last sync */
  const performSync = useCallback(async (): Promise<SyncResult> => {
    if (!userId) return { newMessages: 0, conflicts: 0, resolvedConflicts: [] };

    setSyncing(true);
    try {
      const res = await fetch('/api/messages/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          since: stateRef.current.lastSyncAt,
          deviceId: stateRef.current.deviceId,
          lastRead: stateRef.current.lastRead,
        }),
      });

      if (!res.ok) return { newMessages: 0, conflicts: 0, resolvedConflicts: [] };

      const data = (await res.json()) as {
        messages: Array<{ id: string; fromId: string; content: string; createdAt: number }>;
        total: number;
      };

      // Resolve conflicts
      const resolved = resolveConflict(data.messages ?? []);
      const conflicts = resolved.filter((m) => m.conflict).length;

      // Update synced IDs
      const newIds = resolved.map((m) => m.id);
      setState((prev) => ({
        ...prev,
        lastSyncAt: Date.now(),
        syncedIds: [...new Set([...prev.syncedIds, ...newIds])].slice(-1000),
      }));

      return {
        newMessages: data.total,
        conflicts,
        resolvedConflicts: resolved
          .filter((m) => m.conflict)
          .map((m) => ({
            messageId: m.id,
            kept: m.id,
            discarded: m.conflict?.duplicateOf,
          })),
      };
    } catch {
      return { newMessages: 0, conflicts: 0, resolvedConflicts: [] };
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  // Full sync on login / reconnect
  useEffect(() => {
    if (userId) {
      performSync();
    }
  }, [userId, performSync]);

  // Periodic sync
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      performSync();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, performSync]);

  // Also sync when coming online
  useEffect(() => {
    const handleOnline = () => {
      if (userId) performSync();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId, performSync]);

  /** Get last read timestamp for a conversation */
  const getLastRead = useCallback(
    (conversationId: string): number => {
      return state.lastRead[conversationId] ?? 0;
    },
    [state.lastRead],
  );

  /** Check if a message ID has already been synced (for dedup) */
  const isAlreadySynced = useCallback(
    (messageId: string): boolean => {
      return state.syncedIds.includes(messageId);
    },
    [state.syncedIds],
  );

  return {
    syncing,
    lastSyncAt: state.lastSyncAt,
    deviceId: state.deviceId,
    markRead,
    performSync,
    getLastRead,
    isAlreadySynced,
  };
}
