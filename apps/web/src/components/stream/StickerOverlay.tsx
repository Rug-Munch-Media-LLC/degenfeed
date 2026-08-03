'use client';

/**
 * @degenfeed/web — TikTok-Style Sticker Overlay
 *
 * Animated stickers that float across the live stream screen.
 * Supports: float-up, diagonal, rain, explode animations.
 * Stickers can be triggered by viewers or creator.
 * Emoji rain = multiple emojis falling like rain.
 */

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import './stream-tiktok-animations.css';

// ─── Types ───────────────────────────────────────────────────────────────

export interface StickerItem {
  id: string;
  name: string;
  imageUrl: string;
  animatedUrl?: string;
  category: string;
  isFree: boolean;
  purchaseSats: number;
  purchaseUsd: number;
  viewerTriggerable: boolean;
  floatAnimation: 'up' | 'diagonal' | 'rain' | 'explode';
  floatDurationSec: number;
  sizeClass: 'sm' | 'md' | 'lg';
}

interface TriggerEvent {
  id: string;
  stickerId: string;
  triggererLabel?: string;
  timestamp: number;
}

interface StickersResponse {
  stickers: StickerItem[];
}

interface ActiveStickersResponse {
  triggers: TriggerEvent[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
};

const SIZE_MAP = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
};

// ─── Floating Sticker Component ──────────────────────────────────────────

interface FloatingStickerProps {
  sticker: StickerItem;
  triggererLabel?: string;
  onComplete: () => void;
  /** Random horizontal offset */
  xOffset?: number;
  /** Delay before start (for rain) */
  delay?: number;
}

