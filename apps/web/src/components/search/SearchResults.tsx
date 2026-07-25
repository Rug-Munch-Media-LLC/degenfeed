'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// ─── Types ─────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  protocol: string;
  author: { displayName: string; avatarUrl?: string };
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

export interface IdentityResult {
  id: string;
  protocol: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string;
  postCount: number;
}

export interface CommunityResult {
  id: string;
  name: string;
  protocol: string;
  description: string;
  memberCount: number;
  url: string;
  icon: string | null;
}

export interface VideoResult {
  id: string;
  title: string;
  source: string;
  channelName: string;
  thumbnailUrl: string | null;
  url: string;
  views: number;
  durationSeconds: number;
  publishedAt: number;
}

// ─── Helpers ───────────────────────────────────────────────────

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getProfileUrl(identity: IdentityResult): string {
  switch (identity.protocol) {
    case 'nostr':
      return `https://snort.social/p/${identity.handle || identity.id}`;
    case 'farcaster':
      return `https://warpcast.com/${identity.handle?.replace('@', '') || identity.id}`;
    case 'lens':
      return `https://hey.xyz/u/${identity.handle?.replace('lens/', '') || identity.id}`;
    case 'bluesky':
      return `https://bsky.app/profile/${identity.handle?.replace('@', '') || identity.id}`;
    case 'mastodon':
      return `https://social.degenfeed.xyz/@${identity.handle || identity.id}`;
    default:
      return '#';
  }
}

// ─── Sub-components ───────────────────────────────────────────

function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse flex items-center gap-3 p-4">
          <div className="h-10 w-10 rounded-full bg-[var(--color-card)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[var(--color-card)]" />
            <div className="h-3 w-full rounded bg-[var(--color-card)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LoadMoreProps {
  loading: boolean;
  hasMore: boolean;
  onClick: () => void;
}

function LoadMoreButton({ loading, hasMore, onClick }: LoadMoreProps) {
  if (!hasMore && !loading) {
    return (
      <div className="py-8 text-center">
        <span className="text-xs text-[var(--color-muted)]">No more results</span>
      </div>
    );
  }
  return (
    <div className="flex justify-center py-8">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:text-degen-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading…
          </>
        ) : (
          'Load More'
        )}
      </button>
    </div>
  );
}

// ─── Identity Results ─────────────────────────────────────────

