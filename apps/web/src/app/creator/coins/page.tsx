'use client';

import dynamic from 'next/dynamic';
import { CreatorCoinComingSoon } from '@/components/creator-coin/CreatorCoinComingSoon';
import { CREATOR_COIN_ENABLED } from '@/lib/creatorCoinConfig';

const CreatorCoinDashboard = dynamic(
  () =>
    import('@/components/creator-coin/CreatorCoinDashboard').then((m) => ({
      default: m.CreatorCoinDashboard,
    })),
  { ssr: false, loading: () => <CoinDashboardSkeleton /> },
);

function CoinDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="skeleton h-8 w-48 rounded-lg mb-6" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function CreatorCoinsPage() {
  // Creator coin management is gated behind CREATOR_COIN_ENABLED.
  if (!CREATOR_COIN_ENABLED) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <CreatorCoinComingSoon
          variant="page"
          title="Creator Coins — Coming Soon"
          description="Managing and deploying creator coins is not yet open to the public. The backend is live in closed testing; creation will be enabled once the contracts have passed end-to-end verification."
        />
      </div>
    );
  }

  // In production: get creator address from auth context
  const creatorAddress = 'placeholder_creator_address';

  return (
    <CreatorCoinDashboard
      creator={creatorAddress}
      solanaRpcUrl={process.env.NEXT_PUBLIC_SOLANA_RPC_URL}
      baseRpcUrl={process.env.NEXT_PUBLIC_BASE_RPC_URL}
    />
  );
}
