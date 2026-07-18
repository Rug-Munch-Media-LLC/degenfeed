'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface MessagesKeyboardActions {
  onSelectConversation: (convId: string) => void;
  onOpenConversation?: (convId: string) => void;
  onCloseConversation?: () => void;
}

/**
 * `useMessagesKeyboardNav` — Keyboard navigation for the messages/conversations list.
 *
 * Shortcuts:
 *   ArrowDown / j  — Next conversation
 *   ArrowUp / k    — Previous conversation
 *   Enter          — Open selected conversation
 *   Escape         — Close conversation / deselect
 *
 * @param conversationIds Array of conversation IDs in display order
 * @param actions         Callbacks
 * @param enabled         Disable when in input
 * @param listRef         Ref to the conversation list container
 */
export function useMessagesKeyboardNav(
  conversationIds: string[],
  actions: MessagesKeyboardActions,
  enabled: boolean,
  listRef: React.RefObject<HTMLElement | null>,
) {
  const focusedIndex = useRef(-1);

  const focusConversationByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= conversationIds.length) return;
      focusedIndex.current = index;
      const id = conversationIds[index];
      if (!id) return;
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-conversation-id="${id}"]`,
      );
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [conversationIds, listRef],
  );

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          if (e.key === 'ArrowDown' && focusedIndex.current < 0) return;
          e.preventDefault();
          focusConversationByIndex(focusedIndex.current + 1);
          break;
        }
        case 'ArrowUp':
        case 'k': {
          if (e.key === 'ArrowUp' && focusedIndex.current < 0) return;
          e.preventDefault();
          focusConversationByIndex(focusedIndex.current - 1);
          break;
        }
        case 'Enter': {
          if (focusedIndex.current < 0) return;
          e.preventDefault();
          const convId = conversationIds[focusedIndex.current];
          if (convId) {
            actions.onSelectConversation(convId);
            actions.onOpenConversation?.(convId);
          }
          break;
        }
        case 'Escape': {
          if (focusedIndex.current >= 0) {
            focusedIndex.current = -1;
            actions.onCloseConversation?.();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, conversationIds, actions, focusConversationByIndex]);

  return {
    focusedIndex,
    focusConversationByIndex,
  };
}
