'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CreatorCoinComingSoon } from '@/components/creator-coin/CreatorCoinComingSoon';
import { CREATOR_COIN_ENABLED } from '@/lib/creatorCoinConfig';

const CreateCoinWizard = dynamic(() => import('../../../components/launch/CreateCoinWizard'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Step indicator skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center">
              <div className="skeleton h-8 w-8 rounded-full" />
              {i < 4 && <div className="mx-2 skeleton h-0.5 w-12 sm:w-20" />}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="skeleton h-6 w-48 rounded-lg" />
        <div className="skeleton h-5 w-72 rounded-lg" />
        <div className="skeleton h-52 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="skeleton h-10 w-20 rounded-lg" />
        <div className="skeleton h-10 w-28 rounded-lg" />
      </div>
    </div>
  ),
});

export default function CreateCoinPage() {
  // Token launch creation is gated behind CREATOR_COIN_ENABLED.
  if (!CREATOR_COIN_ENABLED) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <CreatorCoinComingSoon
          variant="page"
          title="Token Launch — Coming Soon"
          description="Launching a new creator coin is not yet open to the public. The backend is live in closed testing; the launch flow will be enabled once the contracts have passed end-to-end verification."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-10">
      {/* Back link */}
      <div className="mx-auto max-w-2xl px-4 mb-6">
        <Link
          href="/launch"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-degen-400 transition-colors"
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Creator Coins
        </Link>
      </div>

      {/* Wizard */}
      <CreateCoinWizard />
    </div>
  );
}
