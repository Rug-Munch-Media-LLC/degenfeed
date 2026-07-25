'use client';

/**
 * @degenfeed/web — /books
 *
 * BookWyrm Embedded — Federated Book Cataloging
 *
 * Discover, track, and discuss books through the fediverse.
 * Browse BookWyrm instances and embed book catalogs inside
 * DegenFeed's cyberpunk shell.
 */

import { ProtocolShell, PROTOCOL_META } from '@degenfeed/ui/protocol-shell';
import Link from 'next/link';
import { useCallback, useState } from 'react';

const BW_META = PROTOCOL_META.bookwyrm;
const BW_COLOR = BW_META.color;

// ─── Types & Data ───────────────────────────────────────────────────────

interface BookEntry {
  title: string;
  author: string;
  coverUrl: string;
  url: string;
  rating: number;
  reviews: number;
  genre: string;
  description: string;
}

const FEATURED_BOOKS: BookEntry[] = [
  {
    title: 'The Network State',
    author: 'Balaji Srinivasan',
    coverUrl: 'https://covers.openlibrary.org/b/id/12817207-L.jpg',
    url: 'https://bookwyrm.social/book/1234',
    rating: 4.5,
    reviews: 340,
    genre: 'Technology',
    description: 'How to start a new country on the internet — a blueprint for network states.',
  },
  {
    title: 'Read Write Own',
    author: 'Chris Dixon',
    coverUrl: 'https://covers.openlibrary.org/b/id/14217117-L.jpg',
    url: 'https://bookwyrm.social/book/5678',
    rating: 4.3,
    reviews: 210,
    genre: 'Technology',
    description: 'Building the next era of the internet — blockchain networks and web3.',
  },
  {
    title: 'Bitcoin Standart',
    author: 'Saifedean Ammous',
    coverUrl: 'https://covers.openlibrary.org/b/id/8765432-L.jpg',
    url: 'https://bookwyrm.social/book/9012',
    rating: 4.6,
    reviews: 1200,
    genre: 'Economics',
    description: 'The economic case for Bitcoin and decentralized money.',
  },
  {
    title: 'The Sovereign Individual',
    author: 'James Dale Davidson',
    coverUrl: 'https://covers.openlibrary.org/b/id/1009123-L.jpg',
    url: 'https://bookwyrm.social/book/3456',
    rating: 4.4,
    reviews: 890,
    genre: 'Economics',
    description: 'Mastering the transition to the information age.',
  },
  {
    title: 'Snow Crash',
    author: 'Neal Stephenson',
    coverUrl: 'https://covers.openlibrary.org/b/id/8224790-L.jpg',
    url: 'https://bookwyrm.social/book/7890',
    rating: 4.2,
    reviews: 3400,
    genre: 'Fiction',
    description: 'The cyberpunk classic that inspired the metaverse.',
  },
  {
    title: 'Neuromancer',
    author: 'William Gibson',
    coverUrl: 'https://covers.openlibrary.org/b/id/6808568-L.jpg',
    url: 'https://bookwyrm.social/book/12345',
    rating: 4.3,
    reviews: 4500,
    genre: 'Fiction',
    description: 'The book that defined the cyberpunk genre.',
  },
  {
    title: 'The Internet of Money',
    author: 'Andreas M. Antonopoulos',
    coverUrl: 'https://covers.openlibrary.org/b/id/9302123-L.jpg',
    url: 'https://bookwyrm.social/book/67890',
    rating: 4.5,
    reviews: 670,
    genre: 'Technology',
    description: 'Understanding Bitcoin and cryptocurrency fundamentals.',
  },
  {
    title: 'Radical Markets',
    author: 'Eric A. Posner & E. Glen Weyl',
    coverUrl: 'https://covers.openlibrary.org/b/id/10123456-L.jpg',
    url: 'https://bookwyrm.social/book/11111',
    rating: 4.0,
    reviews: 230,
    genre: 'Economics',
    description: 'Uprooting capitalism and democracy for a just society.',
  },
  {
    title: 'The Cult of the Dead Cow',
    author: 'Joseph Menn',
    coverUrl: 'https://covers.openlibrary.org/b/id/11098765-L.jpg',
    url: 'https://bookwyrm.social/book/22222',
    rating: 4.1,
    reviews: 180,
    genre: 'Technology',
    description: 'The story of the legendary hacker group and cybersecurity.',
  },
];

const GENRES = Array.from(new Set(FEATURED_BOOKS.map((b) => b.genre)));

// ─── Page ───────────────────────────────────────────────────────────────

