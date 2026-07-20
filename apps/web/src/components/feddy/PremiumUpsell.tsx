'use client';

import { useState } from 'react';
import { PremiumPaymentModal } from '../PremiumPaymentModal';

export function PremiumUpsell({ feature }: { feature: string }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-degen-500/20 bg-gradient-to-b from-degen-500/5 to-transparent p-6 sm:p-8 text-center">
        {/* Icon */}
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/10">
          <span className="text-3xl">🔒</span>
        </div>

        <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">
          {feature} is a Premium Feature
        </h2>
        <p className="mb-6 text-sm text-[var(--color-muted)] max-w-md mx-auto">
          Upgrade to DegenFeed Premium to create and manage Feddy Communities —
          ActivityPub-native groups that federate across the Fediverse.
        </p>

        {/* Benefits */}
        <div className="mb-6 inline-block text-left">
          <ul className="space-y-2 text-sm text-[var(--color-fg)]/80">
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Create Feddy Communities</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>ActivityPub Federation</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Public Directory Listing</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Launch Creator Coins</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Post to All 12 Protocols</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Advanced Community Analytics</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Moderation Tools</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">✅</span>
              <span>Priority Support</span>
            </li>
          </ul>
        </div>

        {/* Pricing */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-degen-400">$10/month</div>
          <div className="mt-1 text-sm text-[var(--color-muted)]">
            or <span className="font-semibold text-[var(--color-fg)]">$50/year</span> (save 17%)
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full max-w-xs rounded-xl bg-degen-500 px-6 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]"
          >
            Upgrade to Premium
          </button>
          <a
            href="/feddy"
            className="text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-degen-400"
          >
            Browse Communities (Free)
          </a>
        </div>
      </div>

      <PremiumPaymentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          window.location.reload();
        }}
      />
    </>
  );
}
