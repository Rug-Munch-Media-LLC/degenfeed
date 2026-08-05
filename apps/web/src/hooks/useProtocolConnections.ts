'use client';

/**
 * useProtocolConnections — real feed-data protocol status.
 *
 * Previously this hook simulated an OAuth "connect" flow with a fake
 * 1.2s setTimeout and persisted fake state to localStorage. It never
 * checked real health.
 *
 * Now it derives an honest per-protocol status from the ACTUAL feed API
 * response (not the bridge's health endpoint booleans, which have
 * historically disagreed with reality — e.g. reddit/rss/lens reported
 * unhealthy while their feeds returned full pages):
 *   - green  (5+ items)  → the feed is returning real content
 *   - yellow (1-4 items) → the feed is alive but thin / degraded
 *   - red    (0 items)   → the feed returned no content
 *   - grey   (unknown)   → the protocol has no feed endpoint or the
 *                          request failed (kept for EXTRA protocols
 *                          without a real feed route)
 *
 * Health is re-checked on mount and every 5 minutes. The bridge health
 * endpoint is still fetched as a fast supplementary signal so protocols
 * without a per-protocol feed route (EXTRA_PROTOCOLS) can still show a
 * status when the bridge reports one.
 *
 * There is no user-level "connect" action in this build — `connect()`
 * just re-checks real feed data and reports whether the protocol is
 * actually flowing content. `disconnect()` is a no-op refresh.
 */

import { getProtocolLabel } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EXTRA_PROTOCOLS, PROTOCOL_LIST } from '../components/feed/feed-protocols';

/* ─── Types ─────────────────────────────────────────────────── */

export type ProtocolStatus = 'healthy' | 'unhealthy' | 'down' | 'unconfigured';

export interface ProtocolConnection {
  id: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  /** Derived from real feed item counts: healthy / unhealthy / down / unconfigured */
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
  /** Number of protocols the feed API reports as healthy (5+ items). */
  healthyCount: number;
  isConnecting: string | null;
  connect: (
    protocolId: string,
    credentials?: { handle?: string; instanceUrl?: string; token?: string },
  ) => Promise<boolean>;
  disconnect: (protocolId: string) => void;
  connectionError: string | null;
  /** True once the first health check has resolved. */
  loaded: boolean;
}

const HEALTH_ENDPOINT = '/api/feed/health';

/* ─── Default protocol list ─────────────────────────────────── */

/**
 * Full catalog of protocol feeds. Built from the canonical registry
 * (feed-protocols.ts) plus extra routed feeds.
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

/** Protocols that have a real per-protocol feed endpoint we can count. */
const FEED_PROTOCOL_IDS = new Set(PROTOCOL_LIST.map((p) => p.id));

/** Feed volume thresholds: 5+ items = healthy, 1-4 = degraded, 0 = down. */
export function statusFromFeedCount(count: number): ProtocolStatus {
  if (count >= 5) return 'healthy';
  if (count >= 1) return 'unhealthy';
  return 'down';
}

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
  /** Last successful feed-item counts per protocol (id → count). */
  const lastCountsRef = useRef<Record<string, number>>({});

  /** Derive status for one protocol, preferring real feed counts. */
  const deriveStatus = useCallback(
    (proto: ProtocolConnection, health?: { healthy?: boolean }): ProtocolStatus => {
      const counted = lastCountsRef.current[proto.id];
      if (FEED_PROTOCOL_IDS.has(proto.id) && counted !== undefined) {
        return statusFromFeedCount(counted);
      }
      if (health) return health.healthy === true ? 'healthy' : 'unhealthy';
      return 'unconfigured';
    },
    [],
  );

  const applyState = useCallback((updater: (proto: ProtocolConnection) => ProtocolStatus) => {
    setConnections((prev) => {
      const next: ProtocolConnectionMap = {};
      for (const proto of DEFAULT_PROTOCOLS) {
        const status = updater(proto);
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

  /** Fetch per-protocol feed item counts (limit 5 is enough for the thresholds). */
  const fetchFeedCounts = useCallback(async (): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    const ids = Array.from(FEED_PROTOCOL_IDS);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/feed/${encodeURIComponent(id)}?limit=5`, {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'cache-control': 'no-store' },
          });
          if (!res.ok) return { id, count: 0 };
          const json = (await res.json()) as { data?: unknown[]; posts?: unknown[] };
          const items = json.data ?? json.posts ?? [];
          return { id, count: Array.isArray(items) ? items.length : 0 };
        } catch {
          return { id, count: 0 };
        }
      }),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') counts[result.value.id] = result.value.count;
    }
    return counts;
  }, []);

  const applyFeedCounts = useCallback(
    (counts: Record<string, number>) => {
      lastCountsRef.current = counts;
      applyState((proto) => {
        const count = counts[proto.id];
        if (count === undefined) return proto.status;
        return statusFromFeedCount(count);
      });
      setLoaded(true);
      setConnectionError(null);
    },
    [applyState],
  );

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
    // Primary signal: real feed item counts for every protocol with a feed route.
    const counts = await fetchFeedCounts();
    applyFeedCounts(counts);

    // Supplementary: bridge health for protocols without a feed endpoint.
    const sources = await fetchHealth();
    if (sources) lastHealthRef.current = sources;
    applyState((proto) => {
      if (!FEED_PROTOCOL_IDS.has(proto.id)) {
        return deriveStatus(proto, sources?.[proto.id]);
      }
      const counted = lastCountsRef.current[proto.id];
      if (counted !== undefined) return statusFromFeedCount(counted);
      return deriveStatus(proto, sources?.[proto.id]);
    });
  }, [applyFeedCounts, applyState, deriveStatus, fetchFeedCounts, fetchHealth]);

  // Initial load + periodic refresh: health on mount, then every 5 minutes.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 300_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const connect = useCallback(
    async (
      protocolId: string,
      _credentials?: { handle?: string; instanceUrl?: string; token?: string },
    ): Promise<boolean> => {
      // No user-level OAuth exists in this build. Re-check real feed data
      // and report whether the protocol is actually flowing content.
      setIsConnecting(protocolId);
      setConnectionError(null);
      const counts = await fetchFeedCounts();
      applyFeedCounts(counts);
      const count = counts[protocolId];
      const ok = count !== undefined && count >= 5;
      if (!ok) {
        setConnectionError(
          `${getProtocolLabel(protocolId)} has no recent content (${count ?? 0} items).`,
        );
      }
      setIsConnecting(null);
      setLoaded(true);
      return ok;
    },
    [applyFeedCounts, fetchFeedCounts],
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
