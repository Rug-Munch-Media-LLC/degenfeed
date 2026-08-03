'use client';

import type { UnifiedPost } from '@degenfeed/types';
import Image from 'next/image';
import { memo, useEffect, useRef, useState } from 'react';
import { CommunityBadge } from '../CommunityBadge';
import { IdentityBadge } from '../IdentityBadge';
import {
  getProtocolIcon as _getProtocolIcon,
  getProtocolLabel as _getProtocolLabel,
  ProtocolBadge,
} from '../ProtocolBadge';
import type { ReputationBadgeProgress, ReputationBadgeScore } from '../ReputationBadge';
import { ReputationBadge } from '../ReputationBadge';

export interface PostHeaderProps {
  post: UnifiedPost;
  isSelf: boolean;
  reputation?: ReputationBadgeScore | null;
  reputationProgress?: ReputationBadgeProgress | null;
  crossProtocolBadges?: string[];
  following: boolean;
  muted: boolean;
  blocked: boolean;
  communityMuted: boolean;
  isAdmin?: boolean;
  showTranslateMenu: boolean;
  translating: boolean;
  translateTarget: string | null;
  onToggleFollow: (e: React.MouseEvent) => void;
  onToggleMute: (e: React.MouseEvent) => void;
  onBlock: () => void;
  onMuteFromMenu: () => void;
  onReport: () => void;
  onEmbed: () => void;
  onFlagAsSpam: () => void;
  onShowMoreLikeThis?: (topic: string) => void;
  onShowLessLikeThis?: (topic: string) => void;
  onWhyThisPost?: (post: UnifiedPost) => void;
  onAdminRemove?: () => void;
  onAdminBan?: () => void;
  onMuteCommunity: () => void;
  onMuteWordFromMenu: (word: string) => void;
  onShowTranslateMenu: () => void;
  onTranslate: (protocol: string) => void;
}

/** Farcaster avatar ring style */
const FARCASTER_RING = 'ring-2 ring-offset-1 ring-offset-[var(--color-bg)] ring-[#8a63d2]';

/** Get protocol-specific avatar class for ring/border styling */
function getProtocolAvatarClass(protocol: string): string {
  switch (protocol) {
    case 'farcaster':
      return `rounded-full bg-[var(--color-muted)] object-cover ${FARCASTER_RING}`;
    case 'lens':
      return 'rounded-full bg-[var(--color-muted)] object-cover ring-2 ring-offset-1 ring-offset-[var(--color-bg)] ring-[#abfe2c]';
    case 'nostr':
      return 'rounded-full bg-[var(--color-muted)] object-cover ring-1 ring-[#8b5cf6]/40';
    default:
      return 'rounded-full bg-[var(--color-muted)] object-cover';
  }
}

