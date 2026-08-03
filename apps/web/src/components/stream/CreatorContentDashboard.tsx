'use client';

/**
 * @degenfeed/web — Creator Content Earnings Dashboard
 *
 * Shows all revenue from creator content sales:
 * - Emoji sales
 * - Custom gift sales
 * - Filter sales
 * - Sticker sales
 *
 * Total earnings, platform fees, itemized breakdown.
 * Real data from /api/live/creator-content/earnings.
 */

import { useState } from 'react';
import useSWR from 'swr';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ContentEarnings {
  earnings: {
    creatorId: string;
    emojiSalesSats: number;
    emojiSalesUsd: number;
    emojiSoldCount: number;
    giftSalesSats: number;
    giftSalesUsd: number;
    giftSoldCount: number;
    filterSalesSats: number;
    filterSalesUsd: number;
    filterSoldCount: number;
    stickerSalesSats: number;
    stickerSalesUsd: number;
    stickerSoldCount: number;
    totalSalesSats: number;
    totalSalesUsd: number;
    platformFeesSats: number;
    platformFeesUsd: number;
    lastUpdated: number;
  };
}

interface EarningsResponse {
  earnings: ContentEarnings['earnings'];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
};

// ─── Stat Card ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: string;
  color: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10">
      <div className="flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`text-[9px] font-semibold ${
              trend.positive ? 'text-degen-400' : 'text-red-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="mt-3 text-xl font-bold text-white tabular-nums tracking-tight">{value}</p>
      <p className="text-[9px] text-white/40">{label}</p>
      {sublabel && <p className="text-[8px] text-white/20 mt-0.5">{sublabel}</p>}
    </div>
  );
}

// ─── Revenue Row ─────────────────────────────────────────────────────────

