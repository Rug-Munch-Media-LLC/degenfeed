// === Sub-components ===
// Extended for all content types: Audio, Video, Photos, Announcements

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { QuickTipButton } from '../../components/QuickTipButton';
import { LiveDot, Waveform } from './_animations';
import type { SpaceItem, SpacePlatform, SpaceSpeaker } from './_types';
import { formatDuration, formatScheduledDate, timeAgo } from './_utils';

export function AvatarImg({
  src,
  name,
  className = '',
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
        className={`rounded-full object-cover ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-600/30 text-sm font-bold text-[var(--color-fg)] ${className}`}
    >
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  count,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  accent?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-bold text-[var(--color-fg)] tracking-tight">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-[var(--color-muted)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
          {count}
        </span>
      )}
      {accent && (
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-degen-500">
          {accent}
        </span>
      )}
    </div>
  );
}

export function SpeakerAvatar({
  speaker,
  size = 'md',
}: {
  speaker: SpaceSpeaker;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' };
  const ringSize = sizeMap[size];
  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <div
        className={`relative ${ringSize} ${speaker.speaking ? 'animate-tip-pulse rounded-full' : 'rounded-full'}`}
        style={speaker.speaking ? { boxShadow: '0 0 12px rgba(0,255,65,0.5)' } : undefined}
      >
        <AvatarImg
          src={speaker.avatarUrl}
          name={speaker.displayName}
          className={`${ringSize} ring-2 ${speaker.speaking ? 'ring-degen-500 shadow-[0_0_12px_rgba(0,255,65,0.3)]' : speaker.isHost ? 'ring-amber-500/60' : 'ring-[var(--color-glass-border)]'}`}
        />
        {speaker.isHost && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-black shadow-lg"
            title="Host"
          >
            H
          </span>
        )}
        {speaker.isCoHost && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-purple-500 text-[7px] font-bold text-white shadow-lg"
            title="Co-host"
          >
            C
          </span>
        )}
        {speaker.speaking && (
          <Waveform className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-2.5" />
        )}
      </div>
      {size !== 'sm' && (
        <span className="max-w-[56px] truncate text-[9px] text-[var(--color-muted)]">
          {speaker.displayName}
        </span>
      )}
    </div>
  );
}

// ─── Content Type Badge ───────────────────────────────────────────────

export function ContentTypeBadge({ type }: { type?: string }) {
  const meta: Record<string, { icon: string; label: string; color: string }> = {
    audio: { icon: '🎙️', label: 'Audio', color: '#8b5cf6' },
    video: { icon: '📺', label: 'Video', color: '#ef4444' },
    photos: { icon: '📸', label: 'Photos', color: '#f59e0b' },
    announcement: { icon: '📢', label: 'Announce', color: '#06b6d4' },
  };
  const m = meta[type ?? 'audio'] ?? meta.audio;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: `${m.color}18`, color: m.color }}
    >
      {m.icon} {m.label}
    </span>
  );
}

// ─── Live Space Card ──────────────────────────────────────────────────

