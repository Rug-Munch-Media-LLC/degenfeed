'use client';

import { useCallback, useMemo, useState } from 'react';

// === Types ===============================================================

export interface PlatformOption {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  /** Child platforms that receive via this protocol */
  children?: string[];
}

export interface PublishResult {
  platform: string;
  ok: boolean;
  error?: string;
  url?: string;
}

interface CrossPlatformPublisherProps {
  /** Video UUID or post identifier */
  contentId?: string;
  /** Pre-filled text/description for the publish */
  text?: string;
  /** Optional media URL to attach */
  mediaUrl?: string;
  /** Called when publish completes */
  onComplete?: (results: PublishResult[]) => void;
  /** Called to close the modal */
  onClose: () => void;
  /** Mode: modal overlay or inline */
  mode?: 'modal' | 'inline';
  /** Whether to show the text editor */
  showEditor?: boolean;
}

// === Platform Definitions ================================================

const PLATFORMS: PlatformOption[] = [
  {
    id: 'degenfeed',
    label: 'DegenFeed',
    sublabel: 'Primary',
    icon: '🔵',
    color: '#00ff41',
    children: ['Video Hub', 'Shorts Feed', 'Discover'],
  },
  {
    id: 'activitypub',
    label: 'ActivityPub',
    sublabel: 'Mastodon · Pixelfed · Loops · PeerTube',
    icon: '🟣',
    color: '#6364ff',
    children: ['Mastodon', 'Pixelfed', 'Loops', 'PeerTube'],
  },
  {
    id: 'atproto',
    label: 'AT Protocol',
    sublabel: 'Bluesky · Flashes',
    icon: '🔵',
    color: '#1185fe',
    children: ['Bluesky', 'Flashes'],
  },
  {
    id: 'nostr',
    label: 'Nostr',
    sublabel: 'All relays',
    icon: '🟣',
    color: '#8e30eb',
    children: ['PurplePages', 'Habla', 'Yonks'],
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    sublabel: 'Warpcast · Supercast',
    icon: '🟡',
    color: '#8a63d2',
    children: ['Warpcast', 'Supercast'],
  },
  {
    id: 'lens',
    label: 'Lens Protocol',
    sublabel: 'Orb · Phaver · Hey',
    icon: '🟢',
    color: '#abfe2c',
    children: ['Orb', 'Phaver', 'Hey'],
  },
  {
    id: 'zora',
    label: 'Zora',
    sublabel: 'Mint as NFT',
    icon: '🔴',
    color: '#ff6b6b',
  },
];

// === Platform Row ========================================================

