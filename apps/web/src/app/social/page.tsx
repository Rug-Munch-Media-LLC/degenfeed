'use client';

/**
 * @degenfeed/web — /social
 *
 * GoToSocial (GTS) Embedded — Federated Microblogging
 *
 * Browse federated microblogging content through GoToSocial instances.
 * Lightweight, efficient, and privacy-respecting alternative to Mastodon,
 * all embedded inside DegenFeed's cyberpunk shell.
 */

import { ProtocolShell, PROTOCOL_META } from '@degenfeed/ui/protocol-shell';
import Link from 'next/link';
import { useCallback, useState } from 'react';

const GTS_META = PROTOCOL_META.gotosocial;
const GTS_COLOR = GTS_META.color;
const GTS_LABEL = 'GoToSocial';

// ─── Instance data ──────────────────────────────────────────────────────

interface GTSInstance {
  name: string;
  description: string;
  url: string;
  users: number;
  posts: number;
  category: string;
  featured: boolean;
  language: string;
}

const INSTANCES: GTSInstance[] = [
  {
    name: 'degenfeed.social',
    description: 'Official DegenFeed GoToSocial instance — crypto, web3, fediverse',
    url: 'https://degenfeed.social',
    users: 890,
    posts: 12400,
    category: 'Tech',
    featured: true,
    language: 'English',
  },
  {
    name: 'gts.social',
    description: 'General GoToSocial instance — open registration',
    url: 'https://gts.social',
    users: 2300,
    posts: 45000,
    category: 'General',
    featured: true,
    language: 'English',
  },
  {
    name: 'social.privacytools.io',
    description: 'Privacy-focused — minimal tracking, maximum encryption',
    url: 'https://social.privacytools.io',
    users: 1200,
    posts: 28000,
    category: 'Privacy',
    featured: false,
    language: 'English',
  },
  {
    name: 'fedi.social',
    description: 'General fediverse instance with GTS backend',
    url: 'https://fedi.social',
    users: 3400,
    posts: 67000,
    category: 'General',
    featured: false,
    language: 'English',
  },
  {
    name: 'todon.eu',
    description: 'EU-hosted — GDPR compliant, climate conscious',
    url: 'https://todon.eu',
    users: 4500,
    posts: 89000,
    category: 'Regional',
    featured: false,
    language: 'DE/EN',
  },
  {
    name: 'social.coop',
    description: 'Worker-owned cooperative social network',
    url: 'https://social.coop',
    users: 1800,
    posts: 34000,
    category: 'Community',
    featured: true,
    language: 'English',
  },
];

const CATEGORIES = Array.from(new Set(INSTANCES.map((i) => i.category)));

