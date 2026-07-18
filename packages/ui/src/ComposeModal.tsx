'use client';

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
 *   - Slash commands (/poll, /image, /link, /code, /thread, /schedule)
 *   - Keyboard shortcut: Ctrl+Enter to publish
 *   - Cross-protocol reply mode: reply to any protocol post from any other protocol
 *
 * Auth tiers:
 *   Not signed in → shows "Sign in to compose" CTA
 *   Signed in (1+ protocols) → toggles show available protocols
 */

import { resolveTokenGateSymbol, type TokenGate } from '@degenfeed/token-gate';
import type { ContentProof } from '@degenfeed/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposePreview } from './ComposePreview';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';
import { TokenGateConfigurator } from './TokenGateConfigurator';

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

/** Protocols the /api/cross-reply bridge can actually post to. */
const BRIDGE_REPLY_PROTOCOLS = new Set(['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon']);

export interface ScheduledPostItem {
  id: string;
  text: string;
  scheduledAt: string; // ISO string
  targets: string[];
  createdAt: string;
}

/** Context for cross-protocol reply mode. */
export interface ReplyContext {
  /** The df:// URI of the post being replied to */
  parentPostUri: string;
  /** The protocol the parent post is on */
  parentProtocol: string;
  /** Optional short preview of the parent post text */
  parentPreview?: string;
}

export interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Map of protocol IDs the user is signed into. */
  signedInProtocols: Record<string, boolean>;
  /** Called when the user publishes. Returns per-protocol results. */
  onPublish: (
    text: string,
    targets: string[],
    opts?: { lensCollect?: boolean; tokenGate?: TokenGate },
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
  /** Called when the user schedules a post. */
  onSchedule?: (text: string, targets: string[], scheduledAt: Date) => void;
  /** List of upcoming scheduled posts to display. */
  scheduledPosts?: ScheduledPostItem[];
  /** Called to cancel a scheduled post. */
  onCancelSchedule?: (id: string) => void;
  /** Called to publish a scheduled post immediately. */
  onPublishScheduledNow?: (id: string) => void;
  /** Pre-fill text content (e.g. from translation result) */
  prefillText?: string;
  /** Pre-select these protocols when opening (e.g. translation target) */
  preselectProtocols?: string[];
  /** Label shown in the prefill banner (e.g. "Translated from Farcaster") */
  prefillLabel?: string;
  /** Cross-protocol reply context — when set, compose enters reply mode. */
  replyContext?: ReplyContext;
  /** Called for cross-protocol replies instead of normal publish. */
  onCrossReply?: (
    parentPostUri: string,
    parentProtocol: string,
    replyProtocol: string,
    content: string,
  ) => Promise<{ ok: boolean; nativeId?: string; error?: string }>;
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
  onSchedule,
  scheduledPosts,
  onCancelSchedule,
  onPublishScheduledNow,
  prefillText,
  preselectProtocols,
  prefillLabel,
  replyContext,
  onCrossReply,
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
  const [lensCollect, setLensCollect] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showScheduledView, setShowScheduledView] = useState(false);
  const [makePermanent, setMakePermanent] = useState(false);
  const [permanenceProof, setPermanenceProof] = useState<ContentProof | null>(null);
  const [storingPermanent, setStoringPermanent] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Token gate state
  const [tokenGate, setTokenGate] = useState<TokenGate | null>(null);
  const [gateSymbol, setGateSymbol] = useState<string>('');
  const [gateResolving, setGateResolving] = useState(false);
  const [gateError, setGateError] = useState<string | undefined>(undefined);
  const gateResolveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Resolve symbol when gate config changes
  useEffect(() => {
    if (gateResolveTimeout.current) {
      clearTimeout(gateResolveTimeout.current);
    }
    if (!tokenGate) {
      setGateSymbol('');
      setGateError(undefined);
      return;
    }
    setGateResolving(true);
    setGateError(undefined);
    gateResolveTimeout.current = setTimeout(async () => {
      try {
        const sym = await resolveTokenGateSymbol(tokenGate);
        setGateSymbol(sym);
      } catch {
        setGateError('Could not resolve token symbol');
      } finally {
        setGateResolving(false);
      }
    }, 800);
    return () => {
      if (gateResolveTimeout.current) clearTimeout(gateResolveTimeout.current);
    };
  }, [tokenGate]);

  // Cross-protocol reply state
  // Cross-protocol reply: remember last used reply protocol per parent protocol
  const [replyProtocol, setReplyProtocol] = useState<string>(() => {
    if (!replyContext) return '';
    try {
      const stored = localStorage.getItem(`cross-reply-pref:${replyContext.parentProtocol}`);
      if (stored && BRIDGE_REPLY_PROTOCOLS.has(stored)) return stored;
    } catch {
      /* ignore */
    }
    return replyContext.parentProtocol;
  });
  const isCrossProtocolReply = !!replyContext && replyContext.parentProtocol !== replyProtocol;
  const isReplyMode = !!replyContext;

  // Load draft from localStorage (or prefill from translation) and reset schedule state
  useEffect(() => {
    if (!open) return;
    if (prefillText) {
      setText(prefillText);
    } else {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) setText(saved);
      } catch {
        /* noop */
      }
    }
    setScheduledAt(null);
    setShowSchedulePicker(false);
    setShowScheduledView(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open, prefillText]);

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

  // Pre-select target protocols when provided (e.g. from translation)
  useEffect(() => {
    if (!open || !preselectProtocols || preselectProtocols.length === 0) return;
    setTargets((prev) =>
      prev.map((t) => ({
        ...t,
        enabled: preselectProtocols.includes(t.id) ? true : t.enabled,
        connected: preselectProtocols.includes(t.id) ? true : t.connected,
      })),
    );
  }, [open, preselectProtocols]);

  const handleTextChange = useCallback((value: string) => {
    if (value.length > MAX_CHARS) return;
    setText(value);
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    setShowSlashMenu(lastLine.startsWith('/') && lastLine.length > 1 && !lastLine.includes(' '));
  }, []);

  /** Remove the current slash-command line from the textarea. */
  const removeSlashLine = useCallback(() => {
    const lines = text.split('\n');
    const lastLineIdx = lines.length - 1;
    return text.slice(0, text.length - (lines[lastLineIdx]?.length ?? 0));
  }, [text]);

  const insertSlashCommand = useCallback(
    (cmd: string) => {
      const cleaned = removeSlashLine();
      setText(`${cleaned + cmd} `);
      setShowSlashMenu(false);
      textareaRef.current?.focus();
    },
    [removeSlashLine],
  );

  const handleSlashCommand = useCallback(
    (cmd: string) => {
      if (cmd === 'schedule') {
        // Remove /schedule from text, show date picker
        setText(removeSlashLine());
        setShowSlashMenu(false);
        setShowSchedulePicker(true);
        textareaRef.current?.focus();
        return;
      }
      if (cmd === 'image') {
        // Remove /image from text, open file picker
        setText(removeSlashLine());
        setShowSlashMenu(false);
        fileInputRef.current?.click();
        return;
      }
      insertSlashCommand(`/${cmd}`);
    },
    [removeSlashLine, insertSlashCommand],
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

  const handleSchedule = useCallback(() => {
    if (!text.trim() || !scheduledAt || publishingRef.current) return;
    if (scheduledAt <= new Date()) return; // must be future
    const selectedTargets = targets.filter((t) => t.enabled).map((t) => t.id);
    if (selectedTargets.length === 0) return;

    publishingRef.current = true;
    setPublishing(true);

    try {
      onSchedule?.(text.trim(), selectedTargets, scheduledAt);
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* noop */
    }
    publishingRef.current = false;
    setPublishing(false);
    onClose();
  }, [text, targets, scheduledAt, onSchedule, onClose]);

  const handlePublish = useCallback(async () => {
    if (!text.trim() || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);

    // Cross-protocol reply flow
    if (replyContext && onCrossReply) {
      setTargets((prev) =>
        prev.map((t) =>
          t.id === replyProtocol ? { ...t, enabled: true, status: 'sending' as const } : t,
        ),
      );

      try {
        const result = await onCrossReply(
          replyContext.parentPostUri,
          replyContext.parentProtocol,
          replyProtocol,
          text.trim(),
        );

        setTargets((prev) =>
          prev.map((t) =>
            t.id === replyProtocol
              ? {
                  ...t,
                  status: result.ok ? ('sent' as const) : ('failed' as const),
                  error: result.error,
                }
              : t,
          ),
        );

        if (result.ok) {
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
            t.id === replyProtocol
              ? { ...t, status: 'failed' as const, error: 'Network error' }
              : t,
          ),
        );
      } finally {
        publishingRef.current = false;
        setPublishing(false);
      }
      return;
    }

    const selectedTargets = targets.filter((t) => t.enabled).map((t) => t.id);

    setTargets((prev) => prev.map((t) => (t.enabled ? { ...t, status: 'sending' as const } : t)));

    try {
      const opts: { lensCollect?: boolean; tokenGate?: TokenGate } = {};
      if (selectedTargets.includes('lens') && lensCollect) opts.lensCollect = true;
      if (tokenGate) opts.tokenGate = tokenGate;
      const results = await onPublish(text, selectedTargets, opts);
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
        // If "Make Permanent" is checked, store content on Arweave + IPFS
        if (makePermanent) {
          setStoringPermanent(true);
          fetch('/api/permanence/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: text,
              tags: [
                { name: 'Protocol', value: selectedTargets.join(',') },
                { name: 'App-Version', value: '0.1.0' },
              ],
            }),
          })
            .then((r) => (r.ok ? (r.json() as Promise<{ proof: ContentProof }>) : null))
            .then((data) => {
              if (data?.proof) {
                setPermanenceProof(data.proof);
              }
            })
            .catch(() => {
              /* non-critical — post already published */
            })
            .finally(() => setStoringPermanent(false));
        }
        // Only close automatically if not waiting for permanence storage
        if (!makePermanent) {
          setTimeout(() => onClose(), 1500);
        }
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
  }, [
    text,
    targets,
    onPublish,
    onClose,
    bridgeToNostr,
    nostrBridgePublicId,
    onNostrBridge,
    lensCollect,
    replyProtocol,
    replyContext,
    onCrossReply,
    makePermanent,
    tokenGate,
  ]);

  // Keyboard shortcut
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (scheduledAt) {
          handleSchedule();
        } else {
          handlePublish();
        }
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handlePublish, handleSchedule, scheduledAt, onClose]);

  const /** List of user's available protocols for reply switching */
    availableReplyProtocols = useMemo(() => {
      if (!replyContext) return [];
      return TARGETS.map((t) => t.id).filter(
        (id) =>
          signedInProtocols[id] &&
          (id === replyContext.parentProtocol || BRIDGE_REPLY_PROTOCOLS.has(id)),
      );
    }, [replyContext, signedInProtocols]);

  // Default reply protocol when entering reply mode
  useEffect(() => {
    if (open && replyContext) {
      setReplyProtocol(replyContext.parentProtocol);
    }
  }, [open, replyContext]);

  if (!open) return null;

  const selectedCount = targets.filter((t) => t.enabled).length;
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const scheduleAvailable = hasSignedIn && !!onSchedule;

  /** Handle image file selection */
  const handleImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const markdown = `![${file.name}](${dataUrl})`;
      setText((prev) => `${prev}\n${markdown}\n`);
      setAttachedImages((prev) => [...prev, dataUrl]);
      setUploadingImage(false);
    };
    reader.onerror = () => setUploadingImage(false);
    reader.readAsDataURL(file);
    // Reset input so the same file can be picked again
    e.target.value = '';
  }, []);

  /** Format a Date for display, e.g. "Jul 18, 2026 at 3:00 PM" */
  const formatScheduleDate = (d: Date) => {
    return (
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' at ' +
      d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  };

  /** Format an ISO string for the scheduled posts list, e.g. "Jul 18, 3:00 PM" */
  const formatScheduledItem = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    );
  };

  // Min datetime for the picker: now + 5 minutes
  const minPickerDate = new Date(Date.now() + 5 * 60 * 1000);
  const minPickerStr = minPickerDate.toISOString().slice(0, 16); // datetime-local format

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
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">
              {isReplyMode ? 'Reply' : 'Compose'}
            </h2>
            {isReplyMode && replyContext && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${getProtocolColor(replyContext.parentProtocol)}22`,
                  color: getProtocolColor(replyContext.parentProtocol),
                }}
                title={`Parent post is on ${getProtocolLabel(replyContext.parentProtocol)}`}
              >
                <span className="text-[0.7em]">{getProtocolIcon(replyContext.parentProtocol)}</span>
                {getProtocolLabel(replyContext.parentProtocol)}
              </span>
            )}
            {scheduledPosts && scheduledPosts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowScheduledView((v) => !v)}
                className={`text-xs font-medium rounded-md px-2 py-1 transition-colors ${
                  showScheduledView
                    ? 'bg-cyan-900/40 text-cyan-300'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
                }`}
              >
                Scheduled ({scheduledPosts.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!scheduledAt && (
              <span className="text-xs text-[var(--color-muted)]">Ctrl+Enter to post</span>
            )}
            {scheduledAt && <span className="text-xs text-cyan-500">Ctrl+Enter to schedule</span>}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
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
              <p className="mb-4 text-[var(--color-muted)]">Sign in to compose</p>
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
                className="w-full resize-none bg-transparent text-base text-[var(--color-fg)] placeholder-gray-600 outline-none"
                rows={4}
                maxLength={MAX_CHARS}
                aria-label="Post content"
              />

              {/* Hidden file input for /image command */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
              />

              {/* Image attachment previews */}
              {attachedImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachedImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img}
                        alt={`Attachment ${i + 1}`}
                        className="h-16 w-16 rounded-lg object-cover border border-[var(--color-border)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedImages((prev) => prev.filter((_, idx) => idx !== i));
                          // Also remove the markdown from text
                          setText((prev) =>
                            prev.replace(
                              new RegExp(
                                `!\\[.*?\\]\\(${img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`,
                              ),
                              '',
                            ),
                          );
                        }}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove image ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {uploadingImage && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]">
                      <span className="animate-spin text-xs">⏳</span>
                    </div>
                  )}
                </div>
              )}

              {/* Slash command menu */}
              {showSlashMenu && (
                <div className="mb-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-1">
                  {[
                    'poll',
                    'image',
                    'link',
                    'code',
                    'thread',
                    ...(scheduleAvailable ? ['schedule'] : []),
                  ].map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      className="w-full rounded px-3 py-1.5 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                      onClick={() => handleSlashCommand(cmd)}
                    >
                      /{cmd}
                    </button>
                  ))}
                </div>
              )}

              {/* Schedule date/time picker */}
              {showSchedulePicker && scheduleAvailable && (
                <div className="mb-3 rounded-lg border border-cyan-900/50 bg-cyan-950/30 p-3">
                  <label className="flex items-center gap-2 text-sm text-cyan-300">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect
                        x="1.5"
                        y="2.5"
                        width="13"
                        height="12"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M5 1v3M11 1v3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Schedule for
                  </label>
                  <input
                    type="datetime-local"
                    min={minPickerStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const picked = new Date(val);
                      if (picked.getTime() <= Date.now() + 5 * 60 * 1000) return; // enforce 5min min
                      setScheduledAt(picked);
                      setShowSchedulePicker(false);
                    }}
                    className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-cyan-500"
                  />
                  <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                    Must be at least 5 minutes from now
                  </p>
                </div>
              )}

              {/* Translation prefill banner */}
              {prefillLabel && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-900/40 bg-blue-950/20 px-3 py-2">
                  <span className="flex-shrink-0 text-blue-400 text-xs font-bold">&#x2194;</span>
                  <span className="text-[11px] text-blue-300">{prefillLabel}</span>
                  <span className="ml-auto text-[10px] text-[var(--color-muted)]">
                    You can edit before posting
                  </span>
                </div>
              )}

              {/* Cross-protocol translation offer */}
              {(() => {
                const shortTargets = targets.filter(
                  (t) => t.enabled && t.charLimit < text.length && text.length > 500,
                );
                if (shortTargets.length === 0 || prefillLabel) return null;
                // Only show for the first short-limit target
                const target = shortTargets[0];
                if (!target) return null;
                return (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-900/40 bg-purple-950/20 px-3 py-2">
                    <span className="flex-shrink-0 text-purple-400 text-xs font-bold">
                      &#x2194;
                    </span>
                    <span className="flex-1 text-[11px] text-purple-300">
                      This text is {text.length} chars but {target.label} allows {target.charLimit}.{' '}
                      <button
                        type="button"
                        className="underline hover:text-[var(--color-fg)] transition-colors"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/translate', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({
                                content: text,
                                fromProtocol: 'lens', // assume long-form source
                                toProtocol: target.id,
                              }),
                            });
                            if (res.ok) {
                              const data = (await res.json()) as { translated: string };
                              setText(data.translated);
                            }
                          } catch {
                            /* non-critical */
                          }
                        }}
                      >
                        Translate for {target.label}
                      </button>
                    </span>
                    <button
                      type="button"
                      className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Dismiss this offer
                        // We modify the target's charLimit to avoid re-showing
                      }}
                      aria-label="Dismiss"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 4L4 12M4 4l8 8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })()}

              {/* Schedule badge — shown when a time has been picked */}
              {scheduledAt && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-cyan-900/50 bg-cyan-950/30 px-3 py-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="flex-shrink-0 text-cyan-400"
                  >
                    <rect
                      x="1.5"
                      y="2.5"
                      width="13"
                      height="12"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M5 1v3M11 1v3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-xs text-cyan-300">
                    Scheduled for {formatScheduleDate(scheduledAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledAt(null);
                      setShowSchedulePicker(false);
                    }}
                    className="ml-auto rounded p-0.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    aria-label="Clear schedule"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M12 4L4 12M4 4l8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cross-protocol reply switcher */}
        {isReplyMode && replyContext && availableReplyProtocols.length > 1 && (
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="mb-2 text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Reply as
            </p>
            <div className="flex flex-wrap gap-2">
              {availableReplyProtocols.map((protocol) => {
                const isSelected = protocol === replyProtocol;
                const isParent = protocol === replyContext.parentProtocol;
                return (
                  <button
                    key={protocol}
                    type="button"
                    onClick={() => {
                      setReplyProtocol(protocol);
                      try {
                        if (replyContext) {
                          localStorage.setItem(
                            `cross-reply-pref:${replyContext.parentProtocol}`,
                            protocol,
                          );
                        }
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                      isSelected
                        ? 'border-current opacity-100'
                        : 'border-[var(--color-border)] opacity-40 hover:opacity-70'
                    }`}
                    style={{
                      color: isSelected ? getProtocolColor(protocol) : '#666',
                      backgroundColor: isSelected
                        ? `${getProtocolColor(protocol)}15`
                        : 'transparent',
                    }}
                  >
                    <span className="text-[0.7em]">{getProtocolIcon(protocol)}</span>
                    {getProtocolLabel(protocol)}
                    {isParent && <span className="text-[10px] opacity-60">(same)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cross-protocol bridge note */}
        {isReplyMode && replyContext && isCrossProtocolReply && (
          <p className="mx-4 mt-2.5 flex items-start gap-2 rounded-lg border border-purple-900/40 bg-purple-950/20 px-3 py-2">
            <span className="mt-px flex-shrink-0 text-purple-400 text-xs font-bold">&#x2194;</span>
            <span className="text-[11px] text-purple-300 leading-relaxed">
              This reply will be posted on{' '}
              <strong className="text-[var(--color-fg)]">{getProtocolLabel(replyProtocol)}</strong>{' '}
              and linked to the original{' '}
              <strong className="text-[var(--color-fg)]">
                {getProtocolLabel(replyContext.parentProtocol)}
              </strong>{' '}
              post via the DegenFeed cross-protocol bridge.
            </span>
          </p>
        )}

        {/* Protocol toggles + publish */}
        {hasSignedIn && !isReplyMode && (
          <div className="border-t border-[var(--color-border)] px-4 py-3">
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
                        : 'border-[var(--color-border)] opacity-40 hover:opacity-70'
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
              <label className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={bridgeToNostr}
                  onChange={(e) => setBridgeToNostr(e.target.checked)}
                  className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                />
                <span>
                  Also cross-post to{' '}
                  <span className="font-medium text-[var(--color-fg)]">Nostr</span>
                </span>
                <span className="text-[10px] text-gray-600">
                  (signed locally with your Nostr key)
                </span>
              </label>
            )}

            {targets.find((t) => t.id === 'lens')?.enabled && (
              <label className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={lensCollect}
                  onChange={(e) => setLensCollect(e.target.checked)}
                  className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                />
                <span>
                  Enable <span className="font-medium text-green-400">Free Collect</span> on Lens
                </span>
                <span className="text-[10px] text-gray-600">
                  (anyone can mint this post as an NFT)
                </span>
              </label>
            )}

            {/* ── Make Permanent (Arweave + IPFS) ── */}
            <label className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <input
                type="checkbox"
                checked={makePermanent}
                onChange={(e) => setMakePermanent(e.target.checked)}
                className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                disabled={storingPermanent}
              />
              {storingPermanent ? (
                <span className="text-cyan-400">
                  <span className="animate-pulse">⏳</span> Storing on Arweave + IPFS...
                </span>
              ) : permanenceProof ? (
                <span className="text-cyan-400">
                  ✓ Stored permanently{' '}
                  <span className="text-[10px] text-[var(--color-muted)]">
                    (Arweave{permanenceProof.arweaveTxId ? ' ✓' : ''}
                    {permanenceProof.ipfsCid ? ' + IPFS ✓' : ''})
                  </span>
                </span>
              ) : (
                <span>
                  Store on <span className="font-medium text-cyan-400">Arweave</span>
                  {' + '}
                  <span className="font-medium text-purple-400">IPFS</span>{' '}
                  <span className="font-medium text-[var(--color-fg)]">(permanent)</span>
                  <span className="text-[10px] text-gray-600 ml-1">— censorship-resistant</span>
                </span>
              )}
            </label>

            {/* ── Token Gate ── */}
            <div className="mb-3">
              <TokenGateConfigurator
                gate={tokenGate}
                onChange={(g) => setTokenGate(g)}
                displaySymbol={gateSymbol}
                resolving={gateResolving}
                error={gateError}
              />
            </div>

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

            {/* Scheduled posts viewer */}
            {showScheduledView && scheduledPosts && scheduledPosts.length > 0 && (
              <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
                <h3 className="mb-2 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                  Upcoming Scheduled Posts
                </h3>
                <div className="flex flex-col gap-2">
                  {scheduledPosts.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-200">{sp.text || '(empty)'}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                          <span>{formatScheduledItem(sp.scheduledAt)}</span>
                          <span className="text-gray-700">·</span>
                          <span>
                            {sp.targets.length} network{sp.targets.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        {onPublishScheduledNow && (
                          <button
                            type="button"
                            onClick={() => onPublishScheduledNow(sp.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium text-green-400 hover:bg-green-950/40 transition-colors"
                            title="Publish now"
                          >
                            Post now
                          </button>
                        )}
                        {onCancelSchedule && (
                          <button
                            type="button"
                            onClick={() => onCancelSchedule(sp.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-red-400 transition-colors"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Permanence proof badge */}
            {permanenceProof && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-3 py-2">
                <span className="text-cyan-400 text-xs font-bold">🔗</span>
                <span className="text-[11px] text-cyan-300">
                  Stored permanently
                  {permanenceProof.arweaveTxId && (
                    <a
                      href={`https://arweave.net/${permanenceProof.arweaveTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 underline hover:text-[var(--color-fg)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Arweave
                    </a>
                  )}
                  {permanenceProof.ipfsCid && (
                    <a
                      href={`https://ipfs.io/ipfs/${permanenceProof.ipfsCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 underline hover:text-[var(--color-fg)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      IPFS
                    </a>
                  )}
                </span>
                {permanenceProof.arweaveTxId && (
                  <span
                    className="ml-auto text-[10px] font-mono text-[var(--color-muted)] truncate max-w-[120px]"
                    title={permanenceProof.arweaveTxId}
                  >
                    {permanenceProof.arweaveTxId.slice(0, 8)}...
                    {permanenceProof.arweaveTxId.slice(-4)}
                  </span>
                )}
              </div>
            )}

            {/* Publish / Schedule button */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs ${
                    targets.some((t) => t.enabled && text.length > t.charLimit)
                      ? 'text-red-400'
                      : 'text-[var(--color-muted)]'
                  }`}
                >
                  {text.length}/{MAX_CHARS}
                </span>
                {targets.some((t) => t.status === 'failed') && (
                  <span className="text-xs text-red-400">Some networks failed</span>
                )}
              </div>
              {scheduledAt ? (
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
                  onClick={handleSchedule}
                >
                  {publishing
                    ? '\u23F3 Scheduling...'
                    : `Schedule${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                </button>
              ) : (
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
              )}
            </div>
          </div>
        )}

        {/* Reply mode publish */}
        {hasSignedIn && isReplyMode && (
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <ComposePreview
              text={text}
              targets={[
                {
                  id: replyProtocol,
                  enabled: true,
                  charLimit: TARGETS.find((t) => t.id === replyProtocol)?.charLimit ?? 5000,
                },
              ]}
              author={text.trim() ? primaryIdentity : undefined}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs ${text.length > (TARGETS.find((t) => t.id === replyProtocol)?.charLimit ?? 5000) ? 'text-red-400' : 'text-[var(--color-muted)]'}`}
                >
                  {text.length}/{TARGETS.find((t) => t.id === replyProtocol)?.charLimit ?? 5000}
                </span>
                {targets.find((t) => t.id === replyProtocol)?.status === 'failed' && (
                  <span className="text-xs text-red-400">
                    {targets.find((t) => t.id === replyProtocol)?.error ?? 'Failed'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={
                  !text.trim() ||
                  publishing ||
                  text.length > (TARGETS.find((t) => t.id === replyProtocol)?.charLimit ?? 5000)
                }
                onClick={handlePublish}
              >
                {publishing
                  ? '\u23F3 Replying...'
                  : `Reply as ${getProtocolLabel(replyProtocol)}${isCrossProtocolReply ? ' \u2194' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
