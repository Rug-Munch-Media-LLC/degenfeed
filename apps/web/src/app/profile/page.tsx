'use client';

import type { PlatformAccount } from '@degenfeed/ui';
import { CrossPlatformSetup, ErrorBoundary, ReputationBadge } from '@degenfeed/ui';
import { useState } from 'react';
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
import { ConnectAccountPanel } from '../../components/profile/ConnectAccountPanel';
import { GoLiveModal } from '../../components/streams/GoLiveModal';
import { UnifiedComposerButton } from '../../components/UnifiedComposerButton';
import {
  AchievementBadges,
  ContentPerformanceWidget,
  CreatorToolsQuickActions,
  CrossProtocolActivityFeed,
  ProfileContentTabs,
  ProfileSearchBar,
  ProfileSearchResults,
  ProfileSkeleton,
  RevenueWidget,
  TabContent,
  TrendingCreators,
  UnifiedProfileHeader,
  WhoToFollow,
} from './components';
import { PROTOCOL_COLORS, PROTOCOL_LABELS } from './constants';
import { useProfile } from './use-profile';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const p = useProfile();

  if (!p.ready) return <ProfileSkeleton />;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
        {!p.hasSignedIn ? <GuestView onOpenSignIn={p.openSignIn} /> : <SignedInView p={p} />}
      </div>
    </ErrorBoundary>
  );
}

