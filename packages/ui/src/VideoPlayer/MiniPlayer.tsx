'use client';

import { useRef } from 'react';
import { MINI_PLAYER_HEIGHT, MINI_PLAYER_WIDTH } from './constants';

interface MiniPlayerProps {
  title?: string;
  channelName?: string;
  onClose: () => void;
  onClick: () => void;
}

export function MiniPlayer({ title, channelName, onClose, onClick }: MiniPlayerProps) {
  const playerRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(
    null,
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = playerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (playerRef.current) {
        playerRef.current.style.left = `${dragRef.current.left + dx}px`;
        playerRef.current.style.top = `${dragRef.current.top + dy}px`;
      }
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <button
      ref={playerRef}
      type="button"
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 cursor-pointer bg-black/90 backdrop-blur-sm text-left"
      style={{
        width: MINI_PLAYER_WIDTH,
        height: MINI_PLAYER_HEIGHT,
        bottom: 16,
        right: 16,
        padding: 0,
      }}
      onClick={onClick}
      aria-label={`Mini player: ${title ?? 'Video'}`}
    >
      {/* Drag handle */}
      <div
        role="presentation"
        className="absolute top-0 left-0 right-0 h-6 z-10 cursor-grab active:cursor-grabbing flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <div className="h-1 w-8 rounded-full bg-white/30" />
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-1 right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white transition-colors"
        aria-label="Close mini player"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Placeholder content */}
      <div className="flex h-full items-center justify-center">
        <div className="text-center px-2">
          {title && <p className="text-xs font-medium text-white line-clamp-1">{title}</p>}
          {channelName && <p className="mt-0.5 text-[10px] text-white/50">{channelName}</p>}
          <p className="mt-2 text-[10px] text-white/30">Now playing</p>
        </div>
      </div>
    </button>
  );
}
