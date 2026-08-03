'use client';

import Link from 'next/link';
import CommunityStats from '../../../../components/launch/CommunityStats';
import HolderLeaderboard from '../../../../components/launch/HolderLeaderboard';
import LiveCommentFeed from '../../../../components/launch/LiveCommentFeed';
import LiveStreamPlayer from '../../../../components/launch/LiveStreamPlayer';
import MilestoneTracker from '../../../../components/launch/MilestoneTracker';
import { useBondingCurve } from '../../../../hooks/useBondingCurve';
import { useTokenCommunity } from '../../../../hooks/useTokenCommunity';

/* === Types ============================================ */

interface CommunityPageProps {
  params: { symbol: string };
}

/* === Skeleton Loading ================================= */

function CommunitySkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="skeleton h-8 w-48 rounded-lg mb-6" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-96 w-full rounded-xl" />
        </div>
        <div className="w-full space-y-4 lg:w-80">
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* === Main Page ======================================== */

export default function TokenCommunityPage({ params }: CommunityPageProps) {
  const { symbol } = params;
  // Derive token address from the symbol — in production this comes from the metadata
  const {
    curve,
    totalRaised,
    holderCount,
    isLoading: curveLoading,
  } = useBondingCurve(symbol);

  const tokenAddress = curve?.tokenAddress || '';

  const { data, isLoading, isError, refresh } = useTokenCommunity(tokenAddress);

  // If no token address yet (still loading), show skeleton
  if (!tokenAddress && (curveLoading || isLoading)) {
    return <CommunitySkeleton />;
  }

  // Error state
  if (isError && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <span className="text-2xl">😕</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Community Not Available</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Failed to load community data. The token may not have a community hub yet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/launch/${symbol}`} className="btn-primary">
            ← Back to Token
          </Link>
          <button type="button" onClick={() => refresh()} className="btn-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const communityStats = data?.comments;
  const leaderboard = data?.leaderboard ?? [];
  const onlineNow = data?.onlineNow ?? 0;
  const lastHourBuys = data?.lastHourBuys ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
      {/* Navigation */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/launch" className="hover:text-degen-400 transition-colors">
          Creator Coins
        </Link>
        <span>/</span>
        <Link href={`/launch/${symbol}`} className="hover:text-degen-400 transition-colors">
          ${symbol.toUpperCase()}
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--color-fg)]">Community</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">
            ${symbol.toUpperCase()} Community
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            The permanent home for {symbol.toUpperCase()} holders
          </p>
        </div>
        <Link href={`/launch/${symbol}`} className="btn-secondary px-4 py-2 text-sm">
          ← Back to Token
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ════════ MAIN CONTENT ════════ */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Creator Stream */}
          <LiveStreamPlayer tokenAddress={tokenAddress} tokenSymbol={symbol.toUpperCase()} />

          {/* Discussion Board */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">💬 Discussion</h2>
              <p className="text-xs text-[var(--color-muted)]">
                {communityStats?.total ?? 0} messages in this community
              </p>
            </div>
            <div className="p-0">
              <LiveCommentFeed tokenAddress={tokenAddress} />
            </div>
          </div>

          {/* Past Streams / Recordings (placeholder) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">📺 Past Streams</h2>
            <p className="text-xs text-[var(--color-muted)] text-center py-6">
              No past streams yet. When the creator goes live, recordings will appear here.
            </p>
          </div>

          {/* Community Proposals (placeholder) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              🗳️ Community Proposals
            </h2>
            <p className="text-xs text-[var(--color-muted)] text-center py-6">
              No active proposals. Holders will be able to vote on community decisions soon.
            </p>
          </div>
        </div>

        {/* ════════ SIDEBAR ════════ */}
        <div className="w-full shrink-0 space-y-4 lg:w-80 xl:w-96">
          {/* Community Stats */}
          <CommunityStats
            onlineNow={onlineNow}
            lastHourBuys={lastHourBuys}
            totalHolders={holderCount ?? leaderboard.length}
            totalRaised={totalRaised ?? undefined}
          />

          {/* Milestone Tracker */}
          <MilestoneTracker tokenAddress={tokenAddress} compact />

          {/* Holder Leaderboard */}
          <HolderLeaderboard holders={leaderboard} extended />

          {/* Creator Info (placeholder) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              👤 Creator
            </h3>
            {curve?.creator ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-degen-500/20">
                  {curve.creator.avatar ? (
                    <img
                      src={curve.creator.avatar}
                      alt={curve.creator.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-degen-400">
                      {curve.creator.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">{curve.creator.name}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--color-muted)]">
                      Rep: {curve.creator.reputation}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">Creator data loading...</p>
            )}
          </div>

          {/* NFT Gallery (placeholder) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              🖼️ NFT Gallery
            </h3>
            <p className="text-xs text-[var(--color-muted)] text-center py-4">
              Creators can mint NFTs for their top holders. Coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
