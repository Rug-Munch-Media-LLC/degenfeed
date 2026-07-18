'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PostContextMenuProps {
  /** Post ID to act on */
  postId: string;
  /** Post URL for copy-link */
  postUrl?: string;
  /** Callbacks for actions */
  onCopyLink?: (postId: string) => void;
  onOpenNewTab?: (postId: string) => void;
  onReport?: (postId: string) => void;
  /** Whether the menu is currently shown */
  open: boolean;
  /** Position to show the menu */
  position: { x: number; y: number };
  /** Close handler */
  onClose: () => void;
}

/**
 * Right-click context menu for posts.
 * Provides: Copy Link, Open in New Tab, Report.
 * Positioned at the cursor location.
 */
export function PostContextMenu({
  postId,
  postUrl,
  onCopyLink,
  onOpenNewTab,
  onReport,
  open,
  position,
  onClose,
}: PostContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!open || !menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = position.x;
    let y = position.y;

    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;

    setAdjustedPos({ x, y });
  }, [open, position]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    {
      label: 'Copy Link',
      icon: '🔗',
      action: () => {
        if (postUrl) {
          navigator.clipboard.writeText(postUrl).catch(() => {});
        } else {
          onCopyLink?.(postId);
        }
        onClose();
      },
    },
    {
      label: 'Open in New Tab',
      icon: '📂',
      action: () => {
        onOpenNewTab?.(postId);
        onClose();
      },
    },
    {
      label: 'Report',
      icon: '🚩',
      action: () => {
        onReport?.(postId);
        onClose();
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[55] min-w-[180px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-2xl backdrop-blur-xl"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      role="menu"
      aria-label="Post actions"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          role="menuitem"
        >
          <span className="text-sm" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Hook to manage right-click context menu state.
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    postId: string;
    postUrl?: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, postId: string, postUrl?: string) => {
    e.preventDefault();
    setContextMenu({ postId, position: { x: e.clientX, y: e.clientY }, postUrl });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
  };
}
