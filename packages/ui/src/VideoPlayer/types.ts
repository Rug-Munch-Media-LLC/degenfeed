// ─── Types ───────────────────────────────────────────────────────────────

export type VideoPlatform = 'direct' | 'youtube' | 'peertube';
export type AspectRatio = '16:9' | '9:16' | 'auto';

export interface QualityLevel {
  label: string;
  height: number;
  src: string;
}

export interface VideoPlayerProps {
  /** Direct video source URL (.mp4, .webm) */
  src?: string;
  /** Poster / thumbnail image URL */
  poster?: string;
  /** Video title for metadata and a11y */
  title?: string;
  /** Platform/origin of the video — controls rendering strategy */
  platform?: VideoPlatform;
  /** Aspect ratio container. 'auto' uses the video's intrinsic ratio */
  aspectRatio?: AspectRatio;
  /** Additional className */
  className?: string;

  // ── Multi-quality sources ──
  /** Multiple quality levels. If provided, a quality selector appears. */
  qualities?: QualityLevel[];

  // ── YouTube-specific ──
  /** YouTube video ID (extracted from URL) */
  youtubeId?: string;

  // ── PeerTube-specific ──
  /** PeerTube instance domain (e.g. video.degenfeed.xyz) */
  peertubeInstance?: string;
  /** PeerTube video UUID */
  peertubeUuid?: string;

  // ── Short-form / vertical video navigation (TikTok-style) ──
  /** Called when user swipes up for next video */
  onSwipeUp?: () => void;
  /** Called when user swipes down for previous video */
  onSwipeDown?: () => void;

  // ── Lifecycle callbacks ──
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;

  // ── Autoplay / queue ──
  /** Called when the autoplay countdown ends (for next video) */
  onAutoPlayNext?: () => void;
  /** Whether there are more videos in the queue */
  hasNext?: boolean;

  // ── Mini player ──
  /** Enable mini-player mode (floating PiP-style in corner) */
  miniPlayer?: boolean;
  /** Called when user closes the mini player */
  onMiniPlayerClose?: () => void;

  // ── Metadata display ──
  showMetadata?: boolean;
  channelName?: string;
  views?: number;
  likes?: number;
}