function IdentityResults({ identities, showAll }: { identities: IdentityResult[]; showAll: boolean }) {
  if (identities.length === 0) return null;
  return (
    <div className="mb-8">
      {showAll && (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">People</h2>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {identities.map((identity) => (
          <div key={identity.id} className="card-hover flex items-start gap-4 p-4 transition-colors">
            <a href={getProfileUrl(identity)} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold overflow-hidden"
                style={{ backgroundColor: `${getProtocolColor(identity.protocol)}22`, color: getProtocolColor(identity.protocol) }}
              >
                {identity.avatarUrl ? (
                  <Image src={identity.avatarUrl} alt={identity.displayName} width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  identity.displayName[0]?.toUpperCase() || getProtocolIcon(identity.protocol)
                )}
              </div>
            </a>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a href={getProfileUrl(identity)} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold text-[var(--color-fg)] hover:underline">
                  {identity.displayName}
                </a>
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${getProtocolColor(identity.protocol)}22`, color: getProtocolColor(identity.protocol) }}>
                  {identity.protocol}
                </span>
              </div>
              {identity.handle && <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">{identity.handle}</div>}
              {identity.bio && <div className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">{identity.bio}</div>}
              <div className="mt-2 flex items-center gap-3">
                {identity.postCount > 0 && <span className="text-[10px] text-[var(--color-muted)]">{formatCount(identity.postCount)} posts</span>}
                <a href={getProfileUrl(identity)} target="_blank" rel="noopener noreferrer"
                  className="ml-auto rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors">
                  View Profile →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Community Results ────────────────────────────────────────

function CommunityResults({ communities, showAll }: { communities: CommunityResult[]; showAll: boolean }) {
  if (communities.length === 0) return null;
  return (
    <div className="mb-8">
      {showAll && (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">Communities</h2>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {communities.map((community) => (
          <a key={community.id} href={community.url} target="_blank" rel="noopener noreferrer"
            className="card-hover flex items-start gap-4 p-4 transition-colors">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold overflow-hidden"
              style={{ backgroundColor: `${getProtocolColor(community.protocol)}22`, color: getProtocolColor(community.protocol) }}>
              {community.icon ? (
                <Image src={community.icon} alt={community.name} width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                community.name[0]?.toUpperCase() || getProtocolIcon(community.protocol)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-[var(--color-fg)]">{community.name}</span>
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${getProtocolColor(community.protocol)}22`, color: getProtocolColor(community.protocol) }}>
                  {community.protocol}
                </span>
              </div>
              {community.description && <div className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">{community.description}</div>}
              {community.memberCount > 0 && <div className="mt-1 text-[10px] text-[var(--color-muted)]">{formatCount(community.memberCount)} members</div>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Video Results ────────────────────────────────────────────

function VideoResults({ videos, showAll }: { videos: VideoResult[]; showAll: boolean }) {
  if (videos.length === 0) return null;
  return (
    <div className="mb-8">
      {showAll && (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">Videos</h2>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {videos.map((video) => (
          <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer"
            className="card-hover flex items-start gap-4 p-4 transition-colors">
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--color-card)]">
              {video.thumbnailUrl ? (
                <Image src={video.thumbnailUrl} alt={video.title} width={112} height={64}
                  className="h-16 w-28 object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg text-[var(--color-muted)]">▶</div>
              )}
              {video.durationSeconds > 0 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-[var(--color-fg)]">
                  {formatDuration(video.durationSeconds)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-[var(--color-fg)]">{video.title}</span>
                <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">{video.source}</span>
              </div>
              {video.channelName && <div className="mt-0.5 text-xs text-[var(--color-muted)] truncate">{video.channelName}</div>}
              <div className="mt-1 flex gap-3 text-[10px] text-[var(--color-muted)]">
                {video.views > 0 && <span>{formatCount(video.views)} views</span>}
                {video.publishedAt > 0 && <span>{formatTime(video.publishedAt)}</span>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Post Results ─────────────────────────────────────────────

function PostResults({ posts, showAll, identities }: { posts: SearchResult[]; showAll: boolean; identities: IdentityResult[] }) {
  const router = useRouter();
  if (posts.length === 0) return null;
  return (
    <div>
      {showAll && identities.length > 0 && (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">Posts</h2>
      )}
      <div className="space-y-2">
        {posts.map((r) => (
          <button key={r.id} type="button" onClick={() => router.push(`/post/${encodeURIComponent(r.id)}`)}
            className="card-hover flex w-full items-start gap-4 p-4 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden"
              style={{ backgroundColor: `${getProtocolColor(r.protocol)}22`, color: getProtocolColor(r.protocol) }}>
              {r.author.avatarUrl ? (
                <Image src={r.author.avatarUrl} alt={r.author.displayName} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                r.author.displayName[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-[var(--color-fg)] truncate">{r.author.displayName}</span>
                <span className="text-[var(--color-muted)]" style={{ color: getProtocolColor(r.protocol) }}>{r.protocol}</span>
                <span className="ml-auto text-[var(--color-muted)]">{formatTime(r.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--color-muted)] line-clamp-2">{r.text}</p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                <span>♥ {r.metrics.likes}</span>
                <span>↻ {r.metrics.reposts}</span>
                <span>✎ {r.metrics.replies}</span>
                {r.niches.length > 0 && (
                  <div className="ml-auto flex gap-1">
                    {r.niches.slice(0, 2).map((n) => (
                      <span key={n} className="rounded-full bg-[var(--color-card)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">{n}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {r.image && (
              <Image src={r.image} alt="Search result image" width={64} height={64}
                className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Protocol Breakdown ────────────────────────────────────────

interface ProtocolBreakdownProps {
  posts: SearchResult[];
  protocolFilter: string | null;
  onProtocolFilterChange: (id: string | null) => void;
}

function ProtocolBreakdown({ posts, protocolFilter, onProtocolFilterChange }: ProtocolBreakdownProps) {
  if (posts.length === 0) return null;
  const breakdown = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.protocol] = (acc[p.protocol] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">Results by Protocol</h2>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(breakdown).map(([proto, count]) => (
          <button key={proto} type="button"
            onClick={() => onProtocolFilterChange(protocolFilter === proto ? null : proto)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
              protocolFilter === proto
                ? 'text-degen-400 shadow-sm'
                : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
            style={protocolFilter === proto ? { backgroundColor: `${getProtocolColor(proto)}22`, color: getProtocolColor(proto) } : undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getProtocolColor(proto) }} />
            {proto}
            <span className="font-mono">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main SearchResults Component ─────────────────────────────

interface SearchResultsComponentProps {
  loading: boolean;
  searched: boolean;
  error: string | null;
  query: string;
  protocolFilter: string | null;
  onProtocolFilterChange: (id: string | null) => void;
  posts: SearchResult[];
  identities: IdentityResult[];
  communities: CommunityResult[];
  videos: VideoResult[];
  showAll: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function SearchResults({
  loading,
  searched,
  error,
  query,
  protocolFilter,
  onProtocolFilterChange,
  posts,
  identities,
  communities,
  videos,
  showAll,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
}: SearchResultsComponentProps) {
  // Loading
  if (loading) return <Skeleton count={5} />;

  // Error
  if (error) {
    return (
      <div className="card border-red-900/50 bg-red-900/10 py-6 text-center">
        <p className="text-sm text-red-400 mb-2">{error}</p>
        <button type="button" onClick={onRetry}
          className="rounded-lg bg-red-500/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  // Empty
  if (searched && !error && posts.length === 0 && identities.length === 0 && communities.length === 0 && videos.length === 0) {
    return (
      <div className="card py-12 text-center">
        <div className="mb-3 text-3xl text-[var(--color-muted)]">⌕</div>
        <p className="text-sm text-[var(--color-muted)]">No results for &ldquo;{query}&rdquo;</p>
        {protocolFilter && <p className="mt-1 text-xs text-[var(--color-muted)]">Try removing the protocol filter</p>}
      </div>
    );
  }

  if (!searched) return null;

  return (
    <>
      {/* Protocol Breakdown */}
      {showAll && posts.length > 0 && (
        <ProtocolBreakdown posts={posts} protocolFilter={protocolFilter} onProtocolFilterChange={onProtocolFilterChange} />
      )}

      {/* People */}
      <IdentityResults identities={identities} showAll={showAll} />

      {/* Communities */}
      <CommunityResults communities={communities} showAll={showAll} />

      {/* Videos */}
      <VideoResults videos={videos} showAll={showAll} />

      {/* Posts */}
      <PostResults posts={posts} showAll={showAll} identities={identities} />

      {/* Load More */}
      {(posts.length > 0 || identities.length > 0 || communities.length > 0 || videos.length > 0) && (
        <LoadMoreButton loading={loadingMore} hasMore={hasMore} onClick={onLoadMore} />
      )}
    </>
  );
}