// ─── Page ───────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = INSTANCES.filter((inst) => {
    if (activeCategory && inst.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inst.name.toLowerCase().includes(q) ||
        inst.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBrowse = useCallback((inst: GTSInstance) => {
    setEmbedUrl(inst.url);
  }, []);

  const handleBack = useCallback(() => {
    setEmbedUrl(null);
  }, []);

  // ─── Embedded view ────────────────────────────────────────────────

  if (embedUrl) {
    const instance = INSTANCES.find((i) => i.url === embedUrl)!;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Social
        </button>

        <ProtocolShell
          protocol="gotosocial"
          protocolLabel={instance.name}
          color={GTS_COLOR}
          logo={GTS_META.logo}
          embedUrl={instance.url}
          title={instance.name}
          description={instance.description}
          headerStats={[
            { label: 'Users', value: instance.users.toLocaleString(), trend: 'up' },
            { label: 'Posts', value: instance.posts.toLocaleString() },
          ]}
          frameAspectRatio={16 / 9}
          sandboxed={true}
          noSidebar={true}
          breadcrumbs={[
            { label: 'Social', href: '/social' },
            { label: instance.name },
          ]}
          featureFlags={{
            'Federated': true,
            'ActivityPub': true,
            'Lightweight': true,
          }}
        />
      </div>
    );
  }

  // ─── Directory view ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Link href="/feed" className="transition-colors hover:text-[var(--color-fg)]">Feed</Link>
        <span className="opacity-40">/</span>
        <span style={{ color: 'var(--color-fg-secondary)' }}>Social</span>
      </nav>

      {/* Hero */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${GTS_COLOR}33`,
          background: `linear-gradient(135deg, ${GTS_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: GTS_COLOR }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${GTS_COLOR}18`,
              boxShadow: `0 0 24px ${GTS_COLOR}15`,
            }}
          >
            {GTS_META.logo}
          </span>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              GoToSocial
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              Lightweight, privacy-respecting federated social networking.
              Browse GoToSocial instances embedded in DegenFeed.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase"
                style={{
                  backgroundColor: `${GTS_COLOR}15`,
                  color: GTS_COLOR,
                }}
              >
                {GTS_META.logo} Powered by GoToSocial
              </span>
              <a
                href="https://gotosocial.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] underline underline-offset-2"
                style={{ color: 'var(--color-muted)' }}
              >
                What is GoToSocial?
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Search instances..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-[var(--color-card)] py-2.5 px-4 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--color-glass-border)',
              '--tw-ring-color': GTS_COLOR,
            } as React.CSSProperties}
            aria-label="Search social instances"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
          style={{
            borderColor: activeCategory === null ? GTS_COLOR : 'var(--color-glass-border)',
            backgroundColor: activeCategory === null ? `${GTS_COLOR}15` : 'transparent',
            color: activeCategory === null ? GTS_COLOR : 'var(--color-muted)',
          }}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
            style={{
              borderColor: activeCategory === cat ? GTS_COLOR : 'var(--color-glass-border)',
              backgroundColor: activeCategory === cat ? `${GTS_COLOR}15` : 'transparent',
              color: activeCategory === cat ? GTS_COLOR : 'var(--color-muted)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured */}
      {!activeCategory && !searchQuery && (
        <section className="mb-10">
          <h2 className="mb-4 font-heading text-lg font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
            ⭐ Featured Instances
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INSTANCES.filter((i) => i.featured).map((inst) => (
              <InstanceCard key={inst.name} instance={inst} onBrowse={handleBrowse} color={GTS_COLOR} />
            ))}
          </div>
        </section>
      )}

      {/* All instances */}
      <section>
        <h2 className="mb-4 font-heading text-lg font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
          {activeCategory || 'All Instances'}
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>
            ({filtered.length})
          </span>
        </h2>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <span className="mb-3 text-3xl">🔍</span>
            <p className="text-sm text-[var(--color-muted)]">No instances match your search.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveCategory(null); }}
              className="mt-3 rounded-lg px-4 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: `${GTS_COLOR}12`,
                color: GTS_COLOR,
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((inst) => (
              <InstanceCard key={inst.name} instance={inst} onBrowse={handleBrowse} color={GTS_COLOR} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 border-t py-8 text-center" style={{ borderColor: 'var(--color-glass-border)' }}>
        <p className="text-xs text-[var(--color-muted)]">
          Instances powered by GoToSocial, a lightweight ActivityPub server. DegenFeed embeds them in our shell.
        </p>
      </footer>
    </div>
  );
}

// ─── Instance Card ──────────────────────────────────────────────────────

function InstanceCard({
  instance,
  onBrowse,
  color,
}: {
  instance: GTSInstance;
  onBrowse: (inst: GTSInstance) => void;
  color: string;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border p-5 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5"
      style={{
        borderColor: `${color}22`,
        backgroundColor: 'var(--color-card)',
      }}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{ boxShadow: `0 0 30px ${color}10` }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `${color}15` }}
        >
          🐢
        </span>
        <div className="min-w-0">
          <h3 className="font-heading font-bold" style={{ color: 'var(--color-fg)' }}>
            {instance.name}
          </h3>
          <p className="mt-0.5 text-xs line-clamp-2" style={{ color: 'var(--color-fg-secondary)' }}>
            {instance.description}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex gap-4 text-xs">
        <div>
          <span className="font-mono font-bold" style={{ color }}>{instance.users.toLocaleString()}</span>
          <span className="ml-1" style={{ color: 'var(--color-muted)' }}>users</span>
        </div>
        <div>
          <span className="font-mono font-bold" style={{ color }}>{instance.posts.toLocaleString()}</span>
          <span className="ml-1" style={{ color: 'var(--color-muted)' }}>posts</span>
        </div>
        <div className="ml-auto font-mono text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {instance.language}
        </div>
      </div>

      {/* Category tag + browse */}
      <div className="mt-4 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-mono font-medium"
          style={{
            backgroundColor: `${color}10`,
            color,
          }}
        >
          {instance.category}
        </span>
        <button
          type="button"
          onClick={() => onBrowse(instance)}
          className="rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.98]"
          style={{ backgroundColor: color, color: '#fff' }}
        >
          Browse Instance
        </button>
      </div>
    </article>
  );
}
