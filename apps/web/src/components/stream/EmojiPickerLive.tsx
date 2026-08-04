'use client';

/**
 * @degenfeed/web — TikTok-Style Emoji Picker for Live Chat
 *
 * Shows default emojis + purchased creator emojis.
 * Emojis animate when sent in chat (effect classes).
 * Creator emojis can be purchased via the marketplace.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import './stream-tiktok-animations.css';

// ─── Types ───────────────────────────────────────────────────────────────

export interface EmojiItem {
  id: string;
  creatorId: string;
  creatorLabel: string;
  shortcode: string;
  imageUrl: string;
  animatedUrl?: string;
  purchaseSats: number;
  purchaseUsd: number;
  tier: 'free' | 'premium' | 'legendary';
  isDefault: boolean;
  category: string;
  effectClass?: string;
  owned: boolean;
}

interface EmojisResponse {
  emojis: EmojiItem[];
}

// ─── Effect class map ────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
};

// ─── Props ───────────────────────────────────────────────────────────────

interface EmojiPickerLiveProps {
  onSelect: (emoji: EmojiItem) => void;
  onClose: () => void;
}

// ─── Categories ──────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  faces: '😊',
  reactions: '🔥',
  greetings: '👋',
  crypto: '🪙',
  meme: '🐸',
  custom: '🎨',
};

const CATEGORY_LABELS: Record<string, string> = {
  faces: 'Faces',
  reactions: 'Reactions',
  greetings: 'Greetings',
  crypto: 'Crypto',
  meme: 'Memes',
  custom: 'Creator',
};

// ─── Component ───────────────────────────────────────────────────────────

export function EmojiPickerLive({ onSelect, onClose }: EmojiPickerLiveProps) {
  const [activeCategory, setActiveCategory] = useState('reactions');
  const [search, setSearch] = useState('');
  const [showMarketplace, setShowMarketplace] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fetch user's emojis (defaults + purchased)
  const { data, error, mutate } = useSWR<EmojisResponse>('/api/live/emojis/my-purchases', fetcher, {
    revalidateOnFocus: false,
  });

  const emojis = data?.emojis ?? [];
  const purchasedEmojis = emojis.filter((e) => e.owned);

  // Get categories from available emojis
  const categories = useMemo(() => {
    const cats = new Set(purchasedEmojis.map((e) => e.category));
    return ['reactions', 'faces', 'greetings', 'crypto', 'meme', 'custom'].filter((c) =>
      cats.has(c),
    );
  }, [purchasedEmojis]);

  // Filtered emojis
  const filteredEmojis = useMemo(() => {
    let list = purchasedEmojis;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.shortcode.toLowerCase().includes(q) ||
          e.creatorLabel.toLowerCase().includes(q) ||
          e.category.includes(q),
      );
    } else if (activeCategory !== 'all') {
      list = list.filter((e) => e.category === activeCategory);
    }
    return list;
  }, [purchasedEmojis, search, activeCategory]);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close from triggering click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const handleSelectEmoji = useCallback(
    (emoji: EmojiItem) => {
      onSelect(emoji);
    },
    [onSelect],
  );

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 w-[340px] rounded-2xl border border-white/10 bg-gray-900/98 backdrop-blur-2xl shadow-2xl overflow-hidden"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-bold text-white/90 tracking-tight">
          {showMarketplace ? 'Emoji Market' : 'Emojis'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMarketplace((v) => !v)}
            className="rounded-lg px-2.5 py-1 text-[9px] font-medium text-degen-400 hover:bg-degen-500/10 transition-colors"
          >
            {showMarketplace ? '◀ My Emojis' : '🛒 Market'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            aria-label="Close emoji picker"
          >
            <svg
              aria-hidden="true"
              width="12"
              height="12"
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
      </div>

      {!showMarketplace ? (
        <>
          {/* Search */}
          <div className="px-3 pt-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emojis..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-degen-500/40 transition-colors"
              aria-label="Search emojis"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-degen-500/20 text-degen-400 border border-degen-500/20'
                    : 'text-white/50 hover:text-white/80 border border-transparent'
                }`}
              >
                <span>{CATEGORY_ICONS[cat] ?? '📦'}</span>
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-6 gap-1.5 px-3 pb-3 max-h-48 overflow-y-auto">
            {filteredEmojis.map((emoji) => (
              <button
                key={emoji.id}
                type="button"
                onClick={() => handleSelectEmoji(emoji)}
                className="group relative flex aspect-square items-center justify-center rounded-xl text-xl transition-all hover:bg-white/10 hover:scale-110 active:scale-95"
                title={`${emoji.shortcode} — by ${emoji.creatorLabel}${emoji.tier !== 'free' ? ` (${emoji.tier})` : ''}`}
              >
                {/* Tier indicator */}
                {emoji.tier === 'legendary' && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500" />
                )}
                {emoji.tier === 'premium' && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-purple-400 to-pink-500" />
                )}
                <span
                  className={`${emoji.isDefault ? '' : 'drop-shadow-[0_0_8px_rgba(0,255,65,0.3)]'}`}
                >
                  {emoji.imageUrl.match(/😊|🔥|🚀|😂|👋|❤️|😎|🙏|👏|💀|☕|🐂|🐻|💎|👀|💰|🐸|⚔️/u) ? (
                    <span className="text-xl">{emoji.imageUrl}</span>
                  ) : (
                    <img
                      src={emoji.imageUrl}
                      alt={emoji.shortcode}
                      className="h-7 w-7 object-contain"
                      loading="lazy"
                    />
                  )}
                </span>
              </button>
            ))}
            {filteredEmojis.length === 0 && (
              <div className="col-span-6 py-6 text-center">
                <p className="text-[10px] text-white/30">No emojis found</p>
                <p className="mt-1 text-[9px] text-white/20">
                  Visit the market to buy creator emojis
                </p>
              </div>
            )}
          </div>

          {/* Creator label */}
          <div className="border-t border-white/10 px-4 py-2">
            <p className="text-[8px] text-white/20 text-center">
              Creator emojis glow green • Premium emojis have a purple dot
            </p>
          </div>
        </>
      ) : (
        /* ─── Marketplace View ─────────────────────────────────────── */
        <MarketplaceView onBuy={mutate} />
      )}

      {/* Error state */}
      {error && (
        <div className="border-t border-red-500/20 px-4 py-2">
          <p className="text-[9px] text-red-400">Failed to load emojis. Pull to refresh.</p>
        </div>
      )}
    </div>
  );
}

// ─── Marketplace Sub-Component ───────────────────────────────────────────

function MarketplaceView({ onBuy }: { onBuy: () => void }) {
  const { data, error } = useSWR<EmojisResponse>('/api/live/emojis/marketplace', fetcher, {
    revalidateOnFocus: false,
  });

  const marketplaceEmojis = (data?.emojis ?? []).filter((e) => !e.isDefault && e.purchaseSats > 0);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const handleBuy = useCallback(
    async (emoji: EmojiItem) => {
      setBuyingId(emoji.id);
      try {
        const res = await fetch(`/api/live/emojis/${emoji.id}/buy`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chain: 'ethereum' }),
        });
        if (!res.ok) throw new Error('Purchase failed');
        onBuy();
      } catch {
        // Silently fail
      } finally {
        setBuyingId(null);
      }
    },
    [onBuy],
  );

  return (
    <div className="px-3 py-2 max-h-80 overflow-y-auto">
      <p className="mb-2 text-[9px] font-medium uppercase tracking-wider text-white/40">
        Creator Emojis — Buy & Use in Chat
      </p>

      {error && <p className="text-[9px] text-red-400">Failed to load marketplace</p>}

      {marketplaceEmojis.length === 0 && !error && (
        <div className="py-6 text-center">
          <p className="text-[10px] text-white/30">No creator emojis available yet</p>
          <p className="mt-1 text-[9px] text-white/20">Be the first to create one!</p>
        </div>
      )}

      <div className="space-y-2">
        {marketplaceEmojis.map((emoji) => (
          <div
            key={emoji.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 transition-all hover:border-white/20 marketplace-card"
          >
            {/* Emoji preview */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-2xl">
              {emoji.imageUrl.match(/😊|🔥|🚀|😂|👋|❤️|😎|🙏|👏|💀|☕|🐂|🐻|💎|👀|💰|🐸|⚔️/u) ? (
                <span>{emoji.imageUrl}</span>
              ) : (
                <img
                  src={emoji.imageUrl}
                  alt={emoji.shortcode}
                  className="h-7 w-7 object-contain"
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white/80 truncate">
                  {emoji.shortcode}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold uppercase ${
                    emoji.tier === 'legendary'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : emoji.tier === 'premium'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {emoji.tier}
                </span>
              </div>
              <p className="text-[9px] text-white/40 truncate">by {emoji.creatorLabel}</p>
            </div>

            {/* Buy button */}
            <button
              type="button"
              onClick={() => handleBuy(emoji)}
              disabled={buyingId === emoji.id}
              className="flex-shrink-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-[9px] font-bold text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 active:scale-95"
            >
              {buyingId === emoji.id ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>${emoji.purchaseUsd.toFixed(2)}</span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