export function LiveSpaceCard({
  space,
  onJoin,
  onTip,
}: {
  space: SpaceItem;
  onJoin: (id: string) => void;
  onTip: (space: SpaceItem) => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/spaces/${space.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    window.dispatchEvent(
      new CustomEvent('df-toast', { detail: { kind: 'success', message: 'Link copied!' } }),
    );
  }, [space.id]);

  const speakingCount = space.speakers.filter((s) => s.speaking).length;
  const maxVisibleSpeakers = 4;
  const isVideo = space.contentType === 'video';
  const isPhotos = space.contentType === 'photos';

  return (
    <div
      className="group relative flex w-[300px] shrink-0 snap-start flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all duration-300 hover:border-degen-500/40 hover:shadow-[0_0_24px_rgba(0,255,65,0.06)]"
      style={{ animation: 'slideUp 0.35s ease-out both' }}
    >
      {/* Thumbnail for video content */}
      {isVideo && space.thumbnailUrl && (
        <div className="relative mb-3 overflow-hidden rounded-xl">
          <Image
            src={space.thumbnailUrl}
            alt={space.title}
            width={300}
            height={169}
            className="h-32 w-full object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            LIVE
          </span>
        </div>
      )}

      {/* Photo grid for live photos */}
      {isPhotos && space.photoUrls && space.photoUrls.length > 0 && (
        <div className="relative mb-3 overflow-hidden rounded-xl">
          <Image
            src={space.photoUrls[0]}
            alt={space.title}
            width={300}
            height={300}
            className="h-40 w-full object-cover"
            unoptimized
          />
          {space.photoUrls.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              +{space.photoUrls.length - 1}
            </span>
          )}
        </div>
      )}

      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <AvatarImg
            src={space.hostAvatarUrl}
            name={space.hostName}
            className="h-9 w-9 ring-2 ring-degen-500/20"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--color-fg)]">
              {space.hostName}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <LiveDot />
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                {isPhotos ? 'NEW' : 'LIVE'}
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">
                · {formatDuration(space.createdAt)}
              </span>
            </div>
          </div>
        </div>
        {space.recordingUrl && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-900/40 bg-red-950/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            REC
          </span>
        )}
      </div>
      <h3 className="mb-3 line-clamp-2 text-sm font-bold leading-snug text-[var(--color-fg)]">
        {space.title}
      </h3>

      {/* Content type badge */}
      <div className="mb-2 flex items-center gap-1.5">
        <ContentTypeBadge type={space.contentType} />
        {isVideo && space.listeners > 0 && (
          <span className="text-[10px] text-[var(--color-muted)]">{space.listeners} watching</span>
        )}
      </div>

      {space.speakers.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {space.speakers.slice(0, maxVisibleSpeakers).map((speaker) => (
              <SpeakerAvatar key={speaker.id} speaker={speaker} size="sm" />
            ))}
            {space.speakers.length > maxVisibleSpeakers && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-muted)]/20 text-[9px] font-bold text-[var(--color-muted)]">
                +{space.speakers.length - maxVisibleSpeakers}
              </div>
            )}
          </div>
          {speakingCount > 0 && (
            <p className="mt-1 text-[9px] text-degen-400">{speakingCount} speaking</p>
          )}
        </div>
      )}
      {!isVideo && !isPhotos && (
        <div className="mb-3 flex items-center gap-2">
          <Waveform className="h-4" />
          <span className="text-[11px] font-medium text-[var(--color-muted)]">
            {space.listeners} listening
          </span>
          {space.tippingEnabled && (
            <span className="ml-auto">
              <QuickTipButton
                recipientProtocol={space.protocols?.[0] ?? 'ethereum'}
                recipientAuthorId={space.hostId}
                recipientDisplayName={space.hostName}
                subtle
              />
            </span>
          )}
        </div>
      )}
      {(() => {
        const platforms = getSpacePlatforms(space);
        return platforms.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1">
            {platforms.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                style={{ backgroundColor: `${getPlatformColor(p)}15`, color: getPlatformColor(p) }}
              >
                <span className="text-[0.6em]">{getPlatformIcon(p)}</span>
                {getPlatformLabel(p)}
              </span>
            ))}
          </div>
        ) : null;
      })()}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
          aria-label="Share link"
        >
          {copied ? '✓ Copied' : '🔗 Share'}
        </button>
        {!isPhotos && (
          <button
            type="button"
            className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:border-amber-500/30 hover:text-amber-400"
            aria-label="Request to speak"
          >
            ✋ Hand
          </button>
        )}
        {space.tippingEnabled && (
          <button
            type="button"
            onClick={() => onTip(space)}
            className="rounded-xl border border-[var(--color-glass-border)] bg-degen-500/10 px-3 py-2 text-xs font-medium text-degen-400 transition-all hover:bg-degen-500/20"
          >
            ⚡
          </button>
        )}
      </div>
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => onJoin(space.id)}
          className="w-full translate-y-1 rounded-xl border border-transparent bg-degen-500/10 px-4 py-2.5 text-xs font-bold text-degen-400 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 hover:border-degen-500/30 hover:bg-degen-500/20"
        >
          {isPhotos ? 'View' : 'Join'}
        </button>
      </div>
    </div>
  );
}

export function UpcomingSpaceCard({
  space,
  onReminder,
  onTip,
}: {
  space: SpaceItem;
  onReminder: (id: string) => void;
  onTip: (space: SpaceItem) => void;
}) {
  const [reminded, setReminded] = useState(false);
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-card-hover)]">
      <div className="mb-3 flex items-start gap-3">
        <AvatarImg src={space.hostAvatarUrl} name={space.hostName} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[var(--color-fg)]">{space.title}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            by <span className="font-medium text-[var(--color-fg)]">{space.hostName}</span>
          </p>
        </div>
      </div>
      <div className="mb-2">
        <ContentTypeBadge type={space.contentType} />
      </div>
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-cyan-400">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{space.scheduledAt ? formatScheduledDate(space.scheduledAt) : 'TBD'}</span>
        {space.tippingEnabled && (
          <span className="ml-auto">
            <QuickTipButton
              recipientProtocol={space.protocols?.[0] ?? 'ethereum'}
              recipientAuthorId={space.hostId}
              recipientDisplayName={space.hostName}
              subtle
            />
          </span>
        )}
      </div>
      {(() => {
        const platforms = getSpacePlatforms(space);
        return platforms.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1">
            {platforms.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                style={{ backgroundColor: `${getPlatformColor(p)}15`, color: getPlatformColor(p) }}
              >
                <span className="text-[0.6em]">{getPlatformIcon(p)}</span>
                {getPlatformLabel(p)}
              </span>
            ))}
          </div>
        ) : null;
      })()}
      {space.tippingEnabled && (
        <button
          type="button"
          onClick={() => onTip(space)}
          className="mb-2 w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
        >
          Tip ⚡
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setReminded(true);
          onReminder(space.id);
        }}
        disabled={reminded}
        className={`mt-auto w-full rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
          reminded
            ? 'border border-degen-500/30 bg-degen-500/15 text-degen-400'
            : 'border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 text-[var(--color-fg)] hover:border-[var(--color-border)] hover:bg-[var(--color-muted)]/20'
        }`}
      >
        {reminded ? (
          <span className="flex items-center justify-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>{' '}
            Reminder Set
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>{' '}
            Set Reminder
          </span>
        )}
      </button>
    </div>
  );
}

