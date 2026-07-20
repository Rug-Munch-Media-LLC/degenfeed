'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../components/AuthProvider';
import { CommunityBanner } from '../../../components/feddy/CommunityBanner';
import { CommunityFeed } from '../../../components/feddy/CommunityFeed';
import { CommunitySidebar } from '../../../components/feddy/CommunitySidebar';
import { CommunityMemberList } from '../../../components/feddy/CommunityMemberList';
import { CommunityRules } from '../../../components/feddy/CommunityRules';
import { JoinButton } from '../../../components/feddy/JoinButton';
import { ModPanel } from '../../../components/feddy/ModPanel';
import { PremiumUpsell } from '../../../components/feddy/PremiumUpsell';
import { usePremium } from '../../../hooks/usePremium';
import { GoLiveModal } from '../../../components/streams/GoLiveModal';
import type { FeddyCommunity, CommunityMember as Member, CommunityPost as Post, CommunityStats, MemberRole } from '../../../components/feddy/types';

// === Skeleton ==========================================================

function CommunitySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-48 w-full rounded-2xl bg-[var(--color-muted)]/10 sm:h-64" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[var(--color-muted)]/5" />
            ))}
          </div>
          <div className="w-full lg:w-80 space-y-4">
            <div className="h-48 rounded-xl bg-[var(--color-muted)]/5" />
            <div className="h-32 rounded-xl bg-[var(--color-muted)]/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

// === Community Page ====================================================

export default function CommunityPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const { walletAddress } = useAuth();
  const { tier: premiumTier } = usePremium();

  const [community, setCommunity] = useState<FeddyCommunity | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [viewerRole, setViewerRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'members' | 'rules' | 'about'>('feed');
  const [showModPanel, setShowModPanel] = useState(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);

  const fetchCommunity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/feddy/${encodeURIComponent(name)}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Community not found');
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json() as {
        community: FeddyCommunity & { viewerRole: MemberRole | null };
        posts: Post[];
        members: Member[];
        stats: CommunityStats;
      };

      setCommunity(data.community);
      setPosts(data.posts);
      setMembers(data.members);
      setStats(data.stats);
      setViewerRole(data.community.viewerRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community');
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  const handleJoined = useCallback(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  const handleLeft = useCallback(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  const handlePosted = useCallback(() => {
    // Refresh posts without full reload
    fetchCommunity();
  }, [fetchCommunity]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <CommunitySkeleton />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <span className="mb-4 text-5xl">🔍</span>
        <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">
          {error === 'Community not found' ? 'Community Not Found' : 'Something went wrong'}
        </h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          {error === 'Community not found'
            ? `No community named "${name}" exists. Check the URL or browse the directory.`
            : error || 'An unexpected error occurred.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/feddy"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30"
          >
            Browse Directory
          </Link>
          <Link
            href="/feddy/create"
            className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400"
          >
            Create Community
          </Link>
      </div>

      {/* Go Live Modal */}
      <GoLiveModal
        isOpen={showGoLiveModal}
        onClose={() => setShowGoLiveModal(false)}
        defaultSurfaces={['community', 'visual-feed', 'discover']}
      />
    </div>
  );
}

  const isOwner = viewerRole === 'owner';
  const isMod = viewerRole === 'moderator' || isOwner;
  const isMember = viewerRole !== null;

  return (
    <div className="min-h-screen animate-page-enter">
      {/* Banner */}
      <CommunityBanner
        community={community}
        viewerRole={viewerRole}
      />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Nav tabs */}
        <div className="mb-6 flex items-center gap-1 border-b border-[var(--color-border)]">
          {(['feed', 'members', 'rules', 'about'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-degen-500 text-degen-400'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {tab === 'feed' ? 'Feed' : tab === 'members' ? 'Members' : tab === 'rules' ? 'Rules' : 'About'}
            </button>
          ))}

          {/* Go Live button */}
          <button
            type="button"
            onClick={() => setShowGoLiveModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-all border-b-2 border-transparent text-[var(--color-muted)] hover:text-degen-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
            </span>
            Go Live
          </button>

          {/* Mod button */}
          {(isMod) && (
            <button
              type="button"
              onClick={() => setShowModPanel(!showModPanel)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                showModPanel
                  ? 'border-degen-500 text-degen-400'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              Mod Tools
            </button>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {showModPanel ? (
              <ModPanel
                community={community}
                viewerRole={viewerRole}
                onUpdate={fetchCommunity}
              />
            ) : activeTab === 'feed' ? (
              <CommunityFeed
                community={community}
                posts={posts}
                isMember={isMember}
                isPremium={premiumTier !== 'free'}
                walletAddress={walletAddress}
                onPostCreated={handlePosted}
              />
            ) : activeTab === 'members' ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--color-fg)]">
                    Members ({members.length})
                  </h3>
                </div>
                <CommunityMemberList
                  members={members}
                  viewerWallet={walletAddress}
                  viewerRole={viewerRole}
                  communityId={community.id}
                  onUpdate={fetchCommunity}
                />
              </div>
            ) : activeTab === 'rules' ? (
              <CommunityRules community={community} />
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-[var(--color-fg)]">About</h3>
                <p className="text-sm leading-relaxed text-[var(--color-muted)]">
                  {community.description || 'No description provided.'}
                </p>
                {community.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {community.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--color-overlay)] px-2.5 py-1 text-xs text-[var(--color-muted)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {community.linkedCoin && (
                  <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
                    <p className="text-xs font-medium text-degen-400">Linked Creator Coin</p>
                    <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">{community.linkedCoin}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            <CommunitySidebar
              community={community}
              stats={stats}
              viewerRole={viewerRole}
            />

            {isMember && (
              <JoinButton
                communityId={community.id}
                communityName={community.name}
                isMember={isMember}
                isOwner={isOwner}
                onJoined={handleJoined}
                onLeft={handleLeft}
              />
            )}

            {!isMember && walletAddress && (
              <JoinButton
                communityId={community.id}
                communityName={community.name}
                isMember={false}
                isOwner={false}
                onJoined={handleJoined}
                onLeft={handleLeft}
              />
            )}

            {!walletAddress && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
                <p className="mb-3 text-sm text-[var(--color-muted)]">
                  Connect your wallet to join this community.
                </p>
                <Link
                  href="/auth"
                  className="inline-block rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400"
                >
                  Connect Wallet
                </Link>
              </div>
            )}

            {/* Federated badge */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-fg)]">ActivityPub</p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    Federates to Mastodon, Pixelfed, Lemmy
                  </p>
                </div>
              </div>
              <div className="mt-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2 font-mono text-xs text-degen-400">
                {community.gtsHandle}
              </div>
              <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                Follow from any Fediverse app
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