function RevenueRow({
  icon,
  label,
  sats,
  usd,
  count,
  color,
}: {
  icon: string;
  label: string;
  sats: number;
  usd: number;
  count: number;
  color: string;
}) {
  const maxUsd = 100; // scale reference
  const pct = Math.min((usd / maxUsd) * 100, 100);

  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20 hover:bg-white/10">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80">{label}</span>
            <span className="text-xs font-bold text-white tabular-nums">${usd.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {/* Progress bar */}
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[9px] text-white/40 tabular-nums whitespace-nowrap">
              {count} sold
            </span>
          </div>
        </div>
        <span className="text-[8px] text-white/30 tabular-nums whitespace-nowrap">
          {sats.toLocaleString()} sats
        </span>
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────

interface CreatorContentDashboardProps {
  /** If provided, shows a compact sidebar version */
  compact?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function CreatorContentDashboard({ compact = false }: CreatorContentDashboardProps) {
  const { data, error, mutate } = useSWR<EarningsResponse>(
    '/api/live/creator-content/earnings',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 30000 },
  );

  const earnings = data?.earnings;
  const [activeSection, setActiveSection] = useState<
    'all' | 'emoji' | 'gift' | 'filter' | 'sticker'
  >('all');

  // ─── Compact sidebar version ─────────────────────────────────────────

  if (compact) {
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/40">
            Content Sales
          </h3>
          <button
            type="button"
            onClick={() => mutate()}
            className="text-[8px] text-white/30 hover:text-white/50 transition-colors"
            aria-label="Refresh earnings"
          >
            ↻
          </button>
        </div>

        {error && <p className="text-[8px] text-red-400">Failed to load</p>}

        {!earnings && !error && (
          <div className="py-4 text-center">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        )}

        {earnings && (
          <>
            <div className="text-center">
              <span className="text-lg font-bold text-white tabular-nums">
                ${earnings.totalSalesUsd.toFixed(2)}
              </span>
              <p className="text-[8px] text-white/30">Total earned</p>
            </div>

            <div className="space-y-1">
              <MiniRow icon="😀" label="Emoji" usd={earnings.emojiSalesUsd} color="#00ff41" />
              <MiniRow icon="🎁" label="Gifts" usd={earnings.giftSalesUsd} color="#8B5CF6" />
              <MiniRow icon="🎭" label="Filters" usd={earnings.filterSalesUsd} color="#3B82F6" />
              <MiniRow icon="🎨" label="Stickers" usd={earnings.stickerSalesUsd} color="#F59E0B" />
            </div>

            <div className="border-t border-white/10 pt-2 text-[8px] text-white/20 text-center">
              Fees: ${earnings.platformFeesUsd.toFixed(2)} (15%)
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Full dashboard ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Creator Content Revenue</h2>
          <p className="text-[10px] text-white/40 mt-0.5">
            Earnings from emoji, gift, filter &amp; sticker sales
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-white/50 hover:bg-white/5 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-red-400">Failed to load earnings data</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-2 text-[9px] text-red-300 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {!earnings && !error && (
        <div className="flex items-center justify-center py-12">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        </div>
      )}

      {earnings && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={`$${earnings.totalSalesUsd.toFixed(2)}`}
              sublabel={`${earnings.totalSalesSats.toLocaleString()} sats`}
              icon="💰"
              color="#00ff41"
              trend={{ value: 'Lifetime', positive: true }}
            />
            <StatCard
              label="Items Sold"
              value={(
                earnings.emojiSoldCount +
                earnings.giftSoldCount +
                earnings.filterSoldCount +
                earnings.stickerSoldCount
              ).toLocaleString()}
              icon="📦"
              color="#8B5CF6"
            />
            <StatCard
              label="Platform Fees"
              value={`$${earnings.platformFeesUsd.toFixed(2)}`}
              sublabel={`${earnings.platformFeesSats.toLocaleString()} sats`}
              icon="🏛️"
              color="#F59E0B"
            />
            <StatCard
              label="Net Revenue"
              value={`$${(earnings.totalSalesUsd - earnings.platformFeesUsd).toFixed(2)}`}
              icon="🛡️"
              color="#3B82F6"
            />
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 border-b border-white/10">
            {(['all', 'emoji', 'gift', 'filter', 'sticker'] as const).map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={`px-4 py-2.5 text-[10px] font-medium capitalize transition-all border-b-2 ${
                  activeSection === section
                    ? 'border-degen-500 text-degen-400'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                {section === 'emoji' && '😀 Emoji'}
                {section === 'gift' && '🎁 Gifts'}
                {section === 'filter' && '🎭 Filters'}
                {section === 'sticker' && '🎨 Stickers'}
                {section === 'all' && '📊 All'}
              </button>
            ))}
          </div>

          {/* Revenue breakdown */}
          <div className="space-y-2">
            {(activeSection === 'all' || activeSection === 'emoji') && (
              <RevenueRow
                icon="😀"
                label="Emoji Sales"
                sats={earnings.emojiSalesSats}
                usd={earnings.emojiSalesUsd}
                count={earnings.emojiSoldCount}
                color="#00ff41"
              />
            )}
            {(activeSection === 'all' || activeSection === 'gift') && (
              <RevenueRow
                icon="🎁"
                label="Custom Gift Sales"
                sats={earnings.giftSalesSats}
                usd={earnings.giftSalesUsd}
                count={earnings.giftSoldCount}
                color="#8B5CF6"
              />
            )}
            {(activeSection === 'all' || activeSection === 'filter') && (
              <RevenueRow
                icon="🎭"
                label="Filter Sales"
                sats={earnings.filterSalesSats}
                usd={earnings.filterSalesUsd}
                count={earnings.filterSoldCount}
                color="#3B82F6"
              />
            )}
            {(activeSection === 'all' || activeSection === 'sticker') && (
              <RevenueRow
                icon="🎨"
                label="Sticker Sales"
                sats={earnings.stickerSalesSats}
                usd={earnings.stickerSalesUsd}
                count={earnings.stickerSoldCount}
                color="#F59E0B"
              />
            )}
          </div>

          {/* Last updated */}
          <p className="text-[8px] text-white/20 text-right">
            Last updated: {new Date(earnings.lastUpdated).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Mini Row (compact variant) ──────────────────────────────────────────

function MiniRow({
  icon,
  label,
  usd,
  color,
}: {
  icon: string;
  label: string;
  usd: number;
  color: string;
}) {
  const maxUsd = 100;
  const pct = Math.min((usd / maxUsd) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-5">{icon}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[8px] text-white/50 tabular-nums w-12 text-right">
        ${usd.toFixed(2)}
      </span>
    </div>
  );
}