function FloatingSticker({
  sticker,
  triggererLabel,
  onComplete,
  xOffset = 0,
  delay = 0,
}: FloatingStickerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const appear = setTimeout(() => setVisible(true), delay * 1000);
    const disappear = setTimeout(
      () => {
        setVisible(false);
        onComplete();
      },
      (delay + sticker.floatDurationSec) * 1000,
    );

    return () => {
      clearTimeout(appear);
      clearTimeout(disappear);
    };
  }, [sticker.floatDurationSec, delay, onComplete]);

  if (!visible) return null;

  const animClass =
    sticker.floatAnimation === 'up'
      ? 'sticker-float-up'
      : sticker.floatAnimation === 'diagonal'
        ? 'sticker-float-diagonal'
        : sticker.floatAnimation === 'rain'
          ? 'sticker-rain'
          : sticker.floatAnimation === 'explode'
            ? 'sticker-explode'
            : 'sticker-float-up';

  return (
    <div
      className={`pointer-events-none z-30 ${animClass} ${SIZE_MAP[sticker.sizeClass] ?? 'text-4xl'}`}
      style={
        {
          '--sticker-x': `${xOffset}px`,
          animationDuration: `${sticker.floatDurationSec}s`,
        } as React.CSSProperties
      }
    >
      {sticker.imageUrl.match(/[❤️⚔️🎙️🎁🚀🌙🔥🎊]/) ? (
        <span className="inline-block drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          {sticker.imageUrl}
        </span>
      ) : (
        <img
          src={sticker.imageUrl}
          alt={sticker.name}
          className="inline-block object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          style={{
            width:
              sticker.sizeClass === 'sm' ? '24px' : sticker.sizeClass === 'lg' ? '64px' : '40px',
            height:
              sticker.sizeClass === 'sm' ? '24px' : sticker.sizeClass === 'lg' ? '64px' : '40px',
          }}
        />
      )}
      {triggererLabel && sticker.floatAnimation === 'explode' && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[8px] text-white/60 backdrop-blur-sm">
            {triggererLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Emoji Rain Generator ────────────────────────────────────────────────

interface RainDrop {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
}


// ─── Props ───────────────────────────────────────────────────────────────

interface StickerOverlayProps {
  streamId: string;
  /** Default stickers available to the creator/viewer panel */
  onTrigger?: (sticker: StickerItem) => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export function StickerOverlay({ streamId, onTrigger }: StickerOverlayProps) {
  const [activeStickers, setActiveStickers] = useState<
    Array<{
      id: string;
      sticker: StickerItem;
      triggererLabel?: string;
      xOffset: number;
      delay: number;
    }>
  >([]);

  // Poll for active sticker triggers from server
  const { data } = useSWR<ActiveStickersResponse>(
    streamId ? `/api/live/stickers/active/${streamId}` : null,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false },
  );

  // Match triggered stickers to definitions
  const { data: stickerDefs } = useSWR<StickersResponse>('/api/live/stickers', fetcher, {
    revalidateOnFocus: false,
  });

  const allStickers = stickerDefs?.stickers ?? [];

  // Process incoming triggers from server
  useEffect(() => {
    if (!data?.triggers || !allStickers.length) return;

    const latestTrigger = data.triggers[data.triggers.length - 1];
    if (!latestTrigger) return;

    // Check if we already have this trigger
    if (activeStickers.some((s) => s.id === latestTrigger.id)) return;

    const stickerDef = allStickers.find((s) => s.id === latestTrigger.stickerId);
    if (!stickerDef) return;

    // Handle rain stickers specially — create many emojis
    if (stickerDef.floatAnimation === 'rain') {
      setActiveStickers((prev) => [
        ...prev,
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `${latestTrigger.id}-${i}`,
          sticker: stickerDef,
          triggererLabel: latestTrigger.triggererLabel,
          xOffset: Math.random() * window.innerWidth * 0.8,
          delay: i * 0.3,
        })),
      ]);
    } else {
      setActiveStickers((prev) => [
        ...prev,
        {
          id: latestTrigger.id,
          sticker: stickerDef,
          triggererLabel: latestTrigger.triggererLabel,
          xOffset: (Math.random() - 0.5) * 200,
          delay: 0,
        },
      ]);
    }
  }, [data, allStickers, activeStickers]);

  const handleComplete = useCallback((id: string) => {
    setActiveStickers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleLocalTrigger = useCallback(
    (sticker: StickerItem) => {
      if (sticker.floatAnimation === 'rain') {
        setActiveStickers((prev) => [
          ...prev,
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `local-${Date.now()}-${i}`,
            sticker,
            xOffset: Math.random() * window.innerWidth * 0.8,
            delay: i * 0.3,
          })),
        ]);
      } else {
        setActiveStickers((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            sticker,
            xOffset: (Math.random() - 0.5) * 200,
            delay: 0,
          },
        ]);
      }
      onTrigger?.(sticker);
    },
    [onTrigger],
  );

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Active floating stickers */}
      {activeStickers.map((s) => (
        <FloatingSticker
          key={s.id}
          sticker={s.sticker}
          triggererLabel={s.triggererLabel}
          xOffset={s.xOffset}
          delay={s.delay}
          onComplete={() => handleComplete(s.id)}
        />
      ))}

      {/* Sticker trigger buttons (shown when panel is visible) */}
      {allStickers.length > 0 && (
        <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
          {allStickers.slice(0, 6).map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => handleLocalTrigger(sticker)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-lg transition-all hover:bg-black/60 hover:scale-110 active:scale-95"
              title={sticker.name}
              aria-label={`Trigger ${sticker.name} sticker`}
            >
              {sticker.imageUrl.match(/[❤️⚔️🎙️🎁🚀🌙🔥🎊]/) ? (
                <span>{sticker.imageUrl}</span>
              ) : (
                <img src={sticker.imageUrl} alt={sticker.name} className="h-5 w-5 object-contain" />
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Sticker Panel (full picker) ─────────────────────────────────────────

interface StickerPanelProps {
  streamId: string;
  onClose: () => void;
  onStickerTriggered?: () => void;
}

export function StickerPanel({ streamId, onClose, onStickerTriggered }: StickerPanelProps) {
  const { data, error } = useSWR<StickersResponse>('/api/live/stickers', fetcher, {
    revalidateOnFocus: false,
  });

  const stickers = data?.stickers ?? [];
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const handleTrigger = useCallback(
    async (sticker: StickerItem) => {
      try {
        await fetch(`/api/live/stickers/${sticker.id}/trigger`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ streamId }),
        });
        onStickerTriggered?.();
      } catch {
        // silently fail
      }
    },
    [streamId, onStickerTriggered],
  );

  const handleBuy = useCallback(async (sticker: StickerItem) => {
    setBuyingId(sticker.id);
    try {
      await fetch(`/api/live/stickers/${sticker.id}/buy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain: 'ethereum' }),
      });
    } catch {
      // silently fail
    } finally {
      setBuyingId(null);
    }
  }, []);

  return (
    <div className="gift-panel-wrapper">
      <div className="gift-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-bold text-white">🎨 Stickers</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {error && <p className="text-[9px] text-red-400">Failed to load stickers</p>}

          {stickers.length === 0 && !error && (
            <div className="py-8 text-center">
              <p className="text-xs text-white/30">No stickers available</p>
            </div>
          )}

          {/* Free stickers */}
          {stickers.filter((s) => s.isFree).length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-medium uppercase tracking-wider text-white/40">
                Free
              </p>
              <div className="grid grid-cols-4 gap-2">
                {stickers
                  .filter((s) => s.isFree)
                  .map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => handleTrigger(sticker)}
                      className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
                      title={sticker.name}
                    >
                      <span className="text-2xl">{sticker.imageUrl}</span>
                      <span className="text-[8px] text-white/50 truncate max-w-full">
                        {sticker.name}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Premium stickers */}
          {stickers.filter((s) => !s.isFree).length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-medium uppercase tracking-wider text-white/40">
                Premium
              </p>
              <div className="grid grid-cols-2 gap-2">
                {stickers
                  .filter((s) => !s.isFree)
                  .map((sticker) => (
                    <div
                      key={sticker.id}
                      className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-2"
                    >
                      <span className="text-xl">{sticker.imageUrl}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white/70 truncate">
                          {sticker.name}
                        </p>
                      </div>
                      {buyingId === sticker.id ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBuy(sticker)}
                          className="rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-2.5 py-1 text-[8px] font-bold text-white"
                        >
                          ${sticker.purchaseUsd.toFixed(2)}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
