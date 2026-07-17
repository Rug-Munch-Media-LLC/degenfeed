import {
  addBlockedUser,
  deleteFollow,
  getMutedIdentities,
  isFollowing,
  muteIdentity,
  removeBlockedUser,
  saveFollow,
  unmuteIdentity,
} from '@degenfeed/storage';
import type { Embed, EngagementAction, UnifiedPost } from '@degenfeed/types';
import { detectTokens, formatTimeAgo } from '@degenfeed/utils';
import Image from 'next/image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BlueskyPostContext } from './BlueskyPostContext';
import { FrameEmbed } from './FrameEmbed';
import { IdentityBadge } from './IdentityBadge';
import { LemmyThreadView } from './LemmyThreadView';
import { LensPublicationBadge } from './LensPublicationBadge';
import { MastodonInstanceContext } from './MastodonInstanceContext';
import { NostrRelayBadge } from './NostrRelayBadge';
import { PeerTubeEmbed } from './PeerTubeEmbed';
import { ProtocolBadge } from './ProtocolBadge';
import { QuickTipButton } from './QuickTipButton';
import { ReportModal } from './ReportModal';
import { TokenChart } from './TokenChart';

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
      className="group mt-2 block overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 transition-colors hover:border-degen-500/30 hover:bg-gray-800/50"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {image && (
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={image}
            alt={title || ''}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-3">
        {host && <p className="mb-1 text-[11px] text-gray-500 uppercase tracking-wide">{host}</p>}
        {title && <p className="mb-1 text-sm font-semibold text-white line-clamp-1">{title}</p>}
        {description && <p className="text-xs text-gray-400 line-clamp-2">{description}</p>}
        {!title && !description && (
          <p className="truncate text-xs text-degen-500">{embed.url.replace(/^https?:\/\//, '')}</p>
        )}
      </div>
    </a>
  );
}

function ImageGrid({ images }: { images: string[] }) {
  if (images.length === 1) {
    return (
      <div className="mt-2 max-h-80 overflow-hidden rounded-xl">
        <Image
          src={images[0]}
          alt=""
          width={200}
          height={200}
          className="h-full w-full object-cover"
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
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
      {images.slice(0, 4).map((url, idx) => (
        <div key={url} className="relative aspect-square">
          <Image src={url} alt="" width={200} height={200} className="h-full w-full object-cover" />
          {idx === 3 && images.length > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-white">
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

export const PostCard = memo(function PostCard({
  post,
  onEngage,
  onClick,
  expanded,
  onTip,
  onPaywall,
  onReport,
  crossProtocolBadges,
}: PostCardProps) {
  const [showFullText, setShowFullText] = useState(expanded ?? false);
  const [localState, setLocalState] = useState<LocalState>({
    engagement: post.engagement,
    metrics: post.metrics,
  });
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [following, setFollowing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
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

  const needsTruncation = !expanded && post.text.length > MAX_TEXT_LENGTH;
  const displayText =
    needsTruncation && !showFullText ? `${post.text.slice(0, MAX_TEXT_LENGTH)}...` : post.text;

  async function perform(action: EngagementAction, content?: string) {
    if (!onEngage) return;
    const previous = localState;
    setLocalState((s) => applyOptimistic(s, action));
    const result = await onEngage(action, post.id, content);
    if (!result.ok) {
      setLocalState(previous);
    } else if (action === 'reply') {
      setReplyText('');
      setShowReply(false);
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

  const handleReportSubmitted = useCallback(() => {
    onReport?.(post.id);
    setShowReportModal(false);
  }, [onReport, post.id]);

  return (
    <>
      <article
        className="cursor-pointer border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.03]"
        onClick={() => onClick?.(post.id)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onClick) {
            e.preventDefault();
            onClick(post.id);
          }
        }}
        aria-label={`Post by ${post.author.displayName}`}
      >
        {/* Author row */}
        <div className="mb-2 flex items-center gap-3">
          <Image
            src={
              post.author.avatarUrl ||
              'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23333%22/%3E%3Ctext x=%2216%22 y=%2222%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3E%40%3C/text%3E%3C/svg%3E'
            }
            alt={post.author.displayName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full bg-gray-800 object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-white">
                {post.author.displayName}
              </span>
              {post.protocol === 'nostr' && post.author.handles.nostr?.includes('@') && (
                <span className="flex-shrink-0 text-blue-400 text-xs" title="NIP-05 verified">
                  ✓
                </span>
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
                    className="rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
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
                      className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-gray-800 bg-gray-950 py-1 shadow-2xl"
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleReport}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors"
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
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleBlock}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors"
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
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 transition-colors"
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
                    : 'border border-gray-700 text-gray-500 hover:border-degen-500/30 hover:text-degen-400'
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
                    : 'border border-gray-700 text-gray-600 hover:border-red-500/30 hover:text-red-400'
                }`}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute author' : 'Mute author'}
              >
                {muted ? '🔇 Muted' : '🔇'}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
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
              className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
            >
              Unlock for {post.paywall.amount} SOL
            </button>
          </div>
        )}
        <div className="mb-3 text-sm text-gray-300 whitespace-pre-wrap break-words">
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
                  {frames.length === 0 && post.protocol === 'farcaster' && links.length > 0 && (
                    <FrameCard url={links[0]?.url} />
                  )}
                  {links.map((embed) => (
                    <LinkPreview key={`link-${embed.url}`} embed={embed} />
                  ))}
                  {videos.map((embed) => (
                    <a
                      key={`video-${embed.url}`}
                      href={embed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block w-full rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-xs text-degen-500 hover:text-degen-400 transition-colors truncate"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      ▶ {embed.url.replace(/^https?:\/\//, '').slice(0, 60)}
                    </a>
                  ))}
                </>
              );
            })()}
          </div>
        )}

        {post.niches.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {post.niches.slice(0, 5).map((n) => (
              <span
                key={n}
                className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-400"
              >
                {n}
              </span>
            ))}
          </div>
        )}

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
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <button
            type="button"
            className={`flex items-center gap-1 transition-colors hover:text-red-400 ${localState.engagement.viewerLiked ? 'text-red-400' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              void perform(localState.engagement.viewerLiked ? 'unlike' : 'like');
            }}
            aria-label={`${localState.metrics.likes} likes`}
          >
            {localState.engagement.viewerLiked ? '❤' : '♡'} {formatCount(localState.metrics.likes)}
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
              void navigator.clipboard.writeText(
                `${window.location.origin}/post/${encodeURIComponent(post.id)}`,
              );
            }}
            aria-label="Share"
          >
            ↗ Share
          </button>
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
              className="flex-1 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-degen-500 focus:outline-none"
              maxLength={1000}
            />
            <button type="submit" className="btn-primary text-xs">
              Reply
            </button>
          </form>
        )}
      </article>
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
        onSubmitted={handleReportSubmitted}
      />
    </>
  );
});
