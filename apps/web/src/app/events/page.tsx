'use client';

/**
 * @degenfeed/web — /events
 *
 * Mobilizon Embedded — Federated Event Management
 *
 * Discover, create, and manage events from the fediverse.
 * Browse Mobilizon events and embed them inside DegenFeed's shell.
 */

import { PROTOCOL_META, ProtocolShell } from '@degenfeed/ui/protocol-shell';
import Link from 'next/link';
import { useCallback, useState } from 'react';

const MOB_META = PROTOCOL_META.mobilizon!;
const MOB_COLOR = MOB_META.color;

// ─── Types & Data ───────────────────────────────────────────────────────

interface EventEntry {
  name: string;
  date: string;
  location: string;
  url: string;
  attendees: number;
  category: string;
  description: string;
  virtual: boolean;
  imageUrl: string;
}

const FEATURED_EVENTS: EventEntry[] = [
  {
    name: 'DegenFeed Community Call',
    date: '2026-08-15',
    location: 'Online / Discord',
    url: 'https://mobilizon.degenfeed.xyz/events/1',
    attendees: 340,
    category: 'Community',
    description: 'Monthly community call — roadmap updates, Q&A, and feature discussion.',
    virtual: true,
    imageUrl: '',
  },
  {
    name: 'Web3 Social Summit',
    date: '2026-09-01',
    location: 'Berlin, Germany',
    url: 'https://mobilizon.fr/events/4512',
    attendees: 1200,
    category: 'Conference',
    description: 'The annual gathering of decentralized social network builders.',
    virtual: false,
    imageUrl: '',
  },
  {
    name: 'Nostr Hackathon',
    date: '2026-08-20',
    location: 'Online',
    url: 'https://mobilizon.fr/events/4513',
    attendees: 560,
    category: 'Hackathon',
    description: 'Build on Nostr protocols — relays, clients, and tools.',
    virtual: true,
    imageUrl: '',
  },
  {
    name: 'Farcaster Frames Workshop',
    date: '2026-08-10',
    location: 'Online',
    url: 'https://mobilizon.fr/events/4514',
    attendees: 280,
    category: 'Workshop',
    description: 'Learn to build interactive Farcaster Frames step by step.',
    virtual: true,
    imageUrl: '',
  },
  {
    name: 'Fediverse Meetup',
    date: '2026-09-15',
    location: 'Amsterdam, Netherlands',
    url: 'https://mobilizon.fr/events/4515',
    attendees: 420,
    category: 'Meetup',
    description: 'Fediverse enthusiasts gathering — Mastodon, Lemmy, PeerTube, and more.',
    virtual: false,
    imageUrl: '',
  },
  {
    name: 'On-Chain Identity Summit',
    date: '2026-10-05',
    location: 'Lisbon, Portugal',
    url: 'https://mobilizon.fr/events/4516',
    attendees: 800,
    category: 'Conference',
    description: 'Decentralized identity, verifiable credentials, and on-chain reputation.',
    virtual: false,
    imageUrl: '',
  },
  {
    name: 'Decentralized Media Panel',
    date: '2026-08-25',
    location: 'Online',
    url: 'https://mobilizon.fr/events/4517',
    attendees: 190,
    category: 'Panel',
    description:
      'Discussion on decentralized publishing, content monetization, and censorship resistance.',
    virtual: true,
    imageUrl: '',
  },
  {
    name: 'Open Source Social Coding',
    date: '2026-09-10',
    location: 'Online',
    url: 'https://mobilizon.fr/events/4518',
    attendees: 150,
    category: 'Hackathon',
    description: 'Collaborative coding session for open source social media projects.',
    virtual: true,
    imageUrl: '',
  },
  {
    name: 'Crypto Economics Reading Group',
    date: '2026-08-28',
    location: 'Online',
    url: 'https://mobilizon.fr/events/4519',
    attendees: 85,
    category: 'Community',
    description: 'Monthly reading group discussing token economics and mechanism design.',
    virtual: true,
    imageUrl: '',
  },
];

const CATEGORIES = Array.from(new Set(FEATURED_EVENTS.map((e) => e.category)));

