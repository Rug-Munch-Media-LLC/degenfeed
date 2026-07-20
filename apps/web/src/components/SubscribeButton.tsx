'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { type PremiumTier, TIERS } from '../hooks/usePremium';
import SubscriberBadge from './SubscriberBadge';

interface SubscribeButtonProps {
  creator: string;
  creatorProtocol?: 'ethereum' | 'solana';
  variant?: 'primary' | 'subtle' | 'compact';
  onSubscribe?: (tierId: PremiumTier) => void;
  subscribed?: boolean;
  currentTier?: PremiumTier;
}

const variantClasses: Record<NonNullable<SubscribeButtonProps['variant']>, string> = {
  primary: 'btn-primary gap-2 px-4 py-2 text-sm',
  subtle:
    'rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] hover:border-degen-500/30 hover:bg-degen-500/10 transition-colors gap-2',
  compact:
    'inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-transparent px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors',
};

const SUB_TIERS: Array<{
  id: PremiumTier;
  name: string;
  price: string;
  color: string;
  bg: string;
  benefits: string[];
}> = [
  {
    id: 'pro',
    name: 'Fan',
    price: '$10/mo',
    color: '#1aff6e',
    bg: 'rgba(0,255,65,0.08)',
    benefits: ['Subscriber badge', 'Exclusive posts', 'Ad-free browsing'],
  },
  {
    id: 'creator',
    name: 'Supporter',
    price: '$25/mo',
    color: '#8a63d2',
    bg: 'rgba(138,99,210,0.08)',
    benefits: ['Everything in Fan', 'Early access to content', 'Priority replies'],
  },
  {
    id: 'enterprise',
    name: 'Patron',
    price: '$50/mo',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    benefits: ['Everything in Supporter', 'Private creator chat', 'Direct influence on content'],
  },
];

function TierPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (tierId: PremiumTier) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Choose subscription tier"
    >
      <section
        className="w-full max-w-sm rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Choose Your Tier</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]/10 hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {SUB_TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => {
                onSelect(tier.id);
                onClose();
              }}
              className="group w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/50 p-4 text-left transition-all hover:border-degen-500/30"
              style={
                {
                  '--tier-color': tier.color,
                } as React.CSSProperties
              }
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: tier.bg, color: tier.color }}
                  >
                    ✦
                  </div>
                  <span className="text-sm font-bold text-[var(--color-fg)]">{tier.name}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: tier.color }}>
                  {tier.price}
                </span>
              </div>
              <ul className="space-y-1">
                {tier.benefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="shrink-0"
                      style={{ color: tier.color }}
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] text-[var(--color-muted)]">
          Cancel anytime · Powered by crypto · No KYC required
        </p>
      </section>
    </div>
  );
}

export default function SubscribeButton({
  creator,
  variant = 'primary',
  onSubscribe,
  subscribed = false,
  currentTier,
}: SubscribeButtonProps) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const handleClick = useCallback(() => {
    setShowPicker(true);
  }, []);

  const handleSelect = useCallback(
    (tierId: PremiumTier) => {
      onSubscribe?.(tierId);
      setAnimKey((k) => k + 1);
      router.push(`/subscribe/${encodeURIComponent(creator)}?tier=${tierId}`);
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: {
            kind: 'success',
            message: `Subscribed as ${SUB_TIERS.find((t) => t.id === tierId)?.name ?? tierId}!`,
          },
        }),
      );
    },
    [creator, onSubscribe, router],
  );

  if (subscribed) {
    return (
      <span
        key={animKey}
        className="inline-flex items-center gap-1.5 rounded-lg bg-degen-500/15 px-3 py-1.5 text-sm font-medium text-degen-400 animate-slide-up"
      >
        <span aria-hidden="true">✓</span>
        <span>Subscribed</span>
        {currentTier && (
          <SubscriberBadge tier={currentTier as 'fan' | 'supporter' | 'patron'} size="sm" />
        )}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`group relative ${variantClasses[variant]}`}
        aria-label={`Subscribe to ${creator}`}
      >
        {variant === 'compact' ? (
          <>
            <span aria-hidden="true" className="text-degen-400 group-hover:animate-heart-pop">
              +
            </span>
            <span>Subscribe</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="group-hover:animate-heart-pop">
              ✦
            </span>
            <span>Subscribe</span>
            {/* Hover tooltip */}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-muted)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Fan $10 · Supporter $25 · Patron $50
            </span>
          </>
        )}
      </button>

      <TierPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelect}
      />
    </>
  );
}
