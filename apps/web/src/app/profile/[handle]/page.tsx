'use client';

import { ErrorBoundary, ReputationBadge } from '@degenfeed/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  CreatorToolsPanel,
  ProfileHeader,
  ProfileSearchInput,
  ProfileSkeleton,
  ProfileTabs,
  SearchResults,
  StatsBar,
  SuggestedFollows,
  TabContent,
} from '../components';
import { useProfile } from '../use-profile';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ handle: string }> | { handle: string };
}

export default function ProfileByIdentifierPage({ params }: Props) {
  // In Next.js App Router, params is a Promise in newer versions
  const _unwrappedParams = 'then' in params ? { handle: '' } : (params as { handle: string });
  const handle = 'then' in params ? '' : (params as { handle: string }).handle;

  return <ProfileByIdentifierContent handleParam={handle || ''} />;
}

function ProfileByIdentifierContent({ handleParam }: { handleParam: string }) {
  const router = useRouter();
  const p = useProfile(handleParam);

  // Resolve the identifier to fetch profile
  useEffect(() => {
    if (p.ready && handleParam) {
      p.fetchProfile();
    }
  }, [p.ready, handleParam, p.fetchProfile]);

  if (p.profileLoading) return <ProfileSkeleton />;

  if (p.profileError) {
    return (
      <ErrorBoundary>
        <div className="mx-auto max-w-2xl px-4 py-20">
          <div className="card border-red-900/30 bg-red-950/20 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-400">
              !
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Profile not found</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Could not find a profile matching &quot;{handleParam}&quot;
            </p>
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="btn-primary text-sm"
            >
              Go to your profile
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!p.profile) return <ProfileSkeleton />;
  const profile = p.profile;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main content */}
          <div>
            <ProfileHeader
              profile={profile}
              onEdit={profile.isOwnProfile ? () => router.push('/profile') : undefined}
              onFollow={profile.isOwnProfile ? undefined : p.handleFollow}
              onUnfollow={profile.isOwnProfile ? undefined : p.handleUnfollow}
              onMessage={() => router.push(`/messages?user=${profile.walletAddress}`)}
              onTip={() => router.push(`/tip?to=${profile.walletAddress}`)}
            />

            {/* Reputation */}
            {p.repScore && !p.repLoading && (
              <div className="mb-6 flex justify-center">
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
              <StatsBar stats={profile.stats} />
            </div>

            {/* Creator Tools (own profile only) */}
            {profile.isOwnProfile && (
              <div className="mb-6">
                <CreatorToolsPanel
                  tools={p.creatorTools}
                  loading={p.creatorToolsLoading}
                  onLaunchCoin={() => router.push('/launch')}
                  onManageCoin={() =>
                    p.creatorTools?.coinDashboardUrl && router.push(p.creatorTools.coinDashboardUrl)
                  }
                  onGoLive={() => router.push('/live')}
                  onCreatePost={() => router.push('/post/create')}
                  onCreatePodcast={() => router.push('/podcasts/create')}
                  onNewsletter={() => router.push('/newsletter')}
                />
              </div>
            )}

            <ProfileTabs active={p.activeTab} onTabChange={p.setActiveTab} />
            <div className="py-4">
              <TabContent tab={p.activeTab} posts={p.profilePosts} loading={p.postsLoading} />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden space-y-4 lg:block">
            <div className="sticky top-24 space-y-4">
              <ProfileSearchInput
                value={p.searchQuery}
                onChange={p.setSearchQuery}
                onClear={() => p.setSearchQuery('')}
              />
              {p.searchResults.length > 0 && (
                <SearchResults
                  results={p.searchResults}
                  loading={p.searchLoading}
                  onSelect={(result) => {
                    if (result.walletAddress) {
                      router.push(`/profile/${result.walletAddress}`);
                    }
                  }}
                />
              )}
              <SuggestedFollows profiles={p.suggestedProfiles} />
            </div>
          </aside>
        </div>
      </div>
    </ErrorBoundary>
  );
}
