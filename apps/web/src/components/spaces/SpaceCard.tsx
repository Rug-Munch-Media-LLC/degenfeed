'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useCallback, useState } from 'react';

// === Types ========================================================

interface Speaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
}

export interface SpaceCardData {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  protocols: string[];
  status: 'live' | 'scheduled' | 'ended';
  createdAt: number;
  startedAt?: number;
  scheduledAt?: string;
  listeners: number;
  speakers: Speaker[];
  tippingEnabled: boolean;
  isRecorded: boolean;
  recording?: { url?: string; duration?: number };
}

interface SpaceCardProps {
  space: SpaceCardData;
  variant: 'live' | 'upcoming' | 'past';
  onJoin?: (id: string) => void;
  onReminder?: (id: string) => void;
  onTip?: (space: SpaceCardData) => void;
}

// === Helpers ======================================================

function Avatar({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
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
        unoptimized
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

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 items-center justify-center" role="img" aria-label="Live">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

function formatDuration(startTime: number): string {
  const m = Math.floor((Date.now() - startTime) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// === SpaceCard ====================================================

export function SpaceCard({ space, variant, onJoin, onReminder, onTip }: SpaceCardProps) {
  const [reminded, setReminded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/spaces/${space.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [space.id]);

  const speakingCount = space.speakers.filter((s) => s.speaking).length;
  const maxVisible = 4;

  return (
    <div
      className={`group relative flex w-[300px] shrink-0 snap-start flex-col rounded-2xl border bg-[var(--color-card)] p-5 transition-all duration-300 ${
        variant === 'live'
          ? 'border-[var(--color-glass-border)] hover:border-degen-500/40 hover:shadow-[0_0_24px_rgba(0,255,65,0.06)]'
          : variant === 'upcoming'
            ? 'border-[var(--color-glass-border)]'
            : 'border-[var(--color-glass-border)] opacity-70 hover:opacity-100'
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar
            src={space.hostAvatarUrl}
            name={space.hostName}
            className={`h-9 w-9 ${variant === 'live' ? 'ring-2 ring-degen-500/20' : ''}`}
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--color-fg)]">{space.hostName}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {variant === 'live' && (
                <>
                  <LiveDot />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                    LIVE
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">
                    · {formatDuration(space.createdAt)}
                  </span>
                </>
              )}
              {variant === 'upcoming' && space.scheduledAt && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {formatScheduledDate(space.scheduledAt)}
                </span>
              )}
              {variant === 'past' && (
                <span className="text-[10px] text-[var(--color-muted)]">
                  Ended{space.recording?.duration ? ` · ${Math.floor(space.recording.duration / 60)}m` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        {variant === 'live' && space.isRecorded && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-900/40 bg-red-950/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            REC
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className={`mb-3 line-clamp-2 text-sm font-bold leading-snug text-[var(--color-fg)]`}>
        {space.title}
      </h3>

      {/* Speaker avatars */}
      {space.speakers.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {space.speakers.slice(0, maxVisible).map((speaker) => (
              <div key={speaker.id} className="relative inline-flex flex-col items-center gap-1">
                <Avatar src={speaker.avatarUrl} name={speaker.displayName} className="h-7 w-7" />
              </div>
            ))}
            {space.speakers.length > maxVisible && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-muted)]/20 text-[9px] font-bold text-[var(--color-muted)]">
                +{space.speakers.length - maxVisible}
              </div>
            )}
          </div>
          {variant === 'live' && speakingCount > 0 && (
            <p className="mt-1 text-[9px] text-degen-400">{speakingCount} speaking</p>
          )}
        </div>
      )}

      {/* Listener count & actions */}
      <div className="mb-3 flex items-center gap-2">
        {variant === 'live' && (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="text-degen-500">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[11px] font-medium text-[var(--color-muted)]">
              {space.listeners} listening
            </span>
          </>
        )}
        <div className="ml-auto flex gap-1">
          {/* Protocol badges */}
          {space.protocols.slice(0, 3).map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: `${getProtocolColor(p)}15`, color: getProtocolColor(p) }}
            >
              <span className="text-[0.6em]">{getProtocolIcon(p)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {variant === 'live' && (
          <>
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
            >
              {copied ? '✓ Copied' : '🔗 Share'}
            </button>
            <button
              type="button"
              onClick={() => onJoin?.(space.id)}
              className="flex-[2] rounded-xl bg-degen-500/15 px-3 py-2 text-[10px] font-bold text-degen-400 transition-all hover:bg-degen-500/25"
            >
              Join
            </button>
          </>
        )}
        {variant === 'upcoming' && (
          <>
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
            >
              {copied ? '✓ Copied' : '🔗 Share'}
            </button>
            <button
              type="button"
              onClick={() => {
                setReminded(true);
                onReminder?.(space.id);
              }}
              disabled={reminded}
              className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-semibold transition-all ${
                reminded
                  ? 'border border-degen-500/30 bg-degen-500/15 text-degen-400'
                  : 'border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 text-[var(--color-fg)] hover:border-[var(--color-border)]'
              }`}
            >
              {reminded ? '✓ Reminder Set' : '🔔 Remind'}
            </button>
          </>
        )}
        {variant === 'past' && (
          <button
            type="button"
            onClick={() => onJoin?.(space.id)}
            className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
          >
            {space.recording?.url ? '▶ Listen' : '📄 Details'}
          </button>
        )}
        {space.tippingEnabled && (
          <button
            type="button"
            onClick={() => onTip?.(space)}
            className="rounded-xl border border-[var(--color-glass-border)] bg-amber-500/10 px-2 py-2 text-xs font-medium text-amber-400 transition-all hover:bg-amber-500/20"
            aria-label="Tip host"
          >
            ⚡
          </button>
        )}
      </div>
    </div>
  );
}
