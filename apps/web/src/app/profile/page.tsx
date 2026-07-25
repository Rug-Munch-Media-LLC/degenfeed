'use client';

import type { PlatformAccount } from '@degenfeed/ui';
import { CrossPlatformSetup, ErrorBoundary, ReputationBadge } from '@degenfeed/ui';
import {
  CredentialCard,
  CredentialSecurityNote,
  CredentialsProgressBanner,
  registrationToCredential,
} from '../../components/CredentialsDisplay';
import { EditProfileModal } from '../../components/EditProfileModal';
import { IdentityLinker } from '../../components/IdentityLinker';
import { ProtocolStatusSection } from '../../components/onboarding/ProtocolStatusSection';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import { GoLiveModal } from '../../components/streams/GoLiveModal';
import {
  AchievementBadges,
  ProfileHeader,
  ProfileSkeleton,
  ProfileTabs,
  ProtocolBadgesRow,
  StatsBar,
  TabEmptyState,
} from './components';
import { useProfile } from './use-profile';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const p = useProfile();

  if (!p.ready) return <ProfileSkeleton />;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter">
        {!p.hasSignedIn ? <GuestView onOpenSignIn={p.openSignIn} /> : <SignedInView p={p} />}
      </div>
    </ErrorBoundary>
  );
}

function GuestView({ onOpenSignIn }: { onOpenSignIn: () => void }) {
  return (
    <>
      <div className="mb-8 flex flex-col items-center py-12">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)]">
          <span className="text-4xl font-bold text-[var(--color-fg)]">?</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Welcome to DegenFeed</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Connect accounts to build your unified identity
        </p>
        <button onClick={onOpenSignIn} className="btn-primary press-effect" type="button">
          Connect an account
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: '🔗',
            title: 'Link Protocols',
            desc: 'Connect Nostr, Farcaster, Lens, Bluesky, and more',
          },
          {
            icon: '🆔',
            title: 'Unified Identity',
            desc: 'One profile that spans all your networks',
          },
          { icon: '📡', title: 'Cross-Post', desc: 'Post once, share everywhere' },
        ].map((step) => (
          <div key={step.title} className="card text-center">
            <div className="mb-2 text-2xl">{step.icon}</div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">{step.title}</h3>
            <p className="text-xs text-[var(--color-muted)]">{step.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function SignedInView({ p }: { p: ReturnType<typeof useProfile> }) {
  return (
    <>
      <ProfileHeader
        displayName={p.displayName}
        handle={p.handle}
        joinDate={p.joinDate}
        avatarUrl={p.avatarUrl}
        bio={(p.primaryIdentity as { bio?: string })?.bio}
      />

      {p.repScore && !p.repLoading && (
        <div className="mt-3 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-degen-500/20 bg-degen-500/10 px-4 py-1.5">
            <ReputationBadge
              score={p.repScore}
              progress={p.repProgress}
              size="sm"
              showIcon
              showLabel
              showTooltip={false}
              showProgress={false}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <StatsBar stats={p.profileStats} />
      </div>
      <div className="mb-6">
        <ProtocolBadgesRow identities={p.identities} />
      </div>

      {/* Protocol Accounts Status Section */}
      <ProtocolStatusSection
        walletAddress={p.walletAddress ?? ''}
        isOwnProfile={true}
      />

      {p.showCrossPlatformSetup && (
        <div className="mb-6" id="cross-platform-setup">
          <CrossPlatformSetup
            key={p.crossPlatformKey}
            walletAddress={p.walletAddress ?? ''}
            onRegistered={(result: PlatformAccount) => p.handleRegistered(result)}
          />
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => p.setShowEditModal(true)}
            className="btn-secondary text-xs"
          >
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => p.setShowCrossPlatformSetup(true)}
            className="btn-secondary text-xs"
          >
            Create Accounts
          </button>
          <button
            type="button"
            onClick={() => p.setShowGoLiveModal(true)}
            className="btn-secondary text-xs"
          >
            Go Live
          </button>
          <button
            type="button"
            onClick={() => p.setShowUpgradeModal(true)}
            className="btn-primary text-xs"
          >
            Upgrade
          </button>
        </div>
      </div>

      <div className="mb-6">
        <AchievementBadges earned={p.earnedAchievements} />
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Portable Credentials
        </h2>
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Use these credentials to login on any Mastodon/Lemmy/PeerTube app. You own this account.
        </p>
        <CredentialsProgressBanner connectedCount={p.identities.length} totalPlatforms={5} />
        <div className="mt-3 space-y-3">
          {p.identities.map((id) => {
            const result: Parameters<typeof registrationToCredential>[0] = {
              platform: id.protocol,
              status: 'created',
              username: id.handle ?? id.displayName,
              accountInfo: { username: id.handle ?? '' },
            };
            const card = registrationToCredential(result);
            return card ? <CredentialCard key={id.id} credential={card} /> : null;
          })}
        </div>
        <div className="mt-3">
          <CredentialSecurityNote />
        </div>
      </div>

      {/* Identity Linker */}
      <div className="mb-6">
        <IdentityLinker />
      </div>

      {/* Tabs */}
      <ProfileTabs active={p.activeTab} onTabChange={p.setActiveTab} />
      <div className="py-6">
        <TabEmptyState tab={p.activeTab} />
      </div>

      {/* Modals */}
      {p.showEditModal && <EditProfileModal open onClose={() => p.setShowEditModal(false)} />}
      {p.showGoLiveModal && <GoLiveModal isOpen onClose={() => p.setShowGoLiveModal(false)} />}
      {p.showUpgradeModal && (
        <PremiumPaymentModal
          open
          onClose={() => p.setShowUpgradeModal(false)}
          onSuccess={() => {
            p.refreshPremium();
            p.setShowUpgradeModal(false);
          }}
        />
      )}
    </>
  );
}
