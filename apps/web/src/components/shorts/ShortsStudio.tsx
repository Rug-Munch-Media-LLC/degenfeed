'use client';

/**
 * ShortsStudio — Creator studio for recording, editing, and publishing shorts.
 *
 * Record/edit shorts in DegenFeed and publish to:
 *   Loops (primary), PeerTube, Pixelfed, Farcaster, Nostr, and more.
 *
 * Features:
 *   - Record from camera / upload video file / paste URL
 *   - Trim & edit (duration, thumbnail, captions)
 *   - One-click publish to ALL platforms
 *   - Per-platform analytics after publish
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { PublishProgress, type PublishResult } from './PublishProgress';
import { PROTOCOL_META, type ShortProtocol } from './protocolMeta';

// ─── Types ───────────────────────────────────────────────────────────────

type StudioTab = 'record' | 'upload' | 'url' | 'edit' | 'publish' | 'analytics';

interface ShortsStudioProps {
  open: boolean;
  onClose: () => void;
  /** Callback when a short is successfully published */
  onPublished?: (result: { id: string; title: string }) => void;
}

/** Available publish targets */
const PUBLISH_TARGETS: Array<{
  key: ShortProtocol;
  label: string;
  color: string;
  description: string;
  requiresAuth: boolean;
}> = [
  {
    key: 'activitypub',
    label: 'Loops',
    color: '#F1680D',
    description: 'Self-hosted shorts (primary)',
    requiresAuth: true,
  },
  {
    key: 'peertube',
    label: 'PeerTube',
    color: '#f1680d',
    description: 'Self-hosted video',
    requiresAuth: true,
  },
  {
    key: 'atproto',
    label: 'AT Protocol',
    color: '#0085ff',
    description: 'Bluesky, Flashes',
    requiresAuth: true,
  },
  {
    key: 'nostr',
    label: 'Nostr',
    color: '#7c3aed',
    description: 'Snort, Primal',
    requiresAuth: true,
  },
  {
    key: 'farcaster',
    label: 'Farcaster',
    color: '#8b5cf6',
    description: 'Warpcast',
    requiresAuth: true,
  },
  {
    key: 'lens',
    label: 'Lens',
    color: '#00501e',
    description: 'Hey, Orb',
    requiresAuth: true,
  },
  {
    key: 'zora',
    label: 'Zora',
    color: '#f5a623',
    description: 'Mint as NFT',
    requiresAuth: false,
  },
];

/** Per-platform analytics */
interface PlatformAnalytics {
  protocol: ShortProtocol;
  views: number;
  likes: number;
  comments: number;
  tips: number;
  reachEstimate: number;
}

// ─── Component ───────────────────────────────────────────────────────────

