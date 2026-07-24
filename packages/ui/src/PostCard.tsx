'use client';

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
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { detectTokens, formatTimeAgo, parseVideoUrl } from '@degenfeed/utils';
import Image from 'next/image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlueskyPostContext } from './BlueskyPostContext';
import { CommunityBadge } from './CommunityBadge';
import { EmbedModal } from './EmbedModal';
import { IdentityBadge } from './IdentityBadge';
import { LemmyThreadView } from './LemmyThreadView';
import { LensPublicationBadge } from './LensPublicationBadge';
import { MastodonInstanceContext } from './MastodonInstanceContext';

import { PeerTubeEmbed } from './PeerTubeEmbed';
import {
  applyOptimistic,
  PostCardEngagement,
  type PostCardEngagementProps,
} from './PostCardEngagement';
import {
  FrameCard,
  ImageGrid,
  LinkPreview,
  PermanenceBadge,
  VideoEmbedCard,
} from './PostCardMedia';
import {
  getProtocolIcon as _getProtocolIcon,
  getProtocolLabel as _getProtocolLabel,
  ProtocolBadge,
} from './ProtocolBadge';
import { ReportModal } from './ReportModal';
import {
  ReputationBadge,
  type ReputationBadgeProgress,
  type ReputationBadgeScore,
} from './ReputationBadge';
import { TokenChart } from './TokenChart';
import { TranslationPreview } from './TranslationPreview';

/**
 * Schedule low-priority work during idle periods.
 * Falls back to setTimeout if requestIdleCallback is unavailable (SSR, older browsers).
 */
const scheduleIdle =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn: () => void) => setTimeout(fn, 1);

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
   * Right-click / long-press context menu handler.
   */
  onContextMenu?: (e: React.MouseEvent, postId: string) => void;
  /**
   * Optional progress data for the reputation level progress bar (shown in tooltip).
   */
  reputationProgress?: ReputationBadgeProgress | null;
  /**
   * Called when user clicks "Show more like this" — boosts the post's topic.
   * The post's niches[0] is used as the topic to boost.
   */
  onShowMoreLikeThis?: (topic: string) => void;
  /**
   * Called when user clicks "Show less like this" — demotes the post's topic.
   * The post's niches[0] is used as the topic to demote.
   */
  onShowLessLikeThis?: (topic: string) => void;
  /**
   * Called when user clicks "Why am I seeing this?" in the three-dot menu.
   * Opens the FeedWhyCard transparency panel for this post.
   */
  onWhyThisPost?: (post: UnifiedPost) => void;
  /**
   * Called when user opens the enhanced share sheet from engagement bar.
   * Receives the post to share. When provided, overrides the default
   * native Web Share API behavior.
   */
  onOpenShareSheet?: (post: UnifiedPost) => void;
}

const MAX_TEXT_LENGTH = 500;

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

function buildQualityTooltip(quality: NonNullable<UnifiedPost['qualityScore']>): string {
  const lines = [`Protocol quality: ${quality.score}/${quality.max}`];
  if (quality.reasons.length > 0) {
    lines.push(`Signals: ${quality.reasons.join(', ')}`);
  }
  return lines.join('\n');
}

// ─── Local state type (shared with PostCardEngagement) ────────────

interface LocalState {
  engagement: UnifiedPost['engagement'];
  metrics: UnifiedPost['metrics'];
}

// ─── Main component ───────────────────────────────────────────────

