'use client';

/**
 * @degenfeed/web — Gift Panel Component
 *
 * Gift selection tray for live streams. Viewers pick a gift type,
 * choose payment method, and send with one click.
 *
 * Telegram-like experience:
 *   - 6 gift tiers with prices
 *   - Package deals (10x at discount)
 *   - Anonymous gifting toggle
 *   - Subscription gifting option
 *   - Streak bonus display
 *   - One-click with saved wallet
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { GiftAnimationOverlay, type GiftAnimationEvent } from './GiftAnimation';

// ─── Types ───────────────────────────────────────────────────────────────

export interface GiftTypeInfo {
  id: string;
  name: string;
  icon: string;
  sats: number;
  usd: number;
  creatorEarnsUsd: number;
  platformFeeUsd: number;
  tier: number;
  animationDurationSec: number;
  animationClass: string;
  isFullScreenAnimation: boolean;
  canGiftSubscription: boolean;
  allowsAnonymous: boolean;
  description: string;
}

export interface GiftPackageInfo {
  id: string;
  name: string;
  description: string;
  giftTypeId: string;
  giftTypeName: string;
  giftIcon: string;
  count: number;
  totalSats: number;
  totalUsd: number;
  discountPercent: number;
  savingsSats: number;
}

export interface StreakInfo {
  count: number;
  label: string;
  animationBonus: string;
  displayMultiplier: number;
}

interface GiftTypesResponse {
  gifts: GiftTypeInfo[];
  streaks: StreakInfo[];
}

interface PackagesResponse {
  packages: GiftPackageInfo[];
}

// ─── Fetcher ──────────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
};

// ─── Props ────────────────────────────────────────────────────────────────

interface GiftPanelProps {
  streamId: string;
  creatorId: string;
  creatorLabel?: string;
  /** Currently connected wallet address */
  walletAddress?: string;
  /** Available balance in sats from the wallet */
  balanceSats?: number;
  /** If true, show full panel (not just the compact bar) */
  expanded?: boolean;
  /** Called when a gift is sent */
  onGiftSent?: (event: GiftAnimationEvent) => void;
  /** Called to toggle panel expansion */
  onToggleExpand?: () => void;
}

// ─── Payment Method Icons ──────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { id: 'lightning', label: 'Lightning', icon: '⚡', color: '#F5A623' },
  { id: 'solana', label: 'Solana', icon: '◎', color: '#9945FF' },
  { id: 'ethereum', label: 'Ethereum', icon: '◆', color: '#627EEA' },
  { id: 'base', label: 'Base', icon: '🛡️', color: '#0052FF' },
  { id: 'creator_coin', label: 'Creator Coin', icon: '🪙', color: '#00ff41' },
];

// ─── Component ────────────────────────────────────────────────────────────

