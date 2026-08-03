'use client';

/**
 * useProtocolConnections — real bridge-health protocol status.
 *
 * Previously this hook simulated an OAuth "connect" flow with a fake
 * 1.2s setTimeout and persisted fake state to localStorage. It never
 * checked real health.
 *
 * Now it fetches live health from `/api/feed/health` and derives an
 * honest per-protocol status:
 *   - green  (`connected: true`)  → bridge reports the protocol healthy
 *   - yellow (`status: 'unhealthy'`) → bridge reports the protocol down
 *   - grey   (`status: 'unconfigured'`) → not reported by the bridge
 *
 * There is no user-level "connect" action in this build — `connect()`
 * just re-checks real health and reports whether the protocol is
 * actually flowing data. `disconnect()` is a no-op refresh.
 */

import { getProtocolLabel } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EXTRA_PROTOCOLS, PROTOCOL_LIST } from '../components/feed/feed-protocols';

/* ─── Types ─────────────────────────────────────────────────── */

export type ProtocolStatus = 'healthy' | 'unhealthy' | 'unconfigured';

export interface ProtocolConnection {
  id: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  /** Derived from real bridge health: healthy / unhealthy / unconfigured */
  status: ProtocolStatus;
  /** Canonical feed route (e.g. /feed/nostr) */
  route: string;
  handle?: string;
  instanceUrl?: string;
  avatar?: string;
}

export type ProtocolConnectionMap = Record<string, ProtocolConnection>;

export interface ProtocolConnectionsState {
  connections: ProtocolConnectionMap;
  connectedCount: number;
  totalCount: number;
  /** Number of protocols the bridge reports as healthy (data flowing). */
  healthyCount: number;
  isConnecting: string | null;
  connect: (
    protocolId: string,
    credentials?: { handle?: string; instanceUrl?: string; token?: string },
  ) => Promise<boolean>;
  disconnect: (protocolId: string) => void;
  connectionError: string | null;
  /** True once the first health fetch has resolved. */
  loaded: boolean;
}

const HEALTH_ENDPOINT = '/api/feed/health';

/* ─── Default protocol list ─────────────────────────────────── */

/**
 * Full catalog of protocol feeds. Built from the canonical registry
 * (feed-protocols.ts) plus extra routed feeds. The bridge health
 * endpoint reports live status for the ones it tracks; everything else
 * stays `unconfigured` (grey) until the bridge reports it.
 */
const DEFAULT_PROTOCOLS: ProtocolConnection[] = PROTOCOL_LIST.map(
  (p): ProtocolConnection => ({
    id: p.id,
    name: p.label,
    icon: p.icon,
    color: p.color,
    connected: false,
    status: 'unconfigured',
    route: p.route,
  }),
).concat(
  EXTRA_PROTOCOLS.map(
    (p): ProtocolConnection => ({
      id: p.id,
      name: p.label,
      icon: p.icon,
      color: p.color,
      connected: false,
      status: 'unconfigured',
      route: p.route,
    }),
  ),
);

interface HealthPayload {
  sources?: Record<string, { healthy?: boolean }>;
}

/* ─── Hook ──────────────────────────────────────────────────── */

export function useProtocolConnections(): ProtocolConnectionsState {
  const [connections, setConnections] = useState<ProtocolConnectionMap>(() => {
    const map: ProtocolConnectionMap = {};
    for (const proto of DEFAULT_PROTOCOLS) map[proto.id] = proto;
    return map;
  });
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lastHealthRef = useRef<HealthPayload['sources'] | null>(null);

  const applyHealth = useCallback((sources: HealthPayload['sources']) => {
    lastHealthRef.current = sources;
    setConnections((prev) => {
      const next: ProtocolConnectionMap = {};
      for (const proto of DEFAULT_PROTOCOLS) {
        const health = sources?.[proto.id];
        let status: ProtocolStatus = 'unconfigured';
        if (health) status = health.healthy === true ? 'healthy' : 'unhealthy';
        const existing = prev[proto.id] ?? proto;
        next[proto.id] = {
          ...proto,
          icon: existing.icon ?? proto.icon,
          color: existing.color ?? proto.color,
          connected: status === 'healthy',
          status,
        };
      }
      return next;
    });
  }, []);

  const fetchHealth = useCallback(async (): Promise<HealthPayload['sources'] | null> => {
    try {
      const res = await fetch(HEALTH_ENDPOINT, { credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as HealthPayload;
      return data.sources ?? null;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const sources = await fetchHealth();
    if (sources) {
      applyHealth(sources);
      setLoaded(true);
      setConnectionError(null);
    } else {
      // Keep last known state; surface the failure once so the UI can
      // show that status is unknown rather than pretending it's fine.
      setConnectionError('Unable to reach feed health endpoint');
    }
  }, [applyHealth, fetchHealth]);

  // Initial load + periodic refresh.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const connect = useCallback(
    async (
      protocolId: string,
      _credentials?: { handle?: string; instanceUrl?: string; token?: string },
    ): Promise<boolean> => {
      // No user-level OAuth exists in this build. Re-check real health
      // and report whether the protocol is actually flowing data.
      setIsConnecting(protocolId);
      setConnectionError(null);
      const sources = await fetchHealth();
      if (sources) applyHealth(sources);
      const health = (sources ?? lastHealthRef.current)?.[protocolId];
      const ok = health?.healthy === true;
      if (!ok) {
        setConnectionError(
          `${getProtocolLabel(protocolId)} is not currently healthy on the bridge.`,
        );
      }
      setIsConnecting(null);
      setLoaded(true);
      return ok;
    },
    [applyHealth, fetchHealth],
  );

  const disconnect = useCallback(
    (_protocolId: string) => {
      // No per-user disconnect endpoint in this build — refresh real status.
      void refresh();
    },
    [refresh],
  );

  const merged: ProtocolConnectionMap = {};
  for (const proto of DEFAULT_PROTOCOLS) {
    merged[proto.id] = connections[proto.id] ?? proto;
  }

  const connectedCount = Object.values(merged).filter((c) => c.connected).length;
  const healthyCount = Object.values(merged).filter((c) => c.status === 'healthy').length;

  return {
    connections: merged,
    connectedCount,
    totalCount: DEFAULT_PROTOCOLS.length,
    healthyCount,
    isConnecting,
    connect,
    disconnect,
    connectionError,
    loaded,
  };
}