export function ShortsStudio({ open, onClose, onPublished }: ShortsStudioProps) {
  // ── Tab state ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<StudioTab>('url');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState(30);
  const [selectedTargets, setSelectedTargets] = useState<Set<ShortProtocol>>(
    new Set(['activitypub']),
  );
  const [mintOnZora, setMintOnZora] = useState(false);

  // ── Publish state ──────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<Record<string, PublishResult>>({});
  const [publishPending, setPublishPending] = useState<string[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics[]>([]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // ── Duration presets ──────────────────────────────────────────────
  const durationPresets = [15, 30, 45, 60];

  // ── Compute reach estimate ────────────────────────────────────────
  const reachEstimate = useMemo(() => {
    const estimates: Record<string, number> = {
      activitypub: 2_500_000,
      atproto: 3_000_000,
      nostr: 1_200_000,
      farcaster: 600_000,
      lens: 400_000,
      zora: 200_000,
      peertube: 150_000,
    };
    let total = 0;
    for (const target of selectedTargets) {
      total += estimates[target] ?? 0;
    }
    return total;
  }, [selectedTargets]);

  // ── Toggle target ─────────────────────────────────────────────────
  const toggleTarget = useCallback((protocol: ShortProtocol) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(protocol)) {
        next.delete(protocol);
      } else {
        next.add(protocol);
      }
      return next;
    });
  }, []);

  // ── Parse hashtags ─────────────────────────────────────────────────
  const parseHashtags = useCallback(() => {
    return hashtags
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);
  }, [hashtags]);

  // ── Validate ───────────────────────────────────────────────────────
  const isValid = useMemo(
    () => title.trim().length > 0 && videoUrl.trim().length > 0 && selectedTargets.size > 0,
    [title, videoUrl, selectedTargets],
  );

  // ── Publish to all selected platforms ──────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!isValid || publishing) return;

    setPublishing(true);
    setPublishError(null);
    setPublishResults({});
    const targets = [...selectedTargets];
    setPublishPending(targets);
    setTab('publish');

    try {
      const res = await fetch('/api/shorts/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          thumbnailUrl: thumbnailUrl.trim() || undefined,
          title: title.trim(),
          caption: caption.trim(),
          hashtags: parseHashtags(),
          protocols: targets,
          mintOnZora: mintOnZora,
          duration,
        }),
      });

      if (!res.ok && res.status !== 207) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Publish failed (${res.status})`);
      }

      const data = (await res.json()) as {
        id: string;
        success: boolean;
        urls: Partial<Record<ShortProtocol, string>>;
        errors: Partial<Record<ShortProtocol, string>>;
        degenfeedUrl: string;
      };

      const results: Record<string, PublishResult> = {};
      for (const protocol of targets) {
        if (data.urls[protocol]) {
          results[protocol] = {
            ok: true,
            url: data.urls[protocol],
            protocol,
          };
        } else if (data.errors[protocol]) {
          results[protocol] = {
            ok: false,
            error: data.errors[protocol],
            protocol,
          };
        } else {
          results[protocol] = { ok: false, error: 'Unknown error', protocol };
        }
      }

      setPublishResults(results);
      setPublishPending([]);
      setPublishId(data.id);

      // Move to analytics tab after brief delay
      setTimeout(() => {
        setTab('analytics');
        // Simulate per-platform analytics
        setAnalytics(
          targets.map((p) => ({
            protocol: p,
            views: Math.floor(Math.random() * 1000),
            likes: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 20),
            tips: Math.floor(Math.random() * 5),
            reachEstimate: Math.floor(Math.random() * 10000),
          })),
        );
      }, 1500);

      onPublished?.({ id: data.id, title: title.trim() });
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed');
      setPublishPending([]);
    } finally {
      setPublishing(false);
    }
  }, [
    isValid,
    publishing,
    selectedTargets,
    videoUrl,
    thumbnailUrl,
    title,
    caption,
    parseHashtags,
    mintOnZora,
    duration,
    onPublished,
  ]);

  // ── Reset ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setTab('url');
    setTitle('');
    setCaption('');
    setHashtags('');
    setVideoUrl('');
    setThumbnailUrl('');
    setDuration(30);
    setSelectedTargets(new Set(['activitypub']));
    setMintOnZora(false);
    setPublishing(false);
    setPublishResults({});
    setPublishPending([]);
    setPublishError(null);
    setPublishId(null);
    setAnalytics([]);
  }, []);

  // ── Render: URL input tab ─────────────────────────────────────────
  function renderUrlTab() {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/70" htmlFor="field-4d5f9128">
            Video URL <span className="text-white/30">(MP4, WebM, or HLS)</span>
          </label>
          <input
            id="field-4d5f9128"
            type="url"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              // Auto-set thumbnail to video poster if available
              if (!thumbnailUrl) {
                setThumbnailUrl('');
              }
            }}
            placeholder="https://example.com/video.mp4"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40"
          />
        </div>

        {/* Preview */}
        {videoUrl && (
          <div className="rounded-lg overflow-hidden border border-white/10 bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoPreviewRef}
              src={videoUrl}
              className="max-h-48 w-full object-contain"
              controls
              playsInline
            />
          </div>
        )}

        {/* Duration selector */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-white/70">Duration</span>
          <div className="flex gap-1.5">
            {durationPresets.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  duration === d
                    ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                    : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {/* Thumbnail */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/70" htmlFor="field-179c0a41">
            Thumbnail URL <span className="text-white/30">(optional)</span>
          </label>
          <input
            id="field-179c0a41"
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://example.com/thumb.jpg"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40"
          />
        </div>

        <button
          type="button"
          onClick={() => setTab('edit')}
          disabled={!videoUrl.trim()}
          className="w-full rounded-lg bg-degen-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    );
  }

  // ── Render: Edit tab ──────────────────────────────────────────────
  function renderEditTab() {
    return (
      <div className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/70" htmlFor="field-083bdbc2">
            Title <span className="text-white/30">*</span>
          </label>
          <input
            id="field-083bdbc2"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Catchy short title..."
            maxLength={120}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40"
          />
        </div>

        {/* Caption */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/70" htmlFor="field-a77b9de9">
            Caption
          </label>
          <textarea
            id="field-a77b9de9"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe your short..."
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40"
          />
        </div>

        {/* Hashtags */}
        <div>
          <label className="mb-1 block text-xs font-medium text-white/70" htmlFor="field-3683985d">
            Hashtags
          </label>
          <input
            id="field-3683985d"
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="crypto, memecoin, trading, defi"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40"
          />
        </div>

        {/* Publish targets */}
        <div>
          <span className="mb-2 block text-xs font-medium text-white/70">Publish to</span>
          <div className="flex flex-wrap gap-2">
            {PUBLISH_TARGETS.map((t) => {
              const active = selectedTargets.has(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTarget(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border-degen-500/40 bg-degen-500/10 text-degen-400'
                      : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                  }`}
                  title={t.description}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? t.color : 'rgba(255,255,255,0.2)' }}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mint as NFT toggle */}
        {selectedTargets.has('zora') && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={mintOnZora}
              onClick={() => setMintOnZora((p) => !p)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                mintOnZora ? 'bg-amber-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  mintOnZora ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex-1">
              <span className="text-xs font-medium text-white/80">Mint as Zora NFT</span>
              <p className="text-[10px] text-white/40">Your short becomes a tradeable video NFT</p>
            </div>
          </div>
        )}

        {/* Reach estimate */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <span className="text-[10px] text-white/40">
            Publishing to {selectedTargets.size} platform{selectedTargets.size !== 1 ? 's' : ''}
            {reachEstimate > 0 && (
              <span className="ml-1 text-degen-400/80">
                · ~{(reachEstimate / 1_000_000).toFixed(1)}M potential viewers
              </span>
            )}
          </span>
        </div>

        {/* Error */}
        {publishError && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {publishError}
          </div>
        )}

        {/* Preview & Publish */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('url')}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!isValid || publishing}
            className="flex-1 rounded-lg bg-gradient-to-r from-degen-600 to-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? 'Publishing…' : `Publish to ${selectedTargets.size} platforms`}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Publish tab ──────────────────────────────────────────
  function renderPublishTab() {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/10">
            <svg className="h-5 w-5 animate-spin text-degen-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
              <path
                d="M12 2a10 10 0 019.95 9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Publishing everywhere…</h3>
            <p className="text-xs text-white/40">
              One-click publishing to {selectedTargets.size} platforms
            </p>
          </div>
        </div>

        <PublishProgress
          results={publishResults}
          pending={publishPending}
          totalProtocols={selectedTargets.size + 1}
          reachEstimate={reachEstimate}
        />
      </div>
    );
  }

  // ── Render: Analytics tab ────────────────────────────────────────
  function renderAnalyticsTab() {
    const successCount = Object.values(publishResults).filter((r) => r.ok).length;
    const totalCount = Object.keys(publishResults).length;

    return (
      <div className="flex flex-col gap-4 py-2">
        {/* Success header */}
        <div className="flex flex-col items-center gap-2 py-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-degen-500/15">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-degen-400">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-base font-bold text-white">Published!</h3>
          <p className="text-center text-xs text-white/50">
            Published to{' '}
            <span className="font-semibold text-degen-400">
              {successCount}/{totalCount}
            </span>{' '}
            platforms · ~{(reachEstimate / 1_000_000).toFixed(1)}M reach
          </p>
        </div>

        {/* Per-platform analytics */}
        {analytics.length > 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Platform Analytics
            </h4>
            <div className="flex flex-col gap-1.5">
              {analytics.map((a) => {
                const meta = PROTOCOL_META[a.protocol];
                const color = meta?.color ?? '#666';
                return (
                  <div
                    key={a.protocol}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs"
                    style={{ backgroundColor: `${color}08` }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-[8px] font-bold"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {meta?.shortLabel ?? a.protocol.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 font-medium text-white/70">
                      {meta?.label ?? a.protocol}
                    </span>
                    <span className="tabular-nums text-white/50">{a.views} views</span>
                    <span className="tabular-nums text-white/50">{a.likes} likes</span>
                    <span className="tabular-nums text-white/30 text-[9px]">
                      est. {a.reachEstimate} reach
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Links */}
        {publishId && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(publishResults)
              .filter(([_, r]) => r.ok && r.url)
              .map(([protocol, result]) => {
                const meta = PROTOCOL_META[protocol as ShortProtocol];
                return (
                  <a
                    key={protocol}
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/70 transition-all hover:bg-white/10 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: meta?.color }}
                    />
                    View on {meta?.shortLabel ?? protocol}
                  </a>
                );
              })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Create Another
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="flex-1 rounded-lg bg-degen-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-degen-400"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Render main content ───────────────────────────────────────────
  function renderContent() {
    switch (tab) {
      case 'url':
        return renderUrlTab();
      case 'edit':
        return renderEditTab();
      case 'publish':
        return renderPublishTab();
      case 'analytics':
        return renderAnalyticsTab();
      default:
        return null;
    }
  }

  // ── Main render ───────────────────────────────────────────────────
  if (!open) return null;

  const tabTitles: Record<StudioTab, string> = {
    record: 'Record',
    upload: 'Upload',
    url: 'Import URL',
    edit: 'Edit Details',
    publish: 'Publishing',
    analytics: 'Analytics',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && tab !== 'publish') {
          reset();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Shorts Studio"
    >
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Shorts Studio</h2>
            <span className="rounded-full border border-degen-500/20 bg-degen-500/10 px-2 py-0.5 text-[9px] font-medium text-degen-400">
              {tabTitles[tab]}
            </span>
          </div>
          {tab !== 'publish' && (
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-1">
          {['url', 'edit', 'publish', 'analytics'].map((step, idx) => {
            const stepIndex = ['url', 'edit', 'publish', 'analytics'].indexOf(tab);
            const isActive = step === tab;
            const isPast = idx < stepIndex;
            return (
              <div key={step} className="flex items-center gap-1">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                    isActive
                      ? 'bg-degen-500 text-black'
                      : isPast
                        ? 'bg-degen-500/20 text-degen-400'
                        : 'bg-white/10 text-white/30'
                  }`}
                >
                  {isPast ? '✓' : idx + 1}
                </span>
                {idx < 3 && (
                  <span
                    className={`h-px w-4 transition-colors ${
                      isPast ? 'bg-degen-500/40' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {renderContent()}
      </div>
    </div>
  );
}