export function PastSpaceCard({ space }: { space: SpaceItem }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/50 p-5 opacity-70 transition-all duration-200 hover:border-[var(--color-border)] hover:opacity-100">
      <div className="mb-3 flex items-start gap-3">
        <AvatarImg
          src={space.hostAvatarUrl}
          name={space.hostName}
          className="h-10 w-10 shrink-0 opacity-70"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[var(--color-fg)]">{space.title}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {space.hostName} · {space.endedAt ? timeAgo(space.endedAt) : timeAgo(space.createdAt)}
          </p>
        </div>
      </div>
      <div className="mb-2">
        <ContentTypeBadge type={space.contentType} />
      </div>
      {space.recordingUrl ? (
        <a
          href={space.recordingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-2.5 text-xs font-semibold text-[var(--color-fg)] transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-muted)]/20"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>{' '}
          Listen to Recording
        </a>
      ) : (
        <div className="mt-auto w-full rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-muted)]/5 px-4 py-2.5 text-center text-xs text-[var(--color-muted)]">
          No recording
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/30 px-4 py-12">
      <span className="mb-4 text-3xl opacity-25" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      <p className="mt-1 max-w-xs text-center text-xs text-[var(--color-muted)]">{subtitle}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 rounded-xl bg-degen-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.2)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function LiveSkeleton() {
  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--color-muted)]/20" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-muted)]/20" />
          <div className="h-2 w-16 animate-pulse rounded bg-[var(--color-muted)]/15" />
        </div>
      </div>
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-[var(--color-muted)]/20" />
      <div className="mb-4 h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted)]/15" />
      <div className="mb-4 flex gap-[2px]">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-3 w-[2px] animate-pulse rounded-full bg-[var(--color-muted)]/20"
          />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--color-muted)]/10" />
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--color-muted)]/20" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-muted)]/20" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-muted)]/15" />
        </div>
      </div>
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[var(--color-muted)]/15" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--color-muted)]/10" />
    </div>
  );
}

// ─── Cross-platform helpers ─────────────────────────────────────────────

/** Map platform ID to display color — expanded for all platforms */
export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    // Audio
    nostr: '#8b5cf6',
    peertube: '#f97316',
    owncast: '#06b6d4',
    livepeer: '#10b981',
    // Social
    farcaster: '#8a63d2',
    lens: '#42e66d',
    bluesky: '#1185fe',
    mastodon: '#6364ff',
    discord: '#5865f2',
    telegram: '#26a5e4',
    twitter: '#1da1f2',
    // Video
    youtube: '#ff0000',
    twitch: '#9146ff',
    kick: '#53fc18',
    // Photos
    'nostr-pictures': '#8b5cf6',
    'bluesky-photos': '#1185fe',
    pixelfed: '#ff0066',
  };
  return colors[platform] ?? '#888';
}

/** Map platform ID to display icon — expanded for all platforms */
export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    // Audio
    nostr: '⚡',
    peertube: '📺',
    owncast: '🔴',
    livepeer: '🎬',
    // Social
    farcaster: '🏎️',
    lens: '🔮',
    bluesky: '🦋',
    mastodon: '🐘',
    discord: '💬',
    telegram: '✈️',
    twitter: '𝕏',
    // Video
    youtube: '▶️',
    twitch: '📡',
    kick: '⚽',
    // Photos
    'nostr-pictures': '📸',
    'bluesky-photos': '🦋',
    pixelfed: '📷',
  };
  return icons[platform] ?? '🌐';
}

/** Map platform ID to display label — expanded for all platforms */
export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    // Audio
    nostr: 'Nostr',
    peertube: 'PeerTube',
    owncast: 'Owncast',
    livepeer: 'LivePeer',
    // Social
    farcaster: 'Farcaster',
    lens: 'Lens',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    discord: 'Discord',
    telegram: 'Telegram',
    twitter: 'X',
    // Video
    youtube: 'YouTube',
    twitch: 'Twitch',
    kick: 'Kick',
    // Photos
    'nostr-pictures': 'Nostr Pic',
    'bluesky-photos': 'Bsky Pic',
    pixelfed: 'Pixelfed',
  };
  return labels[platform] ?? platform;
}

/** Get platform identifiers from a space item (handles legacy and new formats) */
export function getSpacePlatforms(space: {
  protocols?: string[];
  platforms?: Array<{ platform: string }>;
}): string[] {
  if (space.platforms && space.platforms.length > 0) {
    return space.platforms.map((p) => p.platform);
  }
  return space.protocols ?? [];
}
