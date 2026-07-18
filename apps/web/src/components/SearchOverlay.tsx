'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
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

interface IdentityResult {
  id: string;
  protocol: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string;
  postCount: number;
}

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

function getProfileUrl(identity: IdentityResult): string {
  // Build external profile URL by protocol
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

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [identities, setIdentities] = useState<IdentityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'people'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setIdentities([]);
      setSearched(false);
      setActiveTab('all');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIdentities([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const [postsRes, identityRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`, { credentials: 'include' }),
        fetch(`/api/search/identity?q=${encodeURIComponent(q)}&limit=5`, {
          credentials: 'include',
        }),
      ]);
      const postsData = postsRes.ok
        ? ((await postsRes.json()) as { data?: SearchResult[] })
        : { data: [] };
      const identityData = identityRes.ok
        ? ((await identityRes.json()) as { data?: IdentityResult[] })
        : { data: [] };
      setResults(postsData.data ?? []);
      setIdentities(identityData.data ?? []);
    } catch (err) {
      setResults([]);
      setIdentities([]);
      setError(err instanceof Error ? err.message : 'Search failed');
    }
    setLoading(false);
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleChange = useCallback(
    (val: string) => {
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 300);
    },
    [doSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    },
    [onClose],
  );

  if (!open) return null;

  const showPeople = activeTab === 'all' || activeTab === 'people';
  const showPosts = activeTab === 'all';
  const visibleIdentities = showPeople ? identities : [];
  const visibleResults = showPosts ? results : [];

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--color-glass-bg)] pt-16 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl px-4">
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search posts, people, topics, tokens..."
            className="input h-12 pl-12 pr-12 text-base"
            role="searchbox"
            aria-label="Search posts, people, topics, and tokens"
            autoComplete="off"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
            {loading ? '⟳' : '⌕'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Tabs */}
        {searched && !loading && (
          <div className="mb-3 flex gap-1 rounded-xl bg-[var(--color-card)] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('people')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'people'
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              People {identities.length > 0 && `(${identities.length})`}
            </button>
            <a
              href={`/search?q=${encodeURIComponent(query)}`}
              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors text-center"
              onClick={onClose}
            >
              Advanced →
            </a>
          </div>
        )}

        {loading && (
          <div className="mb-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full bg-[var(--color-card)]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-[var(--color-card)]" />
                  <div className="h-3 w-full rounded bg-[var(--color-card)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="card border-red-900/50 bg-red-900/10 py-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {searched &&
          !loading &&
          !error &&
          visibleIdentities.length === 0 &&
          visibleResults.length === 0 && (
            <div className="card py-8 text-center">
              <p className="text-sm text-[var(--color-muted)]">
                No results for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {/* People results */}
          {visibleIdentities.length > 0 && (
            <div>
              {(activeTab === 'people' ||
                (activeTab === 'all' && visibleIdentities.length > 0)) && (
                <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
                  People
                </div>
              )}
              <div
                className={
                  activeTab === 'people'
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4'
                    : 'space-y-1 mb-3'
                }
              >
                {visibleIdentities.map((identity) => (
                  <a
                    key={identity.id}
                    href={getProfileUrl(identity)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`card-hover flex items-center gap-3 transition-colors ${
                      activeTab === 'people' ? 'p-4' : 'p-3'
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold overflow-hidden"
                      style={{
                        backgroundColor: `${getProtocolColor(identity.protocol)}22`,
                        color: getProtocolColor(identity.protocol),
                      }}
                    >
                      {identity.avatarUrl ? (
                        <Image
                          src={identity.avatarUrl}
                          alt={identity.displayName}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        identity.displayName[0]?.toUpperCase() || getProtocolIcon(identity.protocol)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                          {identity.displayName}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${getProtocolColor(identity.protocol)}22`,
                            color: getProtocolColor(identity.protocol),
                          }}
                        >
                          {identity.protocol}
                        </span>
                      </div>
                      {identity.handle && (
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {identity.handle}
                        </div>
                      )}
                      {identity.bio && activeTab === 'people' && (
                        <div className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                          {identity.bio}
                        </div>
                      )}
                      {activeTab === 'people' && identity.postCount > 0 && (
                        <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                          {formatCount(identity.postCount)} posts
                        </div>
                      )}
                    </div>
                    {activeTab === 'people' && (
                      <span className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors">
                        View
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Post results */}
          {visibleResults.length > 0 && (
            <div>
              {visibleIdentities.length > 0 && activeTab === 'all' && (
                <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
                  Posts
                </div>
              )}
              <div className="space-y-2">
                {visibleResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      router.push(`/post/${encodeURIComponent(r.id)}`);
                      onClose();
                    }}
                    className="card-hover flex w-full items-start gap-3 p-3 text-left"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${getProtocolColor(r.protocol)}22`,
                        color: getProtocolColor(r.protocol),
                      }}
                    >
                      {r.author.displayName[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-[var(--color-fg)] truncate">
                          {r.author.displayName}
                        </span>
                        <span
                          className="text-[var(--color-muted)]"
                          style={{ color: getProtocolColor(r.protocol) }}
                        >
                          {r.protocol}
                        </span>
                        <span className="ml-auto text-[var(--color-muted)]">
                          {formatTime(r.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--color-muted)] line-clamp-2">
                        {r.text}
                      </p>
                      <div className="mt-1 flex gap-3 text-[10px] text-[var(--color-muted)]">
                        <span>♥ {r.metrics.likes}</span>
                        <span>↻ {r.metrics.reposts}</span>
                        <span>✎ {r.metrics.replies}</span>
                      </div>
                    </div>
                    {r.image && (
                      <Image
                        src={r.image}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
