'use client';

/**
 * CreateShortModal — Publish a short to multiple protocols in one go.
 *
 * Flow:
 *   1. Upload/enter a video URL (up to 60 seconds)
 *   2. Add title, caption, hashtags
 *   3. Select which protocols to publish to
 *   4. Optionally mint as Zora NFT
 *   5. Click "Publish"
 *   6. Progress: uploading → publishing → done
 *   7. Success with per-protocol links + share buttons + reach estimate
 */

import { useCallback, useMemo, useState } from 'react';
import { PublishProgress, type PublishResult } from './PublishProgress';
import { buildShareUrl, PROTOCOL_META, type ShortProtocol } from './protocolMeta';

// === Types ================================================================

interface CreateShortModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: { id: string; title: string }) => void;
}

type PublishStage = 'form' | 'uploading' | 'publishing' | 'done' | 'error';

interface PublishResponse {
  id: string;
  success: boolean;
  urls: Partial<Record<ShortProtocol, string>>;
  zoraTokenId?: string;
  zoraUrl?: string;
  degenfeedUrl: string;
  tipLink: string;
  errors: Partial<Record<ShortProtocol, string>>;
}

// === Available protocols for selection (user-facing) ======================

const AVAILABLE_PROTOCOLS: {
  key: ShortProtocol;
  label: string;
  color: string;
  description: string;
}[] = [
  {
    key: 'activitypub',
    label: 'ActivityPub',
    color: '#6364ff',
    description: 'Mastodon, Pixelfed, PeerTube',
  },
  { key: 'atproto', label: 'AT Protocol', color: '#0085ff', description: 'Bluesky, Flashes' },
  { key: 'nostr', label: 'Nostr', color: '#7c3aed', description: 'Snort, Coracle, Primal' },
  { key: 'farcaster', label: 'Farcaster', color: '#8b5cf6', description: 'Warpcast, Supercast' },
  { key: 'lens', label: 'Lens', color: '#00501e', description: 'Hey, Orb, Phaver' },
  { key: 'zora', label: 'Zora', color: '#f5a623', description: 'Zora Network' },
];

// === Reach estimate (conservative — real data would come from API) ========

const REACH_ESTIMATES: Record<string, number> = {
  activitypub: 2_500_000,
  atproto: 3_000_000,
  nostr: 1_200_000,
  farcaster: 600_000,
  lens: 400_000,
  zora: 200_000,
  degenfeed: 50_000,
};

// === Component ============================================================

