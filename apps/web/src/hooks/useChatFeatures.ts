'use client';

/**
 * useChatFeatures — Rich message composable for reactions, editing, search, etc.
 */

import { useCallback, useMemo, useState } from 'react';
import { retryFetch, retryFetchJson } from '../lib/retryFetch';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  me: boolean;
}

export interface ChatSearchResult {
  messageId: string;
  content: string;
  fromId: string;
  createdAt: number;
  conversationId?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  multipleChoice: boolean;
  endsAt: number | null;
  totalVotes: number;
  createdBy: string;
}

/* ─── Hook ──────────────────────────────────────────────────────────── */

export function useChatFeatures(conversationId?: string) {
  const [searchResults, setSearchResults] = useState<ChatSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [typingUsers, setTypingUsers_] = useState<string[]>([]);

  // ── Reactions ──────────────────────────────────────────────────

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!conversationId) return;
      try {
        await retryFetch('/api/messages/react', {
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ conversationId, messageId, emoji }),
          },
        });
      } catch {
        // Best-effort
      }
    },
    [conversationId],
  );

  // ── Reply ──────────────────────────────────────────────────────

  const replyToMessage = useCallback(
    async (messageId: string, content: string, replyToId: string) => {
      if (!conversationId) return null;
      try {
        const res = await retryFetch('/api/messages/send', {
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              conversationId,
              to: '', // Filled by server from conversation
              body: content,
              replyTo: replyToId,
            }),
          },
        });
        return await res.json();
      } catch {
        return null;
      }
    },
    [conversationId],
  );

  // ── Edit ────────────────────────────────────────────────────────

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!conversationId) return false;
      try {
        const res = await retryFetch('/api/messages/edit', {
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ conversationId, messageId, content: newContent }),
          },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [conversationId],
  );

  // ── Delete ──────────────────────────────────────────────────────

  const deleteMessage = useCallback(
    async (messageId: string, forEveryone: boolean) => {
      if (!conversationId) return false;
      try {
        const res = await retryFetch(`/api/messages/${encodeURIComponent(messageId)}`, {
          fetchOptions: {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ forEveryone }),
          },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [conversationId],
  );

  // ── Pin ─────────────────────────────────────────────────────────

  const pinMessage = useCallback(
    async (messageId: string, pin: boolean) => {
      if (!conversationId) return false;
      try {
        const res = await retryFetch('/api/messages/pin', {
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ conversationId, messageId, pin }),
          },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [conversationId],
  );

  // ── Search ──────────────────────────────────────────────────────

  const searchMessages = useCallback(
    async (query: string) => {
      if (!query.trim() || !conversationId) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await retryFetchJson<{ results: ChatSearchResult[] }>(
          `/api/messages/search?q=${encodeURIComponent(query)}&conversationId=${encodeURIComponent(conversationId)}`,
          { maxRetries: 1 },
        );
        setSearchResults(data.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [conversationId],
  );

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  // ── Polls ───────────────────────────────────────────────────────

  const createPoll = useCallback(
    async (question: string, options: string[], multipleChoice: boolean, endsInMinutes?: number) => {
      if (!conversationId) return null;
      try {
        const data = await retryFetchJson<{ ok: boolean; poll: Poll }>(
          '/api/messages/polls/create',
          {
            fetchOptions: {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                conversationId,
                question,
                options,
                multipleChoice,
                endsAt: endsInMinutes ? Date.now() + endsInMinutes * 60000 : null,
              }),
            },
          },
        );
        if (data.ok && data.poll) {
          setPolls((prev) => [...prev, data.poll]);
          return data.poll;
        }
      } catch {
        return null;
      }
    },
    [conversationId],
  );

  const votePoll = useCallback(
    async (pollId: string, optionIds: string[]) => {
      if (!conversationId) return false;
      try {
        const data = await retryFetchJson<{ ok: boolean; poll: Poll }>(
          `/api/messages/polls/vote`,
          {
            fetchOptions: {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ conversationId, pollId, optionIds }),
            },
          },
        );
        if (data.ok && data.poll) {
          setPolls((prev) => prev.map((p) => (p.id === pollId ? data.poll : p)));
          return true;
        }
      } catch {
        return false;
      }
    },
    [conversationId],
  );

  // ── Typing indicators ─────────────────────────────────────────

  const setTypingUsers = useCallback((users: string[]) => {
    setTypingUsers_(users);
  }, []);

  // ── GIF Search (Tenor/Giphy) ────────────────────────────────────

  const searchGifs = useCallback(async (query: string): Promise<Array<{ url: string; preview: string; width: number; height: number }>> => {
    if (!query.trim()) return [];
    try {
      const data = await retryFetchJson<{ results: Array<{ url: string; preview: string; width: number; height: number }> }>(
        `/api/messages/gifs/search?q=${encodeURIComponent(query)}`,
        { maxRetries: 1 },
      );
      return data.results ?? [];
    } catch {
      return [];
    }
  }, []);

  return {
    // State
    searchResults,
    searching,
    polls,

    // Reactions
    toggleReaction,

    // Messaging
    replyToMessage,
    editMessage,
    deleteMessage,
    pinMessage,

    // Search
    searchMessages,
    clearSearch,

    // Polls
    createPoll,
    votePoll,

    // Typing
    typingUsers,
    setTypingUsers,

    // GIFs
    searchGifs,
  };
}