function PostCardComponent({
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
  onOpenShareSheet,
  isAdmin,
  onAdminRemove,
  onAdminBan,
  reputation,
  reputationProgress,
  onShowMoreLikeThis,
  onShowLessLikeThis,
  onWhyThisPost,
  onContextMenu,
}: PostCardProps): React.ReactElement | null {
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
  const [communityMuted, setCommunityMuted] = useState(false);
  const [showMuteWordMenu, setShowMuteWordMenu] = useState(false);
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
  const raw: Record<string, unknown> | undefined = post.raw as Record<string, unknown> | undefined;
  const _relays: string[] = Array.isArray(raw?.relays) ? (raw.relays as string[]) : [];

  useEffect(() => {
    if (typeof window === 'undefined' || !post.author.id) return;
    let cancelled = false;
    const fmCommunityName = post.community?.name?.toLowerCase() ?? '';
    Promise.all([
      isFollowing('self', post.author.id),
      getMutedIdentities('self').then((m) => m.some((x) => x.targetId === post.author.id)),
      import('@degenfeed/storage').then(({ isBlocked }) => isBlocked(post.author.id, 'self')),
      post.community && fmCommunityName
        ? import('@degenfeed/storage').then(({ isCommunityMuted }) =>
            isCommunityMuted(fmCommunityName),
          )
        : Promise.resolve(false),
    ])
      .then(([f, m, b, cm]) => {
        if (!cancelled) {
          setFollowing(f);
          setMuted(m);
          setBlocked(b);
          setCommunityMuted(cm);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post.author.id, post.community]);

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
      if (!post.dfUri) return;
      fetch(`/api/cross-reply/status?parentPostUri=${encodeURIComponent(post.dfUri)}`)
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ total: number; byProtocol: Record<string, number> }>)
            : null,
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

  const perform = useCallback(
    async (action: EngagementAction, content?: string) => {
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
    },
    [
      onEngage,
      post.id,
      post.protocol,
      post.text,
      post.author.displayName,
      post.author.handles,
      localState,
    ],
  );

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

  const handleMuteCommunity = useCallback(async () => {
    setShowMenu(false);
    if (!post.community) return;
    const communityName = post.community.name;
    const next = !communityMuted;
    setCommunityMuted(next);
    try {
      const { muteCommunity, unmuteCommunity } = await import('@degenfeed/storage');
      if (next) {
        await muteCommunity(communityName.toLowerCase(), communityName, post.community.instance);
      } else {
        await unmuteCommunity(communityName.toLowerCase());
      }
    } catch {
      setCommunityMuted(!next);
    }
  }, [communityMuted, post.community]);

  const handleMuteWordFromMenu = useCallback(async (word: string) => {
    setShowMenu(false);
    setShowMuteWordMenu(false);
    try {
      const { addMutedWord } = await import('@degenfeed/storage');
      await addMutedWord(word);
    } catch {
      /* ignore */
    }
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
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
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

  const engagementProps: PostCardEngagementProps = useMemo(
    () => ({
      post,
      localState,
      bridgeReplies,
      showReply,
      replyText,
      animatingLike,
      onPerform: perform,
      onSetShowReply: setShowReply,
      onSetReplyText: setReplyText,
      onShare: handleShare,
      onTip,
      onCrossReplyOpen,
      onOpenShareSheet: onOpenShareSheet ? () => onOpenShareSheet(post) : undefined,
    }),
    [
      post,
      localState,
      bridgeReplies,
      showReply,
      replyText,
      animatingLike,
      onTip,
      onCrossReplyOpen,
      perform,
      onOpenShareSheet,
      handleShare,
    ],
  );

  const isNostr = post.protocol === 'nostr';
  const nostrBadge: any = isNostr ? <span>Nostr</span> : null;

  return (
    <>
      <article
        className="post-card cursor-pointer border-b border-[var(--color-border)] px-4 py-3 transition-all duration-150 hover:bg-[var(--color-overlay)] hover:border-[color-mix(in_srgb,var(--color-accent)_15%,var(--color-border))] hover:scale-[1.002] hover:shadow-sm"
        onClick={() => onClick?.(post.id)}
        onContextMenu={(e) => onContextMenu?.(e, post.id)}
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
        <div className="author-row group mb-2 flex items-center gap-3">
          <Image
            src={
              post.author.avatarUrl ||
              'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23333%22/%3E%3Ctext x=%2216%22 y=%2222%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3E%40%3C/text%3E%3C/svg%3E'
            }
            alt={`Avatar of ${post.author.displayName}`}
            width={32}
            height={32}
            sizes="32px"
            className="avatar h-8 w-8 rounded-full bg-[var(--color-muted)] object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0">
            {post.protocol === 'lemmy' && post.community && (
              <div className="lemmy-community-row mb-0.5">
                <CommunityBadge name={post.community.name} icon={post.community.icon} size="sm" />
                <span className="ml-1 text-xs text-muted-foreground">posted in </span>
                <a
                  href={`/c/${post.community.name}`}
                  className="text-xs font-medium hover:underline text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  c/{post.community.name}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="author-name truncate text-sm font-semibold text-[var(--color-fg)]">
                {post.author.displayName}
              </span>
              {post.protocol === 'nostr' && post.author.handles.nostr?.includes('@') && (
                <span
                  className="flex-shrink-0 dark:text-blue-300 text-blue-600 text-xs"
                  title="NIP-05 verified"
                >
                  ✓
                </span>
              )}
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

              {crossProtocolBadges && crossProtocolBadges.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-1">
                  {crossProtocolBadges.slice(0, 3).map((p) => (
                    <IdentityBadge key={p} protocol={p} size="xs" />
                  ))}
                  {crossProtocolBadges.length > 3 && (
                    <span className="flex items-center px-1 text-[10px] text-[var(--color-muted)]">
                      +{crossProtocolBadges.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Three-dot menu */}
              {!isSelf && (
                <div ref={menuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu((v) => !v);
                    }}
                    className="rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
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
                      className="shrink-0"
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
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
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
                            d="M4 2v12M12 2v12M2 4h12M2 12h12"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        Embed post
                      </button>

                      {onWhyThisPost && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onWhyThisPost(post);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-degen-400 hover:bg-degen-500/10 transition-colors"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                            <path
                              d="M8 7.5v4M8 5v.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          Why am I seeing this?
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleFlagAsSpam}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-orange-400"
                        >
                          <path
                            d="M4 2v12M4 2l8 3-8 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Flag as spam
                      </button>

                      {post.niches.length > 0 && onShowMoreLikeThis && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onShowMoreLikeThis(post.niches[0] ?? 'crypto');
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-green-400 hover:bg-green-500/10 transition-colors"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <path
                              d="M8 2v12M2 8h12"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          Show more like this
                        </button>
                      )}
                      {post.niches.length > 0 && onShowLessLikeThis && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onShowLessLikeThis(post.niches[0] ?? 'crypto');
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <path
                              d="M2 8h12"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          Show less like this
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleReport}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
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

                      {isAdmin && onAdminRemove && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleAdminRemove}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <path
                              d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Remove post
                        </button>
                      )}
                      {isAdmin && onAdminBan && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleAdminBan}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0"
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
                            <path
                              d="M8 3v3M8 10v3"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                            />
                          </svg>
                          Ban user
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTranslateMenu((v) => !v);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
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
                                className="flex w-full items-center gap-3 px-4 py-2 pl-8 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors disabled:opacity-50"
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

                      {post.community && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleMuteCommunity}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="shrink-0 text-purple-400"
                          >
                            <rect
                              x="2"
                              y="2"
                              width="5"
                              height="5"
                              rx="1"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <rect
                              x="9"
                              y="2"
                              width="5"
                              height="5"
                              rx="1"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <rect
                              x="2"
                              y="9"
                              width="5"
                              height="5"
                              rx="1"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <rect
                              x="9"
                              y="9"
                              width="5"
                              height="5"
                              rx="1"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </svg>
                          {communityMuted ? 'Unmute community' : `Mute /c/${post.community.name}`}
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMuteWordMenu((v) => !v);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-orange-400"
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
                        Mute word
                      </button>

                      {showMuteWordMenu &&
                        (() => {
                          const candidates = [
                            ...new Set(
                              (post.text || '')
                                .toLowerCase()
                                .split(/[\s,;:.!?]+/)
                                .filter((w) => w.length > 3 && w.length < 30 && !/^\d+$/.test(w))
                                .slice(0, 6),
                            ),
                          ];
                          return (
                            <div className="border-t border-[var(--color-border)]">
                              {candidates.length === 0 && (
                                <p className="px-4 py-2 text-xs text-[var(--color-muted)]">
                                  No words to mute
                                </p>
                              )}
                              {candidates.map((word) => (
                                <button
                                  key={word}
                                  type="button"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMuteWordFromMenu(word);
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-2 pl-8 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                                >
                                  &ldquo;{word}&rdquo;
                                </button>
                              ))}
                            </div>
                          );
                        })()}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleBlock}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
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
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 text-[var(--color-muted)]"
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
                    : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400'
                }`}
                aria-label={
                  following
                    ? `Unfollow ${post.author.handles[post.protocol] ?? post.author.displayName}`
                    : `Follow ${post.author.handles[post.protocol] ?? post.author.displayName}`
                }
                aria-pressed={following}
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
                    : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:border-red-500/30 hover:text-red-400'
                }`}
                aria-label={
                  muted
                    ? `Unmute ${post.author.handles[post.protocol] ?? post.author.displayName}`
                    : `Mute ${post.author.handles[post.protocol] ?? post.author.displayName}`
                }
                aria-pressed={muted}
                title={muted ? 'Unmute author' : 'Mute author'}
              >
                {muted ? '🔇 Muted' : '🔇'}
              </button>
            </div>
            <div className="author-handle flex items-center gap-2 text-xs text-[var(--color-muted)]">
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
              {post.qualityBadge === 'verified' && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                  title={
                    post.qualityScore
                      ? buildQualityTooltip(post.qualityScore)
                      : 'High-quality post by protocol rules'
                  }
                >
                  ⭐ Verified
                </span>
              )}
              {(post.isHot || post.isTrending) && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-400"
                  title={post.isHot ? 'Rising engagement velocity' : 'High engagement'}
                >
                  🔥 Hot
                </span>
              )}
              {post.qualityScore && post.qualityBadge !== 'verified' && (
                <span
                  className="inline-flex shrink-0 items-center rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--color-muted)]"
                  title={buildQualityTooltip(post.qualityScore)}
                >
                  Q {post.qualityScore.score}/{post.qualityScore.max}
                </span>
              )}
              {/* Hover-only high-quality badge */}
              {(post.feedDebug?.qualityScore ?? (post.score?.quality ?? 0) / 3) > 0.7 && (
                <span
                  className="relative z-10 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="This post was rated as high quality by the content quality filter"
                >
                  ⚡ High Quality
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {post.paywall && (
          <div className="mb-3 rounded-xl border border-purple-900/30 bg-purple-900/10 p-4 text-center">
            <div className="mb-2 text-2xl">🔒</div>
            <p className="mb-3 text-sm text-[var(--color-muted)]">This post is locked.</p>
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
        <div className="content-text mb-3 text-[15px] leading-[1.5] text-[var(--color-fg)] whitespace-pre-wrap break-words">
          {displayText}
          {needsTruncation && !showFullText && (
            <button
              type="button"
              className="ml-1 text-degen-500 hover:text-degen-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullText(true);
              }}
              aria-label="Show more"
            >
              Show more
            </button>
          )}
        </div>

        {/* Inline token charts */}
        {post.text &&
          detectTokens(post.text).map((token, i) => (
            <TokenChart key={token.address ?? token.symbol ?? `token-${i}`} {...token} compact />
          ))}

        {/* Embeds (media, links, frames, videos) */}
        {post.embeds.length > 0 && (
          <div className="mb-3">
            {(() => {
              const images = post.embeds.filter((e) => e.kind === 'image').map((e) => e.url);
              const links = post.embeds.filter((e) => e.kind === 'link');
              const videos = post.embeds.filter((e) => e.kind === 'video');
              const frames = post.embeds.filter((e) => e.kind === 'frame');
              return (
                <>
                  {images.length > 0 && (
                    <ImageGrid images={images} authorName={post.author.displayName} />
                  )}
                  {frames.map((embed) => (
                    <FrameCard key={`frame-${embed.url}`} url={embed.url} />
                  ))}
                  {frames.length === 0 &&
                    post.protocol === 'farcaster' &&
                    links.length > 0 &&
                    links[0]?.url && (
                      <FrameCard key={`link-frame-${links[0].url}`} url={links[0].url} />
                    )}
                  {links.map((embed) => {
                    const linkVideoInfo = parseVideoUrl(embed.url);
                    if (linkVideoInfo) {
                      return (
                        <VideoEmbedCard key={`link-video-${embed.url}`} videoInfo={linkVideoInfo} />
                      );
                    }
                    return (
                      <LinkPreview
                        key={`link-${embed.url}`}
                        embed={embed}
                        authorName={post.author.displayName}
                      />
                    );
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
                className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]"
              >
                {n}
              </span>
            ))}
          </div>
        )}

        {post.contentProof && <PermanenceBadge proof={post.contentProof} />}

        {post.protocol === 'lemmy' && <LemmyThreadView post={post} />}
        {post.protocol === 'peertube' && (
          <PeerTubeEmbed
            url={
              post.embeds.find((e) => e.kind === 'video')?.url ??
              post.embeds.find((e) => e.kind === 'link')?.url ??
              ''
            }
            title={raw?.videoTitle as string | undefined}
            channelName={raw?.channelName as string | undefined}
          />
        )}
        {nostrBadge}
        {post.protocol === 'mastodon' && (
          <MastodonInstanceContext
            instance={(raw?.instance as string) ?? 'mastodon.social'}
            federatedFrom={raw?.federatedFrom as string | undefined}
          />
        )}
        {post.protocol === 'lens' && <LensPublicationBadge post={post} />}
        {post.protocol === 'bluesky' && <BlueskyPostContext post={post} />}
        {post.protocol === 'threads' && raw?._viaActivityPub && (
          <span
            className="mb-2 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-fg) 10%, transparent)',
              color: 'var(--color-fg)',
            }}
            title="Delivered via ActivityPub federation"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M8 2v12M2 8h12"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            via ActivityPub
          </span>
        )}

        {/* Engagement metrics + Tip */}
        <PostCardEngagement {...engagementProps} />
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

      {/* Translation preview overlay */}
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
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
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
}

export const PostCard = memo(PostCardComponent);
