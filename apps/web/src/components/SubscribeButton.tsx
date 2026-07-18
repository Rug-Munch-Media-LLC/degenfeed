'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import SubscriberBadge from './SubscriberBadge';

interface SubscribeButtonProps {
  creator: string;
  creatorProtocol?: 'ethereum' | 'solana';
  variant?: 'primary' | 'subtle' | 'compact';
  onSubscribe?: () => void;
  subscribed?: boolean;
  currentTier?: string;
}

const variantClasses: Record<NonNullable<SubscribeButtonProps['variant']>, string> = {
  primary: 'btn-primary gap-2 px-4 py-2 text-sm',
  subtle:
    'rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] hover:border-degen-500/30 hover:bg-degen-500/10 transition-colors gap-2',
  compact:
    'inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-transparent px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors',
};

export default function SubscribeButton({
  creator,
  variant = 'primary',
  onSubscribe,
  subscribed = false,
  currentTier,
}: SubscribeButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    onSubscribe?.();
    router.push(`/subscribe/${encodeURIComponent(creator)}`);
    window.dispatchEvent(
      new CustomEvent('df-toast', { detail: { kind: 'success', message: 'Subscribed!' } }),
    );
  }, [creator, onSubscribe, router]);

  if (subscribed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-degen-500/15 px-3 py-1.5 text-sm font-medium text-degen-400">
        <span aria-hidden="true">✓</span>
        <span>Subscribed</span>
        {currentTier && (
          <SubscriberBadge tier={currentTier as 'supporter' | 'member' | 'patron'} size="sm" />
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={variantClasses[variant]}
      aria-label={`Subscribe to creator ${creator.slice(0, 6)}...${creator.slice(-4)}`}
    >
      {variant === 'compact' ? (
        <>
          <span aria-hidden="true" className="text-degen-400">
            +
          </span>
          <span>Subscribe</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">✦</span>
          <span>Subscribe</span>
        </>
      )}
    </button>
  );
}
