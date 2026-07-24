'use client';

/**
 * @components/ShortVideoCard — Full-screen TikTok-style video overlay card.
 *
 * Right rail: Like ❤️, Comment 💬, Tip ⚡, Share ↗️, Bookmark 🔖
 * Bottom info: creator avatar + name, caption, hashtags, sound
 * Top progress bar. Mute toggle. Double-tap heart burst.
 * Seek by tapping edges. Long-press to pause.
 *
 * Design: Neon dark cyberpunk with degen-green glass accents.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { getProtocolColor, VideoPlayer } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { memo } from 'react';
import { ActionRail } from './ActionRail';
import { BottomOverlay } from './BottomOverlay';
import { HeartBurst } from './HeartBurst';
import { useShortsInteraction } from './useShortsInteraction';
import { VideoInfoPanel } from './VideoInfoPanel';

const TipModal = dynamic(() => import('../TipModal').then((m) => ({ default: m.TipModal })), {
  ssr: false,
});

interface ShortVideoCardProps {
  post: UnifiedPost;
  isActive: boolean;
  onDoubleTap?: () => void;
  onPlayStateChange?: (paused: boolean) => void;
}

export const ShortVideoCard = memo(function ShortVideoCard({
  post,
  isActive,
  onDoubleTap,
  onPlayStateChange,
}: ShortVideoCardProps) {
  const {
    liked,
    likeCount,
    bookmarked,
    muted,
    showOverlay,
    progress,
    showCaption,
    showInfoPanel,
    heartVisible,
    emotes,
    pullDismissProgress,
    videoInfo,
    hashtags,
    authorHandle,
    isDirect,
    isPeertube,
    youtubeId,
    tipCount,
    pullDismissStyle,
    tipModalOpenState: tipModalOpen,
    setShowCaption,
    setShowInfoPanel,
    setTipModalOpen,
    handleTap,
    handlePointerDown,
    handlePointerUp,
    handleLike,
    handleBookmark,
    handleShare,
    handleComment,
    handleTip,
    handleMute,
    handleInfoTouchStart,
    handleInfoTouchEnd,
  } = useShortsInteraction(post, isActive, onDoubleTap, onPlayStateChange);

  const protocolColor = getProtocolColor(post.protocol);
  const renderPlayer = () => {
    if (youtubeId) {
      return (
        <VideoPlayer
          youtubeId={youtubeId}
          platform="youtube"
          aspectRatio="9:16"
          title={post.text}
          showMetadata={false}
          onPlay={() => onPlayStateChange?.(false)}
          onPause={() => onPlayStateChange?.(true)}
          className="h-full w-full"
        />
      );
    }
    if (isDirect && videoInfo?.platform === 'direct') {
      return (
        <VideoPlayer
          src={videoInfo.url}
          platform="direct"
          aspectRatio="9:16"
          title={post.text}
          showMetadata={false}
          onPlay={() => onPlayStateChange?.(false)}
          onPause={() => onPlayStateChange?.(true)}
          className="h-full w-full"
        />
      );
    }
    if (isPeertube && videoInfo?.platform === 'peertube') {
      return (
        <VideoPlayer
          peertubeInstance={videoInfo.instance}
          peertubeUuid={videoInfo.uuid}
          platform="peertube"
          aspectRatio="9:16"
          title={post.text}
          showMetadata={false}
          onPlay={() => onPlayStateChange?.(false)}
          onPause={() => onPlayStateChange?.(true)}
          className="h-full w-full"
        />
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg)]">
        {post.author.avatarUrl && (
          <Image
            src={post.author.avatarUrl}
            alt={post.author.displayName}
            width={120}
            height={120}
            className="h-30 w-30 rounded-full object-cover opacity-20"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white/70"
              aria-hidden="true"
            >
              <path d="M8 5V19L19 12L8 5Z" />
            </svg>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Video unavailable</p>
          <a
            href={post.embeds[0]?.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-white/10 hover:text-white"
          >
            Open original
          </a>
        </div>
      </div>
    );
  };

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-black select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      aria-label={`Video by ${post.author.displayName}`}
    >
      {/* Progress Bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5">
        <div className="h-full w-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-150 ease-linear"
            style={{ width: `${progress * 100}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Video Player */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const width = rect.width;
          if (showInfoPanel) return;
          if (x < width * 0.25) {
            window.dispatchEvent(new CustomEvent('shorts-seek-back'));
            return;
          }
          if (x > width * 0.75) {
            window.dispatchEvent(new CustomEvent('shorts-seek-forward'));
            return;
          }
          window.dispatchEvent(new CustomEvent('shorts-toggle-overlay'));
        }}
        onDoubleClick={handleTap}
        role="presentation"
      >
        {renderPlayer()}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[15%] bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      {/* Pull-to-dismiss */}
      {pullDismissProgress > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          style={pullDismissStyle}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/70 drop-shadow-lg"
            style={{
              transform: `rotate(${pullDismissProgress * 180}deg)`,
              transition: 'transform 0.1s',
            }}
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Emote Reactions */}
      {emotes.map((emote) => (
        <div
          key={emote.id}
          className="pointer-events-none absolute z-40 text-2xl drop-shadow-lg"
          style={{
            left: `${emote.x}%`,
            bottom: '30%',
            animation: 'emote-float 2.5s ease-out forwards',
          }}
          aria-hidden="true"
        >
          {emote.emoji}
        </div>
      ))}

      <HeartBurst visible={heartVisible} />

      {/* Seek hint zones */}
      <div className="pointer-events-none absolute left-0 top-0 z-20 flex h-full w-[25%] items-center justify-start pl-3">
        <span className="text-2xl text-white/30 drop-shadow-lg opacity-0">⏪</span>
      </div>
      <div className="pointer-events-none absolute right-0 top-0 z-20 flex h-full w-[25%] items-center justify-end pr-3">
        <span className="text-2xl text-white/30 drop-shadow-lg opacity-0">⏩</span>
      </div>

      {/* Mute button */}
      <button
        type="button"
        onClick={handleMute}
        className={`absolute right-4 top-16 z-30 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all duration-300 ${muted ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-degen-500/20 text-degen-400 hover:bg-degen-500/30'} ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M11 5L6 9H2v6h4l5 4V5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M23 9l-6 6M17 9l6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Action Rail */}
      <ActionRail
        post={post}
        liked={liked}
        bookmarked={bookmarked}
        likeCount={likeCount}
        tipCount={tipCount}
        protocolColor={protocolColor}
        showOverlay={showOverlay}
        showInfoPanel={showInfoPanel}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onTip={handleTip}
        onBookmark={handleBookmark}
      />

      {/* Bottom Info */}
      <BottomOverlay
        post={post}
        showCaption={showCaption}
        showOverlay={showOverlay}
        showInfoPanel={showInfoPanel}
        protocolColor={protocolColor}
        authorHandle={authorHandle}
        hashtags={hashtags}
        onToggleCaption={() => setShowCaption((prev) => !prev)}
        onInfoTouchStart={handleInfoTouchStart}
        onInfoTouchEnd={handleInfoTouchEnd}
      />

      <VideoInfoPanel post={post} visible={showInfoPanel} />

      {/* Close info panel */}
      {showInfoPanel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoPanel(false);
          }}
          className="absolute right-4 top-16 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md transition-colors hover:bg-white/10"
          aria-label="Close info panel"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white/70"
            aria-hidden="true"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {/* PeerTube link */}
      {isPeertube && !showInfoPanel && (
        <a
          href={videoInfo?.platform === 'peertube' ? videoInfo.url : '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-36 right-16 z-30 inline-flex items-center gap-1.5 rounded-full border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-medium text-degen-400 backdrop-blur-sm transition-all hover:bg-degen-500/20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
          </svg>
          PeerTube
        </a>
      )}

      <TipModal
        open={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        recipientProtocol={post.protocol}
        recipientAuthorId={post.author.id}
        recipientDisplayName={post.author.displayName}
        publicationId={post.id}
        postContext={{
          protocol: post.protocol,
          authorId: post.author.id,
          author: {
            evmAddress: post.author.keys.evmAddress,
            solanaAddress: post.author.keys.solanaAddress,
          },
        }}
      />

      <style>{`
        @keyframes shorts-heart-pop {
          0% { transform: scale(0.3); opacity: 0; }
          25% { transform: scale(1.5); opacity: 1; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1) translateY(-30px); opacity: 0; }
        }
        @keyframes shorts-heart-orbit {
          0% { transform: rotate(var(--angle)) translateX(0) scale(0); opacity: 0; }
          30% { transform: rotate(var(--angle)) translateX(40px) scale(1); opacity: 1; }
          100% { transform: rotate(var(--angle)) translateX(60px) scale(0.5); opacity: 0; }
        }
        @keyframes shorts-panel-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes emote-float {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          15% { transform: translateY(-10px) scale(1.2); opacity: 1; }
          30% { transform: translateY(-20px) scale(1); opacity: 0.9; }
          100% { transform: translateY(-120px) scale(0.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </section>
  );
});

export { ActionButton } from './ActionButton';
export { ActionRail } from './ActionRail';
export { BottomOverlay } from './BottomOverlay';
export { HeartBurst } from './HeartBurst';
export { extractHashtags, formatCount, truncateText } from './helpers';
export { useShortsInteraction } from './useShortsInteraction';
export { VideoInfoPanel } from './VideoInfoPanel';
