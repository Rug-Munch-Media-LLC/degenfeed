'use client';

import { ErrorBoundary, ReputationBadge } from '@degenfeed/ui';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  CrossProtocolActivityFeed,
  ProfileContentTabs,
  ProfileSearchBar,
  ProfileSearchResults,
  TabContent,
  TrendingCreators,
  UnifiedProfileHeader,
  WhoToFollow,
} from '../components';
import { useProfile } from '../use-profile';

// Dynamically import podcast & music tab content for route splitting
const PodcastTabContent = nextDynamic(() => import('../PodcastTabContent'), {
  loading: () => (
    <div className="p-4 text-center text-sm text-[var(--color-muted)]">Loading podcasts…</div>
  ),
});

const MusicTabContent = nextDynamic(() => import('../MusicTabContent'), {
  loading: () => (
    <div className="p-4 text-center text-sm text-[var(--color-muted)]">Loading music…</div>
  ),
});

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ handle: string }> | { handle: string };
}

export default function ProfileByIdentifierPage({ params }: Props) {
  const handle = 'then' in params ? '' : (params as { handle: string }).handle;

  return <ProfileByIdentifierContent handleParam={handle || ''} />;
}

function ProfileByIdentifierContent({ handleParam }: { handleParam: string }) {
  const router = useRouter();
  const p = useProfile();

  // Resolve the identifier to fetch profile
  useEffect(() => {
    if (p.ready && handleParam) {
      // In a real implementation, this would fetch by handle/wallet
      void fetch(`/api/unified-profile/resolve?identifier=${encodeURIComponent(handleParam)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.wallet) {
            router.replace(`/profile/${data.wallet}`);
          }
        });
    }
  }, [p.ready, handleParam, router]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
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
              isOwnProfile={false}
              onFollow={p.handleFollow}
              onSubscribe={p.handleSubscribe}
              onTip={p.handleTip}
              onMessage={p.handleMessage}
              onShare={p.handleShare}
            />

            {/* Reputation */}
            {p.repScore && !p.repLoading && (
              <div className="mt-4 mb-6 flex justify-center">
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

            {/* 17-source tabs */}
            <ProfileContentTabs active={p.activeTab} onTabChange={p.setActiveTab} />
            <div className="py-4">
              {p.activeTab === 'podcasts' ? (
                <PodcastTabContent
                  creatorId={p.walletAddress || p.handle || ''}
                  initialPodcasts={undefined}
                />
              ) : p.activeTab === 'music' ? (
                <MusicTabContent
                  creatorId={p.walletAddress || p.handle || ''}
                  artistName={p.displayName}
                />
              ) : (
                <TabContent tab={p.activeTab} items={p.tabContent} loading={p.tabLoading} />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 shrink-0 space-y-4">
            <ProfileSearchBar
              value={p.searchQuery}
              onChange={p.handleSearch}
              onClear={() => {
                p.setSearchQuery('');
                p.handleSearch('');
              }}
            />
            <ProfileSearchResults
              results={p.searchResults}
              loading={p.searchLoading}
              onSelect={(profile) => {
                router.push(`/profile/${profile.handle ?? profile.id}`);
              }}
            />

            <CrossProtocolActivityFeed activities={p.activities} loading={p.activitiesLoading} />

            <TrendingCreators profiles={p.trendingCreators} loading={p.trendingLoading} />
            <WhoToFollow profiles={p.whoToFollow} loading={p.whoToFollowLoading} />
          </aside>
        </div>
      </div>
    </ErrorBoundary>
  );
}
