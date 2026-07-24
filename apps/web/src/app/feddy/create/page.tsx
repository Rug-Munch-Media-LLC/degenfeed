'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { CreateCommunityWizard } from '../../../components/feddy/CreateCommunityWizard';
import { PremiumUpsell } from '../../../components/feddy/PremiumUpsell';
import { usePremium } from '../../../hooks/usePremium';

export default function CreateCommunityPage() {
  const { walletAddress, ready } = useAuth();
  const { tier, loading: premiumLoading } = usePremium();
  const router = useRouter();

  const authLoading = !ready;
  const isPremium = tier !== 'free';
  const loading = authLoading || premiumLoading;

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-20">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--color-muted)]/30" />
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <span className="mb-4 text-5xl">🔌</span>
        <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Connect Your Wallet</h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          You need to connect your wallet before creating a Feddy Community.
        </p>
        <a
          href="/auth"
          className="inline-block rounded-xl bg-degen-500 px-6 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400"
        >
          Connect Wallet
        </a>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <PremiumUpsell feature="Feddy Communities" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 animate-page-enter">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/20 px-4 py-1.5">
          <span className="text-sm">🌐</span>
          <span className="text-xs font-medium text-purple-400">
            ActivityPub Federated Community
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)] sm:text-3xl tracking-tight">
          Create a Feddy Community
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Launch an ActivityPub-native group that federates across the Fediverse. Your community
          will have its own handle and appear on Mastodon, Pixelfed, Lemmy, and more.
        </p>
      </div>

      <CreateCommunityWizard
        onCreated={(name) => {
          router.push(`/feddy/${name}`);
        }}
      />
    </div>
  );
}
