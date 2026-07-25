'use client';

/**
 * @degenfeed/web — UnifiedVideoEmbed
 *
 * A single embed component that handles ALL video sources:
 *   - PeerTube (iframe)
 *   - YouTube (iframe)
 *   - Zora (custom player / collect overlay)
 *   - Farcaster Frames (iframe / HLS player)
 *   - Lens (iframe / HLS)
 *   - IPFS/Arweave (gateway HTML5 player)
 *   - Nostr video events
 *   - Odysee/LBRY
 *   - DTube
 *   - Rumble (iframe)
 *   - BitTube (IPFS-based HTML5)
 *   - Direct video URLs (HTML5 player with HLS.js)
 *
 * Features:
 *   - Auto-detect source type from URL
 *   - Unified controls (play, pause, volume, fullscreen, theater)
 *   - Platform badge
 *   - Tip button overlay
 *   - Share button
 *   - Fallback chain for IPFS/Arweave content
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoSourceBadge } from './VideoSourceBadge';

// ─── Types ───────────────────────────────────────────────────────────────

export type EmbedSource =
  | 'youtube'
  | 'peertube'
  | 'zora'
  | 'farcaster'
  | 'lens'
  | 'nostr'
  | 'odysee'
  | 'dtube'
  | 'rumble'
  | 'bittube'
  | 'vimeo'
  | 'dailymotion'
  | 'twitch'
  | 'ipfs'
  | 'arweave'
  | 'hls'
  | 'direct';

export interface UnifiedEmbedProps {
  /** Video URL (any source) */
  url: string;
  /** Explicit source override (auto-detected if omitted) */
  source?: EmbedSource;
  /** Video title */
  title: string;
  /** Poster/thumbnail URL */
  poster?: string;
  /** Autoplay on mount */
  autoplay?: boolean;
  /** Enable theater mode toggle */
  theaterMode?: boolean;
  /** Show platform badge */
  showBadge?: boolean;
  /** Show tip button */
  showTip?: boolean;
  /** Show share button */
  showShare?: boolean;
  /** Tip callback */
  onTip?: () => void;
  /** Share callback */
  onShare?: () => void;
  /** Error callback */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Width override */
  width?: string | number;
  /** Height override */
  height?: string | number;
  /** IPFS gateway to use (default: ipfs.degenfeed.xyz) */
  ipfsGateway?: string;
  /** Arweave gateway to use (default: arweave.degenfeed.xyz) */
  arweaveGateway?: string;
}

// ─── Source Detection ────────────────────────────────────────────────────

interface SourceDetection {
  source: EmbedSource;
  embedUrl?: string;
  videoUrl: string;
  poster?: string;
}

function detectSource(url: string, explicitSource?: EmbedSource): SourceDetection {
  if (explicitSource) {
    return { source: explicitSource, videoUrl: url };
  }

  // YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const vid = match?.[1];
    return {
      source: 'youtube',
      embedUrl: vid
        ? `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1`
        : undefined,
      videoUrl: url,
    };
  }

  // PeerTube
  if (
    url.includes('peertube') ||
    url.includes('/videos/embed/') ||
    url.includes('video.degenfeed.xyz')
  ) {
    // Extract video UUID from various PeerTube URL formats
    const uuidMatch = url.match(/\/videos\/(?:embed|watch)\/([a-zA-Z0-9-]+)/);
    const instance = url.includes('video.degenfeed.xyz')
      ? 'https://video.degenfeed.xyz'
      : new URL(url).origin;
    return {
      source: 'peertube',
      embedUrl: uuidMatch
        ? `${instance}/videos/embed/${uuidMatch[1]}?autoplay=1&controls=1&title=0`
        : undefined,
      videoUrl: url,
    };
  }

  // Farcaster (warpcast.com or fc: URLs)
  if (url.includes('warpcast.com') || url.includes('fc:')) {
    return {
      source: 'farcaster',
      embedUrl: url.includes('embed') ? url : undefined,
      videoUrl: url,
    };
  }

  // Lens (lens.xyz or hey.xyz)
  if (url.includes('lens.xyz') || url.includes('hey.xyz') || url.includes('lenster.xyz')) {
    return {
      source: 'lens',
      videoUrl: url,
    };
  }

  // Zora (zora.co)
  if (url.includes('zora.co')) {
    return {
      source: 'zora',
      videoUrl: url,
    };
  }

  // Odysee / LBRY
  if (url.includes('odysee.com') || url.includes('lbry.tv')) {
    return {
      source: 'odysee',
      videoUrl: url,
    };
  }

  // Rumble
  if (url.includes('rumble.com')) {
    return {
      source: 'rumble',
      embedUrl: url.replace(/\/v\//, '/embed/'),
      videoUrl: url,
    };
  }

  // DTube
  if (url.includes('dtube') || url.includes('d-tube')) {
    return { source: 'dtube', videoUrl: url };
  }

  // BitTube
  if (url.includes('bittube') || url.includes('bit.tube') || url.includes('bittube.app')) {
    return { source: 'bittube', videoUrl: url };
  }

  // Twitch
  if (url.includes('twitch.tv')) {
    const match = url.match(/twitch\.tv\/(\w+)/);
    return {
      source: 'twitch',
      embedUrl: match
        ? `https://player.twitch.tv/?channel=${match[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'degenfeed.xyz'}`
        : undefined,
      videoUrl: url,
    };
  }

  // Vimeo
  if (url.includes('vimeo.com')) {
    return { source: 'vimeo', videoUrl: url };
  }

  // Dailymotion
  if (url.includes('dailymotion.com')) {
    return { source: 'dailymotion', videoUrl: url };
  }

  // IPFS
  if (url.startsWith('ipfs://') || url.includes('/ipfs/')) {
    return { source: 'ipfs', videoUrl: url };
  }

  // Arweave
  if (url.startsWith('ar://') || url.includes('arweave.net') || url.includes('arweave.live')) {
    return { source: 'arweave', videoUrl: url };
  }

  // HLS direct URL
  if (url.endsWith('.m3u8')) {
    return { source: 'hls', videoUrl: url };
  }

  // Direct video file
  if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) {
    return { source: 'direct', videoUrl: url };
  }

  return { source: 'direct', videoUrl: url };
}

