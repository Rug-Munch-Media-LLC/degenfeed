'use client';

import { useCallback, useRef, useState } from 'react';

export type ContentType = 'all' | 'article' | 'thread' | 'image' | 'video' | 'space' | 'data';

interface ContentFilterBarProps {
  active: ContentType;
  onChange: (type: ContentType) => void;
  color: string;
}

const FILTERS: { id: ContentType; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📝' },
  { id: 'article', label: 'Articles', icon: '📰' },
  { id: 'thread', label: 'Threads', icon: '🧵' },
  { id: 'image', label: 'Images', icon: '🖼️' },
  { id: 'video', label: 'Videos', icon: '🎬' },
  { id: 'space', label: 'Spaces', icon: '🔊' },
  { id: 'data', label: 'Data', icon: '📊' },
];

export function ContentFilterBar({ active, onChange, color }: ContentFilterBarProps) {
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Use IntersectionObserver to detect when the bar hits the top of viewport
  const barRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
          ([entry]) => {
            // When the sentinel is NOT intersecting (scrolled past it), bar is sticky
            setIsSticky(!entry?.isIntersecting);
          },
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel to detect when the bar should become sticky */}
      <div ref={sentinelRef} className="pointer-events-none h-px" />

      <div
        ref={barRef}
        className={`mb-4 transition-all duration-200 ${
          isSticky ? 'fixed left-0 right-0 top-[108px] z-40 border-b py-2 shadow-md' : 'relative'
        }`}
        style={{
          backgroundColor: isSticky ? 'var(--color-glass-bg)' : 'transparent',
          borderColor: isSticky ? 'var(--color-glass-border)' : 'transparent',
          backdropFilter: isSticky ? 'blur(16px)' : 'none',
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto px-4 scrollbar-none">
          {FILTERS.map((f) => {
            const isActive = active === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange(f.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-fg)] shadow-sm'
                    : 'text-gray-500 hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: `${color}22`,
                        color,
                        boxShadow: `0 0 12px ${color}22`,
                      }
                    : undefined
                }
              >
                <span className="text-xs">{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Spacer when sticky to prevent content jump */}
      {isSticky && <div className="h-10" />}
    </>
  );
}
