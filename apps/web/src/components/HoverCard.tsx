'use client';

import type React from 'react';
import { useCallback, useRef, useState } from 'react';

interface HoverCardProps {
  /** The trigger element (e.g. username) */
  children: React.ReactNode;
  /** Content to show in the hover card */
  content: React.ReactNode;
  /** Delay before showing (default 400ms) */
  showDelay?: number;
}

/**
 * Hover card that appears when hovering over a trigger element.
 * Shows mini profile preview with avatar, bio, follow button.
 * Uses a delay to avoid flickering when the user is just passing through.
 */
export function HoverCard({ children, content, showDelay = 400 }: HoverCardProps) {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setVisible(true), showDelay);
  }, [showDelay]);

  const handleMouseLeave = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={handleMouseEnter}
      onPointerLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div
          ref={cardRef}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-xl backdrop-blur-xl"
          onMouseEnter={() => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {/* Arrow */}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[var(--color-border)] bg-[var(--color-card)]" />
          {content}
        </div>
      )}
    </span>
  );
}