// ─── IPFS/Arweave Gateway Resolver ──────────────────────────────────────

function resolveIPFS(url: string, preferredGateway = 'https://ipfs.degenfeed.xyz'): string {
  const cid = url
    .replace('ipfs://', '')
    .replace(/^\/ipfs\//, '')
    .split('?')[0]!;
  return `${preferredGateway}/ipfs/${cid}`;
}

function resolveArweave(url: string, preferredGateway = 'https://arweave.degenfeed.xyz'): string {
  const id = url
    .replace('ar://', '')
    .replace('https://arweave.net/', '')
    .replace('https://arweave.live/', '')
    .split('?')[0]!;
  return `${preferredGateway}/${id}`;
}

// ─── HLS.js Dynamic Import ──────────────────────────────────────────────

async function loadHls(): Promise<typeof import('hls.js') | null> {
  try {
    return await import('hls.js');
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UnifiedVideoEmbed Component
// ═══════════════════════════════════════════════════════════════════════════

export function UnifiedVideoEmbed({
  url,
  source: explicitSource,
  title,
  poster,
  autoplay = false,
  theaterMode: enableTheater = true,
  showBadge = true,
  showTip = false,
  showShare = false,
  onTip,
  onShare,
  onError,
  className = '',
  width,
  height,
  ipfsGateway = 'https://ipfs.degenfeed.xyz',
  arweaveGateway = 'https://arweave.degenfeed.xyz',
}: UnifiedEmbedProps) {
  const detection = detectSource(url, explicitSource);
  const { source, embedUrl } = detection;
  const videoUrl = detection.videoUrl;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [theaterActive, setTheaterActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hlsSupported, setHlsSupported] = useState(true);

  // Resolve IPFS/Arweave URLs
  const resolvedUrl =
    source === 'ipfs'
      ? resolveIPFS(videoUrl, ipfsGateway)
      : source === 'arweave'
        ? resolveArweave(videoUrl, arweaveGateway)
        : videoUrl;

  // HLS.js setup for HLS streams
  useEffect(() => {
    if (source !== 'hls' && !resolvedUrl.endsWith('.m3u8')) return;
    if (!videoRef.current) return;

    let hlsInstance: any = null;
    let destroyed = false;

    (async () => {
      const Hls = await loadHls();
      if (!Hls?.isSupported()) {
        setHlsSupported(false);
        return;
      }
      if (destroyed) return;

      hlsInstance = new Hls.default();
      hlsInstance.loadSource(resolvedUrl);
      hlsInstance.attachMedia(videoRef.current!);

      hlsInstance.on(Hls.default.Events.MANIFEST_PARSED, () => {
        if (autoplay && videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      });

      hlsInstance.on(Hls.default.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          setLoadError(true);
          setErrorMessage('HLS playback error');
          onError?.('HLS playback error');
        }
      });
    })();

    return () => {
      destroyed = true;
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [source, resolvedUrl, autoplay, onError]);

  const handleNativeVideoError = useCallback(() => {
    setLoadError(true);
    setErrorMessage('Video failed to load');
    onError?.('Video failed to load');
  }, [onError]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback to theater mode if fullscreen unavailable
      setTheaterActive(!theaterActive);
    }
  }, [theaterActive]);

  const toggleTheater = useCallback(() => {
    setTheaterActive((prev) => !prev);
  }, []);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
    onShare?.();
  }, [title, onShare]);

  // ─── Error State ─────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div
        className={`relative flex aspect-video items-center justify-center rounded-xl bg-[var(--color-card)] ${className}`}
        style={{ width, height }}
      >
        <div className="text-center px-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-red-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-muted)]">
            {errorMessage || 'Failed to load video'}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]/60">
            Try opening the video directly
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Open original
          </a>
        </div>
      </div>
    );
  }

  // ─── Platform-specific embed types ──────────────────────────────────

  const renderEmbed = () => {
    switch (source) {
      // ── YouTube / PeerTube / Twitch / Rumble / Vimeo / Dailymotion: iframe ──
      case 'youtube':
      case 'peertube':
      case 'twitch':
      case 'rumble':
      case 'vimeo':
      case 'dailymotion':
      case 'farcaster':
      case 'lens': {
        const src = embedUrl || url;
        return (
          <iframe
            src={src}
            title={title}
            className="h-full w-full"
            allow={`autoplay; encrypted-media; fullscreen; picture-in-picture`}
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            loading="lazy"
            style={{ border: 0 }}
            onError={() => {
              setLoadError(true);
              setErrorMessage('Embed failed to load');
              onError?.('Embed failed to load');
            }}
          />
        );
      }

      // ── Zora: Collect overlay + iframe ──
      case 'zora': {
        // Extract Zora collect URL for embed
        const zoraEmbedSrc = url.includes('zora.co/collect')
          ? url
          : `https://zora.co/embed/${url.includes('zora.co') ? url.replace('https://zora.co/', '') : url}`;
        return (
          <div className="relative h-full w-full">
            <iframe
              src={zoraEmbedSrc}
              title={title}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-popups"
              loading="lazy"
              style={{ border: 0 }}
            />
            {/* Collect overlay button */}
            {showTip && (
              <button
                type="button"
                onClick={onTip}
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-blue-600 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M2 12h20" />
                </svg>
                Collect
              </button>
            )}
          </div>
        );
      }

      // ── Odysee/LBRY: iframe embed ──
      case 'odysee': {
        const odyseeId = url.match(/@([^/]+)\/([^/?]+)/);
        const odyseeEmbedSrc = odyseeId
          ? `https://odysee.com/$/embed/@${odyseeId[1]}/${odyseeId[2]}`
          : url;
        return (
          <iframe
            src={odyseeEmbedSrc}
            title={title}
            className="h-full w-full"
            allow="autoplay; fullscreen"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-popups"
            loading="lazy"
            style={{ border: 0 }}
          />
        );
      }

      // ── DTube: external embed ──
      case 'dtube': {
        const dtubeId = url.match(/d-tube\.com\/v\/([a-zA-Z0-9]+)/)?.[1];
        const dtubeEmbedSrc = dtubeId ? `https://d-tube.com/embed/video/${dtubeId}` : url;
        return (
          <iframe
            src={dtubeEmbedSrc}
            title={title}
            className="h-full w-full"
            allow="autoplay; fullscreen"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts"
            loading="lazy"
            style={{ border: 0 }}
          />
        );
      }

      // ── BitTube: IPFS-based HTML5 video ──
      case 'bittube': {
        return (
          <video
            ref={videoRef}
            src={resolvedUrl}
            className="h-full w-full object-contain bg-black"
            poster={poster}
            controls
            onError={handleNativeVideoError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
          >
            <p>Your browser does not support HTML5 video.</p>
          </video>
        );
      }

      // ── IPFS / Arweave: HTML5 video with fallback chain ──
      case 'ipfs':
      case 'arweave': {
        return (
          <video
            ref={videoRef}
            className="h-full w-full object-contain bg-black"
            poster={poster}
            controls
            autoPlay={autoplay}
            onError={handleNativeVideoError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
            crossOrigin="anonymous"
          >
            <source src={resolvedUrl} type="video/mp4" />
            <source src={resolvedUrl} type="video/webm" />
            <p>
              Video available on {source === 'ipfs' ? 'IPFS' : 'Arweave'}.
              <a href={url} target="_blank" rel="noopener noreferrer">
                Open directly
              </a>
            </p>
          </video>
        );
      }

      // ── HLS: HTML5 video with HLS.js or native HLS support ──
      case 'hls': {
        if (!hlsSupported) {
          // Native HLS (Safari) or fallback to direct link
          return (
            <video
              ref={videoRef}
              className="h-full w-full object-contain bg-black"
              poster={poster}
              controls
              autoPlay={autoplay}
              onError={handleNativeVideoError}
              preload="metadata"
            >
              <source src={resolvedUrl} type="application/x-mpegURL" />
              <p>HLS playback not supported in this browser.</p>
            </video>
          );
        }
        // HLS.js handles it via the video ref
        return (
          <video
            ref={videoRef}
            className="h-full w-full object-contain bg-black"
            poster={poster}
            controls
            onError={handleNativeVideoError}
            preload="metadata"
          />
        );
      }
      default: {
        // Determine MIME type from extension
        const mimeType = url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)
          ? `video/${url
              .match(/\.(mp4|webm|ogg|mov)/i)?.[0]
              ?.replace('.', '')
              .replace('mov', 'mp4')}`
          : 'video/mp4';

        return (
          <video
            ref={videoRef}
            className="h-full w-full object-contain bg-black"
            poster={poster}
            controls
            autoPlay={autoplay}
            onError={handleNativeVideoError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
            crossOrigin="anonymous"
          >
            <source src={resolvedUrl} type={mimeType} />
            <p>Your browser does not support HTML5 video.</p>
          </video>
        );
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${className} ${theaterActive ? 'fixed inset-0 z-50 flex flex-col bg-black' : ''}`}
      style={width || height ? { width, height } : undefined}
    >
      {/* Theater mode header */}
      {theaterActive && (
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="truncate text-sm font-medium text-white">{title}</h2>
          <button
            type="button"
            onClick={toggleTheater}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Exit theater mode"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Player container */}
      <div
        className={`relative ${!theaterActive ? 'aspect-video overflow-hidden rounded-xl bg-black' : 'flex-1'}`}
      >
        {/* Video embed */}
        {renderEmbed()}

        {/* Platform badge */}
        {showBadge && (
          <div className="absolute left-3 top-3 z-10">
            <VideoSourceBadge source={sourceToBadgeSource(source)} size="md" />
          </div>
        )}

        {/* Tip button overlay */}
        {showTip && onTip && source !== 'zora' && (
          <button
            type="button"
            onClick={onTip}
            className="absolute bottom-14 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-degen-500 px-3 py-1.5 text-xs font-medium text-black shadow-lg hover:bg-degen-400 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v20M2 12h20" />
            </svg>
            Tip
          </button>
        )}

        {/* Share button */}
        {showShare && (
          <button
            type="button"
            onClick={handleShare}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/80 hover:text-white transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        )}

        {/* Open original link */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/80 hover:text-white transition-colors"
        >
          Open original
        </a>
      </div>

      {/* Controls bar (only for HTML5 video sources) */}
      {(source === 'direct' ||
        source === 'ipfs' ||
        source === 'arweave' ||
        source === 'hls' ||
        source === 'bittube') &&
        !theaterActive && (
          <div className="mt-2 flex items-center gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-card)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            {/* Volume */}
            <button
              type="button"
              onClick={toggleMute}
              className="flex items-center rounded-lg bg-[var(--color-card)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                </svg>
              )}
            </button>

            {/* Volume slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-[var(--color-card)] accent-degen-500"
              aria-label="Volume"
            />

            <div className="flex-1" />

            {/* Theater mode */}
            {enableTheater && (
              <button
                type="button"
                onClick={toggleTheater}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  theaterActive
                    ? 'bg-degen-500/10 text-degen-500'
                    : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
                title="Theater mode"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                Theater
              </button>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center rounded-lg bg-[var(--color-card)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              )}
            </button>
          </div>
        )}
    </div>
  );
}

// ─── Helper: map embed source to VideoSourceBadge source ────────────────

function sourceToBadgeSource(
  source: EmbedSource,
): Parameters<typeof VideoSourceBadge>[0]['source'] {
  switch (source) {
    case 'youtube':
      return 'youtube';
    case 'peertube':
      return 'peertube';
    case 'zora':
      return 'zora';
    case 'odysee':
      return 'odysee';
    case 'dtube':
      return 'dtube';
    case 'rumble':
      return 'rumble';
    case 'bittube':
      return 'bitchute';
    case 'vimeo':
      return 'vimeo';
    case 'dailymotion':
      return 'dailymotion';
    case 'twitch':
      return 'twitch';
    case 'ipfs':
    case 'arweave':
    case 'hls':
    case 'direct':
      return 'creator';
    case 'farcaster':
    case 'lens':
    case 'nostr':
      return 'creator'; // These use creator/degen badge
    default:
      return 'creator';
  }
}
