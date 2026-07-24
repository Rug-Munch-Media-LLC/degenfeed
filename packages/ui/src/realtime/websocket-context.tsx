/**
 * @degenfeed/realtime — WebSocketProvider
 *
 * Provides a shared WebSocket connection via React context so multiple
 * components can subscribe to channels without creating duplicate connections.
 */

'use client';

import type React from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { ChannelName } from './channels';
import { useRealtime } from './useRealtime';

interface RealtimeContextValue {
  connected: boolean;
  subscribe: (channel: ChannelName | string, handler: (data: unknown) => void) => () => void;
  send: (type: string, data?: unknown) => void;
  sendTyping: (conversationId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function WebSocketProvider({
  userId,
  children,
}: {
  userId?: string | null;
  children: React.ReactNode;
}) {
  const { connected, subscribe, send, sendTyping } = useRealtime(userId);

  const value = useMemo(
    () => ({ connected, subscribe, send, sendTyping }),
    [connected, subscribe, send, sendTyping],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeContext(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    return {
      connected: false,
      subscribe: () => () => {},
      send: () => {},
      sendTyping: () => {},
    };
  }
  return ctx;
}

export function RealtimeStatusDot() {
  const { connected } = useRealtimeContext();

  return (
    <div
      role="status"
      aria-label={connected ? 'Real-time connection active' : 'Real-time connection unavailable'}
      title={
        connected
          ? 'WebSocket connected — live updates active'
          : 'WebSocket disconnected — falling back to polling'
      }
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors"
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          backgroundColor: connected ? 'var(--color-accent)' : 'var(--color-danger)',
          boxShadow: connected
            ? '0 0 6px color-mix(in srgb, var(--color-accent) 40%, transparent)'
            : '0 0 6px color-mix(in srgb, var(--color-danger) 40%, transparent)',
        }}
      />
      <span className="hidden sm:inline">{connected ? 'Live' : 'Live'}</span>
    </div>
  );
}