export default function BooksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const filtered = FEATURED_BOOKS.filter((book) => {
    if (activeGenre && book.genre !== activeGenre) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBrowse = useCallback((book: BookEntry) => {
    setEmbedUrl(book.url);
  }, []);

  const handleBack = useCallback(() => {
    setEmbedUrl(null);
  }, []);

  // ─── Embedded view ────────────────────────────────────────────────

  if (embedUrl) {
    const book = FEATURED_BOOKS.find((b) => b.url === embedUrl)!;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Books
        </button>

        <ProtocolShell
          protocol="bookwyrm"
          protocolLabel={book.title}
          color={BW_COLOR}
          logo={BW_META.logo}
          embedUrl={book.url}
          title={book.title}
          description={`by ${book.author} · ${book.genre}`}
          headerStats={[
            { label: 'Rating', value: `${book.rating}/5` },
            { label: 'Reviews', value: book.reviews.toLocaleString(), trend: 'up' },
          ]}
          frameAspectRatio={16 / 9}
          sandboxed={true}
          noSidebar={true}
          breadcrumbs={[
            { label: 'Books', href: '/books' },
            { label: book.title },
          ]}
          featureFlags={{
            'Federated': true,
            'Reviews': true,
            'Track': true,
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
        <span style={{ color: 'var(--color-fg-secondary)' }}>Books</span>
      </nav>

      {/* Hero */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${BW_COLOR}33`,
          background: `linear-gradient(135deg, ${BW_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: BW_COLOR }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${BW_COLOR}18`,
              boxShadow: `0 0 24px ${BW_COLOR}15`,
            }}
          >
            {BW_META.logo}
          </span>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Books</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              Discover and track books from the fediverse via BookWyrm.
            </p>
            <span
              className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wider uppercase"
              style={{
                backgroundColor: `${BW_COLOR}15`,
                color: BW_COLOR,
              }}
            >
              📚 Powered by BookWyrm
            </span>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="mb-6">
        <input
          type="search"
          placeholder="Search books by title or author..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border bg-[var(--color-card)] py-2.5 px-4 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--color-glass-border)',
            '--tw-ring-color': BW_COLOR,
          } as React.CSSProperties}
          aria-label="Search books"
        />
      </div>

      {/* Genre tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveGenre(null)}
          className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
          style={{
            borderColor: activeGenre === null ? BW_COLOR : 'var(--color-glass-border)',
            backgroundColor: activeGenre === null ? `${BW_COLOR}15` : 'transparent',
            color: activeGenre === null ? BW_COLOR : 'var(--color-muted)',
          }}
        >
          All
        </button>
        {GENRES.map((genre) => (
          <button
            key={genre}
            type="button"
            onClick={() => setActiveGenre(genre)}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
            style={{
              borderColor: activeGenre === genre ? BW_COLOR : 'var(--color-glass-border)',
              backgroundColor: activeGenre === genre ? `${BW_COLOR}15` : 'transparent',
              color: activeGenre === genre ? BW_COLOR : 'var(--color-muted)',
            }}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Book grid */}
      <section>
        <h2 className="mb-4 font-heading text-lg font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
          {activeGenre || 'All Books'}
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>
            ({filtered.length})
          </span>
        </h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book) => (
            <article
              key={book.title}
              className="group relative overflow-hidden rounded-xl border p-4 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5"
              style={{
                borderColor: `${BW_COLOR}22`,
                backgroundColor: 'var(--color-card)',
              }}
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
                style={{ boxShadow: `0 0 30px ${BW_COLOR}10` }}
                aria-hidden="true"
              />

              <div className="flex gap-4">
                {/* Cover */}
                <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-muted-bg)]">
                  <img
                    src={book.coverUrl}
                    alt={`Cover of ${book.title}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
                    {book.title}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                    {book.author}
                  </p>

                  {/* Rating */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold" style={{ color: BW_COLOR }}>
                      ★ {book.rating}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                      ({book.reviews.toLocaleString()} reviews)
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs line-clamp-2" style={{ color: 'var(--color-fg-secondary)' }}>
                    {book.description}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-mono"
                      style={{
                        backgroundColor: `${BW_COLOR}10`,
                        color: BW_COLOR,
                      }}
                    >
                      {book.genre}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBrowse(book)}
                      className="rounded-lg px-3 py-1 text-[11px] font-semibold transition-all active:scale-[0.98]"
                      style={{
                        backgroundColor: BW_COLOR,
                        color: '#fff',
                      }}
                    >
                      View on BookWyrm
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t py-8 text-center" style={{ borderColor: 'var(--color-glass-border)' }}>
        <p className="text-xs text-[var(--color-muted)]">
          Book data from BookWyrm, the federated book catalog. DegenFeed embeds it in our shell.
        </p>
      </footer>
    </div>
  );
}