function PlatformRow({
  platform,
  selected,
  onToggle,
}: {
  platform: PlatformOption;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
        selected
          ? 'border-degen-500/40 bg-degen-500/8 shadow-[0_0_12px_rgba(0,255,65,0.06)]'
          : 'border-[var(--color-border)] bg-[var(--color-overlay)] hover:border-[var(--color-muted)]'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
          selected
            ? 'border-degen-500 bg-degen-500'
            : 'border-[var(--color-muted)] bg-transparent'
        }`}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6l2.5 2.5 4.5-5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Icon */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
        style={{ backgroundColor: `${platform.color}15` }}
      >
        <span>{platform.icon}</span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-fg)]">{platform.label}</span>
          <span className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] font-medium text-[var(--color-muted)]">
            {platform.sublabel}
          </span>
        </div>
        {platform.children && selected && (
          <div className="mt-1 flex flex-wrap gap-1">
            {platform.children.map((child) => (
              <span
                key={child}
                className="rounded-md bg-degen-500/10 px-2 py-0.5 text-[9px] text-degen-400"
              >
                {child}
              </span>
            ))}
          </div>
        )}
      </div>

      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(platform.id)}
        className="sr-only"
        aria-label={`Publish to ${platform.label}`}
      />
    </label>
  );
}

// === Main Component ======================================================

export default function CrossPlatformPublisher({
  contentId,
  text: initialText,
  mediaUrl,
  onComplete,
  onClose,
  mode = 'modal',
  showEditor = true,
}: CrossPlatformPublisherProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(['degenfeed', 'farcaster', 'nostr']),
  );
  const [publishText, setPublishText] = useState(initialText ?? '');
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);

  const togglePlatform = useCallback((id: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPlatforms(new Set(PLATFORMS.map((p) => p.id)));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedPlatforms(new Set());
  }, []);

  const allSelected = selectedPlatforms.size === PLATFORMS.length;

  const canPublish = selectedPlatforms.size > 0 && (showEditor ? publishText.trim().length > 0 : true);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    setPublishing(true);
    setResults(null);

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targets: Array.from(selectedPlatforms),
          text: publishText.trim(),
          mediaUrl,
          contentId,
          auth: {}, // Will use server-side session tokens
        }),
      });

      const data = await res.json();
      const publishResults: PublishResult[] = Array.from(selectedPlatforms).map((platform) => {
        const platformResult = data.results?.[platform];
        return {
          platform,
          ok: platformResult?.ok ?? false,
          error: platformResult?.error,
          url: platformResult?.hash ? `https://degenfeed.xyz/p/${platformResult.hash}` : undefined,
        };
      });

      // Check premium tier limits
      if (data.meta?.tier === 'free' && data.meta?.protocols_used > 3) {
        publishResults.push({
          platform: 'upgrade',
          ok: false,
          error: 'Free tier limited to 3 protocols. Upgrade for unlimited cross-posting.',
        });
      }

      setResults(publishResults);
      onComplete?.(publishResults);
    } catch (err) {
      setResults([
        {
          platform: 'error',
          ok: false,
          error: err instanceof Error ? err.message : 'Publish failed',
        },
      ]);
    } finally {
      setPublishing(false);
    }
  }, [canPublish, selectedPlatforms, publishText, mediaUrl, contentId, onComplete]);

  const handleRetry = useCallback(() => {
    setResults(null);
    setPublishing(false);
  }, []);

  // == Content ==========================================================

  const body = (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-muted)]">
          {selectedPlatforms.size} of {PLATFORMS.length} platforms selected
        </p>
        <div className="flex gap-2">
          {!allSelected ? (
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-medium text-degen-400 transition-colors hover:text-degen-300"
            >
              Select All
            </button>
          ) : (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Platform list */}
      <div className="space-y-2.5">
        {PLATFORMS.map((platform) => (
          <PlatformRow
            key={platform.id}
            platform={platform}
            selected={selectedPlatforms.has(platform.id)}
            onToggle={togglePlatform}
          />
        ))}
      </div>

      {/* Text editor */}
      {showEditor && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
            Post Text
          </label>
          <textarea
            value={publishText}
            onChange={(e) => setPublishText(e.target.value)}
            placeholder="Write a post to accompany your video..."
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Markdown supported</span>
            <span>{publishText.length}/500</span>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
          <h4 className="text-xs font-semibold text-[var(--color-fg)]">Publish Results</h4>
          <div className="space-y-1.5">
            {results.map((r) => (
              <div key={r.platform} className="flex items-center gap-2 text-xs">
                {r.ok ? (
                  <span className="text-degen-400">✓</span>
                ) : (
                  <span className="text-red-400">✗</span>
                )}
                <span className="font-medium text-[var(--color-fg)] capitalize">{r.platform}</span>
                {r.error && (
                  <span className="ml-auto max-w-[200px] truncate text-[var(--color-muted)]">
                    {r.error}
                  </span>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-degen-400 hover:text-degen-300"
                  >
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade prompt */}
      {results?.some((r) => r.platform === 'upgrade') && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-400">
          Free tier max: 3 protocols.{' '}
          <a href="/settings#subscription" className="font-medium underline hover:text-yellow-300">
            Upgrade to Premium
          </a>{' '}
          for unlimited cross-posting.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex gap-2">
          {mode === 'modal' && !publishing && !results && (
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
          )}
          {results && (
            <button type="button" onClick={handleRetry} className="btn-secondary text-sm">
              {results.some((r) => !r.ok) ? 'Retry' : 'Publish More'}
            </button>
          )}
        </div>
        {!publishing && canPublish && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {results?.some((r) => !r.ok) ? 'Retry Failed' : 'Publish to Selected'}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {publishing && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <svg className="h-4 w-4 animate-spin text-degen-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Publishing to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? 's' : ''}...
          </div>
        )}
      </div>
    </div>
  );

  // == Modal mode ========================================================

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
          {/* Header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-fg)]">Cross-Protocol Publish</h2>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Publish your video to multiple platforms at once
              </p>
            </div>
            {!publishing && (
              <button
                type="button"
                onClick={onClose}
                className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {body}
        </div>
      </div>
    );
  }

  // == Inline mode =======================================================

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Publish to Platforms</h3>
        <p className="text-xs text-[var(--color-muted)]">
          Select where to publish this video
        </p>
      </div>
      {body}
    </div>
  );
}

export { CrossPlatformPublisher, PLATFORMS };
