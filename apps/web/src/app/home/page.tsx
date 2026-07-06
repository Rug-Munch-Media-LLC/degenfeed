'use client';

import { useAuth } from '../../components/AuthProvider';
import { SECTIONS } from './sections';

export const dynamic = 'force-dynamic';

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

export default function HomePage() {
  const { signedInProtocols, ready, openSignIn, openCompose } = useAuth();
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const count = Object.keys(signedInProtocols).length;

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-4 h-1 w-48 animate-pulse rounded-full bg-gray-800" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">DegenFeed</h1>
        <p className="mt-1 text-sm text-gray-500">
          {hasSignedIn
            ? `Connected: ${count} network${count > 1 ? 's' : ''}`
            : 'Every network. One window. Zero sign-ups required.'}
        </p>
      </header>

      {hasSignedIn && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-degen-400">Signed in:</span>
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
      )}

      <a
        href="/news"
        className="card-hover mb-6 block border-degen-500/30 bg-gradient-to-r from-degen-500/10 via-purple-500/10 to-fuchsia-500/10"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-degen-400">
              New
            </div>
            <h2 className="text-lg font-bold text-white">DegenFeed News</h2>
            <p className="text-sm text-gray-500">
              Curated crypto, AI, and tech news from 35+ sources.
            </p>
          </div>
          <span className="text-2xl text-degen-400">→</span>
        </div>
      </a>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
          Choose a feed
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>

      <div className="card border-degen-500/20 bg-degen-500/5">
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
    </div>
  );
}
