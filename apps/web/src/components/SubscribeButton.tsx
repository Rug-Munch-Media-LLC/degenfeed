'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  chain: string;
  benefits: string[];
  active: boolean;
  maxSubscribers: number;
  subscriberCount: number;
  nftContract?: string;
}

interface SubscriptionStatus {
  active: boolean;
  tierId?: string;
  expiryDate?: number;
  tokenId?: string;
  nftContract?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────

interface SubscribeButtonProps {
  creatorAddress: string;
  creatorName: string;
  /** Variant for display */
  variant?: 'profile' | 'stream' | 'inline';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

// ─── Token formatting ────────────────────────────────────────────────────

const CHAIN_ICONS: Record<string, string> = {
  ethereum: '⟠',
  base: '⬡',
  polygon: '⬣',
  solana: '◎',
};

function formatAmount(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

// ─── Benefit colors ──────────────────────────────────────────────────────

const BENEFIT_COLORS: Record<string, string> = {
  badge: '#8b5cf6',
  early_access: '#3b82f6',
  exclusive_content: '#10b981',
  discord: '#5865F2',
  '1on1': '#f59e0b',
  voting: '#ef4444',
};

// ─── Main Component ──────────────────────────────────────────────────────

export function SubscribeButton({
  creatorAddress,
  creatorName,
  variant = 'profile',
  size = 'md',
}: SubscribeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [step, setStep] = useState<'tiers' | 'confirm' | 'payment' | 'success'>('tiers');
  const [confirming, setConfirming] = useState(false);

  // Fetch tiers on mount
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/subscription-nft/tiers?creator=${encodeURIComponent(creatorAddress)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tiers) setTiers(data.tiers);
      })
      .catch(() => {
        // Fallback tiers
        setTiers([
          {
            id: 'supporter',
            name: 'Supporter',
            description: 'Basic support tier',
            price: 5,
            durationDays: 30,
            chain: 'base',
            benefits: ['badge', 'early_access'],
            active: true,
            maxSubscribers: 0,
            subscriberCount: 0,
          },
          {
            id: 'member',
            name: 'Member',
            description: 'Exclusive content access',
            price: 15,
            durationDays: 30,
            chain: 'base',
            benefits: ['badge', 'early_access', 'exclusive_content'],
            active: true,
            maxSubscribers: 0,
            subscriberCount: 0,
          },
          {
            id: 'patron',
            name: 'Patron',
            description: 'Full VIP access',
            price: 50,
            durationDays: 30,
            chain: 'base',
            benefits: ['badge', 'early_access', 'exclusive_content', '1on1', 'voting'],
            active: true,
            maxSubscribers: 0,
            subscriberCount: 0,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, creatorAddress]);

  // Check existing subscription
  useEffect(() => {
    fetch(`/api/subscription-nft/check?creator=${encodeURIComponent(creatorAddress)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.hasAccess) setStatus(data);
      })
      .catch(() => {});
  }, [creatorAddress]);

  const handleSubscribe = useCallback(async (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setStep('confirm');

    // In production, this would initiate the wallet transaction
    // For now, show the confirmation flow
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedTier) return;
    setConfirming(true);

    try {
      // Call subscription API
      const res = await fetch('/api/subscription-nft/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          creator: creatorAddress,
          tierId: selectedTier.id,
          chain: selectedTier.chain,
          amount: String(selectedTier.price),
          method: selectedTier.chain === 'solana' ? 'solana' : 'ethereum',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Simulate wallet interaction
        // In production, this would trigger wallet.send() with the payment intent
        setStep('payment');

        // Simulate txHash for demo
        const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

        // Confirm the subscription
        const confirmRes = await fetch('/api/subscription-nft/confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            creator: creatorAddress,
            tierId: selectedTier.id,
            txHash,
            nonce: data.nonce,
          }),
        });

        const confirmData = await confirmRes.json();
        if (confirmData.success) {
          setStep('success');
          setStatus({
            active: true,
            tierId: selectedTier.id,
            expiryDate: confirmData.subscription?.expiryDate,
          });
        }
      }
    } catch (err) {
      console.error('Subscription failed:', err);
    } finally {
      setConfirming(false);
    }
  }, [selectedTier, creatorAddress]);

  const handleCancel = useCallback(async () => {
    if (!confirm('Cancel your subscription?')) return;

    try {
      await fetch('/api/subscription-nft/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator: creatorAddress }),
      });
      setStatus(null);
      setStep('tiers');
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  }, [creatorAddress]);

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <>
      {/* Trigger Button */}
      {status?.active ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 font-semibold text-green-400 transition-all hover:bg-green-500/20 active:scale-95 ${sizeClasses[size]}`}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          Subscribed
        </button>
      ) : variant === 'profile' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full bg-degen-500 font-semibold text-white transition-all hover:opacity-90 active:scale-95 ${sizeClasses[size]}`}
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
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Subscribe
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all hover:bg-[var(--color-overlay)] active:scale-95 ${sizeClasses[size]}`}
          style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
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
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Subscribe
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-glass-border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                {step === 'success' ? 'Subscribed!' : `Subscribe to ${creatorName}`}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
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

            {/* Steps */}
            {step === 'tiers' && (
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-degen-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      Loading tiers...
                    </p>
                  </div>
                ) : (
                  tiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => handleSubscribe(tier)}
                      className="w-full text-left rounded-xl border p-4 transition-all hover:bg-[var(--color-overlay)] active:scale-[0.99] group"
                      style={{ borderColor: 'var(--color-glass-border)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="font-semibold text-sm"
                          style={{ color: 'var(--color-fg)' }}
                        >
                          {tier.name}
                        </span>
                        <span className="text-sm font-bold text-degen-400">
                          {formatAmount(tier.price)}/mo
                        </span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
                        {tier.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tier.benefits.map((benefit) => (
                          <span
                            key={benefit}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${BENEFIT_COLORS[benefit] || '#8b5cf6'}15`,
                              color: BENEFIT_COLORS[benefit] || '#8b5cf6',
                            }}
                          >
                            {benefit.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                      <div
                        className="flex items-center gap-2 mt-2 text-[10px]"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        <span>
                          {CHAIN_ICONS[tier.chain] || '⟠'} {tier.chain}
                        </span>
                        <span>·</span>
                        <span>{tier.durationDays} days</span>
                        {tier.maxSubscribers > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              {tier.subscriberCount}/{tier.maxSubscribers} subscribers
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Confirm step */}
            {step === 'confirm' && selectedTier && (
              <div className="space-y-4">
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--color-glass-border)' }}
                >
                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--color-fg)' }}>
                    {selectedTier.name} Plan
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {selectedTier.description}
                  </p>
                  <div
                    className="flex items-center justify-between mt-3 pt-3 border-t"
                    style={{ borderColor: 'var(--color-glass-border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--color-fg)' }}>
                      Monthly price
                    </span>
                    <span className="text-lg font-bold text-degen-400">
                      {formatAmount(selectedTier.price)}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between mt-1 text-xs"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <span>Duration</span>
                    <span>{selectedTier.durationDays} days</span>
                  </div>
                  <div
                    className="flex items-center justify-between mt-1 text-xs"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <span>Network</span>
                    <span>{selectedTier.chain}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="w-full rounded-xl bg-degen-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {confirming ? 'Confirming...' : 'Confirm & Pay'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('tiers');
                    setSelectedTier(null);
                  }}
                  className="w-full text-xs text-center transition-colors hover:underline"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Choose a different tier
                </button>
              </div>
            )}

            {/* Payment step */}
            {step === 'payment' && selectedTier && (
              <div className="space-y-4 text-center">
                <div className="animate-spin w-12 h-12 border-2 border-degen-500 border-t-transparent rounded-full mx-auto" />
                <p className="text-sm" style={{ color: 'var(--color-fg)' }}>
                  Waiting for wallet confirmation...
                </p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Confirm the transaction in your wallet to complete the subscription. This will
                  mint a subscription NFT to your wallet.
                </p>
              </div>
            )}

            {/* Success step */}
            {step === 'success' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg
                    aria-hidden="true"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--color-fg)' }}>
                    You&apos;re subscribed!
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                    Your subscription NFT has been minted.
                  </p>
                </div>
                {selectedTier && (
                  <div
                    className="rounded-xl border p-3"
                    style={{ borderColor: 'var(--color-glass-border)' }}
                  >
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
                      {selectedTier.name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      Benefits: {selectedTier.benefits.join(', ')}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                >
                  Done
                </button>
              </div>
            )}

            {/* Cancel subscription (shown when already subscribed) */}
            {status?.active && step === 'tiers' && (
              <button
                type="button"
                onClick={handleCancel}
                className="w-full mt-4 rounded-xl border border-red-500/20 px-4 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/5"
              >
                Cancel subscription
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
