'use client';

/**
 * @degenfeed/degenchat — useDegenChatConnection
 *
 * React hook exposing live connection status for the DegenChat hub and every
 * protocol adapter. Used by the web UI to render per-adapter status dots,
 * auto-reconnect the hub after failures, and surface bridge health events
 * published on the `degenchat:bridge:status` channel.
 *
 *   const { adapterStates, hubStatus, restart } = useDegenChatConnection({
 *     signedInProtocols,
 *   });
 *   // adapterStates.nostr → 'connected' | 'connecting' | 'disconnected'
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEGENCHAT_CHANNELS, type DegenChatBridgeStatusPayload } from './channels';
import {
  DEGENCHAT_PROTOCOL_IDS,
  type DegenChatProtocolId,
} from './protocol-adapters';
import {
  getRedisHub,
  type RedisHub,
  type RedisHubStatus,
  resetRedisHub,
} from './redis-hub';

// ─── Types ────────────────────────────────────────────────────────────────

export type AdapterConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface DegenChatConnectionOptions {
  /** Map of protocol id → signed-in (from the auth provider). */
  signedInProtocols?: Record<string, boolean>;
  /** Start the hub on mount (default true). */
  autoStart?: boolean;
  /** Poll interval for hub status (ms, default 5000). */
  pollIntervalMs?: number;
}

export interface DegenChatConnectionResult {
  hubStatus: RedisHubStatus | null;
  adapterStates: Record<DegenChatProtocolId, AdapterConnectionState>;
  /** True while an auto-reconnect backoff is pending. */
  reconnecting: boolean;
  reconnectAttempt: number;
  /** Manually recreate + restart the hub (clears a wedged connection). */
  restart: () => void;
}

const DEFAULT_POLL_MS = 5000;
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useDegenChatConnection(
  options: DegenChatConnectionOptions = {},
): DegenChatConnectionResult {
  const {
    signedInProtocols = {},
    autoStart = true,
    pollIntervalMs = DEFAULT_POLL_MS,
  } = options;

  const [hubStatus, setHubStatus] = useState<RedisHubStatus | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [bridgeHealth, setBridgeHealth] = useState<
    Partial<Record<DegenChatProtocolId, boolean>>
  >({});

  const hubRef = useRef<RedisHub | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const start = useCallback(async () => {
    try {
      const hub = getRedisHub();
      hubRef.current = hub;
      await hub.start();
      setHubStatus(hub.status());
      setReconnecting(false);
      setReconnectAttempt(0);
    } catch {
      setHubStatus((prev) => (prev ? { ...prev, connected: false } : prev));
      setReconnecting(true);
    }
  }, []);

  // Subscribe to bridge health events so per-adapter status stays in sync.
  useEffect(() => {
    const hub = hubRef.current ?? getRedisHub();
    hubRef.current = hub;
    const unsub = hub.subscribe(DEGENCHAT_CHANNELS.BRIDGE_STATUS, (_channel, envelope) => {
      const payload = envelope.payload as DegenChatBridgeStatusPayload;
      if (!payload?.protocol) return;
      setBridgeHealth((prev) => ({ ...prev, [payload.protocol]: payload.healthy }));
    });
    return unsub;
  }, []);

  // Boot + poll hub status.
  useEffect(() => {
    let mounted = true;
    if (autoStart) {
      void start();
    }
    pollTimerRef.current = setInterval(() => {
      const hub = hubRef.current;
      if (!hub) return;
      if (mounted) setHubStatus(hub.status());
    }, pollIntervalMs);
    return () => {
      mounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [autoStart, pollIntervalMs, start]);

  // Auto-reconnect: when the hub reports disconnected while it should be up,
  // recreate the singleton and restart with exponential backoff.
  useEffect(() => {
    if (!autoStart) return;
    if (!hubStatus || hubStatus.connected || reconnecting) return;

    const attempt = reconnectAttempt;
    const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)] ?? 30000;
    setReconnecting(true);

    reconnectTimerRef.current = setTimeout(() => {
      resetRedisHub();
      hubRef.current = null;
      setReconnectAttempt((a) => a + 1);
      void start();
    }, delay);
  }, [hubStatus, reconnecting, autoStart, start]);

  const adapterStates = useMemo(() => {
    const states = {} as Record<DegenChatProtocolId, AdapterConnectionState>;
    for (const id of DEGENCHAT_PROTOCOL_IDS) {
      const signedIn = Boolean(signedInProtocols[id]);
      const healthy = bridgeHealth[id];
      if (!signedIn || healthy === false) {
        states[id] = 'disconnected';
      } else if (hubStatus?.connected) {
        states[id] = 'connected';
      } else {
        states[id] = 'connecting';
      }
    }
    return states;
  }, [signedInProtocols, bridgeHealth, hubStatus]);

  const restart = useCallback(() => {
    resetRedisHub();
    hubRef.current = null;
    setReconnectAttempt(0);
    void start();
  }, [start]);

  return { hubStatus, adapterStates, reconnecting, reconnectAttempt, restart };
}
