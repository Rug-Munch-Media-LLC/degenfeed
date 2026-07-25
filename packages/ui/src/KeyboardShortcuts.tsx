'use client';

/**
 * @degenfeed/ui — KeyboardShortcuts & useKeyboardShortcuts
 *
 * Global keyboard shortcut registration with help overlay.
 * Supports: g+h (home), g+f (feed), g+n (notifications), g+s (search),
 * ?, n (new post), j/k (navigate), / (search), Escape (close),
 * r (refresh), t (top of page), Ctrl+Enter (post).
 *
 * Usage:
 *   const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
 *   Or wrap the app in <KeyboardShortcutProvider shortcuts={...} />
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/* ─── Types ────────────────────────────────────────────────── */

export interface Shortcut {
  /** Display label */
  label: string;
  /** Key combo(s) to show in UI */
  keys: string;
  /** Group for the help dialog */
  group: string;
  /** Handler */
  action: () => void;
  /** Global (not disabled when input focused) */
  global?: boolean;
  /** Enabled */
  enabled?: boolean;
}

interface ShortcutContextValue {
  registerShortcut: (id: string, shortcut: Shortcut) => void;
  unregisterShortcut: (id: string) => void;
  getShortcuts: () => ShortcutEntry[];
}

interface ShortcutEntry extends Shortcut {
  id: string;
}

const ShortcutContext = createContext<ShortcutContextValue>({
  registerShortcut: () => {},
  unregisterShortcut: () => {},
  getShortcuts: () => [],
});

export function useKeyboardShortcuts() {
  return useContext(ShortcutContext);
}

/* ─── Default Shortcuts ────────────────────────────────────── */

export const DEFAULT_SHORTCUTS: Record<string, Shortcut> = {
  'goto-home': {
    label: 'Go to Home',
    keys: 'g h',
    group: 'Navigation',
    action: () => {},
    global: true,
  },
  'goto-feed': {
    label: 'Go to Feed',
    keys: 'g f',
    group: 'Navigation',
    action: () => {},
    global: true,
  },
  'goto-notifications': {
    label: 'Notifications',
    keys: 'g n',
    group: 'Navigation',
    action: () => {},
    global: true,
  },
  'goto-search': {
    label: 'Search',
    keys: 'g s',
    group: 'Navigation',
    action: () => {},
    global: true,
  },
  'new-post': { label: 'New Post', keys: 'n', group: 'Actions', action: () => {} },
  'search-focus': {
    label: 'Focus Search',
    keys: '/',
    group: 'Actions',
    action: () => {},
    global: true,
  },
  refresh: { label: 'Refresh Feed', keys: 'r', group: 'Actions', action: () => {} },
  'scroll-top': { label: 'Scroll to Top', keys: 't', group: 'Navigation', action: () => {} },
  help: { label: 'Keyboard Help', keys: '?', group: 'Actions', action: () => {}, global: true },
  close: {
    label: 'Close / Back',
    keys: 'Escape',
    group: 'Actions',
    action: () => {},
    global: true,
  },
};

/* ─── Provider ─────────────────────────────────────────────── */

interface KeyboardShortcutProviderProps {
  children: ReactNode;
  shortcuts?: Record<string, Shortcut>;
  /** Element ref that should receive focus when / is pressed (search input) */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function KeyboardShortcutProvider({
  children,
  shortcuts: initialShortcuts,
  searchInputRef,
}: KeyboardShortcutProviderProps) {
  const [showHelp, setShowHelp] = useState(false);
  const shortcutsRef = useRef<Map<string, ShortcutEntry>>(new Map());

  // Register initial shortcuts
  useEffect(() => {
    const merged = { ...DEFAULT_SHORTCUTS, ...initialShortcuts };
    for (const [id, s] of Object.entries(merged)) {
      shortcutsRef.current.set(id, { ...s, id });
    }
  }, [initialShortcuts]);

  const registerShortcut = useCallback((id: string, shortcut: Shortcut) => {
    shortcutsRef.current.set(id, { ...shortcut, id });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    shortcutsRef.current.delete(id);
  }, []);

  const getShortcuts = useCallback(() => {
    return Array.from(shortcutsRef.current.values());
  }, []);

  // Global keyboard handler
  useEffect(() => {
    let buffer = '';
    let bufferTimer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.getAttribute('contenteditable') === 'true';

      const shortcuts = Array.from(shortcutsRef.current.values());

      // Check for single-key shortcuts
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      if (e.key === 'Escape') {
        for (const s of shortcuts) {
          if (s.keys === 'Escape') {
            s.action();
            return;
          }
        }
      }

      // Buffer-based shortcuts (g h, g f, etc.)
      if (!isInput && e.key.length === 1 && e.key !== 'Escape') {
        buffer += e.key.toLowerCase();
        clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => {
          buffer = '';
        }, 1000);

        for (const s of shortcuts) {
          if (s.global && s.keys === buffer) {
            e.preventDefault();
            s.action();
            buffer = '';
            return;
          }
        }
        return;
      }

      // Single-key shortcuts
      if (!isInput && e.key === 'n') {
        for (const s of shortcuts) {
          if (s.keys === 'n') {
            e.preventDefault();
            s.action();
            return;
          }
        }
      }

      if (!isInput && e.key === 'r') {
        for (const s of shortcuts) {
          if (s.keys === 'r') {
            e.preventDefault();
            s.action();
            return;
          }
        }
      }

      if (!isInput && e.key === 't') {
        for (const s of shortcuts) {
          if (s.keys === 't') {
            e.preventDefault();
            s.action();
            return;
          }
        }
      }

      // / focuses search
      if (!isInput && e.key === '/') {
        e.preventDefault();
        searchInputRef?.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(bufferTimer);
    };
  }, [searchInputRef]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutEntry[]>();
    for (const s of getShortcuts()) {
      const group = s.group || 'Other';
      if (!map.has(group)) map.set(group, []);
      map.get(group)?.push(s);
    }
    return map;
  }, [getShortcuts]);

  return (
    <ShortcutContext.Provider value={{ registerShortcut, unregisterShortcut, getShortcuts }}>
      {children}

      {/* Keyboard Shortcuts Help Dialog */}
      {showHelp && (
        <div
          className="shortcuts-overlay"
          onClick={() => setShowHelp(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowHelp(false);
          }}
          role="dialog"
          aria-label="Keyboard shortcuts"
          tabIndex={-1}
        >
          <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <h2 className="shortcuts-title">Keyboard Shortcuts</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="shortcuts-close"
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="shortcuts-body">
              {Array.from(grouped.entries()).map(([group, items]) => (
                <div key={group} className="shortcut-group">
                  <h3 className="shortcut-group-title">{group}</h3>
                  {items.map((s) => (
                    <div key={s.id} className="shortcut-row">
                      <span className="shortcut-label">{s.label}</span>
                      <kbd className="shortcut-keys">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ShortcutContext.Provider>
  );
}
