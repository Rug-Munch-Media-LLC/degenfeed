'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

// ─── Platform Definitions ─────────────────────────────────────────────────

interface PlatformInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  charLimit: number;
  maxMedia: number;
  supportsVideo: boolean;
  supportsRichText: boolean;
  supportsCW: boolean;
  tip: string;
  /** True when the bridge /api/publish fan-out can publish to this protocol. */
  bridgeProtocol?: boolean;
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    charLimit: 50000,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: false,
    supportsCW: false,
    bridgeProtocol: true,
    tip: 'Long-form notes, NIP-23 for articles',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    charLimit: 320,
    maxMedia: 4,
    supportsVideo: false,
    supportsRichText: false,
    supportsCW: false,
    bridgeProtocol: true,
    tip: 'Keep it short—links go in embeds',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '🦋',
    color: '#1185fe',
    charLimit: 300,
    maxMedia: 4,
    supportsVideo: false,
    supportsRichText: false,
    supportsCW: true,
    bridgeProtocol: true,
    tip: 'Hashtags help discovery; alt text required for images',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    charLimit: 500,
    maxMedia: 4,
    supportsVideo: true,
    supportsRichText: false,
    supportsCW: true,
    bridgeProtocol: true,
    tip: 'Hashtags at the end work best; CW for sensitive content',
  },
  {
    id: 'lens',
    label: 'Lens',
    icon: '🌿',
    color: '#abfe2c',
    charLimit: 5000,
    maxMedia: 4,
    supportsVideo: true,
    supportsRichText: false,
    supportsCW: false,
    tip: 'Collectible publications can earn you tips',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🤖',
    color: '#ff4500',
    charLimit: 40000,
    maxMedia: 20,
    supportsVideo: true,
    supportsRichText: true,
    supportsCW: true,
    tip: 'Title is auto-generated from first sentence',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: '#0088cc',
    charLimit: 4096,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: true,
    supportsCW: false,
    tip: 'HTML formatting applied automatically',
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: '💬',
    color: '#5865f2',
    charLimit: 2000,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: true,
    supportsCW: false,
    tip: 'Link cards become rich embeds',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '⊞',
    color: '#101010',
    charLimit: 500,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: false,
    supportsCW: false,
    tip: 'Published via Bridgy Fed or Meta API',
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    icon: '🔮',
    color: '#4a8c6f',
    charLimit: 50000,
    maxMedia: 1,
    supportsVideo: false,
    supportsRichText: true,
    supportsCW: true,
    tip: 'Auto-selects community from content keywords',
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    icon: '▶️',
    color: '#f2691d',
    charLimit: 5000,
    maxMedia: 1,
    supportsVideo: true,
    supportsRichText: true,
    supportsCW: true,
    tip: 'Requires a video file to attach',
  },
  {
    id: 'pixelfed',
    label: 'Pixelfed',
    icon: '📷',
    color: '#005cff',
    charLimit: 5000,
    maxMedia: 20,
    supportsVideo: true,
    supportsRichText: false,
    supportsCW: true,
    tip: 'Image gallery up to 20 photos',
  },
];

// ─── Character Limit Bar Colors ───────────────────────────────────────────

function getCharIndicatorColor(used: number, limit: number): string {
  if (limit <= 0) return 'var(--color-accent)'; // unlimited = green
  const ratio = used / limit;
  if (ratio <= 0.7) return 'var(--color-accent)'; // green
  if (ratio <= 0.9) return '#ffa500'; // yellow/amber
  return '#ff4444'; // red
}

// ─── Props ────────────────────────────────────────────────────────────────

