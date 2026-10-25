'use client';

/**
 * @degenfeed/ui — focus trap for the compose dialog.
 *
 * Handles the three behaviours a modal owes the keyboard: focus moves into the
 * dialog on open, Tab cycles inside it, and Escape closes it. Focus returns to
 * whatever the user was using before the dialog opened.
 */

import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href]:not(.hidden),button:not([disabled]):not(.hidden):not([tabindex="-1"]),textarea:not([disabled]),input:not([disabled]):not([type="file"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    if (container && !container.contains(document.activeElement)) {
      const target = container.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
      target?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [active, containerRef]);
}