export const PostHeader = memo(function PostHeader({
  post,
  isSelf,
  reputation,
  reputationProgress,
  crossProtocolBadges,
  following,
  muted,
  blocked,
  communityMuted,
  isAdmin,
  showTranslateMenu,
  translating,
  translateTarget,
  onToggleFollow,
  onToggleMute,
  onBlock,
  onMuteFromMenu,
  onReport,
  onEmbed,
  onFlagAsSpam,
  onShowMoreLikeThis,
  onShowLessLikeThis,
  onWhyThisPost,
  onAdminRemove,
  onAdminBan,
  onMuteCommunity,
  onMuteWordFromMenu,
  onShowTranslateMenu,
  onTranslate,
}: PostHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showMuteWordMenu, setShowMuteWordMenu] = useState(false);
  const [internalTranslateMenu, setInternalTranslateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const effectiveShowTranslateMenu = showTranslateMenu ?? internalTranslateMenu;
  const setEffectiveTranslateMenu = (v: boolean) => {
    setInternalTranslateMenu(v);
    if (onShowTranslateMenu) onShowTranslateMenu();
  };

  const avatarClass = getProtocolAvatarClass(post.protocol);

  return (
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
        className={avatarClass}
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
        {/* TASK 2: Reddit subreddit info */}
        {post.protocol === 'reddit' && post.community && (
          <div className="reddit-community-row mb-0.5 flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#ff4500] text-[8px] font-bold text-white">
              R
            </span>
            <a
              href={`https://reddit.com/r/${post.community.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--color-muted)] hover:underline hover:text-[#ff4500]"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              r/{post.community.name}
            </a>
          </div>
        )}
        {/* TASK 2: Mastodon instance info */}
        {post.protocol === 'mastodon' && (post.raw as { instance?: string })?.instance && (
          <div className="mastodon-instance-row mb-0.5 flex items-center gap-1">
            <span className="text-[10px] text-[var(--color-muted)]">
              🐘{' '}
              {
                (post.raw as { instance?: string })?.instance
                  ?.replace(/^https?:\/\//, '')
                  .split('/')[0]
              }
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span
            className="author-name truncate text-sm font-semibold"
            style={{
              color:
                post.protocol === 'nostr'
                  ? 'var(--color-fg)'
                  : post.protocol === 'lens'
                    ? '#abfe2c'
                    : post.protocol === 'bluesky'
                      ? '#60a5fa'
                      : post.protocol === 'reddit'
                        ? '#ff4500'
                        : post.protocol === 'rss'
                          ? '#fbbf24'
                          : 'var(--color-fg)',
            }}
          >
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

          {/* TASK 2: Protocol-specific badges */}
          {post.protocol === 'nostr' && (post.raw as { relays?: string[] })?.relays && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: '#8b5cf615', color: '#a78bfa' }}
              title={`Connected to ${(post.raw as { relays?: string[] })?.relays?.length ?? 1} relay(s)`}
            >
              ⚡ {(post.raw as { relays?: string[] })?.relays?.length ?? 1} relays
            </span>
          )}
          {post.protocol === 'bluesky' && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: '#1185fe12', color: '#60a5fa' }}
              title="AT Protocol"
            >
              AT Protocol
            </span>
          )}
          {post.protocol === 'lens' && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: '#abfe2c15', color: '#a3e635' }}
              title="Polygon Network"
            >
              ◈ Polygon
            </span>
          )}
          {post.protocol === 'rss' && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: '#ffa50015', color: '#fbbf24' }}
              title="RSS Feed"
            >
              via RSS
            </span>
          )}

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
                    onClick={() => {
                      setShowMenu(false);
                      onEmbed();
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
                    onClick={() => {
                      setShowMenu(false);
                      onFlagAsSpam();
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
                    onClick={() => {
                      setShowMenu(false);
                      onReport();
                    }}
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
                      onClick={() => {
                        setShowMenu(false);
                        onAdminRemove?.();
                      }}
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
                      onClick={() => {
                        setShowMenu(false);
                        onAdminBan?.();
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
                      setShowMenu(false);
                      setEffectiveTranslateMenu(!effectiveShowTranslateMenu);
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

                  {effectiveShowTranslateMenu && (
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
                              void onTranslate(protocol);
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
                      onClick={() => {
                        setShowMenu(false);
                        onMuteCommunity();
                      }}
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
                                void onMuteWordFromMenu(word);
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
                    onClick={() => {
                      setShowMenu(false);
                      onBlock();
                    }}
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
                    onClick={() => {
                      setShowMenu(false);
                      onMuteFromMenu();
                    }}
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
            onClick={onToggleFollow}
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
            onClick={onToggleMute}
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
              <PostScoreBadge score={post.score} />
            </>
          )}
          <PostQualityBadges post={post} />
        </div>
      </div>
    </div>
  );
});

// ─── helper sub-components ─────────────────────────────────────────

import { formatTimeAgo } from '@degenfeed/utils';
import { buildQualityTooltip, buildScoreTooltip } from '../PostCardHelpers';

function PostScoreBadge({ score }: { score: NonNullable<UnifiedPost['score']> }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-1.5 py-0.5 text-[10px] font-medium text-degen-400"
      title={buildScoreTooltip(score)}
    >
      ★ {Math.round(score.total * 10) / 10}
    </span>
  );
}

function PostQualityBadges({ post }: { post: UnifiedPost }) {
  return (
    <>
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
    </>
  );
}
