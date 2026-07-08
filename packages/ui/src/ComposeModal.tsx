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

import { useCallback, useEffect, useRef, useState } from 'react';
import { ComposePreview } from './ComposePreview';
import { getProtocolColor, getProtocolIcon } from './ProtocolBadge';

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
  onPublish: (
    text: string,
    targets: string[],
  ) => Promise<Record<string, { ok: boolean; error?: string }>>;
  /** Called when a disconnected protocol is clicked. */
  onRequestSignIn?: (protocol: string) => void;
  /** Primary identity used for publish preview. */
  primaryIdentity?: {
    displayName?: string;
    handle?: string;
    avatarUrl?: string;
  };
  /** Public key of the user's Nostr identity, if any. Used to enable the bridge toggle. */
  nostrBridgePublicId?: string;
  /** Called when the bridge toggle fires. Receives the trimmed post text. */
  onNostrBridge?: (text: string) => void | Promise<void>;
}

const DRAFT_KEY = 'degenfeed_compose_draft';
const MAX_CHARS = 50000;

export function ComposeModal({
  open,
  onClose,
  signedInProtocols,
  onPublish,
  onRequestSignIn,
  primaryIdentity,
  nostrBridgePublicId,
  onNostrBridge,
}: ComposeModalProps) {
  const [text, setText] = useState('');
  const [targets, setTargets] = useState<ComposeTarget[]>(() =>
    TARGETS.map((t) => ({
      ...t,
      enabled: !!signedInProtocols[t.id],
      connected: !!signedInProtocols[t.id],
      status: 'idle' as const,
    })),
  );
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [bridgeToNostr, setBridgeToNostr] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load draft from localStorage
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setText(saved);
    } catch {
      /* noop */
    }
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open]);

  // Auto-save draft
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, text);
      } catch {
        /* noop */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [text, open]);

  // Update protocol connection states when signedInProtocols changes
  useEffect(() => {
    setTargets((prev) =>
      prev.map((t) => ({
        ...t,
        connected: !!signedInProtocols[t.id],
      })),
    );
  }, [signedInProtocols]);

  const handleTextChange = useCallback((value: string) => {
    if (value.length > MAX_CHARS) return;
    setText(value);
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    setShowSlashMenu(lastLine.startsWith('/') && lastLine.length > 1 && !lastLine.includes(' '));
  }, []);

  const insertSlashCommand = useCallback(
    (cmd: string) => {
      const lines = text.split('\n');
      const lastLineIdx = lines.length - 1;
      const beforeSlash = text.slice(0, text.length - (lines[lastLineIdx]?.length ?? 0));
      setText(`${beforeSlash + cmd} `);
      setShowSlashMenu(false);
      textareaRef.current?.focus();
    },
    [text],
  );

  const toggleTarget = useCallback(
    (id: string) => {
      setTargets((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          if (!t.connected) {
            onRequestSignIn?.(id);
            return t;
          }
          return { ...t, enabled: !t.enabled };
        }),
      );
    },
    [onRequestSignIn],
  );

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
        }),
      );

      const allOk = selectedTargets.every((id) => results[id]?.ok);
      // Mastodon -> Nostr bridge: fire locally-signed Nostr note in parallel
      if (
        bridgeToNostr &&
        nostrBridgePublicId &&
        selectedTargets.includes('mastodon') &&
        results.mastodon?.ok !== false
      ) {
        try {
          await onNostrBridge?.(text);
        } catch {
          /* bridge failure is non-fatal — main post already went out */
        }
      }
      if (allOk) {
        // Clear draft on success
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* noop */
        }
        setTimeout(() => onClose(), 1500);
      }
    } catch {
      setTargets((prev) =>
        prev.map((t) =>
          t.enabled ? { ...t, status: 'failed' as const, error: 'Network error' } : t,
        ),
      );
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }, [text, targets, onPublish, onClose, bridgeToNostr, nostrBridgePublicId, onNostrBridge]);

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
    <section
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      aria-modal="true"
      aria-label="Compose post"
      role="dialog"
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-gray-800 bg-gray-950 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Compose</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Ctrl+Enter to post</span>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
              type="button"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                role="img"
                aria-label="Close icon"
              >
                <title>Close</title>
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
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
                  el.style.height = `${el.scrollHeight}px`;
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
                      onClick={() => insertSlashCommand(`/${cmd}`)}
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
              {targets.map((target) => {
                const overLimit = target.enabled && text.length > target.charLimit;
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => toggleTarget(target.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                      target.enabled
                        ? 'border-current opacity-100'
                        : 'border-gray-800 opacity-40 hover:opacity-70'
                    }`}
                    style={{
                      color: target.connected
                        ? overLimit
                          ? '#f87171'
                          : getProtocolColor(target.id)
                        : '#666',
                      backgroundColor: target.enabled
                        ? `${getProtocolColor(target.id)}15`
                        : 'transparent',
                    }}
                    title={
                      !target.connected
                        ? `Not connected — sign in with ${target.label}`
                        : `${target.label} (${text.length}/${target.charLimit})`
                    }
                  >
                    {target.status === 'sending' && '\u23F3'}
                    {target.status === 'sent' && '\u2713'}
                    {target.status === 'failed' && '\u2717'}
                    {!target.connected ? (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M8 1C5.5 1 3.5 3 3.5 5.5v2C3 8 2 8.5 2 10v3h12v-3c0-1.5-1-2-1.5-2.5v-2C12.5 3 10.5 1 8 1zM8 13.5c-1 0-1.8-.8-1.8-1.8h3.6c0 1-.8 1.8-1.8 1.8z"
                          fill="currentColor"
                        />
                      </svg>
                    ) : (
                      <span className="text-[0.7em]">{getProtocolIcon(target.id)}</span>
                    )}
                    {target.label}
                    <span className="text-[0.65rem] opacity-60">
                      {text.length}/{target.charLimit}
                    </span>
                  </button>
                );
              })}
            </div>

            {targets.find((t) => t.id === 'mastodon')?.enabled && nostrBridgePublicId && (
              <label className="mb-3 flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={bridgeToNostr}
                  onChange={(e) => setBridgeToNostr(e.target.checked)}
                  className="h-3 w-3 rounded border-white/20 bg-gray-900 text-degen-500 focus:ring-degen-500"
                />
                <span>
                  Also cross-post to <span className="font-medium text-white">Nostr</span>
                </span>
                <span className="text-[10px] text-gray-600">
                  (signed locally with your Nostr key)
                </span>
              </label>
            )}

            <ComposePreview
              text={text}
              targets={targets.map((t) => ({
                id: t.id,
                label: t.label,
                charLimit: t.charLimit,
                enabled: t.enabled,
              }))}
              author={text.trim() ? primaryIdentity : undefined}
            />

            {/* Publish button */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs ${
                    targets.some((t) => t.enabled && text.length > t.charLimit)
                      ? 'text-red-400'
                      : 'text-gray-500'
                  }`}
                >
                  {text.length}/{MAX_CHARS}
                </span>
                {targets.some((t) => t.status === 'failed') && (
                  <span className="text-xs text-red-400">Some networks failed</span>
                )}
              </div>
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={
                  !text.trim() ||
                  publishing ||
                  selectedCount === 0 ||
                  text.length > MAX_CHARS ||
                  targets.some((t) => t.enabled && text.length > t.charLimit)
                }
                onClick={handlePublish}
              >
                {publishing
                  ? '\u23F3 Posting...'
                  : `Post${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
