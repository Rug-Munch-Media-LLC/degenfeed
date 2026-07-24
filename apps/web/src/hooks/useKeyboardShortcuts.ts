'use client';

/**
 * useKeyboardShortcuts — Social feed keyboard navigation.
 * j/k: navigate posts, l: like, r: reply, t: tip, n: new post, /: search.
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutHandlers {
  onNext?: () => void;
  onPrev?: () => void;
  onLike?: () => void;
  onReply?: () => void;
  onTip?: () => void;
  onNewPost?: () => void;
  onSearch?: () => void;
  onScrollDown?: () => void;
  onScrollUp?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'j':
          e.preventDefault();
          handlers.onNext?.();
          break;
        case 'k':
          e.preventDefault();
          handlers.onPrev?.();
          break;
        case 'l':
          e.preventDefault();
          handlers.onLike?.();
          break;
        case 'r':
          e.preventDefault();
          handlers.onReply?.();
          break;
        case 't':
          e.preventDefault();
          handlers.onTip?.();
          break;
        case 'n':
          e.preventDefault();
          handlers.onNewPost?.();
          break;
        case '/':
          e.preventDefault();
          handlers.onSearch?.();
          break;
        case ' ':
          e.preventDefault();
          handlers.onScrollDown?.();
          break;
        case 'Shift':
          // Handled on keyup for scroll-up
          break;
      }
    },
    [handlers],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Shift') {
        e.preventDefault();
        handlers.onScrollUp?.();
      }
    },
    [handlers],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
