'use client';

/**
 * @degenfeed/web — /farcaster/miniapps
 *
 * Farcaster Miniapp Directory & Launcher
 *
 * A curated directory of popular Farcaster miniapps (Frames, apps, tools)
 * that launch inside DegenFeed's ProtocolShell. Each miniapp is rendered
 * as an embed with our cyberpunk design shell.
 *
 * Features:
 *   - Miniapp directory with categories
 *   - Launch miniapp in DegenFeed shell
 *   - "Powered by Farcaster" badge
 *   - Share from miniapp to DegenFeed or other protocols
 *   - Trending/popular miniapp indicators
 */

import { ProtocolShell } from '@degenfeed/ui/protocol-shell';
import Link from 'next/link';
import { useCallback, useState } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────

const FC_COLOR = '#8a63d2';
const FC_PROTOCOL = 'farcaster';
const _FC_LABEL = 'Farcaster';

// ─── Miniapp Definition ─────────────────────────────────────────────────

interface MiniappDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  logo: string;
  embedUrl: string;
  homepage: string;
  badges: string[];
  popular: boolean;
  trending: boolean;
  stats: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
}

const MINIAPPS: MiniappDefinition[] = [
  {
    id: 'paragraph',
    name: 'Paragraph',
    description:
      'Create and publish on-chain newsletters. Write posts, collect subscribers, and earn from your content — all on Farcaster.',
    category: 'Publishing',
    color: '#6b3fa0',
    logo: '📰',
    embedUrl: 'https://paragraph.xyz/',
    homepage: 'https://paragraph.xyz',
    badges: ['Writing', 'Newsletter', 'Monetization'],
    popular: true,
    trending: true,
    stats: [
      { label: 'Posts', value: '12.4K' },
      { label: 'Creators', value: '2.1K', trend: 'up' },
    ],
  },
  {
    id: 'zora',
    name: 'Zora',
    description:
      'Mint and discover NFTs directly from Farcaster. Create drops, collect art, and trade across L2 networks.',
    category: 'NFTs',
    color: '#0052ff',
    logo: '◆',
    embedUrl: 'https://zora.co/',
    homepage: 'https://zora.co',
    badges: ['Minting', 'Art', 'Collectibles'],
    popular: true,
    trending: true,
    stats: [
      { label: 'Mints', value: '48.2K' },
      { label: 'Volume', value: '₿ 142', trend: 'up' },
    ],
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    description:
      'Swap tokens, provide liquidity, and trade across Ethereum L2s. Direct DEX access from your Farcaster feed.',
    category: 'DeFi',
    color: '#ff007a',
    logo: '🦄',
    embedUrl: 'https://app.uniswap.org/',
    homepage: 'https://app.uniswap.org',
    badges: ['Trading', 'Swaps', 'Liquidity'],
    popular: true,
    trending: false,
    stats: [
      { label: 'TVL', value: '$4.2B' },
      { label: '24h Vol', value: '$231M', trend: 'down' },
    ],
  },
  {
    id: 'airstack',
    name: 'Airstack',
    description:
      'On-chain analytics and identity graph for Farcaster. Query profiles, followers, engagement, and token data.',
    category: 'Analytics',
    color: '#00b4d8',
    logo: '📊',
    embedUrl: 'https://app.airstack.xyz/',
    homepage: 'https://app.airstack.xyz',
    badges: ['Analytics', 'Identity', 'Data'],
    popular: false,
    trending: true,
    stats: [
      { label: 'Queries', value: '2.8M' },
      { label: 'Users', value: '8.4K', trend: 'up' },
    ],
  },
  {
    id: 'farquest',
    name: 'FarQuest',
    description:
      'Complete on-chain quests and earn rewards. Social tasks, NFT challenges, and Farcaster-native gamification.',
    category: 'Gaming',
    color: '#f59e0b',
    logo: '⚔',
    embedUrl: 'https://farquest.xyz/',
    homepage: 'https://farquest.xyz',
    badges: ['Quests', 'Rewards', 'Gaming'],
    popular: false,
    trending: true,
    stats: [
      { label: 'Quests', value: '156' },
      { label: 'Players', value: '14K', trend: 'up' },
    ],
  },
  {
    id: 'nouns',
    name: 'Nouns Builder',
    description:
      'Create and manage DAOs on Farcaster. Propose, vote, and govern communities with Nouns-style auction mechanics.',
    category: 'DAO',
    color: '#22c55e',
    logo: '🏛',
    embedUrl: 'https://nouns.build/',
    homepage: 'https://nouns.build',
    badges: ['DAO', 'Governance', 'Auctions'],
    popular: true,
    trending: false,
    stats: [
      { label: 'DAOs', value: '342' },
      { label: 'Proposals', value: '1.8K', trend: 'up' },
    ],
  },
  {
    id: 'bountycaster',
    name: 'BountyCaster',
    description:
      'Post and complete bounties on Farcaster. Freelance tasks, content creation, and development gigs.',
    category: 'Work',
    color: '#ec4899',
    logo: '💰',
    embedUrl: 'https://bountycaster.xyz/',
    homepage: 'https://bountycaster.xyz',
    badges: ['Bounties', 'Freelance', 'Tasks'],
    popular: false,
    trending: false,
    stats: [
      { label: 'Bounties', value: '892' },
      { label: 'Paid', value: '$124K', trend: 'up' },
    ],
  },
  {
    id: 'hypersub',
    name: 'Hypersub',
    description:
      'Subscription monetization for Farcaster creators. Recurring revenue from casts, channels, and exclusive content.',
    category: 'Creator',
    color: '#8b5cf6',
    logo: '📬',
    embedUrl: 'https://hypersub.xyz/',
    homepage: 'https://hypersub.xyz',
    badges: ['Subscriptions', 'Monetization', 'Creator'],
    popular: true,
    trending: true,
    stats: [
      { label: 'Subscribers', value: '22K' },
      { label: 'Revenue', value: '$340K', trend: 'up' },
    ],
  },
  {
    id: 'farconverter',
    name: 'FarConverter',
    description:
      'Turn any Farcaster cast into a blog post, newsletter, or tweet. Cross-post content across protocols.',
    category: 'Tools',
    color: '#10b981',
    logo: '🔄',
    embedUrl: 'https://farconverter.xyz/',
    homepage: 'https://farconverter.xyz',
    badges: ['Cross-post', 'Export', 'Format'],
    popular: false,
    trending: false,
    stats: [
      { label: 'Conversions', value: '6.7K' },
      { label: 'Users', value: '1.2K', trend: 'neutral' },
    ],
  },
  {
    id: 'degen-tipping',
    name: 'Degen Tipping',
    description:
      'Send and receive DEGEN tips on Farcaster. Reward quality content, support creators, and earn from engagement.',
    category: 'Social',
    color: '#00ff41',
    logo: '💎',
    embedUrl: 'https://www.degen.tips/',
    homepage: 'https://www.degen.tips',
    badges: ['Tipping', 'DEGEN', 'Rewards'],
    popular: true,
    trending: true,
    stats: [
      { label: 'Tips Sent', value: '1.2M' },
      { label: 'Total DEGEN', value: '4.8B', trend: 'up' },
    ],
  },
];