export function CreateShortModal({ open, onClose, onCreated }: CreateShortModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [selectedProtocols, setSelectedProtocols] = useState<Set<ShortProtocol>>(
    new Set(['activitypub', 'atproto', 'nostr', 'farcaster', 'lens', 'zora']),
  );
  const [mintOnZora, setMintOnZora] = useState(true);

  // Publish state
  const [stage, setStage] = useState<PublishStage>('form');
  const [publishResults, setPublishResults] = useState<Record<string, PublishResult>>({});
  const [publishPending, setPublishPending] = useState<string[]>([]);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [degenfeedUrl, setDegenfeedUrl] = useState<string | null>(null);
  const [zoraUrl, setZoraUrl] = useState<string | null>(null);
  const [tipLink, setTipLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // == Derived ===========================================================

  const protocolList = useMemo(
    () => AVAILABLE_PROTOCOLS.filter((p) => selectedProtocols.has(p.key)),
    [selectedProtocols],
  );

  const totalReach = useMemo(() => {
    let total = 0;
    for (const p of selectedProtocols) {
      total += REACH_ESTIMATES[p] ?? 0;
    }
    return total;
  }, [selectedProtocols]);

  const hasZora = selectedProtocols.has('zora');

  // == Toggle protocol selection =========================================

  const toggleProtocol = useCallback((protocol: ShortProtocol) => {
    setSelectedProtocols((prev) => {
      const next = new Set(prev);
      if (next.has(protocol)) {
        next.delete(protocol);
      } else {
        next.add(protocol);
      }
      return next;
    });
  }, []);

  // == Reset form ========================================================

  const resetForm = useCallback(() => {
    setTitle('');
    setCaption('');
    setHashtags('');
    setVideoUrl('');
    setThumbnailUrl('');
    setSelectedProtocols(new Set(['activitypub', 'atproto', 'nostr', 'farcaster', 'lens', 'zora']));
    setMintOnZora(true);
    setStage('form');
    setPublishResults({});
    setPublishPending([]);
    setPublishId(null);
    setDegenfeedUrl(null);
    setZoraUrl(null);
    setTipLink(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  // == Parse hashtags from string ========================================

  const parseHashtags = useCallback(() => {
    return hashtags
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);
  }, [hashtags]);

  // == Submit: upload + publish =========================================

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!title.trim()) {
        setError('Title is required');
        return;
      }
      if (!videoUrl.trim()) {
        setError('Video URL is required');
        return;
      }
      if (selectedProtocols.size === 0) {
        setError('Select at least one protocol to publish to');
        return;
      }

      const protocols = [...selectedProtocols];
      const parsedTags = parseHashtags();

      // == Stage 1: Uploading ==
      setStage('uploading');
      setUploadProgress(0);

      // Simulate upload progress (video URL is already a URL, but we
      // show the upload step for UX continuity)
      const progressSim = setInterval(() => {
        setUploadProgress((p) => Math.min(p + Math.random() * 25, 90));
      }, 400);

      // Small delay to show progress (replace with actual upload if needed)
      await new Promise((r) => setTimeout(r, 800));
      clearInterval(progressSim);
      setUploadProgress(100);

      // == Stage 2: Publishing ==
      setStage('publishing');
      setPublishPending(protocols);

      const startedAt = Date.now();

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
            hashtags: parsedTags,
            protocols,
            mintOnZora: hasZora ? mintOnZora : false,
            duration: 30,
          }),
        });

        const elapsed = Date.now() - startedAt;
        // Ensure minimum animation time for UX pleasure
        if (elapsed < 1200) await new Promise((r) => setTimeout(r, 1200 - elapsed));

        if (!res.ok && res.status !== 207) {
          const data = (await res.json()) as { error?: string; details?: string };
          throw new Error(data.error ?? data.details ?? `Publish failed (${res.status})`);
        }

        const data = (await res.json()) as PublishResponse;

        // Build per-protocol results
        const results: Record<string, PublishResult> = {};

        for (const protocol of protocols) {
          if (data.urls[protocol]) {
            results[protocol] = {
              ok: true,
              url: data.urls[protocol],
              protocol: protocol as ShortProtocol,
            };
          } else if (data.errors[protocol]) {
            results[protocol] = {
              ok: false,
              error: data.errors[protocol],
              protocol: protocol as ShortProtocol,
            };
          } else {
            results[protocol] = {
              ok: false,
              error: 'Unknown error',
              protocol: protocol as ShortProtocol,
            };
          }
        }

        // Always add DegenFeed as a "success"
        if (data.degenfeedUrl && !results.degenfeed) {
          results.degenfeed = {
            ok: true,
            url: data.degenfeedUrl,
            protocol: 'degenfeed',
          };
        }

        setPublishResults(results);
        setPublishPending([]);
        setPublishId(data.id);
        setDegenfeedUrl(data.degenfeedUrl);
        setZoraUrl(data.zoraUrl ?? null);
        setTipLink(data.tipLink);

        if (data.success) {
          setStage('done');
          onCreated?.({ id: data.id, title: title.trim() });
        } else {
          // Partial success is still a success — just show errors inline
          setStage('done');
          onCreated?.({ id: data.id, title: title.trim() });
        }
      } catch (err) {
        setPublishPending([]);
        setStage('error');
        setError(err instanceof Error ? err.message : 'Publish failed');
      }
    },
    [
      title,
      caption,
      videoUrl,
      thumbnailUrl,
      selectedProtocols,
      mintOnZora,
      hasZora,
      parseHashtags,
      onCreated,
    ],
  );

  // == Render blocks ====================================================

  if (!open) return null;

  const renderContent = () => {
    switch (stage) {
      case 'form':
        return renderForm();
      case 'uploading':
        return renderUploading();
      case 'publishing':
        return renderPublishing();
      case 'done':
        return renderDone();
      case 'error':
        return renderError();
    }
  };

  // == Form ==============================================================

  function renderForm() {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label htmlFor="short-title" className="mb-1 block text-xs font-medium text-white/70">
            Title *
          </label>
          <input
            id="short-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a catchy title..."
            maxLength={120}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
          />
        </div>

        {/* Caption */}
        <div>
          <label htmlFor="short-caption" className="mb-1 block text-xs font-medium text-white/70">
            Caption
          </label>
          <textarea
            id="short-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe your short..."
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
          />
        </div>

        {/* Hashtags */}
        <div>
          <label htmlFor="short-hashtags" className="mb-1 block text-xs font-medium text-white/70">
            Hashtags
          </label>
          <input
            id="short-hashtags"
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="defi, nft, trading, memecoin"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
          />
        </div>

        {/* Video URL */}
        <div>
          <label htmlFor="short-video-url" className="mb-1 block text-xs font-medium text-white/70">
            Video URL *
          </label>
          <input
            id="short-video-url"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://example.com/video.mp4"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
          />
        </div>

        {/* Thumbnail URL */}
        <div>
          <label htmlFor="short-thumbnail" className="mb-1 block text-xs font-medium text-white/70">
            Thumbnail URL <span className="text-white/30">(optional)</span>
          </label>
          <input
            id="short-thumbnail"
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://example.com/thumb.jpg"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-degen-500/40 focus:bg-white/[0.06]"
          />
        </div>

        {/* == Protocol Selector == */}
        <div>
          <span className="mb-2 block text-xs font-medium text-white/70">Publish to</span>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_PROTOCOLS.map((p) => {
              const active = selectedProtocols.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggleProtocol(p.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border-degen-500/40 bg-degen-500/10 text-degen-400 shadow-[0_0_8px_rgba(0,255,65,0.1)]'
                      : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                  }`}
                  title={p.description}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? p.color : 'rgba(255,255,255,0.2)' }}
                  />
                  {p.label}
                  {active && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-degen-400"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-white/30">
            {selectedProtocols.size === 0
              ? 'Select at least one protocol'
              : `Publishing to ${protocolList.length} protocol${protocolList.length !== 1 ? 's' : ''} — ~${(totalReach / 1_000_000).toFixed(1)}M potential viewers`}
          </p>
        </div>

        {/* == Mint as Zora NFT toggle == */}
        {hasZora && (
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
              <p className="text-[10px] text-white/40">
                Your short becomes a tradeable video NFT on Zora Network
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={selectedProtocols.size === 0 || !title.trim() || !videoUrl.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-degen-600 to-degen-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Publish to {protocolList.length} protocol{protocolList.length !== 1 ? 's' : ''}
          </span>
        </button>

        <p className="text-center text-[10px] text-white/30">
          One upload. Everywhere. Your short will be cross-posted instantly.
        </p>
      </form>
    );
  }

  // == Uploading ==========================================================

  function renderUploading() {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/10">
          <svg
            aria-hidden="true"
            className="h-8 w-8 animate-spin text-degen-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path
              d="M12 2a10 10 0 019.95 9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-white">Processing video…</h3>
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Uploading to storage</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // == Publishing =========================================================

  function renderPublishing() {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/10">
            <svg
              aria-hidden="true"
              className="h-5 w-5 animate-spin text-degen-400"
              viewBox="0 0 24 24"
              fill="none"
            >
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
              Your short is being distributed to all selected protocols
            </p>
          </div>
        </div>

        <PublishProgress
          results={publishResults}
          pending={publishPending}
          totalProtocols={selectedProtocols.size + 1}
          reachEstimate={totalReach}
        />
      </div>
    );
  }

  // == Done ===============================================================

  function renderDone() {
    const allResults = { ...publishResults };
    // Ensure degenfeed is shown even if not in selected protocols
    if (!allResults.degenfeed && degenfeedUrl) {
      allResults.degenfeed = { ok: true, url: degenfeedUrl, protocol: 'degenfeed' };
    }

    const successCount = Object.values(allResults).filter((r) => r.ok).length;
    const totalCount = Object.keys(allResults).length;
    const reachDisplay =
      totalReach > 0
        ? `~${totalReach >= 1_000_000 ? `${(totalReach / 1_000_000).toFixed(1)}M` : `${(totalReach / 1_000).toFixed(0)}K`}`
        : '';

    return (
      <div className="flex flex-col gap-4 py-2">
        {/* Confetti-style header */}
        <div className="flex flex-col items-center gap-2 py-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-degen-500/15">
            <span className="text-2xl">🎉</span>
          </div>
          <h3 className="text-base font-bold text-white">Published!</h3>
          <p className="text-center text-xs text-white/50">
            Your short is now visible to{' '}
            <span className="font-semibold text-degen-400">{reachDisplay} potential viewers</span>{' '}
            across{' '}
            <span className="font-semibold text-white/80">
              {successCount} platform{successCount !== 1 ? 's' : ''}
            </span>
          </p>
        </div>

        {/* Protocol results */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <PublishProgress results={allResults} pending={[]} totalProtocols={totalCount} />
        </div>

        {/* == Share section == */}
        {publishId && (
          <div>
            <p className="mb-2 text-xs font-medium text-white/60">Share your short</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(allResults)
                .filter(([_, r]) => r.ok)
                .map(([protocol]) => {
                  const meta = PROTOCOL_META[protocol as ShortProtocol];
                  if (!meta) return null;
                  const shareUrl = buildShareUrl(protocol as ShortProtocol, publishId, title);
                  return (
                    <a
                      key={protocol}
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      Share on {meta.shortLabel}
                    </a>
                  );
                })}

              {/* DegenFeed direct link */}
              {degenfeedUrl && (
                <a
                  href={degenfeedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-degen-500/30 bg-degen-500/10 px-2.5 py-1 text-[11px] font-medium text-degen-400 transition-all hover:bg-degen-500/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on DegenFeed
                </a>
              )}

              {/* Zora collect link */}
              {zoraUrl && (
                <a
                  href={zoraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 transition-all hover:bg-amber-500/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  Collect on Zora
                </a>
              )}

              {/* Tip link */}
              {tipLink && (
                <a
                  href={tipLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-400 transition-all hover:bg-purple-500/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  ⚡ Tip this short
                </a>
              )}
            </div>
          </div>
        )}

        {/* Errors summary */}
        {Object.values(publishResults).some((r) => !r.ok) && (
          <div className="rounded-lg bg-red-500/5 px-3 py-2">
            <p className="text-[10px] font-medium text-red-400/80">
              Some protocols failed to publish.{' '}
              {Object.entries(publishResults)
                .filter(([_, r]) => !r.ok)
                .map(([protocol]) => PROTOCOL_META[protocol as ShortProtocol]?.label ?? protocol)
                .join(', ')}{' '}
              — you can retry later from your shorts dashboard.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              resetForm();
            }}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Create Another
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
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

  // == Error ==============================================================

  function renderError() {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-red-400"
          >
            <path
              d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-red-400">Publish Failed</h3>
          <p className="mt-1 text-xs text-white/50">{error || 'Something went wrong.'}</p>
        </div>

        {/* Show partial results if any */}
        {Object.keys(publishResults).length > 0 && (
          <div className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <PublishProgress results={publishResults} pending={[]} />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStage('form')}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg bg-degen-500 px-5 py-2 text-xs font-bold text-black"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // === Main Render =======================================================

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (stage === 'form') {
            resetForm();
            onClose();
          } else {
            onClose();
          }
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create short video"
    >
      <div
        className={`mx-4 w-full ${
          stage === 'publishing' || stage === 'done' ? 'max-w-md' : 'max-w-lg'
        } rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {stage === 'form' && 'Create Short'}
            {stage === 'uploading' && 'Processing'}
            {stage === 'publishing' && 'Publishing'}
            {stage === 'done' && '🎉 Published!'}
            {stage === 'error' && 'Publish Failed'}
          </h2>
          {stage !== 'done' && (
            <button
              type="button"
              onClick={() => {
                if (stage === 'form' || stage === 'error') {
                  resetForm();
                }
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

        {renderContent()}
      </div>
    </div>
  );
}
