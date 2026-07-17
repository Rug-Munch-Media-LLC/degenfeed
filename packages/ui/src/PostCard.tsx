import {
  addBlockedUser,
  addBookmark,
  deleteFollow,
  getMutedIdentities,
  isFollowing,
  muteIdentity,
  removeBlockedUser,
  removeBookmark,
  saveFollow,
  unmuteIdentity,
} from '@degenfeed/storage';
import type { Embed, EngagementAction, UnifiedPost } from '@degenfeed/types';
import {
  detectTokens,
  detectVideoFromEmbeds,
  formatTimeAgo,
  isShortFormVideo,
  parseVideoUrl,
  type VideoInfo,
} from '@degenfeed/utils';
import type { ContentProof } from '@degenfeed/types';
import Image from 'next/image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Schedule low-priority work during idle periods.
 * Falls back to setTimeout if requestIdleCallback is unavailable (SSR, older browsers).
 */
const scheduleIdle =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn: () => void) => setTimeout(fn, 1);
import { BlueskyPostContext } from './BlueskyPostContext';
import { EmbedModal } from './EmbedModal';
import { FrameEmbed } from './FrameEmbed';
import { IdentityBadge } from './IdentityBadge';
import { LemmyThreadView } from './LemmyThreadView';
import { LensPublicationBadge } from './LensPublicationBadge';
import { MastodonInstanceContext } from './MastodonInstanceContext';
import { NostrRelayBadge } from './NostrRelayBadge';
import { PeerTubeEmbed } from './PeerTubeEmbed';
import {
  getProtocolIcon as _getProtocolIcon,
  getProtocolLabel as _getProtocolLabel,
  ProtocolBadge,
} from './ProtocolBadge';
import { QuickTipButton } from './QuickTipButton';
import { ReputationBadge, type ReputationBadgeScore, type ReputationBadgeProgress } from './ReputationBadge';
import { ReportModal } from './ReportModal';
import { TokenChart } from './TokenChart';
import { TranslationPreview } from './TranslationPreview';
import { VideoPlayer } from './VideoPlayer';

interface FrameData {
  url: string;
  image: string;
  title?: string;
  buttons: Array<{ index: number; label: string; action?: string; target?: string }>;
  postUrl?: string;
  version: string;
}

