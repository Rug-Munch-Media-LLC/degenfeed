'use client';

/**
 * useChatReliability — Retry with exponential backoff, delivery confirmation,
 * message ordering, and duplicate detection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

export interface DeliveryState {
  messageId: string;
  /** Per-protocol delivery status */
  protocols: Record<
    string,
    {
      ok: boolean;
      nativeId?: string;
      error?: string;
      attemptedAt: number;
      attempts: number;
    }
  >;
  /** Overall status */
  status: 'pending' | 'delivered' | 'partial' | 'failed';
  /** Timestamp of last update */
  updatedAt: number;
}

export interface OutOfOrderMessage {
  messageId: string;
  expectedOrder: number;
  receivedAt: number;
  gap: number; // Number of missing messages before this one
}

export interface MessageOrder {
  sequenceId: number;
  messageId: string;
}

/* ─── Constants ───────────────────────────────────────────────── */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 10000;
const DUPLICATE_WINDOW_MS = 30000; // 30 second window for dedup

/* ─── Hook: Delivery Tracking ─────────────────────────────────── */

export function useDeliveryTracking() {
  const [deliveries, setDeliveries] = useState<Map<string, DeliveryState>>(new Map());

  /** Track a new message delivery attempt */
  const trackAttempt = useCallback(
    (messageId: string, protocol: string, ok: boolean, nativeId?: string, error?: string) => {
      setDeliveries((prev) => {
        const next = new Map(prev);
        const existing = next.get(messageId);
        const protocolState = existing?.protocols[protocol] ?? { attempts: 0 };

        const newProtocolState = {
          ok,
          nativeId,
          error,
          attemptedAt: Date.now(),
          attempts: protocolState.attempts + 1,
        };

        const protocols = { ...existing?.protocols, [protocol]: newProtocolState };
        const protocolValues = Object.values(protocols);
        const allOk = protocolValues.every((p) => p.ok);
        const anyOk = protocolValues.some((p) => p.ok);

        const status: DeliveryState['status'] = allOk ? 'delivered' : anyOk ? 'partial' : 'failed';

        next.set(messageId, {
          messageId,
          protocols,
          status,
          updatedAt: Date.now(),
        });

        return next;
      });
    },
    [],
  );

  /** Get delivery state for a message */
  const getDelivery = useCallback(
    (messageId: string): DeliveryState | undefined => {
      return deliveries.get(messageId);
    },
    [deliveries],
  );

  return { deliveries, trackAttempt, getDelivery };
}

/* ─── Hook: Retry with Exponential Backoff ────────────────────── */

export function useExponentialRetry(sendFn: (messageId: string) => Promise<boolean>) {
  const retryTimers = useRef<
    Map<string, { timer: ReturnType<typeof setTimeout>; attempt: number; messageId: string }>
  >(new Map());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const { timer } of retryTimers.current.values()) {
        clearTimeout(timer);
      }
      retryTimers.current.clear();
    };
  }, []);

  const scheduleRetry = useCallback(
    (messageId: string) => {
      const existing = retryTimers.current.get(messageId);
      const attempt = existing ? existing.attempt + 1 : 1;

      if (attempt > MAX_RETRIES) {
        retryTimers.current.delete(messageId);
        setRetryingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }

      const delay = Math.min(
        BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * BASE_DELAY_MS,
        MAX_DELAY_MS,
      );

      const timer = setTimeout(async () => {
        setRetryingIds((prev) => new Set(prev).add(messageId));
        try {
          const ok = await sendFn(messageId);
          if (ok) {
            retryTimers.current.delete(messageId);
            setRetryingIds((prev) => {
              const next = new Set(prev);
              next.delete(messageId);
              return next;
            });
          } else {
            // Schedule next retry
            scheduleRetry(messageId);
          }
        } catch {
          scheduleRetry(messageId);
        }
      }, delay);

      retryTimers.current.set(messageId, { timer, attempt, messageId });
      setRetryingIds((prev) => new Set(prev).add(messageId));
    },
    [sendFn],
  );

  const cancelRetry = useCallback((messageId: string) => {
    const existing = retryTimers.current.get(messageId);
    if (existing) {
      clearTimeout(existing.timer);
      retryTimers.current.delete(messageId);
    }
    setRetryingIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }, []);

  return { retryingIds, scheduleRetry, cancelRetry };
}

