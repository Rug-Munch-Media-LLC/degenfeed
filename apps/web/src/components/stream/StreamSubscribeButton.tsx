'use client';

import { useCallback, useState } from 'react';

interface StreamSubscribeButtonProps {
  streamId: string;
  isSubscribed?: boolean;
  onSubscribe?: (id: string) => void;
}

export function StreamSubscribeButton({
  streamId,
  isSubscribed: initial = false,
  onSubscribe,
}: StreamSubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(initial);
  const [showTiers, setShowTiers] = useState(false);

  const tiers = [
    { level: 'Tier 1', price: '$4.99', badge: 'SUB', color: '#9146FF' },
    { level: 'Tier 2', price: '$9.99', badge: 'SUB', color: '#B366FF' },
    { level: 'Tier 3', price: '$24.99', badge: 'SUB', color: '#D499FF' },
  ];

  const handleSubscribe = useCallback(
    (_tier: string) => {
      setSubscribed(true);
      setShowTiers(false);
      onSubscribe?.(streamId);
    },
    [streamId, onSubscribe],
  );

  if (subscribed) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-400 transition-all hover:bg-purple-500/20"
        aria-label="Subscribed"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        Subscribed
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowTiers((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500 active:scale-[0.97]"
        aria-label="Subscribe"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        Subscribe
      </button>

      {showTiers && (
        <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl animate-slide-up z-50">
          {tiers.map((tier) => (
            <button
              key={tier.level}
              type="button"
              onClick={() => handleSubscribe(tier.level)}
              className="flex w-full items-center justify-between px-4 py-3 text-xs transition-colors hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[8px] font-bold text-white"
                  style={{ backgroundColor: tier.color }}
                >
                  {tier.badge}
                </span>
                <span className="text-white/90">{tier.level}</span>
              </div>
              <span className="font-semibold text-white">{tier.price}</span>
            </button>
          ))}
          <div className="border-t border-white/10 px-4 py-2">
            <p className="text-[9px] text-white/30">Cancel anytime • Supports the creator</p>
          </div>
        </div>
      )}
    </div>
  );
}
