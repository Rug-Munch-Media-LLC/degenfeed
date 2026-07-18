'use client';

import { useCallback, useState } from 'react';

interface JumpItem {
  id: string;
  label: string;
  icon: string;
}

const JUMP_ITEMS: JumpItem[] = [
  { id: 'trending', label: 'Trending', icon: '📈' },
  { id: 'hot', label: 'Hot', icon: '🔥' },
  { id: 'quality', label: 'Quality', icon: '⭐' },
  { id: 'new', label: 'New', icon: '✨' },
  { id: 'videos', label: 'Videos', icon: '🎬' },
  { id: 'discussions', label: 'Discussions', icon: '💬' },
];

interface QuickJumpSidebarProps {
  color: string;
  activeTab: string;
  onJump: (id: string) => void;
}

export function QuickJumpSidebar({ color, activeTab, onJump }: QuickJumpSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleJump = useCallback(
    (id: string) => {
      onJump(id);
      setMobileOpen(false);
    },
    [onJump],
  );

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block" aria-label="Quick jump navigation">
        <div
          className="sticky top-[124px] rounded-xl border p-3"
          style={{
            borderColor: `${color}22`,
            backgroundColor: 'var(--color-card)',
          }}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Jump to
            </span>
          </div>
          <div className="space-y-0.5">
            {JUMP_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleJump(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-fg)]'
                      : 'text-gray-500 hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${color}18`,
                          color,
                        }
                      : undefined
                  }
                >
                  <span className="text-xs">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile dropdown trigger */}
      <div className="mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderColor: `${color}22`,
            backgroundColor: `${color}08`,
            color: 'var(--color-fg)',
          }}
          aria-expanded={mobileOpen}
          aria-label="Quick jump navigation"
        >
          <span>🔍</span>
          <span>Jump to...</span>
          <span className="ml-auto text-xs" style={{ color: 'var(--color-muted)' }}>
            {mobileOpen ? '▲' : '▼'}
          </span>
        </button>
        {mobileOpen && (
          <div
            className="mt-1 overflow-hidden rounded-xl border"
            style={{
              borderColor: `${color}22`,
              backgroundColor: 'var(--color-card)',
            }}
          >
            {JUMP_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleJump(item.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    isActive ? 'font-medium' : 'text-gray-500'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${color}12`,
                          color,
                        }
                      : undefined
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