function GuestView({ onOpenSignIn }: { onOpenSignIn: () => void }) {
  return (
    <>
      <div className="mb-8 flex flex-col items-center py-12">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30 shadow-[0_0_40px_var(--color-accent-glow)]">
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
  const [showConnectMore, setShowConnectMore] = useState(false);

  const verifiedIdentities = p.identities.filter(
    (id) => !id.protocol.startsWith('ethereum') && !id.protocol.startsWith('solana'),
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ─── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Unified Profile Header — Identity across ALL protocols */}
        <UnifiedProfileHeader
          displayName={p.displayName}
          handle={p.handle}
          joinDate={p.joinDate}
          avatarUrl={p.avatarUrl}
          bio={(p.primaryIdentity as { bio?: string })?.bio}
          identities={p.identities}
          stats={p.profileStats}
          creatorCoin={p.creatorCoin}
          daoMemberships={p.daoMemberships}
          isOwnProfile={true}
          onEdit={() => p.setShowEditModal(true)}
          onFollow={p.handleFollow}
          onSubscribe={p.handleSubscribe}
          onTip={p.handleTip}
          onMessage={p.handleMessage}
          onShare={p.handleShare}
        />

        {/* Reputation Badge */}
        {p.repScore && !p.repLoading && (
          <div className="mt-4 flex justify-center">
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

        {/* Action Buttons Bar (own profile) */}
        <div className="mt-4 mb-4">
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

        {/* Creator Hub Navigation */}
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Creator Hub
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <a
              href="/profile/earnings"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-3 text-center transition-all hover:border-amber-500/30 hover:bg-amber-500/[0.03]"
            >
              <span className="text-xl">💰</span>
              <span className="text-[11px] font-medium text-[var(--color-fg)]">Earnings</span>
              <span className="text-[9px] text-[var(--color-muted)]">Revenue & payouts</span>
            </a>
            <a
              href="/profile/content-library"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-3 text-center transition-all hover:border-blue-500/30 hover:bg-blue-500/[0.03]"
            >
              <span className="text-xl">📚</span>
              <span className="text-[11px] font-medium text-[var(--color-fg)]">Content</span>
              <span className="text-[9px] text-[var(--color-muted)]">All posts & media</span>
            </a>
            <a
              href="/profile/audience"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-3 text-center transition-all hover:border-pink-500/30 hover:bg-pink-500/[0.03]"
            >
              <span className="text-xl">👥</span>
              <span className="text-[11px] font-medium text-[var(--color-fg)]">Audience</span>
              <span className="text-[9px] text-[var(--color-muted)]">Followers & growth</span>
            </a>
            <a
              href="/profile/settings"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-3 text-center transition-all hover:border-slate-500/30 hover:bg-slate-500/[0.03]"
            >
              <span className="text-xl">⚙️</span>
              <span className="text-[11px] font-medium text-[var(--color-fg)]">Settings</span>
              <span className="text-[9px] text-[var(--color-muted)]">Configuration</span>
            </a>
          </div>
        </div>

        {/* Protocol Accounts Status */}
        <div className="mb-6">
          <ProtocolStatusSection walletAddress={p.walletAddress ?? ''} isOwnProfile={true} />
        </div>

        {p.showCrossPlatformSetup && (
          <div className="mb-6" id="cross-platform-setup">
            <CrossPlatformSetup
              key={p.crossPlatformKey}
              walletAddress={p.walletAddress ?? ''}
              onRegistered={(result: PlatformAccount) => p.handleRegistered(result)}
            />
          </div>
        )}

        {/* Achievement Badges */}
        <div className="mb-6">
          <AchievementBadges earned={p.earnedAchievements} />
        </div>

        {/* ─── Creator Tools (own profile) ─────────────────────── */}
        <div className="mb-6 space-y-3">
          <CreatorToolsQuickActions
            onCompose={() => p.setShowComposeModal(true)}
            onGoLive={() => p.setShowGoLiveModal(true)}
            onCreatePodcast={() => {
              p.showToast('info', 'Podcast creation coming soon');
            }}
            onLaunchCoin={() => {
              p.showToast('info', 'Coin launch coming soon');
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ContentPerformanceWidget performance={p.contentPerformance} loading={p.perfLoading} />
            <RevenueWidget revenue={p.revenueStats} loading={p.revLoading} />
          </div>
        </div>

        {/* ─── Portable Credentials ──────────────────────────────── */}
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
              const card = registrationToCredential({
                platform: id.protocol,
                status: 'created',
                username: id.handle ?? id.displayName,
                accountInfo: { username: id.handle ?? '' },
              });
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

        {/* ─── Tabs (17 content sources) ─────────────────────────── */}
        <ProfileContentTabs active={p.activeTab} onTabChange={p.setActiveTab} />
        <div className="py-6">
          <TabContent tab={p.activeTab} items={p.tabContent} loading={p.tabLoading} />
        </div>

        {/* ─── Modals ───────────────────────────────────────────── */}
        {p.showEditModal && <EditProfileModal open onClose={() => p.setShowEditModal(false)} />}
        {p.showGoLiveModal && <GoLiveModal isOpen onClose={() => p.setShowGoLiveModal(false)} />}
        {p.showComposeModal && <UnifiedComposerButton />}
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
      </div>

      {/* ─── Sidebar ──────────────────────────────────────────────── */}
      <aside className="w-full lg:w-80 shrink-0 space-y-4">
        {/* Profile Discovery — Search */}
        <div>
          <ProfileSearchBar
            value={p.searchQuery}
            onChange={p.handleSearch}
            onClear={() => {
              p.setSearchQuery('');
              p.handleSearch('');
            }}
          />
          <div className="mt-2">
            <ProfileSearchResults
              results={p.searchResults}
              loading={p.searchLoading}
              onSelect={(profile) => {
                window.location.href = `/profile/${profile.handle ?? profile.id}`;
              }}
            />
          </div>
        </div>

        {/* Cross-Protocol Activity Feed */}
        <CrossProtocolActivityFeed activities={p.activities} loading={p.activitiesLoading} />

        {/* Trending Creators */}
        <TrendingCreators profiles={p.trendingCreators} loading={p.trendingLoading} />

        {/* Who to Follow */}
        <WhoToFollow profiles={p.whoToFollow} loading={p.whoToFollowLoading} />

        {/* Wallet & Verification */}
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Wallet &amp; Verification
          </h4>

          {/* Connected wallet address (truncated) */}
          <div className="mb-3">
            <div className="mb-1 text-[10px] text-[var(--color-muted)]">Wallet</div>
            {p.walletAddress ? (
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-degen-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-degen-400">
                  {p.walletAddress.slice(0, 6)}&hellip;{p.walletAddress.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(p.walletAddress ?? '');
                    p.showToast('success', '✓ Wallet address copied');
                  }}
                  className="rounded-md border border-[var(--color-glass-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:border-gray-500 hover:text-[var(--color-fg)]"
                >
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">No wallet connected</p>
            )}
          </div>

          {/* Linked protocols with verification badges */}
          <div className="mb-1 text-[10px] text-[var(--color-muted)]">Linked protocols</div>
          <div className="flex flex-wrap gap-1.5">
            {verifiedIdentities.length > 0 ? (
              verifiedIdentities.map((id) => (
                <span
                  key={id.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-muted)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg)]"
                  title={id.handle}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: PROTOCOL_COLORS[id.protocol] ?? '#666' }}
                  />
                  {PROTOCOL_LABELS[id.protocol] ?? id.protocol}
                  {id.verified ? (
                    <span className="text-degen-400" role="img" aria-label="Verified">
                      ✓
                    </span>
                  ) : null}
                </span>
              ))
            ) : (
              <p className="text-[10px] text-[var(--color-muted)]">No protocols linked yet</p>
            )}
          </div>

          {/* Connect more protocols */}
          <button
            type="button"
            onClick={() => setShowConnectMore((v) => !v)}
            className="mt-3 w-full rounded-lg bg-degen-500/15 px-3 py-2 text-[11px] font-semibold text-degen-400 transition-colors hover:bg-degen-500/25"
          >
            {showConnectMore ? 'Hide connect panel' : 'Connect More Protocols +'}
          </button>

          {/* Inline connect panel */}
          {showConnectMore && (
            <div className="mt-3 border-t border-[var(--color-glass-border)] pt-3">
              <ConnectAccountPanel onConnected={() => p.refreshPremium()} />
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Connected Networks
          </h4>
          <div className="space-y-1.5">
            {p.connectedProtocols.length > 0 ? (
              p.connectedProtocols.map((protocol) => (
                <div key={protocol} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: PROTOCOL_COLORS[protocol] ?? '#666' }}
                    />
                    <span className="text-xs text-[var(--color-fg)] capitalize">{protocol}</span>
                  </div>
                  <span className="text-[10px] text-[var(--color-muted)]">Connected</span>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-[var(--color-muted)]">No protocols connected</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
