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
import type { ContentProof, EngagementAction } from '@degenfeed/types';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { EmbedModal } from './EmbedModal';
import { CrossPostVersions } from './CrossPostVersions';
import {
  applyOptimistic,
  PostCardEngagement,
  type PostCardEngagementProps,
} from './PostCardEngagement';
import { MAX_TEXT_LENGTH, scheduleIdle } from './PostCardHelpers';
import type { LocalState, PostCardProps } from './PostCardTypes';
import { PostBody, PostHeader, PostMedia, PostMetrics, PostThread } from './post-card';
import { ReportModal } from './ReportModal';
import { TranslationPreview } from './TranslationPreview';

// ─── Local permanence badge ────────────────────────────────────────

function PermanenceBadgeLink({ proof }: { proof: ContentProof }) {
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

  const tooltip =
    tooltipParts.length > 0
      ? `Stored permanently\n${tooltipParts.join('\n')}`
      : 'Stored permanently';

  return (
    <div className="flex flex-wrap gap-2 items-center">
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

// ─── Main component ────────────────────────────────────────────────

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
  postMetaSlot,
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
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [communityMuted, setCommunityMuted] = useState(false);
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

  const isSelf = post.author.id === 'self' || post.author.id.startsWith('self:');

  // Seed/demo content is flagged `_demo: true` (top-level by the bridge,
  // or nested in `raw` by the seed-content provider). Surface it honestly
  // instead of presenting demo posts as real network content.
  const isDemo =
    (post as unknown as { _demo?: boolean })._demo === true ||
    ((post.raw as { _demo?: boolean } | undefined)?._demo === true);

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

  useEffect(() => {
    setLocalState({ engagement: post.engagement, metrics: post.metrics });
  }, [post.engagement, post.metrics]);

  // Cross-protocol bridge reply counts
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
    setShowReportModal(true);
  }, []);

  const handleEmbed = useCallback(() => {
    setShowEmbedModal(true);
  }, []);

  const handleFlagAsSpam = useCallback(async () => {
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

  const handleMuteCommunity = useCallback(async () => {
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
    try {
      const { addMutedWord } = await import('@degenfeed/storage');
      await addMutedWord(word);
    } catch {
      /* ignore */
    }
  }, []);

  const handleAdminRemove = useCallback(() => {
    onAdminRemove?.(post.id);
  }, [onAdminRemove, post.id]);

  const handleAdminBan = useCallback(() => {
    onAdminBan?.(post.author.id, post.protocol, post.author.displayName);
  }, [onAdminBan, post.author.id, post.author.displayName, post.protocol]);

  const handleTranslate = useCallback(
    async (targetProtocol: string) => {
      setShowTranslateMenu(false);
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

  return (
    <>
      <article
        className={`post-card protocol-${post.protocol} group cursor-pointer border-b border-[var(--color-border)] px-4 py-3 transition-all duration-150 hover:bg-[var(--color-overlay)] hover:border-[color-mix(in_srgb,var(--color-accent)_15%,var(--color-border))] hover:shadow-sm`}
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
        {/* Author row (avatar, name, badges, menu, follow/mute) */}
        <PostHeader
          post={post}
          isSelf={isSelf}
          reputation={reputation}
          reputationProgress={reputationProgress}
          crossProtocolBadges={crossProtocolBadges}
          following={following}
          muted={muted}
          blocked={blocked}
          communityMuted={communityMuted}
          isAdmin={isAdmin}
          showTranslateMenu={showTranslateMenu}
          translating={translating}
          translateTarget={translateTarget}
          onToggleFollow={toggleFollow}
          onToggleMute={toggleMute}
          onBlock={handleBlock}
          onMuteFromMenu={handleMuteFromMenu}
          onReport={handleReport}
          onEmbed={handleEmbed}
          onFlagAsSpam={handleFlagAsSpam}
          onShowMoreLikeThis={onShowMoreLikeThis ? (t) => onShowMoreLikeThis(t) : undefined}
          onShowLessLikeThis={onShowLessLikeThis ? (t) => onShowLessLikeThis(t) : undefined}
          onWhyThisPost={onWhyThisPost}
          onAdminRemove={isAdmin ? handleAdminRemove : undefined}
          onAdminBan={isAdmin ? handleAdminBan : undefined}
          onMuteCommunity={handleMuteCommunity}
          onMuteWordFromMenu={handleMuteWordFromMenu}
          onShowTranslateMenu={() => setShowTranslateMenu((v) => !v)}
          onTranslate={handleTranslate}
        />

        {/* Protocol badge row (left) + Why this post? ⓘ icon (right).
            The protocol badge itself lives in the PostHeader (top-left);
            this row only carries the demo flag and the transparency button. */}
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {isDemo && (
              <span
                className="inline-flex items-center rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400"
                title="This is placeholder demo content — the live source is temporarily unavailable"
              >
                Demo
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWhyThisPost?.(post);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-[var(--color-muted)] opacity-60 transition-all hover:bg-degen-500/10 hover:text-degen-400 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Why this post?"
            title="Why am I seeing this?"
          >
            ⓘ
          </button>
        </div>

        {/* Post body (paywall, text, token charts) */}
        <PostBody
          post={post}
          expanded={expanded}
          showFullText={showFullText}
          needsTruncation={needsTruncation}
          displayText={displayText}
          onShowFullText={() => setShowFullText(true)}
          onPaywall={onPaywall}
        />

        {/* Media embeds (images, videos, links, frames) */}
        <div className="mb-3">
          <PostMedia post={post} authorName={post.author.displayName} />
        </div>

        {/* Niche tags */}
        <PostMetrics post={post} />

        {/* Protocol-native metadata as inline badges (not a separate section) */}
        {postMetaSlot?.(post)}

        {/* Cross-posted siblings — e.g. Nostr post that also lives on Farcaster */}
        <CrossPostVersions post={post} className="mb-3" />

        {/* Permanence badge */}
        {post.contentProof && (
          <div className="mb-3">
            <PermanenceBadgeLink proof={post.contentProof} />
          </div>
        )}

        {/* Protocol-specific thread views & context badges */}
        <PostThread post={post} />

        {/* Engagement actions (like, repost, reply, share, tip) */}
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

export type { EngageHandler, EngageResult, PostCardProps } from './PostCardTypes';
