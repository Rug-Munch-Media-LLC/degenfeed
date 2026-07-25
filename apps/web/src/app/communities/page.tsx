'use client';

/**
 * @degenfeed/web — /communities
 *
 * Lemmy Embedded — Federated Communities
 *
 * Browse federated Lemmy communities through DegenFeed's protocol shell.
 * Lists communities, allows browsing posts, and provides a gateway
 * to the wider Lemmy fediverse — all inside our cyberpunk design.
 */

import { ProtocolShell, PROTOCOL_META } from '@degenfeed/ui/protocol-shell';
import Link from 'next/link';
import { useCallback, useState } from 'react';

const LEMMY_META = PROTOCOL_META.lemmy;
const LEMMY_COLOR = LEMMY_META.color;

// ─── Featured communities ───────────────────────────────────────────────

interface CommunityEntry {
  name: string;
  description: string;
  url: string;
  members: number;
  posts: number;
  category: string;
  trending: boolean;
}

const FEATURED_COMMUNITIES: CommunityEntry[] = [
  {
    name: 'DegenFeed',
    description: 'Official DegenFeed community — cross-protocol social discussion',
    url: 'https://lemmy.degenfeed.xyz/c/degenfeed',
    members: 1240,
    posts: 3400,
    category: 'Social',
    trending: true,
  },
  {
    name: 'Web3',
    description: 'Decentralized web, crypto, and blockchain discussions',
    url: 'https://lemmy.dbzer0.com/c/web3',
    members: 5800,
    posts: 15200,
    category: 'Tech',
    trending: true,
  },
  {
    name: 'CryptoCurrency',
    description: 'Cryptocurrency news, trading, and technology',
    url: 'https://lemmy.world/c/cryptocurrency',
    members: 12000,
    posts: 45000,
    category: 'Finance',
    trending: true,
  },
  {
    name: 'Open Source',
    description: 'Open source software development and collaboration',
    url: 'https://lemmy.ml/c/opensource',
    members: 8900,
    posts: 21000,
    category: 'Tech',
    trending: false,
  },
  {
    name: 'Privacy Guides',
    description: 'Privacy tools, guides, and discussions',
    url: 'https://lemmy.dbzer0.com/c/privacyguides',
    members: 6700,
    posts: 12400,
    category: 'Tech',
    trending: true,
  },
  {
    name: 'Self Hosted',
    description: 'Self-hosting services, hardware, and software',
    url: 'https://lemmy.world/c/selfhosted',
    members: 15000,
    posts: 38000,
    category: 'Tech',
    trending: false,
  },
  {
    name: 'Gaming',
    description: 'Video games, tabletop, and gaming culture',
    url: 'https://lemmy.ml/c/gaming',
    members: 22000,
    posts: 67000,
    category: 'Gaming',
    trending: false,
  },
  {
    name: 'Music',
    description: 'Music discovery, production, and discussion',
    url: 'https://lemmy.world/c/music',
    members: 4800,
    posts: 14000,
    category: 'Entertainment',
    trending: false,
  },
  {
    name: 'Science',
    description: 'Scientific discoveries, research, and discussion',
    url: 'https://lemmy.world/c/science',
    members: 31000,
    posts: 89000,
    category: 'Science',
    trending: false,
  },
];

const CATEGORIES = Array.from(new Set(FEATURED_COMMUNITIES.map((c) => c.category)));

// ─── Page ───────────────────────────────────────────────────────────────

