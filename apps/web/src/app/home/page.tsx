'use client';

import { useAuth } from '../../components/AuthProvider';
import { SECTIONS } from './sections';

function getProtocolColor(p: string): string {
  const colors: Record<string, string> = {
    nostr: '#8e30eb',
    farcaster: '#8a63d2',
    lens: '#abfe2c',
    bluesky: '#1185fe',
    threads: '#888',
    mastodon: '#6364ff',
    rss: '#ffa500',
  };
  return colors[p] ?? '#666';
}

const CATEGORIES = SECTIONS.filter((s) =>
  [
    'crypto',
    'bitcoin',
    'ethereum',
    'solana',
    'defi',
    'nft',
    'ai',
    'regulation',
    'security',
    'macro',
    'news',
  ].includes(s.id),
);

const PLATFORMS = SECTIONS.filter((s) =>
  ['nostr', 'farcaster', 'lens', 'bluesky', 'threads', 'mastodon', 'articles'].includes(s.id),
);

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { signedInProtocols, ready, openSignIn, openCompose } = useAuth();
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const count = Object.keys(signedInProtocols).length;

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 h-1 w-48 animate-pulse rounded-full bg-gray-800" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="card sticky top-24 border-degen-500/20 bg-degen-500/5">
            <h2 className="mb-3 text-sm font-semibold text-degen-400">Feeds</h2>
            <nav className="space-y-1">
              {CATEGORIES.map((s) => (
                <a
                  key={s.id}
                  href={`/home/${s.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </nav>
            <h2 className="mb-3 mt-6 text-sm font-semibold text-degen-400">Platforms</h2>
            <nav className="space-y-1">
              {PLATFORMS.map((s) => (
                <a
                  key={s.id}
                  href={`/home/${s.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="lg:col-span-6">
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              The home of web3 social
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {hasSignedIn
                ? `Connected: ${count} network${count > 1 ? 's' : ''}`
                : 'Every network. One window. Zero sign-ups required.'}
            </p>
          </header>

          <div className="card mb-6 border-degen-500/30 bg-gradient-to-r from-degen-500/10 via-purple-500/10 to-fuchsia-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-degen-400">
                  Live
                </div>
                <h2 className="text-lg font-bold text-white">DegenFeed News</h2>
                <p className="text-sm text-gray-500">
                  Curated crypto, AI, and tech news from 45+ sources.
                </p>
              </div>
              <a href="/news" className="btn-primary text-center text-sm">
                Open News →
              </a>
            </div>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {CATEGORIES.map((s) => (
              <a
                key={s.id}
                href={`/home/${s.id}`}
                className="whitespace-nowrap rounded-full border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 hover:border-degen-500/50 hover:text-white"
              >
                {s.icon} {s.label}
              </a>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`/home/${section.id}`}
                className="card-hover group cursor-pointer"
                style={{ borderColor: `${section.color}33` }}
              >
                <div className="mb-2 text-2xl" style={{ color: section.color }}>
                  {section.icon}
                </div>
                <div className="text-sm font-semibold text-white group-hover:text-degen-400">
                  {section.label}
                </div>
                <div className="mt-1 text-xs text-gray-500 line-clamp-2">{section.description}</div>
              </a>
            ))}
          </div>

          <div className="card mt-6 border-degen-500/20 bg-degen-500/5">
            <h3 className="mb-2 text-sm font-semibold text-degen-400">
              {hasSignedIn ? 'Ready to post?' : 'No account? No problem.'}
            </h3>
            <p className="text-sm text-gray-400">
              {hasSignedIn
                ? 'Click Compose to write a post. Select which networks to publish to.'
                : 'All content is visible without signing in. Connect an account to like, reply, and repost. Add multiple to cross-post.'}
            </p>
            {!hasSignedIn ? (
              <button type="button" className="btn-primary mt-3 text-sm" onClick={openSignIn}>
                Sign in with any protocol
              </button>
            ) : (
              <button type="button" className="btn-primary mt-3 text-sm" onClick={openCompose}>
                Compose a post
              </button>
            )}
          </div>
        </main>

        <aside className="hidden lg:col-span-3 lg:block">
          <div className="card sticky top-24 border-purple-500/20 bg-purple-500/5">
            <h2 className="mb-3 text-sm font-semibold text-purple-400">Trending</h2>
            <p className="text-xs text-gray-500">
              Hot tickers and topics update as you browse feeds.
            </p>
            <a href="/home/trending" className="btn-primary mt-3 block text-center text-xs">
              See Trending
            </a>
          </div>

          <div className="card mt-4 border-yellow-500/20 bg-yellow-500/5">
            <h2 className="mb-2 text-sm font-semibold text-yellow-400">Premium</h2>
            <p className="text-xs text-gray-400">
              Unlock cross-posting, algorithm controls, analytics, and creator monetization.
            </p>
            <a
              href="/premium"
              className="mt-3 block text-center text-xs text-yellow-400 hover:underline"
            >
              Compare plans →
            </a>
          </div>

          {hasSignedIn && (
            <div className="card mt-4 border-degen-500/20 bg-degen-500/5">
              <h2 className="mb-2 text-sm font-semibold text-degen-400">Signed in</h2>
              <div className="flex flex-wrap gap-2">
                {Object.keys(signedInProtocols).map((p) => (
                  <span
                    key={p}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${getProtocolColor(p)}22`,
                      color: getProtocolColor(p),
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
