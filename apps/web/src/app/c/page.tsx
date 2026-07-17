'use client';

import type { CrossProtocolCommunity } from '@degenfeed/utils';
import { ErrorBoundary } from '@degenfeed/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

const PROTOCOL_NAMES: Record<string, { label: string; color: string; emoji: string }> = {
  lemmy: { label: 'Lemmy', color: '#00b868', emoji: 'L' },
  nostr: { label: 'Nostr', color: '#8e30eb', emoji: '⚡' },
  farcaster: { label: 'Farcaster', color: '#8a63d2', emoji: '🟣' },
  mastodon: { label: 'Mastodon', color: '#6364ff', emoji: '🐘' },
  bluesky: { label: 'Bluesky', color: '#1185fe', emoji: '🦋' },
  lens: { label: 'Lens', color: '#abfe2c', emoji: '🌿' },
};

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CrossProtocolCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { openSignIn, ready } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/communities', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { data: CrossProtocolCommunity[]; meta: { total: number } };
        if (!cancelled) setCommunities(data.data ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return communities;
    const q = search.toLowerCase();
    return communities.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [communities, search]);

  const protocolSet = useCallback((community: CrossProtocolCommunity) => {
    return Object.entries(PROTOCOL_NAMES).filter(([key]) => {
      const protocols = community.protocols as Record<string, unknown>;
      return protocols[key] !== undefined;
    });
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Communities</h1>
              <p className="mt-1 text-sm text-gray-500">
                Cross-protocol communities spanning Lemmy, Nostr, Farcaster, Mastodon, Bluesky, and
                Lens.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!ready) {
                  openSignIn();
                  return;
                }
                setShowCreate(true);
              }}
              className="btn-primary text-sm"
            >
              + Create
            </button>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-gray-500 outline-none transition-colors focus:border-degen-500/50"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-24" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="mb-4 text-4xl">🌐</div>
            <p className="text-gray-400">
              {search ? 'No communities match your search.' : 'No communities yet.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-4 btn-primary text-sm"
              >
                Create the first community
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((community) => (
              <Link
                key={community.id}
                href={`/c/${community.name}`}
                className="card group flex flex-col transition-all hover:border-degen-500/30 hover:shadow-[0_0_20px_rgba(0,255,65,0.05)]"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-muted)] text-lg font-bold text-[var(--color-fg)]">
                    {community.icon ? (
                      <Image
                        src={community.icon}
                        alt={community.displayName}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      community.displayName.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[var(--color-fg)] truncate">{community.displayName}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{community.description}</p>
                  </div>
                </div>

                {/* Protocol badges */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {protocolSet(community).map(([key, meta]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                    >
                      {meta.emoji} {meta.label}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>{community.memberCount.toLocaleString()} members</span>
                  <span>{community.postCount.toLocaleString()} posts</span>
                  <span className="ml-auto text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create community modal (simplified inline) */}
        {showCreate && (
          <CreateCommunityModal
            onClose={() => setShowCreate(false)}
            onCreated={(slug) => {
              setShowCreate(false);
              window.location.href = `/c/${slug}`;
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

function CreateCommunityModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          displayName: displayName.trim() || name.trim(),
          description: description.trim(),
        }),
      });
      const data = (await res.json()) as { success?: boolean; community?: { name: string }; error?: string; slug?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to create community');
        return;
      }
      if (data.community) {
        onCreated(data.community.name);
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card mx-4 w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">Create Community</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="crypto"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
              required
              maxLength={48}
            />
            <p className="mt-1 text-[10px] text-gray-600">URL-safe slug (letters, numbers, hyphens)</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Crypto & Blockchain"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about?"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none resize-none focus:border-degen-500/50"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create Community'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
