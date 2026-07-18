'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface FeedKeyboardActions {
  onOpenPost?: (postId: string) => void;
  onLike?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onTip?: (postId: string) => void;
  onBookmark?: (postId: string, action: 'bookmark' | 'unbookmark') => void;
  onCloseModal?: () => void;
}

/**
 * `useFeedKeyboardNav` — Full keyboard navigation for the feed.
 *
 * Shortcuts:
 *   j / ArrowDown  — Focus next post
 *   k / ArrowUp    — Focus previous post
 *   Enter          — Open focused post
 *   l              — Like focused post
 *   r              — Reply to focused post
 *   t              — Tip focused post
 *   b              — Bookmark focused post
 *   Escape         — Close any open modal/overlay
 *
 * @param postIds     Array of post IDs in display order
 * @param actions     Callbacks for each action
 * @param enabled     Disable when a modal/input is active
 * @param containerRef Ref to the feed container element
 * @returns { focusedIndex, focusedPostId, focusPostByIndex }
 */
export function useFeedKeyboardNav(
  postIds: string[],
  actions: FeedKeyboardActions,
  enabled: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const focusedIndex = useRef(-1);

  const focusPostByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= postIds.length) return;
      focusedIndex.current = index;
      const id = postIds[index];
      if (!id) return;
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-post-id="${id}"]`);
      el?.focus();
      // Scroll into view if needed
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [postIds, containerRef],
  );

  const focusNext = useCallback(() => {
    focusPostByIndex(focusedIndex.current + 1);
  }, [focusPostByIndex]);

  const focusPrev = useCallback(() => {
    focusPostByIndex(focusedIndex.current - 1);
  }, [focusPostByIndex]);

  const getFocusedPostId = useCallback((): string | null => {
    if (focusedIndex.current >= 0 && focusedIndex.current < postIds.length) {
      return postIds[focusedIndex.current] ?? null;
    }
    return null;
  }, [postIds]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger inside inputs/textareas/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          focusNext();
          break;
        }
        case 'k':
        case 'ArrowUp': {
          // Allow native ArrowUp for scroll when nothing is focused
          if (e.key === 'ArrowUp' && focusedIndex.current < 0) return;
          e.preventDefault();
          focusPrev();
          break;
        }
        case 'Enter': {
          if (focusedIndex.current < 0) return;
          e.preventDefault();
          const postId = getFocusedPostId();
          if (postId) actions.onOpenPost?.(postId);
          break;
        }
        case 'l': {
          if (focusedIndex.current < 0) return;
          const likeId = getFocusedPostId();
          if (likeId) actions.onLike?.(likeId);
          break;
        }
        case 'r': {
          if (focusedIndex.current < 0) return;
          const replyId = getFocusedPostId();
          if (replyId) actions.onReply?.(replyId);
          break;
        }
        case 't': {
          if (focusedIndex.current < 0) return;
          const tipId = getFocusedPostId();
          if (tipId) actions.onTip?.(tipId);
          break;
        }
        case 'b': {
          if (focusedIndex.current < 0) return;
          const bmId = getFocusedPostId();
          if (bmId) actions.onBookmark?.(bmId, 'bookmark');
          break;
        }
        case 'Escape': {
          actions.onCloseModal?.();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, focusNext, focusPrev, getFocusedPostId, actions]);

  // Reset focused index when post list changes
  useEffect(() => {
    focusedIndex.current = -1;
  }, []);

  return {
    focusedIndex,
    focusPostByIndex,
    focusNext,
    focusPrev,
    getFocusedPostId,
  };
}
