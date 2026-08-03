'use client';

/**
 * useChatUnread — DegenChat unread message count for navigation badges.
 *
 * Polls the conversations endpoint (same data the messages page uses) and
 * subscribes to realtime DM events so the sidebar badge stays in sync without
 * mounting the full messages hook.
 */

import { CHANNELS, useRealtime } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { retryFetchJson } from '../lib/retryFetch';

const POLL_INTERVAL_MS = 30000;

interface ConversationRow {
  unreadCount?: number;
}

export function useChatUnread(): { unreadTotal: number; loading: boolean } {
  const { ready, signedInProtocols, tokens } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { subscribe } = useRealtime(tokens.nostr_pubkey || undefined);

  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!hasSignedIn) {
      setUnreadTotal(0);
      return;
    }
    setLoading(true);
    try {
      const data = await retryFetchJson<{ conversations: ConversationRow[] }>(
        '/api/messages/conversations',
        { maxRetries: 1 },
      );
      const total = (data.conversations ?? []).reduce((s, c) => s + (c.unreadCount ?? 0), 0);
      setUnreadTotal(total);
    } catch {
      // best-effort badge
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    if (!hasSignedIn || !subscribe) return;
    return subscribe(CHANNELS.DM_NEW, () => {
      fetchUnread();
    });
  }, [hasSignedIn, subscribe, fetchUnread]);

  return { unreadTotal, loading };
}