interface CrossPostComposerProps {
  /** Called after successful publish */
  onPublishComplete?: (report: {
    batchId: string;
    results: Array<{ protocol: string; status: string }>;
  }) => void;
  /** Initial text to pre-fill */
  initialText?: string;
  /** Mode: in a modal or full page */
  mode?: 'modal' | 'full';
  /** Callback to close (for modal mode) */
  onClose?: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────

export function CrossPostComposer({
  onPublishComplete,
  initialText = '',
  mode = 'full',
  onClose,
}: CrossPostComposerProps) {
  const { walletAddress, signedInProtocols } = useAuth();
  const { showToast } = useToast();

  // ── State ──
  const [text, setText] = useState(initialText);
  const [title, setTitle] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(['nostr', 'farcaster', 'bluesky']),
  );
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewProtocol, setPreviewProtocol] = useState<string>('nostr');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; alt: string }>>([]);

  // ── Per-protocol publish status + protocol-specific options ──
  const [publishStatus, setPublishStatus] = useState<
    Record<string, { status: 'idle' | 'publishing' | 'published' | 'failed'; error?: string }>
  >({});
  const [protocolOptions, setProtocolOptions] = useState<Record<string, Record<string, unknown>>>(
    {},
  );
  const [expandedOptions, setExpandedOptions] = useState<string | null>(null);

  const isConnected = (id: string) => !!signedInProtocols[id];

  // Seed the selection with protocols the user is actually connected to.
  // Only adds — never removes a user's explicit selection.
  useEffect(() => {
    const connectedBridgeProtocols = PLATFORMS.filter(
      (p) => p.bridgeProtocol && signedInProtocols[p.id],
    ).map((p) => p.id);
    if (connectedBridgeProtocols.length === 0) return;
    setSelectedPlatforms((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of connectedBridgeProtocols) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [signedInProtocols]);

  // ── Character limit tracking ──
  const charCount = text.length;

  const platformCharInfo = useMemo(() => {
    return PLATFORMS.map((p) => {
      const isSelected = selectedPlatforms.has(p.id);
      const overLimit = p.charLimit > 0 && charCount > p.charLimit;
      const remaining = p.charLimit > 0 ? p.charLimit - charCount : Infinity;
      const color = isSelected ? getCharIndicatorColor(charCount, p.charLimit) : undefined;

      return { ...p, isSelected, overLimit, remaining, color };
    });
  }, [charCount, selectedPlatforms]);

  // ── Toggle platform ──
  const togglePlatform = useCallback(
    (id: string) => {
      // Gate on auth state: green protocols are connected, grey need setup
      if (!signedInProtocols[id]) return;
      setSelectedPlatforms((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [signedInProtocols],
  );

  // ── Add hashtag ──
  const addHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags((prev) => [...prev, tag]);
      setHashtagInput('');
    }
  }, [hashtagInput, hashtags]);

  const removeHashtag = useCallback((tag: string) => {
    setHashtags((prev) => prev.filter((h) => h !== tag));
  }, []);

  // ── Handle hashtag keydown ──
  const handleHashtagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addHashtag();
      }
    },
    [addHashtag],
  );

  // ── Media attachment ──
  const handleMediaSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      setMediaFiles((prev) => [...prev, { url, alt: '' }]);
    }
  }, []);

  const removeMedia = useCallback((index: number) => {
    setMediaFiles((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateMediaAlt = useCallback((index: number, alt: string) => {
    setMediaFiles((prev) => prev.map((m, i) => (i === index ? { ...m, alt } : m)));
  }, []);

  // ── Fetch previews ──
  const fetchPreviews = useCallback(async () => {
    if (!text.trim()) return;

    setShowPreview(true);
    try {
      const params = new URLSearchParams({
        text: text.trim(),
        protocols: Array.from(selectedPlatforms).join(','),
      });
      if (title) params.set('title', title);
      if (hashtags.length > 0) params.set('hashtags', hashtags.join(','));

      const res = await fetch(`/api/publish/preview?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { previews: Record<string, string> };
        setPreviews(data.previews);
        // Set first available protocol as default preview
        const firstProtocol = Object.keys(data.previews)[0];
        if (firstProtocol) setPreviewProtocol(firstProtocol);
      }
    } catch {
      showToast('error', 'Failed to load previews');
    }
  }, [text, title, hashtags, selectedPlatforms, showToast]);

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!text.trim() || selectedPlatforms.size === 0) return;

    // Only protocols the bridge fan-out supports can be published to.
    const publishable = Array.from(selectedPlatforms).filter(
      (id) => PLATFORMS.find((p) => p.id === id)?.bridgeProtocol,
    );
    if (publishable.length === 0) {
      setResult('❌ None of the selected protocols are supported by the bridge yet.');
      return;
    }
    const skipped = Array.from(selectedPlatforms).filter((id) => !publishable.includes(id));

    setPublishing(true);
    setResult(null);
    setPublishStatus((prev) => {
      const next = { ...prev };
      for (const id of publishable) next[id] = { status: 'publishing' };
      return next;
    });

    try {
      const body = {
        masterPost: {
          text: text.trim(),
          title: title || undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
          media:
            mediaFiles.length > 0
              ? mediaFiles.map((m) => ({ url: m.url, alt: m.alt, mimeType: 'image/jpeg' }))
              : undefined,
        },
        protocols: publishable,
        options: Object.keys(protocolOptions).length > 0 ? protocolOptions : undefined,
      };

      const res = await fetch('/api/publish/selected', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          batchId: string;
          results: Array<{ protocol: string; status: string; error?: string; url?: string }>;
        };

        setPublishStatus((prev) => {
          const next = { ...prev };
          for (const r of data.results) {
            next[r.protocol] = {
              status: r.status === 'published' ? 'published' : 'failed',
              ...(r.error ? { error: r.error } : {}),
            };
          }
          return next;
        });

        const successCount = data.results.filter((r) => r.status === 'published').length;
        const failCount = data.results.filter((r) => r.status === 'failed').length;

        setResult(
          `✅ Published to ${successCount} platform(s)${failCount > 0 ? ` (${failCount} failed)` : ''}${skipped.length > 0 ? ` — skipped (not bridge-supported): ${skipped.join(', ')}` : ''}`,
        );

        // Clear form on success
        if (failCount === 0) {
          setText('');
          setTitle('');
          setHashtags([]);
          setMediaFiles([]);
        }

        showToast(
          failCount === 0 ? 'success' : 'warning',
          failCount === 0
            ? `Published to ${successCount} platforms!`
            : `Published to ${successCount}, ${failCount} failed`,
        );

        onPublishComplete?.(data);
      } else {
        const err = (await res.json()) as { error?: string };
        setResult(`❌ ${err.error ?? 'Publish failed'}`);
        showToast('error', err.error ?? 'Publish failed');
        setPublishStatus((prev) => {
          const next = { ...prev };
          for (const id of publishable) {
            next[id] = { status: 'failed', error: err.error ?? 'Publish failed' };
          }
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setResult(`❌ ${msg}`);
      showToast('error', msg);
      setPublishStatus((prev) => {
        const next = { ...prev };
        for (const id of publishable) {
          next[id] = { status: 'failed', error: msg };
        }
        return next;
      });
    } finally {
      setPublishing(false);
    }
  }, [
    text,
    title,
    hashtags,
    mediaFiles,
    selectedPlatforms,
    protocolOptions,
    showToast,
    onPublishComplete,
  ]);

  // ── Schedule ──
  const handleSchedule = useCallback(async () => {
    if (!text.trim() || selectedPlatforms.size === 0 || !scheduleDate || !scheduleTime) return;

    setPublishing(true);
    setResult(null);

    try {
      const scheduleAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();

      const body = {
        masterPost: {
          text: text.trim(),
          title: title || undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
        },
        protocols: Array.from(selectedPlatforms),
        scheduleAt,
      };

      const res = await fetch('/api/publish/schedule', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setResult(`✅ Scheduled for ${scheduleDate} at ${scheduleTime}`);
        showToast('success', `Post scheduled for ${scheduleDate} ${scheduleTime}`);
        setShowSchedule(false);
      } else {
        const err = (await res.json()) as { error?: string };
        setResult(`❌ ${err.error ?? 'Schedule failed'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Schedule failed';
      setResult(`❌ ${msg}`);
    } finally {
      setPublishing(false);
    }
  }, [text, title, hashtags, selectedPlatforms, scheduleDate, scheduleTime, showToast]);

  // ── Render ──

  const containerClass =
    mode === 'modal'
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
      : '';
  const cardClass =
    mode === 'modal'
      ? 'mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl'
      : 'card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl';

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-fg)]">Cross-Post Composer</h2>
            <p className="text-xs text-[var(--color-muted)]">Write once, publish everywhere</p>
          </div>
          {mode === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            >
              ✕
            </button>
          )}
        </div>

        {!walletAddress ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">Connect your wallet to publish</p>
          </div>
        ) : (
          <>
            {/* Title input (optional, for platforms that support it) */}
            <input
              type="text"
              placeholder="Post title (optional - used by Reddit, PeerTube, etc.)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
            />

            {/* Text area */}
            <div className="relative mb-2">
              <textarea
                ref={textareaRef}
                placeholder="What do you want to share across all your platforms?"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
                  }
                }}
                rows={5}
                className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
              />
            </div>

            {/* Character count */}
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-muted)]">
                  {charCount.toLocaleString()} characters
                </span>
              </div>

              {/* Platform character limit bars */}
              <div className="space-y-1">
                {platformCharInfo
                  .filter((p) => p.isSelected)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span
                        className="w-20 text-[10px] font-medium"
                        style={{ color: p.color ?? 'var(--color-muted)' }}
                      >
                        {p.label}
                      </span>
                      <div className="flex-1 rounded-full bg-[var(--color-border)] h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min((charCount / Math.max(p.charLimit, 1)) * 100, 100)}%`,
                            backgroundColor: p.color ?? 'var(--color-muted)',
                            opacity: charCount > 0 ? 1 : 0.3,
                          }}
                        />
                      </div>
                      <span
                        className="w-16 text-right text-[10px] tabular-nums"
                        style={{ color: p.color ?? 'var(--color-muted)' }}
                      >
                        {p.remaining === Infinity
                          ? '∞'
                          : p.remaining >= 0
                            ? `${p.remaining}`
                            : `-${Math.abs(p.remaining)}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Hashtag input */}
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add hashtag..."
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKeyDown}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addHashtag}
                  disabled={!hashtagInput.trim()}
                  className="rounded-lg bg-degen-500/20 px-3 py-1.5 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2 py-0.5 text-xs text-degen-400"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeHashtag(tag)}
                        className="text-degen-400/60 hover:text-degen-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Media attachment */}
            <div className="mb-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400">
                📎 Attach Media
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleMediaSelect}
                  className="hidden"
                />
              </label>

              {mediaFiles.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {mediaFiles.map((media, i) => (
                    <div
                      key={i}
                      className="relative group rounded-lg overflow-hidden border border-[var(--color-border)]"
                    >
                      <img
                        src={media.url}
                        alt={media.alt || 'Media preview'}
                        className="w-full h-20 object-cover"
                      />
                      <input
                        type="text"
                        placeholder="Alt text..."
                        value={media.alt}
                        onChange={(e) => updateMediaAlt(i, e.target.value)}
                        className="w-full px-1 py-0.5 text-[9px] bg-[var(--color-card)] text-[var(--color-fg)] border-t border-[var(--color-border)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute top-0.5 right-0.5 rounded-full bg-black/60 px-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Platform toggles */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">Publish to:</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const isSelected = selectedPlatforms.has(p.id);
                  const isOverLimit = p.charLimit > 0 && charCount > p.charLimit;
                  const connected = isConnected(p.id);
                  const st = publishStatus[p.id];

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      title={
                        connected
                          ? `${p.tip} (${charCount}/${p.charLimit})`
                          : `Not connected — set up ${p.label} first`
                      }
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border shadow-[0_0_8px_rgba(0,0,0,0.08)]'
                          : 'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] opacity-50 hover:opacity-80'
                      }`}
                      style={
                        isSelected
                          ? {
                              borderColor: `${p.color}60`,
                              backgroundColor: `${p.color}15`,
                              color: p.color,
                            }
                          : {}
                      }
                    >
                      {/* Auth indicator: green dot = connected, grey lock = needs setup */}
                      {connected ? (
                        <span
                          role="img"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                          aria-label={`${p.label} connected`}
                        />
                      ) : (
                        <span className="text-[9px] text-[var(--color-muted)]" aria-hidden="true">
                          🔒
                        </span>
                      )}
                      {/* Publish status indicator */}
                      {st?.status === 'publishing' && <span className="text-[10px]">⏳</span>}
                      {st?.status === 'published' && (
                        <span className="text-[10px] text-degen-400">✅</span>
                      )}
                      {st?.status === 'failed' && (
                        <span className="text-[10px] text-red-400">❌</span>
                      )}
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                      {isOverLimit && isSelected && (
                        <span className="text-[9px] text-red-400">⚠️</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Per-protocol publish status detail */}
              {Object.values(publishStatus).some((s) => s.status !== 'idle') && (
                <div className="mt-2 space-y-1">
                  {PLATFORMS.filter((p) => publishStatus[p.id]?.status !== 'idle').map((p) => {
                    const s = publishStatus[p.id];
                    if (!s) return null;
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-[11px]">
                        <span style={{ color: p.color }}>
                          {s.status === 'published' && '✅ published to'}
                          {s.status === 'failed' && '❌ failed on'}
                          {s.status === 'publishing' && '⏳ publishing to'}
                          {s.status === 'idle' && ''}
                        </span>
                        <span className="font-medium text-[var(--color-fg)]">{p.label}</span>
                        {s.error && <span className="text-[var(--color-muted)]">— {s.error}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Connect CTA for unauthenticated protocols */}
              {PLATFORMS.some((p) => !isConnected(p.id)) && (
                <div className="mt-2 rounded-lg bg-yellow-500/5 p-2 text-center text-[11px] text-yellow-400">
                  Locked protocols need setup —{' '}
                  <Link href="/connect" className="underline hover:text-yellow-300">
                    connect accounts
                  </Link>{' '}
                  to publish to them.
                </div>
              )}
            </div>

            {/* Protocol-specific options */}
            {PLATFORMS.filter((p) => p.bridgeProtocol && selectedPlatforms.has(p.id)).length >
              0 && (
              <div className="mb-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                    Protocol options
                  </span>
                  {PLATFORMS.filter((p) => p.bridgeProtocol && selectedPlatforms.has(p.id)).map(
                    (p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setExpandedOptions(expandedOptions === p.id ? null : p.id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          expandedOptions === p.id
                            ? 'border-current opacity-100'
                            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:opacity-80'
                        }`}
                        style={expandedOptions === p.id ? { color: p.color } : {}}
                      >
                        ⚙ {p.label}
                      </button>
                    ),
                  )}
                </div>

                {expandedOptions === 'nostr' && (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                    <input
                      type="text"
                      placeholder="Additional relays (comma-separated): wss://relay.damus.io"
                      defaultValue={(protocolOptions.nostr?.relays as string[])?.join(', ') ?? ''}
                      onBlur={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          nostr: {
                            ...prev.nostr,
                            relays: e.target.value
                              .split(',')
                              .map((r) => r.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="NIP-05 identity: you@yourdomain.com"
                      defaultValue={(protocolOptions.nostr?.nip05 as string) ?? ''}
                      onBlur={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          nostr: { ...prev.nostr, nip05: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                )}

                {expandedOptions === 'mastodon' && (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                    <input
                      type="text"
                      placeholder="Content warning (spoiler)"
                      defaultValue={(protocolOptions.mastodon?.cw as string) ?? ''}
                      onBlur={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          mastodon: { ...prev.mastodon, cw: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-indigo-500 focus:outline-none"
                    />
                    <select
                      defaultValue={(protocolOptions.mastodon?.visibility as string) ?? 'public'}
                      onChange={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          mastodon: { ...prev.mastodon, visibility: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Followers only</option>
                      <option value="direct">Direct message</option>
                    </select>
                  </div>
                )}

                {expandedOptions === 'bluesky' && (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                    <input
                      type="text"
                      placeholder="Labels (comma-separated): nsfw, sexual"
                      defaultValue={(protocolOptions.bluesky?.labels as string[])?.join(', ') ?? ''}
                      onBlur={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          bluesky: {
                            ...prev.bluesky,
                            labels: e.target.value
                              .split(',')
                              .map((l) => l.trim().toLowerCase())
                              .filter(Boolean),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-sky-500 focus:outline-none"
                    />
                    <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <input
                        type="checkbox"
                        defaultChecked={(protocolOptions.bluesky?.threadGate as boolean) ?? false}
                        onChange={(e) =>
                          setProtocolOptions((prev) => ({
                            ...prev,
                            bluesky: {
                              ...prev.bluesky,
                              threadGate: e.target.checked,
                            },
                          }))
                        }
                        className="h-3 w-3 rounded text-sky-500"
                      />
                      Thread gate — only replies from people you mention
                    </label>
                  </div>
                )}

                {expandedOptions === 'farcaster' && (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                    <input
                      type="text"
                      placeholder="Channel (e.g. degen)"
                      defaultValue={(protocolOptions.farcaster?.channel as string) ?? ''}
                      onBlur={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          farcaster: { ...prev.farcaster, channel: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-violet-500 focus:outline-none"
                    />
                    <input
                      type="url"
                      placeholder="Embed URL: https://..."
                      defaultValue={(protocolOptions.farcaster?.embed as string) ?? ''}
                      onBlur={(e) =>
                        setProtocolOptions((prev) => ({
                          ...prev,
                          farcaster: { ...prev.farcaster, embed: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Platform tips */}
            {selectedPlatforms.size > 0 && (
              <div className="mb-4 rounded-lg bg-[var(--color-card)] p-3">
                <p className="mb-1 text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Platform Tips
                </p>
                <ul className="space-y-0.5">
                  {PLATFORMS.filter((p) => selectedPlatforms.has(p.id)).map((p) => (
                    <li key={p.id} className="text-[11px] text-[var(--color-muted)]">
                      <span style={{ color: p.color }}>{p.icon}</span>{' '}
                      <strong style={{ color: p.color }}>{p.label}:</strong> {p.tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Schedule toggle */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowSchedule(!showSchedule)}
                className={`text-xs font-medium transition-colors ${
                  showSchedule
                    ? 'text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {showSchedule ? '📅 Cancel scheduling' : '📅 Schedule for later'}
              </button>

              {showSchedule && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-fg)] focus:border-degen-500/40 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-fg)] focus:border-degen-500/40 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  if (showPreview) {
                    setShowPreview(false);
                  } else {
                    fetchPreviews();
                  }
                }}
                className="text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                {showPreview ? '👁️ Hide preview' : '👁️ Preview'}
              </button>

              {showPreview && Object.keys(previews).length > 0 && (
                <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
                  {/* Preview protocol tabs */}
                  <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                    {Object.keys(previews).map((proto) => {
                      const platform = PLATFORMS.find((p) => p.id === proto);
                      return (
                        <button
                          key={proto}
                          type="button"
                          onClick={() => setPreviewProtocol(proto)}
                          className={`px-3 py-2 text-[10px] font-medium whitespace-nowrap transition-colors ${
                            previewProtocol === proto
                              ? 'border-b-2 text-[var(--color-fg)]'
                              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                          }`}
                          style={
                            previewProtocol === proto
                              ? { borderColor: platform?.color ?? 'var(--color-fg)' }
                              : {}
                          }
                        >
                          {platform?.icon ?? '📄'} {platform?.label ?? proto}
                        </button>
                      );
                    })}
                  </div>

                  {/* Preview content */}
                  <div className="p-3">
                    <pre className="whitespace-pre-wrap text-xs text-[var(--color-fg)] font-sans">
                      {previews[previewProtocol] ?? 'No preview available'}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className="mb-4 rounded-lg bg-[var(--color-card)] p-3 text-xs text-[var(--color-fg)]">
                {result}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {showSchedule ? (
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={
                    !text.trim() ||
                    selectedPlatforms.size === 0 ||
                    publishing ||
                    !scheduleDate ||
                    !scheduleTime
                  }
                  className="btn-primary text-sm disabled:opacity-40"
                >
                  {publishing ? 'Scheduling...' : '📅 Schedule Post'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!text.trim() || selectedPlatforms.size === 0 || publishing}
                  className="btn-primary text-sm disabled:opacity-40"
                >
                  {publishing
                    ? 'Publishing...'
                    : `🚀 Publish to ${selectedPlatforms.size} platform${selectedPlatforms.size !== 1 ? 's' : ''}`}
                </button>
              )}
              {mode === 'modal' && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                >
                  Cancel
                </button>
              )}
              <span className="text-[11px] text-[var(--color-muted)]">
                {selectedPlatforms.size === 0
                  ? 'Select at least one platform'
                  : 'Content auto-adapted per platform'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
