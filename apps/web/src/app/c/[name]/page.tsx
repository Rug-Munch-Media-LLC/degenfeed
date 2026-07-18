'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import type { CrossProtocolCommunity } from '@degenfeed/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';

type Tab = 'posts' | 'about' | 'members' | 'proposals';

const PROTOCOL_META: Record<string, { label: string; color: string; emoji: string; url?: string }> =
  {
    lemmy: { label: 'Lemmy', color: '#00b868', emoji: 'L', url: 'https://join-lemmy.org' },
    nostr: { label: 'Nostr', color: '#8e30eb', emoji: '⚡' },
    farcaster: {
      label: 'Farcaster',
      color: '#8a63d2',
      emoji: '🟣',
      url: 'https://farcaster.xyz',
    },
    mastodon: { label: 'Mastodon', color: '#6364ff', emoji: '🐘' },
    bluesky: { label: 'Bluesky', color: '#1185fe', emoji: '🦋', url: 'https://bsky.app' },
    lens: { label: 'Lens', color: '#abfe2c', emoji: '🌿', url: 'https://lens.xyz' },
  };

interface FeedItem {
  id: string;
  protocol: string;
  text: string;
  author: { displayName: string; handle: string; avatar?: string };
  createdAt: number;
  likes: number;
  replies: number;
}

