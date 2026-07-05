/**
 * @degenfeed/ui — ComposeModal
 *
 * The headline feature: compose once, publish to multiple protocols.
 *
 * Features:
 *   - Auto-growing textarea
 *   - Per-protocol toggle switches (Nostr, Farcaster, Lens, Bluesky, Threads, Mastodon)
 *   - Per-protocol character limits with live counters
 *   - Publish button with "Post to N networks" count
 *   - Per-protocol status indicators (pending / signed / failed)
 *   - Draft autosave to localStorage
 *   - Slash commands (/poll, /image, /link, /code, /thread)
 *   - Keyboard shortcut: Ctrl+Enter to publish
 *
 * Auth tiers:
 *   Not signed in → shows "Sign in to compose" CTA
 *   Signed in (1+ protocols) → toggles show available protocols
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { getProtocolColor } from './ProtocolBadge';


interface ComposeTarget {
  id: string;
  label: string;
  enabled: boolean;
  connected: boolean;
  charLimit: number;

  status: 'idle' | 'sending' | 'sent' | 'failed';
  error?: string;
}

const TARGETS: Omit<ComposeTarget, 'enabled' | 'connected' | 'charCount' | 'status'>[] = [
  { id: 'nostr', label: 'Nostr', charLimit: 50000 },
  { id: 'farcaster', label: 'Farcaster', charLimit: 320 },
  { id: 'lens', label: 'Lens', charLimit: 5000 },
  { id: 'bluesky', label: 'Bluesky', charLimit: 300 },
  { id: 'threads', label: 'Threads', charLimit: 500 },
  { id: 'mastodon', label: 'Mastodon', charLimit: 5000 },
];

export interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Map of protocol IDs the user is signed into. */
  signedInProtocols: Record<string, boolean>;
  /** Called when the user publishes. Returns per-protocol results. */
  onPublish: (text: string, targets: string[]) => Promise<Record<string, { ok: boolean; error?: string }>>;
}

const DRAFT_KEY = 'degenfeed_compose_draft';
const MAX_CHARS = 50000;

export function ComposeModal({ open, onClose, signedInProtocols, onPublish }: ComposeModalProps) {
  const [text, setText] = useState('');
  const [targets, setTargets] = useState<ComposeTarget[]>(() =>
    TARGETS.map((t) => ({
      ...t,
      enabled: !!signedInProtocols[t.id],
      connected: !!signedInProtocols[t.id],
      status: 'idle' as const,
    }))
  );
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load draft from localStorage
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setText(saved);
    } catch { /* noop */ }
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open]);

  // Auto-save draft
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, text); } catch { /* noop */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [text, open]);

  // Update protocol connection states when signedInProtocols changes
  useEffect(() => {
    setTargets((prev) =>
      prev.map((t) => ({
        ...t,
        connected: !!signedInProtocols[t.id],
      }))
    );
  }, [signedInProtocols]);

  const handleTextChange = useCallback((value: string) => {
    if (value.length > MAX_CHARS) return;
    setText(value);
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    setShowSlashMenu(lastLine.startsWith('/') && lastLine.length > 1 && !lastLine.includes(' '));
  }, []);

  const insertSlashCommand = useCallback((cmd: string) => {
    const lines = text.split('\n');
    const lastLineIdx = lines.length - 1;
    const beforeSlash = text.slice(0, text.length - (lines[lastLineIdx]?.length ?? 0));
    setText(beforeSlash + cmd + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  }, [text]);

  const toggleTarget = useCallback((id: string) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id && t.connected ? { ...t, enabled: !t.enabled } : t))
    );
  }, []);

  const handlePublish = useCallback(async () => {
    if (!text.trim() || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);

    const selectedTargets = targets.filter((t) => t.enabled).map((t) => t.id);

    setTargets((prev) => prev.map((t) => (t.enabled ? { ...t, status: 'sending' as const } : t)));

    try {
      const results = await onPublish(text, selectedTargets);
      setTargets((prev) =>
        prev.map((t) => {
          if (!t.enabled) return t;
          const res = results[t.id];
          return {
            ...t,
            status: res?.ok ? ('sent' as const) : ('failed' as const),
            error: res?.error,
          };
        })
      );

      const allOk = selectedTargets.every((id) => results[id]?.ok);
      if (allOk) {
        // Clear draft on success
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
        setTimeout(() => onClose(), 1500);
      }
    } catch {
      setTargets((prev) =>
        prev.map((t) => (t.enabled ? { ...t, status: 'failed' as const, error: 'Network error' } : t))
      );
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }, [text, targets, onPublish, onClose]);

  // Keyboard shortcut
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlePublish();
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handlePublish, onClose]);

  if (!open) return null;

  const selectedCount = targets.filter((t) => t.enabled).length;
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Compose post"
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-gray-800 bg-gray-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Compose</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Ctrl+Enter to post
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
              type="button"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!hasSignedIn ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-gray-500">Sign in to compose</p>
              <a href="/home" className="btn-primary text-sm">
                Sign In
              </a>
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  handleTextChange(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }}
                placeholder="What's happening across the open social graph?"
                className="w-full resize-none bg-transparent text-base text-white placeholder-gray-600 outline-none"
                rows={4}
                maxLength={MAX_CHARS}
                aria-label="Post content"
              />

              {/* Slash command menu */}
              {showSlashMenu && (
                <div className="mb-2 rounded-lg border border-gray-800 bg-gray-900 p-1">
                  {['poll', 'image', 'link', 'code', 'thread'].map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      className="w-full rounded px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                      onClick={() => insertSlashCommand('/' + cmd)}
                    >
                      /{cmd}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Protocol toggles + publish */}
        {hasSignedIn && (
          <div className="border-t border-gray-800 px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  disabled={!target.connected}
                  onClick={() => toggleTarget(target.id)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ' +
                    (target.enabled
                      ? 'border-current opacity-100'
                      : 'border-gray-800 opacity-40 hover:opacity-70')
                  }
                  style={{
                    color: target.connected ? getProtocolColor(target.id) : '#666',
                    backgroundColor: target.enabled ? getProtocolColor(target.id) + '15' : 'transparent',
                  }}
                  title={
                    !target.connected
                      ? 'Not connected — sign in with ' + target.label
                      : target.label + ' (' + text.length + '/' + target.charLimit + ')'
                  }
                >
                  {target.status === 'sending' && '\u23F3'}
                  {target.status === 'sent' && '\u2713'}
                  {target.status === 'failed' && '\u2717'}
                  {target.label}
                  <span className="text-[0.65rem] opacity-60">
                    {text.length}/{target.charLimit}
                  </span>
                </button>
              ))}
            </div>

            {/* Publish button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={'text-xs ' + (text.length > Math.max(...TARGETS.map(t => t.charLimit)) ? 'text-red-400' : 'text-gray-500')}>
                  {text.length}/{MAX_CHARS}
                </span>
                {targets.some((t) => t.status === 'failed') && (
                  <span className="text-xs text-red-400">Some networks failed</span>
                )}
              </div>
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={!text.trim() || publishing || selectedCount === 0 || text.length > MAX_CHARS}
                onClick={handlePublish}
              >
                {publishing ? '\u23F3 Posting...' : 'Post' + (selectedCount > 0 ? ' (' + selectedCount + ')' : '')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