export function GiftPanel({
  streamId,
  creatorId,
  creatorLabel,
  walletAddress,
  balanceSats = 0,
  expanded: initialExpanded = false,
  onGiftSent,
  onToggleExpand,
}: GiftPanelProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [selectedGift, setSelectedGift] = useState<GiftTypeInfo | null>(null);
  const [selectedMethod, setSelectedMethod] = useState('lightning');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<GiftAnimationEvent | null>(null);
  const [recentGifts, setRecentGifts] = useState<Array<{ giftType: GiftTypeInfo; timestamp: number }>>([]);

  // Fetch gift types
  const { data: giftData, error: giftError } = useSWR<GiftTypesResponse>(
    '/api/live/gifts/types',
    fetcher,
    { revalidateOnFocus: false },
  );

  // Fetch packages
  const { data: packagesData } = useSWR<PackagesResponse>(
    showPackages ? '/api/live/gifts/packages' : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const gifts = giftData?.gifts ?? [];
  const streaks = giftData?.streaks ?? [];
  const packages = packagesData?.packages ?? [];

  // Sort gifts by tier
  const sortedGifts = useMemo(() => [...gifts].sort((a, b) => a.tier - b.tier), [gifts]);

  // Handle gift send
  const handleSendGift = useCallback(
    async (gift: GiftTypeInfo, method: string = selectedMethod) => {
      if (!walletAddress && method !== 'lightning') return;
      setIsSending(true);

      try {
        const body = {
          streamId,
          giftTypeId: gift.id,
          creatorId,
          creatorLabel,
          senderId: walletAddress,
          senderLabel: walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : undefined,
          chain: method,
          isAnonymous,
          platform: 'degenfeed',
        };

        const res = await fetch('/api/live/gifts/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as Record<string, string>).error ?? `Send failed: ${res.status}`);
        }

        const data = (await res.json()) as {
          gift: {
            giftTypeId: string;
            icon?: string;
            name?: string;
            tier: number;
            sats: number;
            usd: number;
          };
          streak?: { count: number; label: string; animationBonus: string } | null;
          earnings: { creatorEarnsUsd: number; platformFeeUsd: number };
        };

        // Trigger animation
        const animEvent: GiftAnimationEvent = {
          giftTypeId: data.gift.giftTypeId,
          icon: gift.icon,
          name: gift.name,
          tier: gift.tier,
          sats: data.gift.sats,
          usd: data.gift.usd,
          isFullScreenAnimation: gift.isFullScreenAnimation,
          animationClass: gift.animationClass,
          animationDurationSec: gift.animationDurationSec,
          senderLabel: isAnonymous ? 'Anonymous' : (walletAddress?.slice(0, 8) ?? 'Someone'),
          isAnonymous,
          streak: data.streak ?? undefined,
          creatorLabel,
        };
        setActiveAnimation(animEvent);
        onGiftSent?.(animEvent);

        // Add to recent gifts
        setRecentGifts((prev) => [...prev.slice(-4), { giftType: gift, timestamp: Date.now() }]);

        // Auto-close after sending
        setTimeout(() => {
          setSelectedGift(null);
        }, 1500);
      } catch (err) {
        console.error('[GiftPanel] Send failed:', err);
      } finally {
        setIsSending(false);
      }
    },
    [streamId, creatorId, creatorLabel, walletAddress, isAnonymous, selectedMethod, onGiftSent],
  );

  // Handle package purchase
  const handlePurchasePackage = useCallback(
    async (pkg: GiftPackageInfo) => {
      if (isSending) return;
      setIsSending(true);

      try {
        // Send each gift individually for the package
        for (let i = 0; i < pkg.count; i++) {
          const body = {
            streamId,
            giftTypeId: pkg.giftTypeId,
            creatorId,
            creatorLabel,
            senderId: walletAddress,
            chain: selectedMethod,
            isAnonymous: false,
            isPackage: true,
            packageId: pkg.id,
            platform: 'degenfeed',
          };

          await fetch('/api/live/gifts/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
        }

        // Trigger package animation
        const giftType = gifts.find((g) => g.id === pkg.giftTypeId);
        if (giftType) {
          const animEvent: GiftAnimationEvent = {
            giftTypeId: pkg.giftTypeId,
            icon: pkg.giftIcon,
            name: `${pkg.giftIcon} ${pkg.name}`,
            tier: giftType.tier,
            sats: pkg.totalSats,
            usd: pkg.totalUsd,
            isFullScreenAnimation: true,
            animationClass: giftType.animationClass,
            animationDurationSec: giftType.animationDurationSec * 1.5,
            senderLabel: walletAddress?.slice(0, 8) ?? 'Someone',
            isAnonymous: false,
            isPackage: true,
            packageLabel: pkg.name,
            creatorLabel,
          };
          setActiveAnimation(animEvent);
          onGiftSent?.(animEvent);
        }

        setShowPackages(false);
      } catch (err) {
        console.error('[GiftPanel] Package purchase failed:', err);
      } finally {
        setIsSending(false);
      }
    },
    [streamId, creatorId, creatorLabel, walletAddress, selectedMethod, isSending, gifts, onGiftSent],
  );

  // Handle animation complete
  const handleAnimationComplete = useCallback(() => {
    setActiveAnimation(null);
  }, []);

  // Toggle
  const handleToggle = useCallback(() => {
    setExpanded((v) => !v);
    onToggleExpand?.();
  }, [onToggleExpand]);

  // Get sender's current streak info
  const displayStreak = useMemo(() => {
    if (recentGifts.length === 0) return null;
    const count = recentGifts.length;
    let label = `${count} sent this session`;
    let bonus: string | undefined;
    for (const s of streaks) {
      if (count >= s.count) {
        label = `${count} — ${s.label}`;
        bonus = s.animationBonus;
      }
    }
    return { count, label, bonus };
  }, [recentGifts.length, streaks]);

  // ─── Compact Bar (collapsed state) ──────────────────────────────

  if (!expanded) {
    return (
      <>
        {activeAnimation && (
          <GiftAnimationOverlay event={activeAnimation} onComplete={handleAnimationComplete} />
        )}
        <div className="gift-panel-compact">
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:from-purple-500 hover:to-pink-500 hover:shadow-xl active:scale-95"
          >
            <span>🎁</span>
            <span>Send Gift</span>
            {displayStreak && displayStreak.count >= 3 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px]">
                🔥 {displayStreak.count}
              </span>
            )}
          </button>
        </div>
      </>
    );
  }

  // ─── Full Panel ─────────────────────────────────────────────────

  return (
    <>
      {activeAnimation && (
        <GiftAnimationOverlay event={activeAnimation} onComplete={handleAnimationComplete} />
      )}

      <div className="gift-panel-wrapper">
        <div className="gift-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎁</span>
              <span className="text-sm font-bold text-white">Send a Gift</span>
              {displayStreak && displayStreak.count >= 3 && (
                <span className="rounded-full bg-gradient-to-r from-orange-500/30 to-red-500/30 px-2 py-0.5 text-[9px] font-semibold text-orange-400 border border-orange-500/20">
                  {displayStreak.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {walletAddress && (
                <span className="text-[10px] text-white/40">
                  ⚡ {balanceSats.toLocaleString()} sats
                </span>
              )}
              <button
                type="button"
                onClick={handleToggle}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close gift panel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Gift Grid */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-2">
              {sortedGifts.map((gift) => {
                const isSelected = selectedGift?.id === gift.id;
                const canAfford = balanceSats >= gift.sats;

                return (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => setSelectedGift(isSelected ? null : gift)}
                    disabled={!canAfford && !!walletAddress}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-degen-500 bg-degen-500/20 shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    } ${!canAfford && walletAddress ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={gift.description}
                  >
                    {/* Tier badge */}
                    {gift.tier >= 5 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-[7px]">
                        👑
                      </span>
                    )}

                    <span className="text-2xl">{gift.icon}</span>
                    <span className="text-[10px] font-semibold text-white/80">{gift.name}</span>
                    <span className="text-[9px] text-white/50">${gift.usd.toFixed(2)}</span>
                    <span className="text-[8px] text-white/30">{gift.sats.toLocaleString()} sats</span>

                    {/* Creator earnings hint */}
                    {isSelected && (
                      <span className="mt-1 text-[8px] text-degen-400">
                        Creator earns ${gift.creatorEarnsUsd.toFixed(4)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options bar (anonymous, payment method, subscriptions) */}
          {selectedGift && (
            <div className="border-t border-white/10 px-4 py-3 space-y-3">
              {/* Payment Method */}
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">
                  Pay with
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethod(method.id)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                        selectedMethod === method.id
                          ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                          : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white/80'
                      }`}
                      style={
                        selectedMethod === method.id
                          ? { borderColor: `${method.color}40`, backgroundColor: `${method.color}15`, color: method.color }
                          : {}
                      }
                    >
                      <span>{method.icon}</span>
                      <span>{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options row */}
              <div className="flex items-center justify-between">
                {/* Anonymous toggle */}
                {selectedGift.allowsAnonymous && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-degen-500"
                    />
                    <span className="text-[10px] text-white/60">Send anonymously</span>
                  </label>
                )}

                {/* Subscription gift */}
                {selectedGift.canGiftSubscription && (
                  <button
                    type="button"
                    onClick={() => setShowSubscription((v) => !v)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 underline underline-offset-2"
                  >
                    🎁 Gift a subscription
                  </button>
                )}
              </div>

              {/* Send Button */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSendGift(selectedGift)}
                  disabled={isSending}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending…
                    </span>
                  ) : (
                    <>
                      Send {selectedGift.icon} {selectedGift.name} — ${selectedGift.usd.toFixed(2)}
                    </>
                  )}
                </button>
              </div>

              {/* Creator earns notice */}
              <p className="text-[8px] text-white/30 text-center">
                Creator earns ${selectedGift.creatorEarnsUsd.toFixed(4)} (85%).{' '}
                Platform fee: ${selectedGift.platformFeeUsd.toFixed(4)} (15%).
              </p>
            </div>
          )}

          {/* Package deals button */}
          <div className="border-t border-white/10 px-4 py-2">
            <button
              type="button"
              onClick={() => setShowPackages((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 px-3 py-2 text-[10px] text-yellow-400 hover:from-yellow-500/20 hover:to-orange-500/20 transition-all"
            >
              <span>🎁 Gift packages — Save up to 25%</span>
              <span>{showPackages ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Package grid */}
          {showPackages && packages.length > 0 && (
            <div className="border-t border-white/10 px-4 py-3 max-h-48 overflow-y-auto">
              <span className="mb-2 block text-[9px] font-medium uppercase tracking-wider text-white/40">
                Bundle deals
              </span>
              <div className="grid grid-cols-2 gap-2">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => handlePurchasePackage(pkg)}
                    disabled={isSending}
                    className="flex flex-col items-center gap-1 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 transition-all hover:bg-yellow-500/10 hover:border-yellow-500/30 disabled:opacity-50"
                  >
                    <span className="text-xl">{pkg.giftIcon}</span>
                    <span className="text-[10px] font-semibold text-white/80">
                      {pkg.name}
                    </span>
                    <span className="text-[9px] text-white/50">
                      {pkg.count}× {pkg.giftTypeName}
                    </span>
                    <span className="text-[9px] text-yellow-400 font-medium">
                      {pkg.discountPercent}% OFF
                    </span>
                    <span className="text-[8px] text-white/30">
                      ${pkg.totalUsd.toFixed(2)} (save ${(pkg.savingsSats * 0.0003).toFixed(2)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Streak info */}
          {displayStreak && displayStreak.count >= 1 && (
            <div className="border-t border-white/10 px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Your streak this stream</span>
                <span className="text-[10px] font-semibold text-orange-400">
                  {displayStreak.count} gifts
                  {displayStreak.count >= 3 && ` — ${displayStreak.label}`}
                </span>
              </div>
              {/* Progress bar for next streak tier */}
              <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                  style={{ width: `${Math.min((displayStreak.count / 5) * 100, 100)}%` }}
                />
              </div>
              {displayStreak.count < 5 && (
                <span className="text-[8px] text-white/30">
                  {5 - displayStreak.count} more to unlock On Fire! streak
                </span>
              )}
            </div>
          )}

          {/* Error state */}
          {giftError && (
            <div className="border-t border-red-500/20 px-4 py-2">
              <p className="text-[9px] text-red-400">
                Failed to load gift types. Please refresh.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