export default function CommunityPage() {
  const params = useParams();
  const name = typeof params.name === 'string' ? params.name : '';
  const { openSignIn, ready } = useAuth();
  const { showToast } = useToast();

  const [community, setCommunity] = useState<CrossProtocolCommunity | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  // Fetch community data
  useEffect(() => {
    if (!name) return;
    let cancelled = false;

    async function load() {
      try {
        const [communityRes, feedRes] = await Promise.all([
          fetch(`/api/community/${encodeURIComponent(name)}`, { cache: 'no-store' }),
          fetch(`/api/community/${encodeURIComponent(name)}/feed`, { cache: 'no-store' }),
        ]);

        if (!communityRes.ok) {
          if (!cancelled) setError('Community not found');
          return;
        }

        const communityData = (await communityRes.json()) as { community: CrossProtocolCommunity };
        const feedData = (await feedRes.json()) as { data: FeedItem[] };

        if (!cancelled) {
          setCommunity(communityData.community);
          setFeed(feedData.data ?? []);
        }
      } catch {
        if (!cancelled) setError('Failed to load community');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [name]);

  const handleJoin = useCallback(async () => {
    if (!ready) {
      openSignIn();
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/community/${encodeURIComponent(name)}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setIsMember(true);
        showToast('success', 'Joined community!');
      } else {
        showToast('error', data.error || 'Failed to join');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setJoining(false);
    }
  }, [name, ready, openSignIn, showToast]);

  const protocolList = useMemo(() => {
    if (!community) return [];
    return Object.entries(PROTOCOL_META)
      .filter(([key]) => {
        const protocols = community.protocols as Record<string, unknown>;
        return protocols[key] !== undefined;
      })
      .map(([key, meta]) => ({
        key,
        ...meta,
        data: (community.protocols as Record<string, unknown>)[key],
      }));
  }, [community]);

  const formatDate = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="card animate-pulse h-48" />
        <div className="mt-4 card animate-pulse h-64" />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mb-4 text-4xl">🔍</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Community Not Found</h1>
        <p className="mt-2 text-sm text-gray-500">
          {error || 'The community you are looking for does not exist.'}
        </p>
        <Link href="/c" className="mt-6 inline-block btn-primary text-sm">
          Browse Communities
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Banner */}
        {community.banner && (
          <div className="mb-4 overflow-hidden rounded-xl">
            <Image
              src={community.banner}
              alt={community.displayName}
              width={1200}
              height={300}
              className="h-32 w-full object-cover sm:h-48"
            />
          </div>
        )}

        {/* Community Header */}
        <div className="card mb-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-muted)] text-2xl font-bold text-[var(--color-fg)]">
              {community.icon ? (
                <Image
                  src={community.icon}
                  alt={community.displayName}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                community.displayName.charAt(0).toUpperCase()
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-[var(--color-fg)]">{community.displayName}</h1>
              <p className="mt-1 text-sm text-gray-400 line-clamp-2">{community.description}</p>

              {/* Protocol badges */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {protocolList.map((p) => (
                  <a
                    key={p.key}
                    href={p.url || '#'}
                    target={p.url ? '_blank' : undefined}
                    rel={p.url ? 'noopener' : undefined}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: `${p.color}22`, color: p.color }}
                  >
                    {p.emoji} {p.label}
                  </a>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span>
                  <strong className="text-[var(--color-fg)]">
                    {community.memberCount.toLocaleString()}
                  </strong>{' '}
                  members
                </span>
                <span>
                  <strong className="text-[var(--color-fg)]">
                    {community.postCount.toLocaleString()}
                  </strong>{' '}
                  posts
                </span>
                <span className="text-xs text-gray-600">
                  Created{' '}
                  {new Date(community.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Join button */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  isMember
                    ? 'border border-degen-500/30 bg-degen-500/10 text-degen-400'
                    : 'btn-primary'
                } disabled:opacity-50`}
              >
                {joining ? '…' : isMember ? 'Joined' : '+ Join'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex border-b border-white/10">
          {(['posts', 'about', 'members'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'text-[var(--color-fg)]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-degen-500" />
              )}
            </button>
          ))}
          <Link
            href={`/c/${name}/proposals`}
            className="relative px-4 py-3 text-sm font-medium capitalize text-gray-500 transition-colors hover:text-gray-300"
          >
            Proposals
          </Link>
        </div>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <div className="space-y-3">
            {feed.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500">No posts in this community yet.</p>
                <p className="mt-1 text-xs text-gray-600">
                  Posts from all protocols will appear here.
                </p>
              </div>
            ) : (
              feed.map((item) => (
                <div
                  key={item.id}
                  className="card flex items-start gap-3 transition-colors hover:border-white/20"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-muted)] text-xs text-[var(--color-fg)]">
                    {item.author.avatar ? (
                      <Image
                        src={item.author.avatar}
                        alt={item.author.displayName}
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      item.author.displayName.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-fg)]">
                        {item.author.displayName}
                      </span>
                      <span className="text-xs text-gray-500">@{item.author.handle}</span>
                      {/* Protocol badge */}
                      <span
                        className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${PROTOCOL_META[item.protocol]?.color || '#666'}22`,
                          color: PROTOCOL_META[item.protocol]?.color || '#666',
                        }}
                      >
                        {PROTOCOL_META[item.protocol]?.emoji || '●'}{' '}
                        {PROTOCOL_META[item.protocol]?.label || item.protocol}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-300 line-clamp-3">{item.text}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>♥ {item.likes}</span>
                      <span>💬 {item.replies}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="card space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Description</h3>
              <p className="mt-1 text-sm text-gray-400 whitespace-pre-wrap">
                {community.description || 'No description provided.'}
              </p>
            </div>

            {community.tags && community.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Tags</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {community.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Protocols</h3>
              <div className="mt-2 space-y-2">
                {protocolList.map((p) => {
                  const pd = p.data as Record<string, unknown> | undefined;
                  return (
                    <div
                      key={p.key}
                      className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: `${p.color}22`, color: p.color }}
                        >
                          {p.emoji} {p.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {pd
                            ? Object.entries(pd)
                                .filter(
                                  ([k, v]) =>
                                    k !== 'members' &&
                                    typeof v === 'string' &&
                                    String(v).length > 0,
                                )
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(', ')
                            : 'Not configured'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Creator</h3>
              <p className="mt-1 font-mono text-xs text-gray-500">
                {community.creator.walletAddress.slice(0, 6)}...
                {community.creator.walletAddress.slice(-4)}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="card">
            <p className="text-sm text-gray-400">
              <strong className="text-[var(--color-fg)]">
                {community.memberCount.toLocaleString()}
              </strong>{' '}
              members
            </p>
            <p className="mt-2 text-xs text-gray-600">
              Member list is available to community members. Join to see who else is here.
            </p>
            {!isMember && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="mt-4 btn-primary text-sm disabled:opacity-50"
              >
                {joining ? '…' : '+ Join to see members'}
              </button>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
