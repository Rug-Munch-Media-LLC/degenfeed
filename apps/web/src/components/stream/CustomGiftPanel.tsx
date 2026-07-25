'use client';

/**
 * @degenfeed/web — TikTok-Style Custom Gift Panel
 *
 * Shows default platform gifts + creator's custom gifts.
 * Custom gifts have rarity tiers: Common, Rare, Epic, Legendary, Creator Exclusive.
 * Each rarity has unique glow effects and animation intensity.
 * Fans purchase custom gifts as NFTs → creator earns royalties.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import './stream-tiktok-animations.css';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CustomGiftItem {
  id: string;
  creatorId: string;
  creatorLabel: string;
  name: string;
  icon: string;
  rarity: string;
  sats: number;
  usd: number;
  soldCount: number;
  description: string;
  tags: string[];
}

interface CustomGiftsResponse {
  gifts: CustomGiftItem[];
}

interface DefaultGift {
  id: string;
  name: string;
  icon: string;
  sats: number;
  usd: number;
  tier: number;
}

const RARITY_CONFIG: Record<string, { label: string; color: string; glowClass: string; borderColor: string }> = {
  common: { label: 'Common', color: '#9CA3AF', glowClass: 'rarity-glow-common', borderColor: 'border-gray-500/30' },
  rare: { label: 'Rare', color: '#3B82F6', glowClass: 'rarity-glow-rare', borderColor: 'border-blue-500/30' },
  epic: { label: 'Epic', color: '#8B5CF6', glowClass: 'rarity-glow-epic', borderColor: 'border-purple-500/30' },
  legendary: { label: 'Legendary', color: '#F59E0B', glowClass: 'rarity-glow-legendary', borderColor: 'border-yellow-500/30' },
  creator_exclusive: { label: 'Exclusive', color: '#EC4899', glowClass: 'rarity-glow-exclusive', borderColor: 'border-pink-500/30' },
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
};

// ─── Props ───────────────────────────────────────────────────────────────

interface CustomGiftPanelProps {
  streamId: string;
  creatorId: string;
  creatorLabel?: string;
  walletAddress?: string;
  balanceSats?: number;
  onGiftSent?: (gift: CustomGiftItem & { isCustom: boolean }) => void;
  onClose?: () => void;
}

// ─── Default Gifts (same as live-gifts-core) ─────────────────────────────

const DEFAULT_GIFTS: DefaultGift[] = [
  { id: 'rose', name: 'Rose', icon: '🌹', sats: 100, usd: 0.03, tier: 1 },
  { id: 'balloon', name: 'Balloon', icon: '🎈', sats: 500, usd: 0.15, tier: 2 },
  { id: 'diamond', name: 'Diamond', icon: '💎', sats: 5_000, usd: 1.50, tier: 3 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', sats: 10_000, usd: 3.00, tier: 4 },
  { id: 'crown', name: 'Crown', icon: '👑', sats: 50_000, usd: 15.00, tier: 5 },
  { id: 'whale', name: 'Whale', icon: '🐳', sats: 100_000, usd: 30.00, tier: 6 },
];

// ─── Component ───────────────────────────────────────────────────────────

export function CustomGiftPanel({
  streamId,
  creatorId,
  creatorLabel,
  walletAddress,
  balanceSats = 0,
  onGiftSent,
  onClose,
}: CustomGiftPanelProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom' | 'market'>('default');
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Fetch creator's custom gifts
  const { data: customData, error: customError, mutate: refreshCustom } = useSWR<CustomGiftsResponse>(
    activeTab === 'custom' || activeTab === 'market'
      ? `/api/live/gifts/custom/${creatorId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // Fetch marketplace
  const { data: marketData } = useSWR<{ gifts: CustomGiftItem[] }>(
    activeTab === 'market' ? '/api/live/gifts/custom/marketplace' : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const customGifts = customData?.gifts ?? [];
  const marketGifts = marketData?.gifts ?? [];

  const handleSendGift = useCallback(
    async (gift: DefaultGift | CustomGiftItem, isCustom: boolean) => {
      setSendingId(gift.id);
      try {
        if (isCustom) {
          const body = {
            streamId,
            giftTypeId: gift.id,
            creatorId,
            creatorLabel,
            senderId: walletAddress,
            chain: 'ethereum',
            platform: 'degenfeed',
          };

          const res = await fetch('/api/live/gifts/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!res.ok) throw new Error('Send failed');
          onGiftSent?.({ ...gift as CustomGiftItem, isCustom: true });
        } else {
          // Use existing gift send endpoint
          const body = {
            streamId,
            giftTypeId: gift.id,
            creatorId,
            creatorLabel,
            senderId: walletAddress,
            chain: 'ethereum',
            platform: 'degenfeed',
          };

          const res = await fetch('/api/live/gifts/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!res.ok) throw new Error('Send failed');
          onGiftSent?.({ ...gift, isCustom: false } as CustomGiftItem & { isCustom: boolean });
        }
      } catch {
        // handled gracefully
      } finally {
        setSendingId(null);
      }
    },
    [streamId, creatorId, creatorLabel, walletAddress, onGiftSent],
  );

  const canAfford = (sats: number) => !walletAddress || balanceSats >= sats;

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="gift-panel-wrapper">
      <div className="gift-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎁</span>
            <span className="text-sm font-bold text-white">Gifts</span>
            {walletAddress && (
              <span className="text-[9px] text-white/40">⚡ {balanceSats.toLocaleString()} sats</span>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('default')}
            className={`flex-1 py-2.5 text-[10px] font-medium transition-all ${
              activeTab === 'default'
                ? 'text-degen-400 border-b-2 border-degen-500'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            Platform
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2.5 text-[10px] font-medium transition-all ${
              activeTab === 'custom'
                ? 'text-degen-400 border-b-2 border-degen-500'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {creatorLabel ? `${creatorLabel}'s` : 'Creator'} Gifts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={`flex-1 py-2.5 text-[10px] font-medium transition-all ${
              activeTab === 'market'
                ? 'text-degen-400 border-b-2 border-degen-500'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            🛒 Market
          </button>
        </div>

        {/* ─── Default Gifts ───────────────────────────────────────── */}
        {activeTab === 'default' && (
          <div className="grid grid-cols-3 gap-2 p-4">
            {DEFAULT_GIFTS.map((gift) => {
              const isSending = sendingId === gift.id;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleSendGift(gift, false)}
                  disabled={isSending || (!canAfford(gift.sats) && !!walletAddress)}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                    !canAfford(gift.sats) && walletAddress
                      ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:scale-95 cursor-pointer'
                  }`}
                >
                  <span className="text-2xl">{gift.icon}</span>
                  <span className="text-[10px] font-semibold text-white/80">{gift.name}</span>
                  <span className="text-[9px] text-white/50">${gift.usd.toFixed(2)}</span>
                  {isSending && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Creator Custom Gifts ─────────────────────────────────── */}
        {activeTab === 'custom' && (
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {customGifts.length === 0 && !customError && (
              <div className="py-8 text-center">
                <p className="text-xs text-white/30">No custom gifts yet</p>
                <p className="text-[9px] text-white/20 mt-1">Creators can design their own gifts</p>
              </div>
            )}
            {customError && (
              <p className="text-[9px] text-red-400 text-center py-4">Failed to load custom gifts</p>
            )}
            {customGifts.map((gift) => {
              const rarity = RARITY_CONFIG[gift.rarity] ?? RARITY_CONFIG.common!;
              const isSending = sendingId === gift.id;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleSendGift(gift, true)}
                  disabled={isSending}
                  className={`w-full flex items-center gap-3 rounded-xl border ${rarity.borderColor} bg-white/5 p-3 transition-all hover:bg-white/10 active:scale-[0.98] ${rarity.glowClass} ${!canAfford(gift.sats) && walletAddress ? 'opacity-40' : ''}`}
                  style={{
                    borderColor: canAfford(gift.sats) ? undefined : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Icon */}
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-2xl">
                    {gift.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/90 truncate">{gift.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[7px] font-semibold uppercase whitespace-nowrap"
                        style={{ backgroundColor: `${rarity.color}20`, color: rarity.color }}
                      >
                        {rarity.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/40 mt-0.5 truncate">{gift.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-medium text-white/60">${gift.usd.toFixed(2)}</span>
                      <span className="text-[8px] text-white/30">by {gift.creatorLabel}</span>
                    </div>
                  </div>

                  {/* Send */}
                  <div className="flex-shrink-0">
                    {isSending ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
                    ) : (
                      <span className="text-lg">{gift.icon}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Market ──────────────────────────────────────────────── */}
        {activeTab === 'market' && (
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            <p className="text-[9px] font-medium uppercase tracking-wider text-white/40 mb-2">
              All Custom Gifts — Buy & Send
            </p>
            {marketGifts.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-xs text-white/30">No custom gifts in marketplace yet</p>
                <p className="text-[9px] text-white/20 mt-1">Creators haven&apos;t designed any yet</p>
              </div>
            )}
            {marketGifts.map((gift) => {
              const rarity = RARITY_CONFIG[gift.rarity] ?? RARITY_CONFIG.common!;
              return (
                <div
                  key={gift.id}
                  className={`flex items-center gap-3 rounded-xl border ${rarity.borderColor} bg-white/5 p-3 ${rarity.glowClass} marketplace-card`}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                    {gift.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/80 truncate">{gift.name}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[7px] font-semibold uppercase" style={{ backgroundColor: `${rarity.color}20`, color: rarity.color }}>
                        {rarity.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/40 truncate">by {gift.creatorLabel} • {gift.soldCount} sold</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-[9px] font-bold text-white hover:from-purple-500 hover:to-pink-500 transition-all active:scale-95"
                    onClick={async () => {
                      try {
                        await fetch(`/api/live/gifts/custom/${gift.id}/buy`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ chain: 'ethereum' }),
                        });
                        refreshCustom();
                      } catch { /* handled */ }
                    }}
                  >
                    ${gift.usd.toFixed(2)}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
