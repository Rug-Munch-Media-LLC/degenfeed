'use client';

import dynamic from 'next/dynamic';
import { CreatorCoinComingSoon } from '@/components/creator-coin/CreatorCoinComingSoon';
import { useWalletConnect } from '@/hooks/useWalletConnect';
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
        {['a', 'b', 'c', 'd'].map((k) => (
          <div key={k} className="skeleton h-40 rounded-xl" />
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

  return <CreatorCoinsAuthed />;
}

/**
 * The creator address is the REAL connected wallet address from the
 * useWalletConnect hook (EIP-1193). The former
 * `placeholder_creator_address` string was sent to the deploy API and
 * stored as the token creator — fabricated identity data.
 */
function CreatorCoinsAuthed() {
  const wallet = useWalletConnect();

  if (!wallet.isConnected || !wallet.address) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)]">
          <span className="text-2xl">👛</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Connect your wallet</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Connect the wallet that owns your creator coins to manage them.
        </p>
        <button
          type="button"
          onClick={() => wallet.connect()}
          className="mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:from-purple-500 hover:to-blue-500"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <CreatorCoinDashboard
      creator={wallet.address}
      solanaRpcUrl={process.env.NEXT_PUBLIC_SOLANA_RPC_URL}
      baseRpcUrl={process.env.NEXT_PUBLIC_BASE_RPC_URL}
    />
  );
}
