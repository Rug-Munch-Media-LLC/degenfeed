'use client';

import Link from 'next/link';
import type { LiveStream } from './useLiveStreams';

/* === Types ==================================================== */

interface SpacesHubProps {
  spaces: LiveStream[];
  isLoading?: boolean;
}

/* === Speaker bubbles for a space card ========================= */

function SpeakerBubbles({
  speakers,
  max = 5,
}: {
  speakers: NonNullable<LiveStream['space']>['speakers'];
  max?: number;
}) {
  const visible = speakers.slice(0, max);
  const remaining = speakers.length - max;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {visible.map((s, _i) => (
          <div
            key={s.userId}
            className={`relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-card)] text-[8px] font-bold transition-all ${
              s.isHost
                ? 'bg-degen-500/20 text-degen-400'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
            }`}
            title={`${s.displayName}${s.isHost ? ' (Host)' : ''}${s.isMuted ? ' [Muted]' : ''}`}
          >
            {s.avatarUrl ? (
              <img src={s.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              s.displayName[0]?.toUpperCase() || '?'
            )}
            {s.isMuted && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="3" />
                </svg>
              </span>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-card)] bg-[var(--color-overlay)] text-[9px] font-medium text-[var(--color-muted)]">
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}

/* === Single space card ======================================== */

function SpaceCard({ space }: { space: LiveStream }) {
  const speakers = space.space?.speakers ?? [];
  const listenerCount = space.space?.listenerCount ?? 0;

  return (
    <Link
      href={`/live/${space.id}`}
      className="group flex items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all hover:border-teal-500/30 hover:shadow-[0_0_20px_var(--color-accent-glow)]"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 text-xl">
        🎙️
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--color-fg)] group-hover:text-degen-400">
            {space.title}
          </h3>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-semibold text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            LIVE
          </span>
        </div>

        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <span>by @{space.creatorHandle}</span>
          <span>·</span>
          <span>{listenerCount} listening</span>
        </div>

        {/* Speaker avatars */}
        {speakers.length > 0 && (
          <div className="mt-2">
            <SpeakerBubbles speakers={speakers} />
          </div>
        )}
      </div>
    </Link>
  );
}

/* === Skeleton ================================================= */

function SpacesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
        >
          <div className="h-12 w-12 shrink-0 skeleton rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 skeleton rounded" />
            <div className="h-3 w-1/3 skeleton rounded" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-7 w-7 skeleton rounded-full" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* === Main Component =========================================== */

export function SpacesHub({ spaces, isLoading = false }: SpacesHubProps) {
  if (isLoading) {
    return (
      <section aria-label="Active audio spaces" className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            🎙️
          </span>
          <h2 className="text-base font-bold text-[var(--color-fg)]">Active Spaces</h2>
        </div>
        <SpacesSkeleton />
      </section>
    );
  }

  if (spaces.length === 0) return null;

  return (
    <section aria-label="Active audio spaces" className="mb-8">
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/10 text-sm">
            🎙️
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--color-fg)]">Active Spaces</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              Live audio conversations happening now
            </p>
          </div>
        </div>
        <Link
          href="/spaces"
          className="text-xs font-medium text-degen-400 transition-colors hover:text-degen-300"
        >
          View all
        </Link>
      </div>

      {/* Spaces list */}
      <div className="space-y-3">
        {spaces.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </section>
  );
}