function FrameCard({ url }: { url: string }) {
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [_loading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/frame/resolve?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FrameData>) : null))
      .then((d) => {
        if (!cancelled && d?.image) setFrame(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!frame) return null;

  return (
    <FrameEmbed
      url={frame.url}
      image={frame.image}
      title={frame.title}
      buttons={frame.buttons}
      postUrl={frame.postUrl}
    />
  );
}

export type { ReportModalProps } from './ReportModal';
export type { UnifiedPost };

export interface EngageResult {
  ok: boolean;
  error?: string;
}

export type EngageHandler = (
  action: EngagementAction,
  postId: string,
  content?: string,
) => Promise<EngageResult> | EngageResult;

export interface PostCardProps {
  post: UnifiedPost;
  onEngage?: EngageHandler;
  onClick?: (postId: string) => void;
  expanded?: boolean;
  onTip?: (post: UnifiedPost) => void;
  onPaywall?: (post: UnifiedPost) => void;
  /** Connected protocols for the current viewer — used to derive default tip currency */
  viewerProtocols?: string[];
  /** Called when a report is successfully submitted */
  onReport?: (postId: string) => void;
  /**
   * Cross-protocol identity badges to show for the post author.
   * Each entry is a protocol key (nostr, farcaster, lens, bluesky, mastodon, reddit).
   * These are the OTHER protocols the author has linked to their wallet.
   */
  crossProtocolBadges?: string[];
  /**
   * Called when the user wants to publish translated content to another protocol.
   * Opens ComposeModal with the translated content pre-filled for the target protocol.
   */
  onTranslatePublish?: (content: string, targetProtocol: string) => void;
  /**
   * Called when the user wants to reply to this post from another protocol.
   * Opens ComposeModal in cross-protocol reply mode.
   */
  onCrossReplyOpen?: (post: UnifiedPost) => void;
  /**
   * If true, the viewer is an admin and sees moderation actions
   * (Remove post, Ban user) in the three-dot menu.
   */
  isAdmin?: boolean;
  /**
   * Called when an admin removes this post. The API call removes it
   * from the feed for all users.
   */
  onAdminRemove?: (postId: string) => void;
  /**
   * Called when an admin bans the post author. Passes the userId
   * and protocol for cross-protocol enforcement.
   */
  onAdminBan?: (userId: string, protocol: string, handle?: string) => void;
  /**
   * Optional reputation score for the post author.
   * When provided, shows a reputation badge next to the display name.
   */
  reputation?: ReputationBadgeScore | null;
  /**
   * Optional progress data for the reputation level progress bar (shown in tooltip).
   */
  reputationProgress?: ReputationBadgeProgress | null;
}

const MAX_TEXT_LENGTH = 500;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function buildScoreTooltip(score: NonNullable<UnifiedPost['score']>): string {
  const lines = [
    `Score: ${score.total.toFixed(2)}`,
    `  recency: ${score.recency.toFixed(2)}`,
    `  engagement: ${score.engagement.toFixed(2)}`,
    `  relevance: ${score.relevance.toFixed(2)}`,
    `  quality: ${score.quality.toFixed(2)}`,
    `  source: ${score.source.toFixed(2)}`,
    `  velocity: ${score.velocity.toFixed(2)}`,
  ];
  if (score.reasons.length > 0) {
    lines.push(`Signals: ${score.reasons.join(', ')}`);
  }
  return lines.join('\n');
}

function LinkPreview({ embed }: { embed: Embed }) {
  const meta = embed.meta as { title?: string; description?: string; image?: string } | undefined;
  const title = meta?.title;
  const description = meta?.description;
  const image = meta?.image;
  const host = embed.url ? embed.url.replace(/^https?:\/\//, '').split('/')[0] : '';

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview group mt-2 block overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:bg-[var(--color-muted)]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {image && (
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={image}
            alt={title || ''}
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className="p-3">
        {host && <p className="mb-1 text-[11px] text-gray-500 uppercase tracking-wide">{host}</p>}
        {title && (
          <p className="link-title mb-1 text-sm font-semibold text-[var(--color-fg)] line-clamp-1">{title}</p>
        )}
        {description && <p className="link-desc text-xs text-gray-400 line-clamp-2">{description}</p>}
        {!title && !description && (
          <p className="truncate text-xs text-degen-500">{embed.url.replace(/^https?:\/\//, '')}</p>
        )}
      </div>
    </a>
  );
}

/**
 * Renders a video embed based on the detected video type.
 * YouTube → VideoPlayer with YouTube embed
 * Direct (.mp4/.webm) → VideoPlayer with native video
 * PeerTube handled separately via PeerTubeEmbed component
 */
function VideoEmbedCard({ videoInfo }: { videoInfo: VideoInfo }) {
  const isShort = isShortFormVideo(videoInfo);

  if (videoInfo.platform === 'youtube') {
    return (
      <div className={isShort ? 'max-w-[360px] mx-auto' : ''}>
        <VideoPlayer
          youtubeId={videoInfo.id}
          platform="youtube"
          aspectRatio={isShort ? '9:16' : '16:9'}
          className="mt-2"
        />
      </div>
    );
  }

  // Direct .mp4 / .webm video
  return (
    <VideoPlayer
      src={videoInfo.url}
      platform="direct"
      aspectRatio={isShort ? '9:16' : '16:9'}
      className="mt-2"
    />
  );
}

function ImageGrid({ images }: { images: string[] }) {
  if (images.length === 1) {
    return (
              <div className="image-grid mt-2 max-h-80 overflow-hidden rounded-xl">
        <Image
          src={images[0]!}
          alt=""
          width={200}
          height={200}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  if (images.length === 2) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
        {images.map((url) => (
          <Image
            key={url}
            src={url}
            alt=""
            width={200}
            height={200}
            className="aspect-square w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
      {images.slice(0, 4).map((url, idx) => (
        <div key={url} className="relative aspect-square">
          <Image
            src={url}
            alt=""
            width={200}
            height={200}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {idx === 3 && images.length > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-[var(--color-fg)]">
              +{images.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface LocalState {
  engagement: UnifiedPost['engagement'];
  metrics: UnifiedPost['metrics'];
}

function applyOptimistic(state: LocalState, action: EngagementAction): LocalState {
  const { engagement, metrics } = state;
  switch (action) {
    case 'like':
      return {
        engagement: { ...engagement, viewerLiked: true },
        metrics: { ...metrics, likes: metrics.likes + 1 },
      };
    case 'unlike':
      return {
        engagement: { ...engagement, viewerLiked: false },
        metrics: { ...metrics, likes: Math.max(0, metrics.likes - 1) },
      };
    case 'repost':
      return {
        engagement: { ...engagement, viewerReposted: true },
        metrics: { ...metrics, reposts: metrics.reposts + 1 },
      };
    case 'unrepost':
      return {
        engagement: { ...engagement, viewerReposted: false },
        metrics: { ...metrics, reposts: Math.max(0, metrics.reposts - 1) },
      };
    case 'bookmark':
      return {
        engagement: { ...engagement, viewerBookmarked: true },
        metrics,
      };
    case 'unbookmark':
      return {
        engagement: { ...engagement, viewerBookmarked: false },
        metrics,
      };
    case 'reply':
      return {
        engagement,
        metrics: { ...metrics, replies: metrics.replies + 1 },
      };
    case 'react':
      return { engagement, metrics };
    default:
      return state;
  }
}

// ─── Permanence Badge Component ─────────────────────────────────

function PermanenceBadge({ proof }: { proof: ContentProof }) {
  const tooltipParts: string[] = [];
  if (proof.arweaveTxId) {
    tooltipParts.push(`Arweave: ${proof.arweaveTxId.slice(0, 8)}...${proof.arweaveTxId.slice(-4)}`);
  }
  if (proof.ipfsCid) {
    tooltipParts.push(`IPFS: ${proof.ipfsCid.slice(0, 8)}...`);
  }
  if (proof.onChainTxHash) {
    const chainName = proof.onChainChainId === 8453 ? 'Base' : `Chain ${proof.onChainChainId}`;
    tooltipParts.push(
      `${chainName}: ${proof.onChainTxHash.slice(0, 8)}...${proof.onChainTxHash.slice(-4)}`,
    );
  }

  const tooltip = tooltipParts.length > 0
    ? `Stored permanently\n${tooltipParts.join('\n')}`
    : 'Stored permanently';

  return (
    <div className="mb-3 flex flex-wrap gap-2 items-center">
      {/* Arweave / IPFS permanent badge */}
      <a
        href={
          proof.arweaveTxId
            ? `https://arweave.net/${proof.arweaveTxId}`
            : proof.ipfsCid
              ? `https://ipfs.io/ipfs/${proof.ipfsCid}`
              : undefined
        }
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full bg-cyan-950/40 px-2 py-0.5 text-[10px] font-medium text-cyan-400 hover:bg-cyan-900/50 transition-colors"
        title={tooltip}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span>🔗</span> Permanent
      </a>

      {/* On-chain anchor badge */}
      {proof.onChainTxHash && (
        <a
          href={
            proof.onChainChainId === 8453
              ? `https://basescan.org/tx/${proof.onChainTxHash}`
              : proof.onChainChainId === 1
                ? `https://etherscan.io/tx/${proof.onChainTxHash}`
                : undefined
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-400 hover:bg-amber-900/50 transition-colors"
          title={`On-chain anchor on ${proof.onChainChainId === 8453 ? 'Base' : `Chain ${proof.onChainChainId}`}: ${proof.onChainTxHash.slice(0, 8)}...${proof.onChainTxHash.slice(-4)}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <span>🔒</span> On-chain
        </a>
      )}
    </div>
  );
}

export const PostCard = memo(function PostCard({
  post,
  onEngage,
  onClick,
  expanded,
  onTip,
  onPaywall,
  onReport,
  crossProtocolBadges,
  onTranslatePublish,
  onCrossReplyOpen,
  isAdmin,
  onAdminRemove,
  onAdminBan,
  reputation,
  reputationProgress,
}: PostCardProps) {
  const [showFullText, setShowFullText] = useState(expanded ?? false);
  const [localState, setLocalState] = useState<LocalState>({
    engagement: post.engagement,
    metrics: post.metrics,
  });
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [bridgeReplies, setBridgeReplies] = useState<Record<string, number> | null>(null);
  const [following, setFollowing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [animatingLike, setAnimatingLike] = useState(false);
  const [translateTarget, setTranslateTarget] = useState<string | null>(null);
  const [translationResult, setTranslationResult] = useState<{
    translated: string;
    truncated: boolean;
    originalLength: number;
    translatedLength: number;
    maxLength: number;
    strippedMarkdown: boolean;
    removedProtocolElements: string[];
  } | null>(null);
  const [translating, setTranslating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelf = post.author.id === 'self' || post.author.id.startsWith('self:');

  useEffect(() => {
    if (typeof window === 'undefined' || !post.author.id) return;
    let cancelled = false;
    Promise.all([
      isFollowing('self', post.author.id),
      getMutedIdentities('self').then((m) => m.some((x) => x.targetId === post.author.id)),
      import('@degenfeed/storage').then(({ isBlocked }) => isBlocked(post.author.id, 'self')),
    ])
      .then(([f, m, b]) => {
        if (!cancelled) {
          setFollowing(f);
          setMuted(m);
          setBlocked(b);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post.author.id]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showMenu]);

  useEffect(() => {
    setLocalState({ engagement: post.engagement, metrics: post.metrics });
  }, [post.engagement, post.metrics]);

  // Cross-protocol bridge reply counts — fetched lazily when the post is
  // being viewed (expanded) or the user opens the reply UI. Reads the
  // aggregate of `bridge:reply:{dfUri}:*` KV records via the status API.
  useEffect(() => {
    if (!post.dfUri || !(expanded || showReply)) return;
    let cancelled = false;
    scheduleIdle(() => {
      if (cancelled) return;
      fetch(`/api/cross-reply/status?parentPostUri=${encodeURIComponent(post.dfUri)}`)
        .then((r) =>
          r.ok ? (r.json() as Promise<{ total: number; byProtocol: Record<string, number> }>) : null,
        )
        .then((data) => {
          if (!cancelled && data && data.total > 0) setBridgeReplies(data.byProtocol);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [post.dfUri, expanded, showReply]);

  const needsTruncation = !expanded && post.text.length > MAX_TEXT_LENGTH;
  const displayText =
    needsTruncation && !showFullText ? `${post.text.slice(0, MAX_TEXT_LENGTH)}...` : post.text;

  async function perform(action: EngagementAction, content?: string) {
    if (!onEngage) return;
    const previous = localState;
    setLocalState((s) => applyOptimistic(s, action));
    if (action === 'like' || action === 'unlike') {
      setAnimatingLike(true);
      setTimeout(() => setAnimatingLike(false), 400);
    }
    const result = await onEngage(action, post.id, content);
    if (!result.ok) {
      setLocalState(previous);
    } else if (action === 'reply') {
      setReplyText('');
      setShowReply(false);
    } else if (action === 'bookmark') {
      // Sync to local storage + server KV
      try {
        await addBookmark(
          post.id,
          `df://${post.protocol}:${post.id.replace(/^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/, '')}`,
          post.protocol,
          post.text.slice(0, 120) || post.id,
          post.author.displayName || post.author.handles[post.protocol] || 'Unknown',
        );
      } catch {
        // offline — local state already updated
      }
    } else if (action === 'unbookmark') {
      try {
        await removeBookmark(post.id);
      } catch {
        // offline
      }
    }
  }

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const authorId = post.author.id;
    if (!authorId) return;
    const next = !following;
    setFollowing(next);
    try {
      if (next) {
        await saveFollow({
          identityId: 'self',
          targetId: authorId,
          targetProtocol: post.protocol,
          targetHandle: post.author.handles[post.protocol] ?? post.author.displayName,
          followedAt: Date.now(),
        });
      } else {
        await deleteFollow('self', authorId);
      }
    } catch {
      setFollowing(!next);
    }
  };

  const toggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const authorId = post.author.id;
    if (!authorId) return;
    const next = !muted;
    setMuted(next);
    try {
      if (next) {
        await muteIdentity(authorId, post.author.displayName, 'self');
      } else {
        await unmuteIdentity(authorId, 'self');
      }
    } catch {
      setMuted(!next);
    }
  };

  const handleBlock = useCallback(async () => {
    if (!post.author.id) return;
    setShowMenu(false);
    const next = !blocked;
    setBlocked(next);
    try {
      if (next) {
        await addBlockedUser(post.author.id, post.author.displayName, post.protocol, 'self');
      } else {
        await removeBlockedUser(post.author.id, 'self');
      }
    } catch {
      setBlocked(!next);
    }
  }, [blocked, post.author.id, post.author.displayName, post.protocol]);

  const handleMuteFromMenu = useCallback(async () => {
    setShowMenu(false);
    if (!post.author.id) return;
    const next = !muted;
    setMuted(next);
    try {
      if (next) {
        await muteIdentity(post.author.id, post.author.displayName, 'self');
      } else {
        await unmuteIdentity(post.author.id, 'self');
      }
    } catch {
      setMuted(!next);
    }
  }, [muted, post.author.id, post.author.displayName]);

  const handleReport = useCallback(() => {
    setShowMenu(false);
    setShowReportModal(true);
  }, []);

  const handleEmbed = useCallback(() => {
    setShowMenu(false);
    setShowEmbedModal(true);
  }, []);

  const handleFlagAsSpam = useCallback(async () => {
    setShowMenu(false);
    try {
      await fetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, reason: 'spam', protocol: post.protocol }),
      });
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'success', message: 'Post flagged as spam' },
        }),
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'error', message: 'Failed to flag post' },
        }),
      );
    }
  }, [post.id, post.protocol]);

  const handleAdminRemove = useCallback(() => {
    setShowMenu(false);
    onAdminRemove?.(post.id);
  }, [onAdminRemove, post.id]);

  const handleAdminBan = useCallback(() => {
    setShowMenu(false);
    onAdminBan?.(post.author.id, post.protocol, post.author.displayName);
  }, [onAdminBan, post.author.id, post.author.displayName, post.protocol]);

  const handleTranslate = useCallback(
    async (targetProtocol: string) => {
      setShowTranslateMenu(false);
      setShowMenu(false);
      setTranslating(true);
      setTranslateTarget(targetProtocol);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            content: post.text,
            fromProtocol: post.protocol,
            toProtocol: targetProtocol,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? 'Translation failed');
        }
        const data = (await res.json()) as {
          translated: string;
          truncated: boolean;
          originalLength: number;
          translatedLength: number;
          maxLength: number;
          strippedMarkdown: boolean;
          removedProtocolElements: string[];
        };
        setTranslationResult(data);
      } catch (e) {
        console.error('Translation error:', e);
        setTranslateTarget(null);
      } finally {
        setTranslating(false);
      }
    },
    [post.text, post.protocol],
  );

  const handlePostTranslated = useCallback(
    (content: string, targetProtocol: string) => {
      setTranslationResult(null);
      setTranslateTarget(null);
      if (onTranslatePublish) {
        onTranslatePublish(content, targetProtocol);
      } else {
        // Fallback: copy to clipboard
        void navigator.clipboard.writeText(content);
      }
    },
    [onTranslatePublish],
  );

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/post/${encodeURIComponent(post.dfUri || post.id)}`;
    const shareData: ShareData = {
      title: `Post by ${post.author.displayName}`,
      text: (post.text || '').substring(0, 100),
      url: shareUrl,
    };
    try {
      if (navigator.share && window.matchMedia('(max-width: 768px)').matches) {
        // Mobile: use native share sheet
        await navigator.share(shareData);
      } else {
        // Desktop: copy link to clipboard
        await navigator.clipboard.writeText(shareUrl);
        // Dispatch a custom event so the app's Toast listener can pick it up
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'success', message: 'Link copied to clipboard' },
          }),
        );
      }
    } catch {
      // User cancelled the share dialog — no action needed
    }
  }, [post.id, post.dfUri, post.author.displayName, post.text]);

  const handleReportSubmitted = useCallback(() => {
    onReport?.(post.id);
    setShowReportModal(false);
  }, [onReport, post.id]);

  return (
    <>
      <article
        className="post-card cursor-pointer border-b border-[var(--color-glass-border)] px-4 py-3 transition-colors hover:bg-white/[0.03] hover-lift press-effect"
        onClick={() => onClick?.(post.id)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onClick) {
            e.preventDefault();
            onClick(post.id);
          }
        }}
        aria-label={`Post by ${post.author.displayName}`}
        style={{ transitionDuration: 'var(--duration-fast)' }}
      >
        {/* Author row */}
        <div className="author-row mb-2 flex items-center gap-3">
          <Image
            src={
              post.author.avatarUrl ||
              'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23333%22/%3E%3Ctext x=%2216%22 y=%2222%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3E%40%3C/text%3E%3C/svg%3E'
            }
            alt={post.author.displayName}
            width={32}
            height={32}
            className="avatar h-8 w-8 rounded-full bg-[var(--color-muted)] object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="author-name truncate text-sm font-semibold text-[var(--color-fg)]">
                {post.author.displayName}
              </span>
              {post.protocol === 'nostr' && post.author.handles.nostr?.includes('@') && (
                <span className="flex-shrink-0 text-blue-400 text-xs" title="NIP-05 verified">
                  ✓
                </span>
              )}
              {/* ── Reputation badge ── */}
              {reputation && (
                <ReputationBadge
                  score={reputation}
                  progress={reputationProgress ?? null}
                  size="xs"
                  showIcon={true}
                  showLabel={true}
                  showTooltip={true}
                  showProgress={false}
                />
              )}
              <ProtocolBadge protocol={post.protocol} />

              {/* ── Cross-protocol identity badges ── */}
              {crossProtocolBadges && crossProtocolBadges.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-1">
                  {crossProtocolBadges.slice(0, 3).map((p) => (
                    <IdentityBadge key={p} protocol={p} size="xs" />
                  ))}
                  {crossProtocolBadges.length > 3 && (
                    <span className="flex items-center px-1 text-[10px] text-gray-500">
                      +{crossProtocolBadges.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* ── Three-dot menu ── */}
              {!isSelf && (
                <div ref={menuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu((v) => !v);
                    }}
                    className="rounded-lg p-1 text-gray-500 hover:bg-[var(--color-muted)] hover:text-gray-300 transition-colors"
                    aria-label="More actions"
                    aria-haspopup="true"
                    aria-expanded={showMenu}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </button>
                  {showMenu && (
                    <div
                      className="three-dot-menu absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-2xl"
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleEmbed}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-blue-400"
                        >
                          <path d="M4 2v12M12 2v12M2 4h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Embed post
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleFlagAsSpam}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-orange-400"
                        >
                          <path d="M4 2v12M4 2l8 3-8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Flag as spam
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleReport}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-yellow-500"
                        >
                          <path d="M8 1L16 15H0L8 1Z" fill="currentColor" opacity="0.8" />
                        </svg>
                        Report post
                      </button>

                      {/* ── Admin actions ── */}
                      {isAdmin && onAdminRemove && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleAdminRemove}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                            <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Remove post
                        </button>
                      )}
                      {isAdmin && onAdminBan && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleAdminBan}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="3.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M8 3v3M8 10v3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                          </svg>
                          Ban user
                        </button>
                      )}

                      {/* ── Translate ── */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTranslateMenu((v) => !v);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-blue-400"
                        >
                          <path
                            d="M2 2h6l1 2H3L2 2zm2 4h4l1 2H5l-1-2zm3 4h2l3 6H8l-1-2-1 2H4l3-6z"
                            fill="currentColor"
                          />
                          <path
                            d="M12 2l2 4-2 4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                        Translate to...
                      </button>

                      {showTranslateMenu && (
                        <div className="border-t border-[var(--color-border)]">
                          {(['nostr', 'farcaster', 'lens', 'mastodon', 'bluesky', 'lemmy'] as const)
                            .filter((p) => p !== post.protocol)
                            .map((protocol) => (
                              <button
                                key={protocol}
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleTranslate(protocol);
                                }}
                                disabled={translating}
                                className="flex w-full items-center gap-3 px-4 py-2 pl-8 text-left text-sm text-gray-400 hover:bg-[var(--color-muted)] hover:text-gray-200 transition-colors disabled:opacity-50"
                              >
                                {translating && translateTarget === protocol ? (
                                  <span className="text-[10px] animate-pulse">...</span>
                                ) : (
                                  <span className="text-[0.7em] opacity-60">
                                    {_getProtocolIcon(protocol)}
                                  </span>
                                )}
                                {_getProtocolLabel(protocol)}
                              </button>
                            ))}
                        </div>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleBlock}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-red-400"
                        >
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <line
                            x1="3.5"
                            y1="8"
                            x2="12.5"
                            y2="8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {blocked ? 'Unblock user' : 'Block user'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleMuteFromMenu}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-gray-400"
                        >
                          <path
                            d="M12 10a4 4 0 0 0 0-8M8 14a6 6 0 0 1-6-6M8 14a6 6 0 0 0 6-6M8 14V2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <line
                            x1="2"
                            y1="14"
                            x2="14"
                            y2="2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {muted ? 'Unmute user' : 'Mute user'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={toggleFollow}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  following
                    ? 'bg-degen-500/20 text-degen-400'
                    : 'border border-[var(--color-border)] text-gray-500 hover:border-degen-500/30 hover:text-degen-400'
                }`}
                aria-label={following ? 'Unfollow' : 'Follow'}
                title={following ? 'Unfollow' : 'Follow'}
              >
                {following ? '✓ Following' : '+ Follow'}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  muted
                    ? 'bg-red-500/20 text-red-400'
                    : 'border border-[var(--color-border)] text-gray-600 hover:border-red-500/30 hover:text-red-400'
                }`}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute author' : 'Mute author'}
              >
                {muted ? '🔇 Muted' : '🔇'}
              </button>
            </div>
            <div className="author-handle flex items-center gap-2 text-xs text-gray-500">
              <span className="truncate">
                {post.author.handles[post.protocol] ?? post.author.id.slice(0, 16)}
              </span>
              <span>·</span>
              <time
                dateTime={new Date(post.createdAt).toISOString()}
                title={new Date(post.createdAt).toLocaleString()}
              >
                {formatTimeAgo(post.createdAt)}
              </time>
              {post.score && (
                <>
                  <span>·</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-1.5 py-0.5 text-[10px] font-medium text-degen-400"
                    title={buildScoreTooltip(post.score)}
                  >
                    ★ {Math.round(post.score.total * 10) / 10}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {post.paywall && (
          <div className="mb-3 rounded-xl border border-purple-900/30 bg-purple-900/10 p-4 text-center">
            <div className="mb-2 text-2xl">🔒</div>
            <p className="mb-3 text-sm text-gray-400">This post is locked.</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPaywall?.(post);
              }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-[var(--color-fg)] hover:bg-purple-500 transition-colors"
            >
              Unlock for {post.paywall.amount} SOL
            </button>
          </div>
        )}
        <div className="content-text mb-3 text-sm text-gray-300 whitespace-pre-wrap break-words">
          {displayText}
          {needsTruncation && !showFullText && (
            <button
              type="button"
              className="ml-1 text-degen-500 hover:text-degen-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullText(true);
              }}
            >
              Show more
            </button>
          )}
        </div>

        {/* Inline token charts */}
        {post.text &&
          detectTokens(post.text).map((token, i) => (
            <TokenChart key={`${token.symbol ?? token.address}-${i}`} {...token} compact />
          ))}

        {/* Embeds */}
        {post.embeds.length > 0 && (
          <div className="mb-3">
            {(() => {
              const images = post.embeds.filter((e) => e.kind === 'image').map((e) => e.url);
              const links = post.embeds.filter((e) => e.kind === 'link');
              const videos = post.embeds.filter((e) => e.kind === 'video');
              const frames = post.embeds.filter((e) => e.kind === 'frame');
              return (
                <>
                  {images.length > 0 && <ImageGrid images={images} />}
                  {/* Explicit frame embeds (server-side tagged) */}
                  {frames.map((embed) => (
                    <FrameCard key={`frame-${embed.url}`} url={embed.url} />
                  ))}
                  {/* Fallback: farcaster links may contain frames — probe the first link */}
                  {frames.length === 0 &&
                    post.protocol === 'farcaster' &&
                    links.length > 0 &&
                    links[0]?.url && <FrameCard url={links[0].url} />}
                  {links.map((embed) => {
                    const linkVideoInfo = parseVideoUrl(embed.url);
                    // If a link is actually a video URL, render the native player
                    if (linkVideoInfo) {
                      return (
                        <VideoEmbedCard key={`link-video-${embed.url}`} videoInfo={linkVideoInfo} />
                      );
                    }
                    return <LinkPreview key={`link-${embed.url}`} embed={embed} />;
                  })}
                  {videos.map((embed) => {
                    const videoInfo = parseVideoUrl(embed.url);
                    if (!videoInfo) {
                      return (
                        <a
                          key={`video-${embed.url}`}
                          href={embed.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs text-degen-500 hover:text-degen-400 transition-colors truncate"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          ▶ {embed.url.replace(/^https?:\/\//, '').slice(0, 60)}
                        </a>
                      );
                    }
                    return <VideoEmbedCard key={`video-${embed.url}`} videoInfo={videoInfo} />;
                  })}
                </>
              );
            })()}
          </div>
        )}

        {post.niches.length > 0 && (
          <div className="niche-tags mb-3 flex flex-wrap gap-1">
            {post.niches.slice(0, 5).map((n) => (
              <span
                key={n}
                className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-medium text-gray-400"
              >
                {n}
              </span>
            ))}
          </div>
        )}

        {/* ── Permanence badge ── */}
        {post.contentProof && <PermanenceBadge proof={post.contentProof} />}

        {/* ── Protocol context ── */}
        {post.protocol === 'lemmy' && <LemmyThreadView post={post} />}
        {(post.protocol as string) === 'peertube' && (
          <PeerTubeEmbed
            url={
              post.embeds.find((e) => e.kind === 'video')?.url ??
              post.embeds.find((e) => e.kind === 'link')?.url ??
              ''
            }
            title={
              (post.raw as Record<string, unknown> | undefined)?.videoTitle as string | undefined
            }
            channelName={
              (post.raw as Record<string, unknown> | undefined)?.channelName as string | undefined
            }
          />
        )}
        {post.protocol === 'nostr' && (
          <NostrRelayBadge
            relays={((post.raw as Record<string, unknown> | undefined)?.relays as string[]) ?? []}
          />
        )}
        {post.protocol === 'mastodon' && (
          <MastodonInstanceContext
            instance={
              ((post.raw as Record<string, unknown> | undefined)?.instance as string) ??
              'mastodon.social'
            }
            federatedFrom={
              (post.raw as Record<string, unknown> | undefined)?.federatedFrom as string | undefined
            }
          />
        )}
        {post.protocol === 'lens' && <LensPublicationBadge post={post} />}
        {post.protocol === 'bluesky' && <BlueskyPostContext post={post} />}

        {/* Engagement metrics + Tip */}
        <div className="actions flex items-center gap-4 text-xs text-gray-500">
          <button
            type="button"
            className={`flex items-center gap-1 transition-colors hover:text-red-400 press-effect ${
              localState.engagement.viewerLiked ? 'text-red-400' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              void perform(localState.engagement.viewerLiked ? 'unlike' : 'like');
            }}
            aria-label={`${localState.metrics.likes} likes`}
          >
            <span
              className={`inline-block ${animatingLike ? 'animate-heart-pop' : ''}`}
              style={{
                transformOrigin: 'center',
                transition: 'transform var(--duration-fast) ease-out',
              }}
            >
              {localState.engagement.viewerLiked ? '❤' : '♡'}
            </span>{' '}
            {formatCount(localState.metrics.likes)}
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 transition-colors hover:text-green-400 ${localState.engagement.viewerReposted ? 'text-green-400' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              void perform(localState.engagement.viewerReposted ? 'unrepost' : 'repost');
            }}
            aria-label={`${localState.metrics.reposts} reposts`}
          >
            ↻ {formatCount(localState.metrics.reposts)}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              setShowReply((v) => !v);
            }}
            aria-label={`${localState.metrics.replies} replies`}
          >
            ↩ {formatCount(localState.metrics.replies)}
          </button>
          {onCrossReplyOpen && (
            <button
              type="button"
              className="flex items-center gap-1 transition-colors hover:text-purple-400"
              onClick={(e) => {
                e.stopPropagation();
                onCrossReplyOpen(post);
              }}
              aria-label="Reply from another protocol"
              title="Reply from another protocol via the DegenFeed bridge"
            >
              ⇄
            </button>
          )}
          <button
            type="button"
            className={`flex items-center gap-1 transition-colors hover:text-purple-400 ${localState.engagement.viewerBookmarked ? 'text-purple-400' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              void perform(localState.engagement.viewerBookmarked ? 'unbookmark' : 'bookmark');
            }}
            aria-label={localState.engagement.viewerBookmarked ? 'Bookmarked' : 'Bookmark'}
          >
            {localState.engagement.viewerBookmarked ? '🔖' : '📑'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-purple-400"
            onClick={(e) => {
              e.stopPropagation();
              void handleShare();
            }}
            aria-label="Share"
          >
            ↗ Share
          </button>
          {post.dfUri && (
            <button
              type="button"
              className="flex items-center gap-1 font-mono text-[10px] transition-colors hover:text-degen-400"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(post.dfUri as string);
              }}
              aria-label="Copy df:// URI"
              title={post.dfUri as string}
            >
              ⛓ df://
            </button>
          )}
          {onTip && (
            <QuickTipButton
              postId={post.id}
              authorAddress={post.author.keys.evmAddress || post.author.keys.solanaAddress}
              tipCount={post.tipCount}
              onOpenModal={() => onTip(post)}
            />
          )}
          {post.protocol === 'nostr' && post.metrics.quotes > 0 && onTip && (
            <button
              type="button"
              className="flex items-center gap-1 text-yellow-400 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onTip(post);
              }}
              title={`${post.metrics.quotes} zaps`}
            >
              ⚡{post.metrics.quotes}
            </button>
          )}
        </div>

        {bridgeReplies && Object.keys(bridgeReplies).length > 0 && (
          <p
            className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-300"
            title="Cross-protocol replies bridged via DegenFeed"
          >
            <span className="font-bold text-purple-400">⇄</span>
            Replies from:{' '}
            {Object.entries(bridgeReplies)
              .map(([protocol, count]) => `${_getProtocolLabel(protocol)} (${count})`)
              .join(', ')}
          </p>
        )}

        {showReply && (
          <form
            className="mt-3 flex gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!replyText.trim()) return;
              void perform('reply', replyText.trim());
            }}
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500 focus:outline-none"
              maxLength={1000}
            />
            <button type="submit" className="btn-primary text-xs">
              Reply
            </button>
          </form>
        )}
      </article>
      <EmbedModal
        open={showEmbedModal}
        onClose={() => setShowEmbedModal(false)}
        postId={post.id}
        postUri={post.dfUri}
        authorName={post.author.displayName || post.author.handles[post.protocol] || 'Unknown'}
        protocol={post.protocol}
        text={post.text}
      />
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
        onSubmitted={handleReportSubmitted}
      />

      {/* ── Translation preview overlay ── */}
      {translationResult && (
        <section
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => {
            setTranslationResult(null);
            setTranslateTarget(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setTranslationResult(null);
              setTranslateTarget(null);
            }
          }}
          aria-modal="true"
          aria-label="Translation preview"
          role="dialog"
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog panel needs stopPropagation to prevent backdrop close on inner clicks */}
          <div
            className="flex w-full max-w-xl flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh' }}
            role="none"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Translate Post</h2>
              <button
                type="button"
                onClick={() => {
                  setTranslationResult(null);
                  setTranslateTarget(null);
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
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
            <div className="flex-1 overflow-y-auto">
              <TranslationPreview
                originalContent={post.text}
                fromProtocol={post.protocol}
                translated={translationResult}
                toProtocol={translateTarget ?? ''}
                onPost={handlePostTranslated}
              />
            </div>
          </div>
        </section>
      )}
    </>
  );
});
