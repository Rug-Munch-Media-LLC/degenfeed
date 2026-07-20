'use client';

import { useCallback, useState } from 'react';

interface JumpItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

/* === SVG Icons ============================================== */

function TrendingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function HotIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  );
}

function QualityIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function NewIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function VideosIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function DiscussIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

const JUMP_ITEMS: JumpItem[] = [
  { id: 'trending', label: 'Trending', icon: <TrendingIcon /> },
  { id: 'hot', label: 'Hot', icon: <HotIcon /> },
  { id: 'quality', label: 'Quality', icon: <QualityIcon /> },
  { id: 'new', label: 'New', icon: <NewIcon /> },
  { id: 'videos', label: 'Videos', icon: <VideosIcon /> },
  { id: 'discussions', label: 'Discussions', icon: <DiscussIcon /> },
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
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
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
                  <span className="flex items-center justify-center w-4 h-4">{item.icon}</span>
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Jump to...</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`ml-auto transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
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
                    isActive ? 'font-medium' : 'text-[var(--color-muted)]'
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
                  <span className="flex items-center justify-center w-4 h-4">{item.icon}</span>
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
