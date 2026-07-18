'use client';

import { getProtocolColor, getProtocolIcon, HostSpaceModal, SpaceRoom } from '@degenfeed/ui';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { QuickTipButton } from '../../components/QuickTipButton';

const TipModal = dynamic(
  () => import('../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

// ─── Types ────────────────────────────────────────────────────────

interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
}

interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

interface SpaceItem {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'live' | 'scheduled' | 'ended';
  createdAt: number;
  scheduledAt?: string;
  listeners: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
  recordingUrl?: string;
  endedAt?: number;
}

// ─── Animation keyframes ──────────────────────────────────────────

const ANIM_STYLES = `
@keyframes waveform {
  0%, 100% { transform: scaleY(0.25); }
  50% { transform: scaleY(1); }
}
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
  70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
`;

// ─── Shared components ────────────────────────────────────────────

function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative flex h-2.5 w-2.5 items-center justify-center ${className}`}
      role="img"
      aria-label="Live"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

function Waveform({ className = '' }: { className?: string }) {
  const bars = [12, 20, 14, 22, 16, 18];
  return (
    <span className={`inline-flex items-end gap-[2px] ${className}`} aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-degen-500/70"
          style={{
            height: `${h}%`,
            animation: `waveform 0.9s ease-in-out ${i * 0.12}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </span>
  );
}