/* ─── Hook: Message Ordering ──────────────────────────────────── */

export function useMessageOrdering() {
  const [_sequenceCounter, _setSequenceCounter] = useState(0);
  const expectedSeqRef = useRef<Map<string, number>>(new Map());
  const pendingGapRef = useRef<Map<string, Set<number>>>(new Map());

  /** Generate next sequence ID for a conversation */
  const nextSequence = useCallback((conversationId: string): number => {
    const next = (expectedSeqRef.current.get(conversationId) ?? 0) + 1;
    expectedSeqRef.current.set(conversationId, next);
    return next;
  }, []);

  /** Check if a message arrived in order, or detect gaps */
  const checkOrder = useCallback(
    (
      conversationId: string,
      messageId: string,
      sequenceId: number,
    ): { inOrder: boolean; gap?: OutOfOrderMessage } => {
      const expected = expectedSeqRef.current.get(conversationId) ?? 0;

      if (sequenceId <= expected) {
        // Duplicate or re-delivered — ignore
        return { inOrder: true };
      }

      if (sequenceId === expected + 1) {
        // In order — advance
        expectedSeqRef.current.set(conversationId, sequenceId);
        // Check if we filled a gap
        const gaps = pendingGapRef.current.get(conversationId);
        if (gaps) {
          gaps.delete(sequenceId);
          if (gaps.size === 0) pendingGapRef.current.delete(conversationId);
        }
        return { inOrder: true };
      }

      // Out of order — record gap
      const gap = sequenceId - expected - 1;
      const existingGaps = pendingGapRef.current.get(conversationId) ?? new Set();
      for (let i = expected + 1; i < sequenceId; i++) {
        existingGaps.add(i);
      }
      pendingGapRef.current.set(conversationId, existingGaps);

      return {
        inOrder: false,
        gap: { messageId, expectedOrder: sequenceId, receivedAt: Date.now(), gap },
      };
    },
    [],
  );

  /** Get pending gaps for a conversation */
  const getPendingGaps = useCallback((conversationId: string): number[] => {
    const gaps = pendingGapRef.current.get(conversationId);
    return gaps ? [...gaps].sort((a, b) => a - b) : [];
  }, []);

  return { nextSequence, checkOrder, getPendingGaps };
}

/* ─── Hook: Duplicate Detection ───────────────────────────────── */

export function useDuplicateDetection() {
  const seenRef = useRef<Map<string, number>>(new Map());

  /** Check if message is a duplicate (same id, same content, within window) */
  const isDuplicate = useCallback((messageId: string, content: string, fromId: string): boolean => {
    const key = `${messageId}:${fromId}`;
    const seenAt = seenRef.current.get(key);
    const now = Date.now();

    if (seenAt && now - seenAt < DUPLICATE_WINDOW_MS) {
      return true;
    }

    // Also deduplicate by content+fromId within 2 second window
    const contentKey = `${content}:${fromId}`;
    const contentSeenAt = seenRef.current.get(contentKey);
    if (contentSeenAt && now - contentSeenAt < 2000) {
      return true;
    }

    seenRef.current.set(key, now);
    seenRef.current.set(contentKey, now);

    // Prune old entries
    if (seenRef.current.size > 500) {
      const cutoff = now - DUPLICATE_WINDOW_MS;
      for (const [k, v] of seenRef.current) {
        if (v < cutoff) seenRef.current.delete(k);
      }
    }

    return false;
  }, []);

  return { isDuplicate };
}