export default function CommunitiesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = FEATURED_COMMUNITIES.filter((c) => {
    if (activeCategory && c.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBrowse = useCallback((community: CommunityEntry) => {
    setEmbedUrl(community.url);
  }, []);

  const handleBack = useCallback(() => {
    setEmbedUrl(null);
  }, []);

  // ─── Embedded view ────────────────────────────────────────────────

  if (embedUrl) {
    const community = FEATURED_COMMUNITIES.find((c) => c.url === embedUrl)!;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Communities
        </button>

        <ProtocolShell
          protocol="lemmy"
          protocolLabel={community.name}
          color={LEMMY_COLOR}
          logo={LEMMY_META.logo}
          embedUrl={community.url}
          title={`${community.name} — Lemmy Community`}
          description={community.description}
          headerStats={[
            { label: 'Members', value: community.members.toLocaleString(), trend: 'up' },
            { label: 'Posts', value: community.posts.toLocaleString() },
          ]}
          frameAspectRatio={16 / 9}
          sandboxed={true}
          noSidebar={true}
          breadcrumbs={[
            { label: 'Communities', href: '/communities' },
            { label: community.name },
          ]}
          featureFlags={{
            'Federated': true,
            'Vote': true,
            'Cross-post': true,
          }}
        />
      </div>
    );
  }

  // ─── Directory view ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Link href="/feed" className="transition-colors hover:text-[var(--color-fg)]">
          Feed
        </Link>
        <span className="opacity-40">/</span>
        <span style={{ color: 'var(--color-fg-secondary)' }}>Communities</span>
      </nav>

      {/* Hero */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${LEMMY_COLOR}33`,
          background: `linear-gradient(135deg, ${LEMMY_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: LEMMY_COLOR }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${LEMMY_COLOR}18`,
              boxShadow: `0 0 24px ${LEMMY_COLOR}15`,
            }}
          >
            {LEMMY_META.logo}
          </span>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              Federated Communities
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              Browse Lemmy communities from across the fediverse — all inside DegenFeed.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase"
                style={{
                  backgroundColor: `${LEMMY_COLOR}15`,
                  color: LEMMY_COLOR,
                }}
              >
                {LEMMY_META.logo} Powered by Lemmy
              </span>
              <a
                href="https://join-lemmy.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] underline underline-offset-2"
                style={{ color: 'var(--color-muted)' }}
              >
                What is Lemmy?
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Search + filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-[var(--color-card)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--color-glass-border)',
              '--tw-ring-color': LEMMY_COLOR,
            } as React.CSSProperties}
            aria-label="Search communities"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Community categories">
        <CategoryTab
          label="All"
          active={activeCategory === null}
          color={LEMMY_COLOR}
          onClick={() => setActiveCategory(null)}
        />
        {CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat}
            label={cat}
            active={activeCategory === cat}
            color={LEMMY_COLOR}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
      </div>

      {/* Trending section */}
      {!activeCategory && !searchQuery && (
        <section className="mb-10">
          <h2 className="mb-4 font-heading text-lg font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
            🔥 Trending Communities
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_COMMUNITIES.filter((c) => c.trending).map((community) => (
              <CommunityCard key={community.name} community={community} onBrowse={handleBrowse} />
            ))}
          </div>
        </section>
      )}

      {/* All communities */}
      <section>
        <h2 className="mb-4 font-heading text-lg font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
          {activeCategory || 'All Communities'}
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>
            ({filtered.length})
          </span>
        </h2>

        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <span className="mb-3 text-3xl">🔍</span>
            <p className="text-sm text-[var(--color-muted)]">No communities match your search.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveCategory(null); }}
              className="mt-3 rounded-lg px-4 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: `${LEMMY_COLOR}12`,
                color: LEMMY_COLOR,
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((community) => (
              <CommunityCard key={community.name} community={community} onBrowse={handleBrowse} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer
        className="mt-12 border-t py-8 text-center"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <p className="text-xs text-[var(--color-muted)]">
          Communities are hosted across the Lemmy fediverse. DegenFeed embeds them in our shell.
        </p>
      </footer>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function CategoryTab({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
      style={{
        borderColor: active ? color : 'var(--color-glass-border)',
        backgroundColor: active ? `${color}15` : 'transparent',
        color: active ? color : 'var(--color-muted)',
      }}
    >
      {label}
    </button>
  );
}

function CommunityCard({
  community,
  onBrowse,
}: {
  community: CommunityEntry;
  onBrowse: (c: CommunityEntry) => void;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border p-5 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5"
      style={{
        borderColor: `${LEMMY_COLOR}22`,
        backgroundColor: 'var(--color-card)',
      }}
    >
      {/* Hover glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100"
        style={{ boxShadow: `0 0 30px ${LEMMY_COLOR}10` }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `${LEMMY_COLOR}15` }}
        >
          {LEMMY_META.logo}
        </span>
        <div className="min-w-0">
          <h3 className="font-heading font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
            !{community.name}
          </h3>
          <p className="mt-0.5 text-xs line-clamp-2" style={{ color: 'var(--color-fg-secondary)' }}>
            {community.description}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex gap-4 text-xs">
        <div>
          <span className="font-mono font-bold" style={{ color: LEMMY_COLOR }}>
            {community.members.toLocaleString()}
          </span>
          <span className="ml-1" style={{ color: 'var(--color-muted)' }}>members</span>
        </div>
        <div>
          <span className="font-mono font-bold" style={{ color: LEMMY_COLOR }}>
            {community.posts.toLocaleString()}
          </span>
          <span className="ml-1" style={{ color: 'var(--color-muted)' }}>posts</span>
        </div>
      </div>

      {/* Category badge + browse */}
      <div className="mt-4 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-mono font-medium"
          style={{
            backgroundColor: `${LEMMY_COLOR}10`,
            color: LEMMY_COLOR,
          }}
        >
          {community.category}
        </span>
        <button
          type="button"
          onClick={() => onBrowse(community)}
          className="rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.98]"
          style={{
            backgroundColor: LEMMY_COLOR,
            color: '#fff',
          }}
        >
          Browse
        </button>
      </div>
    </article>
  );
}