const CATEGORIES = Array.from(new Set(MINIAPPS.map((m) => m.category)));

// ─── Page Component ─────────────────────────────────────────────────────

export default function FarcasterMiniappsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [launchedMiniapp, setLaunchedMiniapp] = useState<MiniappDefinition | null>(null);
  const [showOnlyPopular, setShowOnlyPopular] = useState(false);

  const filteredMiniapps = MINIAPPS.filter((app) => {
    if (activeCategory && app.category !== activeCategory) return false;
    if (showOnlyPopular && !app.popular) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.badges.some((b) => b.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleLaunch = useCallback((app: MiniappDefinition) => {
    setLaunchedMiniapp(app);
  }, []);

  const handleBack = useCallback(() => {
    setLaunchedMiniapp(null);
  }, []);

  // ─── Launched view ─────────────────────────────────────────────────

  if (launchedMiniapp) {
    const app = launchedMiniapp;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Miniapp Directory
        </button>

        <ProtocolShell
          protocol={FC_PROTOCOL}
          protocolLabel={app.name}
          color={app.color}
          logo={app.logo}
          embedUrl={app.embedUrl}
          title={app.name}
          description={app.description}
          headerStats={app.stats}
          frameAspectRatio={16 / 9}
          sandboxed={true}
          noSidebar={true}
          breadcrumbs={[
            { label: 'Farcaster', href: '/farcaster' },
            { label: 'Miniapps', href: '/farcaster/miniapps' },
            { label: app.name },
          ]}
          featureFlags={{
            'Cross-post': true,
            Share: true,
            Embed: true,
            'Powered by Farcaster': true,
          }}
        />

        {/* Share bar */}
        <div
          className="mt-6 rounded-xl border p-4"
          style={{ borderColor: `${FC_COLOR}22`, backgroundColor: `${FC_COLOR}04` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: FC_COLOR }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                Share this miniapp
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButton
                label="DegenFeed"
                href={`/compose?text=Check out ${app.name} on Farcaster: ${app.homepage}`}
                icon="D"
              />
              <ShareButton
                label="Farcaster"
                href={`https://warpcast.com/~/compose?text=Check out ${app.name} on Farcaster: ${app.homepage}`}
                icon="🟣"
              />
              <ShareButton
                label="Nostr"
                href={`/nostr/compose?text=Check out ${app.name} on Farcaster: ${app.homepage}`}
                icon="⚡"
              />
              <ShareButton
                label="Bluesky"
                href={`/bluesky/compose?text=Check out ${app.name} on Farcaster: ${app.homepage}`}
                icon="🦋"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Directory view ────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Link href="/farcaster" className="transition-colors hover:text-[var(--color-fg)]">
          Farcaster
        </Link>
        <span className="opacity-40">/</span>
        <span style={{ color: 'var(--color-fg-secondary)' }}>Miniapps</span>
      </nav>

      {/* Hero header */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${FC_COLOR}33`,
          background: `linear-gradient(135deg, ${FC_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: FC_COLOR }}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                style={{
                  backgroundColor: `${FC_COLOR}18`,
                  boxShadow: `0 0 24px ${FC_COLOR}15`,
                }}
              >
                🟣
              </span>
              <div>
                <h1 className="font-heading text-3xl font-bold tracking-tight">
                  Farcaster Miniapps
                </h1>
                <p className="mt-1 text-sm text-[var(--color-fg-secondary)]">
                  Launch popular Farcaster miniapps inside DegenFeed. Everything keeps our cyberpunk
                  look.
                </p>
              </div>
            </div>
          </div>

          {/* Powered by badge */}
          <a
            href="https://www.farcaster.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all hover:scale-105"
            style={{
              borderColor: `${FC_COLOR}44`,
              backgroundColor: `${FC_COLOR}10`,
              color: FC_COLOR,
            }}
          >
            <span className="text-base">🟣</span>
            Powered by Farcaster
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap gap-8">
          <div>
            <div className="font-mono text-2xl font-bold" style={{ color: FC_COLOR }}>
              {MINIAPPS.length}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">Miniapps</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-bold" style={{ color: FC_COLOR }}>
              {CATEGORIES.length}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">Categories</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
              {MINIAPPS.filter((m) => m.trending).length}
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">Trending Now</div>
          </div>
        </div>
      </header>

      {/* Search + filters bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            placeholder="Search miniapps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-[var(--color-card)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
            style={
              {
                borderColor: 'var(--color-glass-border)',
                '--tw-ring-color': FC_COLOR,
              } as React.CSSProperties
            }
            aria-label="Search miniapps"
          />
        </div>

        {/* Popular toggle */}
        <button
          type="button"
          onClick={() => setShowOnlyPopular(!showOnlyPopular)}
          className="rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors"
          style={{
            borderColor: showOnlyPopular ? FC_COLOR : 'var(--color-glass-border)',
            backgroundColor: showOnlyPopular ? `${FC_COLOR}12` : 'transparent',
            color: showOnlyPopular ? FC_COLOR : 'var(--color-muted)',
          }}
          aria-pressed={showOnlyPopular}
        >
          ★ Popular
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Miniapp categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === null}
          onClick={() => setActiveCategory(null)}
          className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
          style={{
            borderColor: activeCategory === null ? FC_COLOR : 'var(--color-glass-border)',
            backgroundColor: activeCategory === null ? `${FC_COLOR}15` : 'transparent',
            color: activeCategory === null ? FC_COLOR : 'var(--color-muted)',
          }}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
            style={{
              borderColor: activeCategory === cat ? FC_COLOR : 'var(--color-glass-border)',
              backgroundColor: activeCategory === cat ? `${FC_COLOR}15` : 'transparent',
              color: activeCategory === cat ? FC_COLOR : 'var(--color-muted)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Trending section */}
      {!activeCategory && !searchQuery && !showOnlyPopular && (
        <section className="mb-10">
          <h2
            className="mb-4 font-heading text-lg font-bold tracking-tight"
            style={{ color: 'var(--color-fg)' }}
          >
            🔥 Trending Miniapps
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MINIAPPS.filter((m) => m.trending).map((app) => (
              <MiniappCard key={app.id} app={app} onLaunch={handleLaunch} />
            ))}
          </div>
        </section>
      )}

      {/* All / filtered miniapps grid */}
      <section>
        <h2
          className="mb-4 font-heading text-lg font-bold tracking-tight"
          style={{ color: 'var(--color-fg)' }}
        >
          {activeCategory
            ? activeCategory
            : searchQuery
              ? 'Search Results'
              : showOnlyPopular
                ? 'Popular Miniapps'
                : 'All Miniapps'}
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>
            ({filteredMiniapps.length})
          </span>
        </h2>

        {filteredMiniapps.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <span className="text-3xl mb-3">🔍</span>
            <p className="text-sm text-[var(--color-muted)]">No miniapps match your filters.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory(null);
                setSearchQuery('');
                setShowOnlyPopular(false);
              }}
              className="mt-3 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: `${FC_COLOR}12`,
                color: FC_COLOR,
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMiniapps.map((app) => (
              <MiniappCard key={app.id} app={app} onLaunch={handleLaunch} />
            ))}
          </div>
        )}
      </section>

      {/* Footer info */}
      <footer
        className="mt-12 border-t py-8 text-center"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">
            All miniapps are third-party services. DegenFeed provides the launcher shell.
          </span>
          <a
            href="https://www.farcaster.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
            style={{
              borderColor: `${FC_COLOR}33`,
              color: FC_COLOR,
            }}
          >
            <span>🟣</span> Learn more about Farcaster
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── Miniapp Card ───────────────────────────────────────────────────────

function MiniappCard({
  app,
  onLaunch,
}: {
  app: MiniappDefinition;
  onLaunch: (app: MiniappDefinition) => void;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border p-5 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5"
      style={{
        borderColor: `${app.color}22`,
        backgroundColor: 'var(--color-card)',
      }}
    >
      {/* Hover glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100"
        style={{
          boxShadow: `0 0 30px ${app.color}10`,
        }}
        aria-hidden="true"
      />

      {/* Top row: logo + badges */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg shadow-md"
          style={{
            backgroundColor: `${app.color}15`,
            boxShadow: `0 0 16px ${app.color}10`,
          }}
        >
          {app.logo}
        </div>
        <div className="flex gap-1">
          {app.popular && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase"
              style={{ backgroundColor: `${app.color}15`, color: app.color }}
            >
              ★ Popular
            </span>
          )}
          {app.trending && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
              }}
            >
              ↑ Trending
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        <h3
          className="font-heading text-base font-bold tracking-tight"
          style={{ color: 'var(--color-fg)' }}
        >
          {app.name}
        </h3>
        <p
          className="mt-1.5 text-xs leading-relaxed"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          {app.description}
        </p>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-mono font-medium"
          style={{
            backgroundColor: `${app.color}10`,
            color: app.color,
          }}
        >
          {app.category}
        </span>
        {app.badges.slice(0, 2).map((badge) => (
          <span
            key={badge}
            className="rounded-full px-2 py-0.5 text-[9px] text-[var(--color-muted)]"
            style={{ backgroundColor: 'var(--color-muted-bg)' }}
          >
            {badge}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div
        className="mt-4 flex gap-4 border-t pt-3"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {app.stats.slice(0, 2).map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold" style={{ color: app.color }}>
              {stat.value}
            </span>
            <span className="text-[9px] text-[var(--color-muted)]">{stat.label}</span>
            {stat.trend && stat.trend !== 'neutral' && (
              <span
                className="text-[10px]"
                style={{
                  color: stat.trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              >
                {stat.trend === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onLaunch(app)}
          className="flex-1 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.98]"
          style={{
            backgroundColor: app.color,
            color: '#fff',
          }}
        >
          Launch in DegenFeed
        </button>
        <a
          href={app.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)', border: '1px solid var(--color-glass-border)' }}
          title={`Open ${app.name} directly`}
        >
          ↗
        </a>
      </div>
    </article>
  );
}

// ─── Share Button ───────────────────────────────────────────────────────

function ShareButton({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
      style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg-secondary)' }}
    >
      <span>{icon}</span>
      {label}
    </a>
  );
}