function AvatarImg({
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

function formatDuration(startTime: number): string {
  const m = Math.floor((Date.now() - startTime) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SpacesIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-degen-500"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

function SectionHeader({
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
        <span className="rounded-full bg-[var(--color-muted)]/10 px-2 py-0.5 text-[10px] font-medium text-gray-500">
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

// ─── LiveSpaceCard ────────────────────────────────────────────────

function LiveSpaceCard({
  space,
  onJoin,
  onTip,
}: {
  space: SpaceItem;
  onJoin: (id: string) => void;
  onTip: (space: SpaceItem) => void;
}) {
  return (
    <div
      className="group relative flex w-[300px] shrink-0 snap-start flex-col rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all duration-300 hover:border-degen-500/40 hover:shadow-[0_0_24px_rgba(0,255,65,0.06)]"
      style={{ animation: 'slideUp 0.35s ease-out both' }}
    >
      {/* Host row */}
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
                LIVE
              </span>
              <span className="text-[10px] text-gray-600">· {formatDuration(space.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Topic */}
      <h3 className="mb-3 line-clamp-2 text-sm font-bold leading-snug text-[var(--color-fg)]">
        {space.title}
      </h3>

      {/* Waveform + listeners + tip */}
      <div className="mb-3 flex items-center gap-2">
        <Waveform className="h-4" />
        <span className="text-[11px] font-medium text-gray-500">{space.listeners} listening</span>
        {space.tippingEnabled && (
          <span className="ml-auto">
            <QuickTipButton
              recipientProtocol={space.protocols[0] ?? 'ethereum'}
              recipientAuthorId={space.hostId}
              recipientDisplayName={space.hostName}
              subtle
            />
          </span>
        )}
      </div>

      {/* Protocols */}
      {space.protocols.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {space.protocols.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: `${getProtocolColor(p)}15`, color: getProtocolColor(p) }}
            >
              <span className="text-[0.6em]">{getProtocolIcon(p)}</span>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Tip button — always visible when enabled */}
      {space.tippingEnabled && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => onTip(space)}
            className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-2 text-xs font-medium text-gray-400 transition-all hover:border-degen-500/30 hover:text-degen-400"
          >
            Tip ⚡
          </button>
        </div>
      )}

      {/* Join button — reveals on hover */}
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => onJoin(space.id)}
          className="w-full translate-y-1 rounded-xl border border-transparent bg-degen-500/10 px-4 py-2.5 text-xs font-bold text-degen-400 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 hover:border-degen-500/30 hover:bg-degen-500/20"
        >
          Join Space
        </button>
      </div>
    </div>
  );
}

// ─── UpcomingSpaceCard ────────────────────────────────────────────

function UpcomingSpaceCard({
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
          <p className="mt-0.5 text-xs text-gray-500">
            by <span className="font-medium text-[var(--color-fg)]">{space.hostName}</span>
          </p>
        </div>
      </div>

      {/* Schedule */}
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
              recipientProtocol={space.protocols[0] ?? 'ethereum'}
              recipientAuthorId={space.hostId}
              recipientDisplayName={space.hostName}
              subtle
            />
          </span>
        )}
      </div>

      {/* Protocols */}
      {space.protocols.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {space.protocols.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
              style={{ backgroundColor: `${getProtocolColor(p)}15`, color: getProtocolColor(p) }}
            >
              <span className="text-[0.6em]">{getProtocolIcon(p)}</span>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Tip button */}
      {space.tippingEnabled && (
        <button
          type="button"
          onClick={() => onTip(space)}
          className="mb-2 w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-2 text-xs font-medium text-gray-400 transition-all hover:border-degen-500/30 hover:text-degen-400"
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
            </svg>
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
            </svg>
            Set Reminder
          </span>
        )}
      </button>
    </div>
  );
}

// ─── PastSpaceCard ────────────────────────────────────────────────

function PastSpaceCard({ space }: { space: SpaceItem }) {
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
          <p className="mt-0.5 text-xs text-gray-500">
            {space.hostName} · {space.endedAt ? timeAgo(space.endedAt) : timeAgo(space.createdAt)}
          </p>
        </div>
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
          </svg>
          Listen to Recording
        </a>
      ) : (
        <div className="mt-auto w-full rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-muted)]/5 px-4 py-2.5 text-center text-xs text-gray-500">
          No recording
        </div>
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────

function EmptyState({
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
      <p className="mt-1 max-w-xs text-center text-xs text-gray-500">{subtitle}</p>
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

// ─── Skeletons ────────────────────────────────────────────────────

function LiveSkeleton() {
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

function GridSkeleton() {
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

// ─── Main Page ────────────────────────────────────────────────────

export default function SpacesPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [liveSpaces, setLiveSpaces] = useState<SpaceItem[]>([]);
  const [upcomingSpaces, setUpcomingSpaces] = useState<SpaceItem[]>([]);
  const [pastSpaces, setPastSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHostModal, setShowHostModal] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [tipSpace, setTipSpace] = useState<SpaceItem | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const activeSpace = useMemo(
    () => liveSpaces.find((s) => s.id === activeSpaceId) || null,
    [liveSpaces, activeSpaceId],
  );

  const fetchSpaces = useCallback(async () => {
    try {
      const [liveRes, upcomingRes] = await Promise.all([
        fetch('/api/spaces/live'),
        fetch('/api/spaces/upcoming'),
      ]);
      if (liveRes.ok) {
        const liveData = (await liveRes.json()) as { spaces: SpaceItem[] };
        setLiveSpaces(liveData.spaces);
      }
      if (upcomingRes.ok) {
        const upcomingData = (await upcomingRes.json()) as { spaces: SpaceItem[] };
        setUpcomingSpaces(upcomingData.spaces);
      }
      // Try fetching past spaces (may not exist yet)
      const pastRes = await fetch('/api/spaces/past').catch(() => null);
      if (pastRes?.ok) {
        const pastData = (await pastRes.json()) as { spaces: SpaceItem[] };
        setPastSpaces(pastData.spaces);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpaces();
    pollRef.current = setInterval(fetchSpaces, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSpaces]);

  const handleJoin = useCallback(async (id: string) => {
    try {
      await fetch(`/api/spaces/${id}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      /* non-critical */
    }
    setActiveSpaceId(id);
  }, []);

  const handleReminder = useCallback((_id: string) => {
    // Could integrate with calendar/notification system
  }, []);

  const handleSpaceCreated = useCallback(
    (space: { id: string; title: string; protocols: string[]; status: 'live' | 'scheduled' }) => {
      if (space.status === 'live') setActiveSpaceId(space.id);
      fetchSpaces();
    },
    [fetchSpaces],
  );

  const handleBroadcast = useCallback(async (text: string, protocols: string[]) => {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, targets: protocols }),
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errData?.error || 'Broadcast failed');
    }
  }, []);

  // ── Live Space Room ──
  if (activeSpace) {
    return (
      <>
        <style>{ANIM_STYLES}</style>
        <SpaceRoom
          space={activeSpace}
          currentUserId={hasSignedIn ? 'current-user' : 'anonymous'}
          currentUserDisplayName={hasSignedIn ? 'User' : 'Guest'}
          onLeave={() => setActiveSpaceId(null)}
        />
      </>
    );
  }

  return (
    <>
      <style>{ANIM_STYLES}</style>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ═══ Header ═══ */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-degen-500/20 bg-degen-500/10">
              <SpacesIcon />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-fg)]">
                Audio Spaces
              </h1>
              <p className="mt-0.5 text-xs text-gray-500">
                Live audio rooms across the open social graph
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (hasSignedIn) setShowHostModal(true);
              else openSignIn();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all duration-200 hover:bg-degen-400 hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] active:scale-[0.97]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {hasSignedIn ? 'Start a Space' : 'Connect to Host'}
          </button>
        </header>

        {/* ═══ Loading ═══ */}
        {loading && (
          <div className="space-y-8">
            <section>
              <SectionHeader icon={<LiveDot />} title="Live Now" />
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                {Array.from({ length: 4 }).map((_, i) => (
                  <LiveSkeleton key={i} />
                ))}
              </div>
            </section>
            <section>
              <SectionHeader icon={<span className="text-sm">📅</span>} title="Upcoming" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <GridSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══ Error ═══ */}
        {error && !loading && (
          <div className="mb-6 rounded-2xl border border-red-900/40 bg-red-950/20 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg text-red-400" aria-hidden="true">
                ⚠
              </span>
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={fetchSpaces}
                className="ml-auto rounded-lg border border-red-900/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ═══ Content ═══ */}
        {!loading && (
          <div className="space-y-10">
            {/* ── Live Now ── */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <LiveDot />
                <h2 className="text-sm font-bold tracking-tight text-[var(--color-fg)]">
                  Live Now
                </h2>
                {liveSpaces.length > 0 && (
                  <>
                    <span className="rounded-full bg-[var(--color-muted)]/10 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {liveSpaces.length}
                    </span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-degen-500">
                      LIVE
                    </span>
                  </>
                )}
              </div>

              {liveSpaces.length === 0 ? (
                <EmptyState
                  icon="🎙️"
                  title="No live spaces right now"
                  subtitle="Start one or check back later. Live audio rooms appear here when hosts go live."
                  action={
                    hasSignedIn
                      ? { label: 'Start a Space', onClick: () => setShowHostModal(true) }
                      : undefined
                  }
                />
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
                  {liveSpaces.map((space) => (
                    <LiveSpaceCard key={space.id} space={space} onJoin={handleJoin} onTip={setTipSpace} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Upcoming ── */}
            <section>
              <SectionHeader
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className="text-cyan-400"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                }
                title="Upcoming"
                count={upcomingSpaces.length}
              />
              {upcomingSpaces.length === 0 ? (
                <EmptyState
                  icon="🗓️"
                  title="No upcoming spaces"
                  subtitle="Schedule one to get started."
                  action={
                    hasSignedIn
                      ? { label: 'Schedule a Space', onClick: () => setShowHostModal(true) }
                      : undefined
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingSpaces.map((space) => (
                    <UpcomingSpaceCard key={space.id} space={space} onReminder={handleReminder} onTip={setTipSpace} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Recent ── */}
            <section>
              <SectionHeader
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className="text-gray-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
                title="Recent"
                count={pastSpaces.length}
              />
              {pastSpaces.length === 0 ? (
                <EmptyState
                  icon="📼"
                  title="No past spaces yet"
                  subtitle="Recording playback will appear here once spaces end."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pastSpaces.map((space) => (
                    <PastSpaceCard key={space.id} space={space} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Host modal */}
        {hasSignedIn && (
          <HostSpaceModal
            open={showHostModal}
            onClose={() => setShowHostModal(false)}
            signedInProtocols={signedInProtocols}
            hostId={hasSignedIn ? 'current-user' : ''}
            hostName="User"
            onSpaceCreated={handleSpaceCreated}
            onBroadcast={handleBroadcast}
          />
        )}

        {/* Tip modal */}
        {tipSpace && (
          <TipModal
            open={!!tipSpace}
            onClose={() => setTipSpace(null)}
            recipientProtocol={tipSpace.protocols[0] ?? 'ethereum'}
            recipientAuthorId={tipSpace.hostId}
            recipientDisplayName={tipSpace.hostName}
          />
        )}

        <div className="h-20 lg:hidden" />
      </div>
    </>
  );
}
