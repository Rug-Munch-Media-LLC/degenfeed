'use client';

/**
 * useProtocolConnections — shared state for protocol connection status.
 *
 * Manages connection state for Mastodon, Bluesky, and other protocols.
 * Each protocol has: id, name, icon, color, connected state, handle/instance,
 * and connect/disconnect actions.
 */

import { getProtocolColor, getProtocolLabel, PROTOCOL_ICONS } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';

/* ─── Types ─────────────────────────────────────────────────── */

export interface ProtocolConnection {
  id: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  handle?: string;
  instanceUrl?: string;
  avatar?: string;
}

export type ProtocolConnectionMap = Record<string, ProtocolConnection>;

export interface ProtocolConnectionsState {
  connections: ProtocolConnectionMap;
  connectedCount: number;
  totalCount: number;
  /** Number of protocols reported healthy (status "up") by the live health endpoint. */
  healthyCount: number;
  /** Epoch ms of the last successful health check (0 before the first check). */
  healthCheckedAt: number;
  isConnecting: string | null;
  connect: (
    protocolId: string,
    credentials: { handle?: string; instanceUrl?: string; token?: string },
  ) => Promise<boolean>;
  disconnect: (protocolId: string) => void;
  connectionError: string | null;
}

const STORAGE_KEY = 'df_protocol_connections';

/* ─── Default protocol list ─────────────────────────────────── */

const DEFAULT_PROTOCOLS: ProtocolConnection[] = [
  {
    id: 'nostr',
    name: 'Nostr',
    icon: PROTOCOL_ICONS.nostr ?? 'N',
    color: getProtocolColor('nostr'),
    connected: false,
  },
  {
    id: 'farcaster',
    name: 'Farcaster',
    icon: PROTOCOL_ICONS.farcaster ?? 'F',
    color: getProtocolColor('farcaster'),
    connected: false,
  },
  {
    id: 'lens',
    name: 'Lens',
    icon: PROTOCOL_ICONS.lens ?? 'L',
    color: getProtocolColor('lens'),
    connected: false,
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: PROTOCOL_ICONS.bluesky ?? 'B',
    color: getProtocolColor('bluesky'),
    connected: false,
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    icon: PROTOCOL_ICONS.mastodon ?? 'M',
    color: getProtocolColor('mastodon'),
    connected: false,
  },
  { id: 'reddit', name: 'Reddit', icon: 'R', color: getProtocolColor('reddit'), connected: false },
  { id: 'rss', name: 'RSS', icon: 'A', color: getProtocolColor('rss'), connected: false },
];

/* ─── Hook ──────────────────────────────────────────────────── */

export function useProtocolConnections(): ProtocolConnectionsState {
  const [connections, setConnections] = useState<ProtocolConnectionMap>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProtocolConnectionMap;
        return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return {};
  });

  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [healthyCount, setHealthyCount] = useState(0);
  const [healthCheckedAt, setHealthCheckedAt] = useState(0);

  // Real health check — queries the app's health endpoint (which proxies the
  // bridge's live per-protocol health) so the sidebar badge reflects actual
  // protocol availability instead of always showing 0.
  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch('/api/health/protocols', {
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          protocols: Record<string, { status: 'up' | 'degraded' | 'down' }>;
        };
        if (cancelled) return;
        const up = Object.values(data.protocols).filter((p) => p.status === 'up').length;
        setHealthyCount(up);
        setHealthCheckedAt(Date.now());
      } catch {
        // keep previous count; never crash the sidebar
      }
    }
    void checkHealth();
    const id = setInterval(checkHealth, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch {
      // storage full or unavailable
    }
  }, [connections]);

  const connect = useCallback(
    async (
      protocolId: string,
      credentials: { handle?: string; instanceUrl?: string; token?: string },
    ): Promise<boolean> => {
      setIsConnecting(protocolId);
      setConnectionError(null);

      try {
        // Simulate OAuth flow — in production, this would redirect to provider
        await new Promise((resolve) => setTimeout(resolve, 1200));

        setConnections((prev) => ({
          ...prev,
          [protocolId]: {
            ...(prev[protocolId] ?? {
              id: protocolId,
              name: getProtocolLabel(protocolId) || protocolId,
              icon: PROTOCOL_ICONS[protocolId] ?? '?',
              color: getProtocolColor(protocolId),
              connected: false,
            }),
            connected: true,
            handle: credentials.handle || credentials.instanceUrl || protocolId,
            instanceUrl: credentials.instanceUrl,
          },
        }));

        setIsConnecting(null);
        return true;
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnecting(null);
        return false;
      }
    },
    [],
  );

  const disconnect = useCallback((protocolId: string) => {
    setConnections((prev) => ({
      ...prev,
      [protocolId]: {
        ...(prev[protocolId] ?? {
          id: protocolId,
          name: getProtocolLabel(protocolId) || protocolId,
          icon: PROTOCOL_ICONS[protocolId] ?? '?',
          color: getProtocolColor(protocolId),
          connected: false,
        }),
        connected: false,
        handle: undefined,
        instanceUrl: undefined,
        avatar: undefined,
      },
    }));
  }, []);

  // Merge saved connections with defaults
  const merged: ProtocolConnectionMap = {};
  const allProtocols = [...DEFAULT_PROTOCOLS];

  for (const proto of allProtocols) {
    const saved = connections[proto.id];
    merged[proto.id] = saved ?? proto;
  }

  // Include any extras that might be saved
  for (const [id, saved] of Object.entries(connections)) {
    if (!merged[id]) {
      merged[id] = saved;
    }
  }

  const connectedCount = Object.values(merged).filter((c) => c.connected).length;

  return {
    connections: merged,
    connectedCount,
    totalCount: allProtocols.length,
    healthyCount,
    healthCheckedAt,
    isConnecting,
    connect,
    disconnect,
    connectionError,
  };
}
