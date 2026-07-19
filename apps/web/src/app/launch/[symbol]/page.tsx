'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BondingCurveChart from '../../../components/launch/BondingCurveChart';
import BuySellInterface from '../../../components/launch/BuySellInterface';
import type { CoinCardData } from '../../../components/launch/CoinCard';
import CommunityStats from '../../../components/launch/CommunityStats';
import CreatorInfo from '../../../components/launch/CreatorInfo';
import HolderLeaderboard from '../../../components/launch/HolderLeaderboard';
import HolderList from '../../../components/launch/HolderList';
import LiveCommentFeed from '../../../components/launch/LiveCommentFeed';
import LiveStreamPlayer from '../../../components/launch/LiveStreamPlayer';
import MilestoneTracker from '../../../components/launch/MilestoneTracker';
import ProgressBar from '../../../components/launch/ProgressBar';
import TradeFeed from '../../../components/launch/TradeFeed';
import {
  formatBondingPrice,
  formatBondingUsd,
  useBondingCurve,
} from '../../../hooks/useBondingCurve';
import { useTokenCommunity } from '../../../hooks/useTokenCommunity';

const ShareModal = dynamic(() => import('../../../components/launch/ShareModal'), { ssr: false });

/* ─── Types ──────────────────────────────────────────── */

interface CoinPageData {
  address: string;
  symbol: string;
  name: string;
  description: string;
  image?: string;
  creator: {
    address: string;
    name: string;
    reputation: number;
    avatar?: string;
    socials?: Record<string, string>;
    otherCoins?: Array<{ symbol: string; address: string; progress: number }>;
  };
  socialProofCount: number;
  graduated?: boolean;
  graduationTarget?: number;
  antiSnipeMax?: string;
}

/* ─── Helpers ────────────────────────────────────────── */

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ─── Skeleton Loading ───────────────────────────────── */

function CoinPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
        <div className="w-full space-y-4 lg:w-96">
          <div className="skeleton h-96 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function CoinPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = typeof params.symbol === 'string' ? params.symbol : '';

  // Fetch live bonding curve data
  const {
    curve,
    price,
    progress,
    totalRaised,
    recentTrades,
    holderCount,
    isLoading: curveLoading,
    isError: curveError,
    isLive,
    refresh,
  } = useBondingCurve(symbol);

  // Page-level static data (coin metadata)
  const [pageData, setPageData] = useState<CoinPageData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Community engagement data
  const tokenAddress = curve?.tokenAddress ?? pageData?.address ?? '';
  const {
    data: communityData,
  } = useTokenCommunity(tokenAddress);

  // Fetch coin metadata
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const fetchMeta = async () => {
      setPageLoading(true);
      try {
        const res = await fetch(`/api/creator/coin/${encodeURIComponent(symbol)}`);
        if (res.ok) {
          const data = (await res.json()) as CoinPageData;
          if (!cancelled) setPageData(data);
        } else {
          // Dev fallback with mock data
          if (!cancelled) {
            setPageData({
              address: `0x${Math.random().toString(16).slice(2, 42)}`,
              symbol: symbol.toUpperCase(),
              name: symbol.charAt(0).toUpperCase() + symbol.slice(1) + ' Token',
              description:
                'A community-driven creator coin launching on DegenFeed with a fair bonding curve. Join the prebonding phase and be part of the journey to graduation!',
              creator: {
                address: `0x${Math.random().toString(16).slice(2, 42)}`,
                name: `${symbol}.eth`,
                reputation: Math.floor(Math.random() * 60) + 30,
                socials: {
                  twitter: 'https://twitter.com/degenfeed',
                  farcaster: 'https://warpcast.com/degenfeed',
                  bluesky: 'https://bsky.app/profile/degenfeed.xyz',
                },
                otherCoins: [
                  { symbol: 'PREV', address: '0x1234', progress: 100 },
                  { symbol: 'TEST', address: '0x5678', progress: 45 },
                ],
              },
              socialProofCount: Math.floor(Math.random() * 200) + 10,
              graduationTarget: 50,
              antiSnipeMax: '2 ETH',
            });
          }
        }
      } catch {
        if (!cancelled) {
          setPageData(null);
          setPageError('Failed to load coin data');
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    void fetchMeta();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const handleBuy = useCallback(
    (amount: string) => {
      setTxError(null);
      // TODO: Integrate with wallet/web3 for actual transaction
      console.log(`Buy ${amount} ${symbol}`);
    },
    [symbol],
  );

  const handleSell = useCallback(
    (amount: string) => {
      setTxError(null);
      // TODO: Integrate with wallet/web3 for actual transaction
      console.log(`Sell ${amount} ${symbol}`);
    },
    [symbol],
  );

  // Loading state
  if (pageLoading && !pageData) return <CoinPageSkeleton />;

  // Error state
  if (pageError && !pageData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Coin Not Found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{pageError}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/launch" className="btn-primary">
            ← Browse Coins
          </Link>
          <button type="button" onClick={() => refresh()} className="btn-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const displayData = pageData!;
  const coinName = displayData.name;
  const coinSymbol = displayData.symbol;
  const isGraduated = curve?.phase === 'graduated' || displayData.graduated;

  // Social proof count (from curve or page data)
  const socialProof = curve?.socialProof ?? displayData.socialProofCount;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/launch" className="hover:text-degen-400 transition-colors">
          Creator Coins
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--color-fg)]">${coinSymbol}</span>
      </nav>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ════════ LEFT: Chart + Info ════════ */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Coin identity */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-degen-500/30 bg-gradient-to-br from-degen-500/20 to-purple-500/20">
              {displayData.image ? (
                <img
                  src={displayData.image}
                  alt={coinSymbol}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-degen-400">{coinSymbol.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">{coinName}</h1>
                <span className="rounded-lg bg-[var(--color-overlay)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--color-muted)]">
                  ${coinSymbol}
                </span>
                {isGraduated && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-degen-500/20 to-fuchsia-500/20 px-3 py-0.5 text-[10px] font-semibold text-fuchsia-400">
                    ✅ Graduated
                  </span>
                )}
              </div>
              {displayData.description && (
                <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">
                  {displayData.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-[var(--color-muted)]">
                  by{' '}
                  <span className="font-medium text-[var(--color-fg)]">
                    {displayData.creator.name}
                  </span>
                </span>
                <span className="text-[var(--color-muted)]">·</span>
                <span className="font-mono tabular-nums text-[var(--color-muted)]">
                  {shortenAddress(displayData.address)}
                </span>
              </div>
            </div>

            {/* Share button */}
            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="btn-secondary shrink-0 px-3 py-2 text-xs"
              aria-label="Share coin"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>
          </div>

          {/* Bonding curve chart */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Bonding Curve</h2>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="flex items-center gap-1 text-[10px] text-degen-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
                    Live
                  </span>
                )}
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                  aria-label="Refresh chart"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              </div>
            </div>
            <BondingCurveChart
              price={price}
              trades={recentTrades}
              loading={curveLoading}
              compact={false}
            />
          </div>

          {/* Progress bar */}
          <ProgressBar
            progress={progress ?? 0}
            phase={curve?.phase || 'early'}
            size="lg"
            label={
              isGraduated
                ? '🚀 Graduated!'
                : `${Math.round(progress ?? 0)}% to graduation — ${curve?.remainingToGraduate ? formatBondingUsd(curve.remainingToGraduate) : '—'} remaining!`
            }
          />

          {/* Price + Market data */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Price
              </span>
              <p className="mt-1 text-sm font-bold tabular-nums text-degen-400">
                {price ? formatBondingPrice(price) : '—'}
              </p>
              {curve?.priceChange24h !== undefined && (
                <p
                  className={`text-[10px] tabular-nums ${curve.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                >
                  {curve.priceChange24h >= 0 ? '+' : ''}
                  {curve.priceChange24h.toFixed(2)}% (24h)
                </p>
              )}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Total Raised
              </span>
              <p className="mt-1 text-sm font-bold tabular-nums text-[var(--color-fg)]">
                {totalRaised !== null ? formatBondingUsd(totalRaised) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Holders
              </span>
              <p className="mt-1 text-sm font-bold tabular-nums text-[var(--color-fg)]">
                {holderCount !== null ? formatCompact(holderCount) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Market Cap
              </span>
              <p className="mt-1 text-sm font-bold tabular-nums text-[var(--color-fg)]">
                {curve?.marketCap ? formatBondingUsd(curve.marketCap) : '—'}
              </p>
            </div>
          </div>

          {/* Social proof banner */}
          {socialProof > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
              </span>
              <span className="text-sm font-medium text-degen-400">
                🔥 {formatCompact(socialProof)} people bought ${coinSymbol} recently
              </span>
            </div>
          )}

          {/* ════ Live Engagement Section ════ */}
          {tokenAddress && (
            <div className="space-y-4">
              {/* Phase indicator */}
              {!isGraduated && curve?.phase && (
                <div className="flex items-center gap-2 rounded-xl border border-degen-500/10 bg-gradient-to-r from-degen-500/5 to-purple-500/5 px-4 py-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
                  </span>
                  <span className="text-xs font-medium text-degen-400">
                    {curve.phaseLabel || `${curve.phase.charAt(0).toUpperCase() + curve.phase.slice(1)} phase`}
                    {curve.phase === 'early' && ' — 2% max buys! Bonding in progress'}
                  </span>
                </div>
              )}

              {/* Live Stream Player */}
              <LiveStreamPlayer
                tokenAddress={tokenAddress}
                tokenSymbol={coinSymbol}
              />

              {/* Live Comment Feed */}
              <LiveCommentFeed tokenAddress={tokenAddress} />

              {/* Community link */}
              {isGraduated && (
                <Link
                  href={`/launch/${symbol}/community`}
                  className="flex items-center justify-between rounded-xl border border-degen-500/20 bg-gradient-to-r from-degen-500/10 to-fuchsia-500/10 px-4 py-3 transition-colors hover:from-degen-500/20 hover:to-fuchsia-500/20"
                >
                  <div>
                    <span className="text-sm font-semibold text-[var(--color-fg)]">
                      🏛️ Community Hub
                    </span>
                    <p className="text-xs text-[var(--color-muted)]">
                      Full discussion board, holder leaderboard, and more
                    </p>
                  </div>
                  <span className="text-lg">→</span>
                </Link>
              )}
            </div>
          )}

          {/* Creator info */}
          <CreatorInfo creator={displayData.creator} />

          {/* Other coins by creator */}
          {displayData.creator.otherCoins && displayData.creator.otherCoins.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                More by this Creator
              </h3>
              <div className="flex flex-wrap gap-2">
                {displayData.creator.otherCoins.map((oc) => (
                  <Link
                    key={oc.address}
                    href={`/launch/${oc.symbol.toLowerCase()}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs transition-colors hover:border-degen-500/30 hover:text-degen-400"
                  >
                    <span className="font-mono font-medium">${oc.symbol}</span>
                    {oc.progress >= 100 ? (
                      <span className="text-[10px] text-degen-400">✅</span>
                    ) : (
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {Math.round(oc.progress)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Graduated tip */}
          {isGraduated && (
            <div className="rounded-xl border border-degen-500/20 bg-gradient-to-r from-degen-500/10 to-fuchsia-500/10 p-5 text-center">
              <span className="text-3xl">🎉</span>
              <h3 className="mt-2 text-base font-bold text-[var(--color-fg)]">
                {coinSymbol} has Graduated!
              </h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                This coin reached its bonding curve target. It&apos;s now trading on a real DEX.
                Holders can claim their tokens and trade freely.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                {curve?.coingeckoId && (
                  <a
                    href={`https://dexscreener.com/search?q=${coinSymbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-sm"
                  >
                    View on DexScreener
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ════════ RIGHT: Buy/Sell + Trades + Holders ════════ */}
        <div className="w-full shrink-0 space-y-5 lg:w-96 xl:w-[420px]">
          {/* Buy/Sell Interface */}
          <BuySellInterface
            price={price}
            symbol={coinSymbol}
            maxPerWallet={displayData.antiSnipeMax || '2 ETH'}
            graduated={isGraduated}
            phaseLabel={curve?.phaseLabel || 'Prebonding'}
            loading={curveLoading}
            error={txError ?? undefined}
            onBuy={handleBuy}
            onSell={handleSell}
          />

          {/* Live Trade Feed */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <TradeFeed
              trades={recentTrades}
              loading={curveLoading && recentTrades.length === 0}
              maxItems={20}
            />
          </div>

          {/* Top Holders */}
          {!tokenAddress && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <HolderList
                holders={curve?.holderList ?? []}
                totalHolders={holderCount ?? undefined}
                loading={curveLoading}
                maxItems={8}
              />
            </div>
          )}

          {/* Community engagement sidebar (when token address is known) */}
          {tokenAddress && (
            <div className="space-y-4">
              {/* Community Stats */}
              <CommunityStats
                onlineNow={communityData?.onlineNow ?? 0}
                lastHourBuys={communityData?.lastHourBuys ?? 0}
                totalHolders={holderCount ?? 0}
                totalRaised={totalRaised ?? undefined}
              />

              {/* Milestone Tracker */}
              <MilestoneTracker tokenAddress={tokenAddress} compact />

              {/* Holder Leaderboard */}
              <HolderLeaderboard
                holders={communityData?.leaderboard ?? curve?.holderList?.map(h => ({
                  wallet: h.address,
                  amount: String(h.usdValue),
                  percentage: h.percentage,
                  usdValue: h.usdValue,
                  badges: [],
                  isCreator: false,
                })) ?? []}
                loading={curveLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        symbol={coinSymbol}
        name={coinName}
        url={typeof window !== 'undefined' ? window.location.href : `/launch/${symbol}`}
        creatorAddress={displayData.address}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </div>
  );
}