// ─── Page ───────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [showVirtual, setShowVirtual] = useState(false);

  const filtered = FEATURED_EVENTS.filter((event) => {
    if (activeCategory && event.category !== activeCategory) return false;
    if (showVirtual && !event.virtual) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        event.name.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBrowse = useCallback((event: EventEntry) => {
    setEmbedUrl(event.url);
  }, []);

  const handleBack = useCallback(() => {
    setEmbedUrl(null);
  }, []);

  // ─── Embedded view ────────────────────────────────────────────────

  if (embedUrl) {
    const event = FEATURED_EVENTS.find((e) => e.url === embedUrl)!;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Events
        </button>

        <ProtocolShell
          protocol="mobilizon"
          protocolLabel={event.name}
          color={MOB_COLOR}
          logo={MOB_META.logo}
          embedUrl={event.url}
          title={event.name}
          description={event.description}
          headerStats={[
            { label: 'Date', value: event.date },
            {
              label: 'Attendees',
              value: event.attendees.toLocaleString(),
              trend: event.attendees > 300 ? 'up' : 'neutral',
            },
            {
              label: 'Location',
              value: event.virtual ? '🌐 Virtual' : (event.location.split(',')[0] ?? ''),
            },
          ]}
          frameAspectRatio={16 / 9}
          sandboxed={true}
          noSidebar={true}
          breadcrumbs={[{ label: 'Events', href: '/events' }, { label: event.name }]}
          featureFlags={{
            Federated: true,
            RSVP: true,
            Calendar: true,
          }}
        />
      </div>
    );
  }

  // ─── Directory view ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Link href="/feed" className="transition-colors hover:text-[var(--color-fg)]">
          Feed
        </Link>
        <span className="opacity-40">/</span>
        <span style={{ color: 'var(--color-fg-secondary)' }}>Events</span>
      </nav>

      {/* Hero */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${MOB_COLOR}33`,
          background: `linear-gradient(135deg, ${MOB_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: MOB_COLOR }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${MOB_COLOR}18`,
              boxShadow: `0 0 24px ${MOB_COLOR}15`,
            }}
          >
            {MOB_META.logo}
          </span>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Events</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              Discover events from the fediverse via Mobilizon.
            </p>
            <span
              className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase"
              style={{
                backgroundColor: `${MOB_COLOR}15`,
                color: MOB_COLOR,
              }}
            >
              📅 Powered by Mobilizon
            </span>
          </div>
        </div>
      </header>

      {/* Search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-[var(--color-card)] py-2.5 px-4 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
            style={
              {
                borderColor: 'var(--color-glass-border)',
                '--tw-ring-color': MOB_COLOR,
              } as React.CSSProperties
            }
            aria-label="Search events"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowVirtual(!showVirtual)}
          className="rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors"
          style={{
            borderColor: showVirtual ? MOB_COLOR : 'var(--color-glass-border)',
            backgroundColor: showVirtual ? `${MOB_COLOR}12` : 'transparent',
            color: showVirtual ? MOB_COLOR : 'var(--color-muted)',
          }}
          aria-pressed={showVirtual}
        >
          🌐 Virtual Only
        </button>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
          style={{
            borderColor: activeCategory === null ? MOB_COLOR : 'var(--color-glass-border)',
            backgroundColor: activeCategory === null ? `${MOB_COLOR}15` : 'transparent',
            color: activeCategory === null ? MOB_COLOR : 'var(--color-muted)',
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
              borderColor: activeCategory === cat ? MOB_COLOR : 'var(--color-glass-border)',
              backgroundColor: activeCategory === cat ? `${MOB_COLOR}15` : 'transparent',
              color: activeCategory === cat ? MOB_COLOR : 'var(--color-muted)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Event grid */}
      <section>
        <h2
          className="mb-4 font-heading text-lg font-bold tracking-tight"
          style={{ color: 'var(--color-fg)' }}
        >
          {activeCategory || (showVirtual ? 'Virtual Events' : 'All Events')}
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
            <p className="text-sm text-[var(--color-muted)]">No events match your filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <article
                key={event.url}
                className="group relative overflow-hidden rounded-xl border p-5 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5"
                style={{
                  borderColor: `${MOB_COLOR}22`,
                  backgroundColor: 'var(--color-card)',
                }}
              >
                <div
                  className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ boxShadow: `0 0 30px ${MOB_COLOR}10` }}
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-mono"
                    style={{
                      backgroundColor: `${MOB_COLOR}10`,
                      color: MOB_COLOR,
                    }}
                  >
                    {event.category}
                  </span>
                  {event.virtual && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-mono"
                      style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}
                    >
                      🌐 Virtual
                    </span>
                  )}
                </div>

                <h3
                  className="mt-3 font-heading text-base font-bold"
                  style={{ color: 'var(--color-fg)' }}
                >
                  {event.name}
                </h3>
                <p
                  className="mt-1 text-xs line-clamp-2"
                  style={{ color: 'var(--color-fg-secondary)' }}
                >
                  {event.description}
                </p>

                <div className="mt-4 space-y-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                  <div className="flex items-center gap-1.5">
                    <span>📅</span>
                    <span className="font-mono">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>📍</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>👥</span>
                    <span className="font-mono" style={{ color: MOB_COLOR }}>
                      {event.attendees.toLocaleString()} attending
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleBrowse(event)}
                  className="mt-4 w-full rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: MOB_COLOR, color: '#fff' }}
                >
                  View on Mobilizon
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer
        className="mt-12 border-t py-8 text-center"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <p className="text-xs text-[var(--color-muted)]">
          Event data from Mobilizon, the federated event platform. DegenFeed embeds it in our shell.
        </p>
      </footer>
    </div>
  );
}
