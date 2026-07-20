'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { retryFetch } from '../../lib/retryFetch';

// === Types (local mirror since types package may not have digest types yet) ==

interface LocalDigestSection {
  type: string;
  title: string;
  items: LocalDigestItem[];
}

interface LocalDigestItem {
  id: string;
  protocol: string;
  protocolColor: string;
  protocolEmoji: string;
  author: { displayName: string; avatarUrl?: string };
  title: string;
  excerpt: string;
  url: string;
  image?: string;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number };
  readTime: number;
  score: number;
}

interface LocalDigestResponse {
  date: string;
  wallet: string | null;
  sections: LocalDigestSection[];
  meta: { totalPosts: number; totalSections: number; fetchedAt: number };
  error?: string;
}

// === Helpers ===========================================================

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function shareDigest() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'My DegenFeed Daily Digest', url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

// === Section Renderers ====================================================

function SectionCard({ section }: { section: LocalDigestSection }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">{section.title}</h2>
      <div className="space-y-3">
        {section.items.map((item) => (
          <DigestCard key={item.id} item={item} />
        ))}
      </div>
      {section.type === 'top-stories' && (
        <Link
          href="/feed"
          className="inline-block mt-3 text-sm text-degen-400 hover:text-degen-300 transition-colors"
        >
          Read more in Feed →
        </Link>
      )}
      {section.type === 'videos' && (
        <Link
          href="/videos"
          className="inline-block mt-3 text-sm text-degen-400 hover:text-degen-300 transition-colors"
        >
          Browse all videos →
        </Link>
      )}
      {section.type === 'trending' && (
        <Link
          href="/trending"
          className="inline-block mt-3 text-sm text-degen-400 hover:text-degen-300 transition-colors"
        >
          View all trending →
        </Link>
      )}
    </div>
  );
}

function DigestCard({ item }: { item: LocalDigestItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 hover:border-degen-400/40 transition-all hover:shadow-md hover:shadow-degen-500/5"
      rel="noopener"
    >
      <div className="flex items-start gap-4">
        {item.image && (
          <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-[var(--color-muted-bg)]">
            <img
              src={item.image}
              alt={item.title || 'Digest article image'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: item.protocolColor }}>
              {item.protocolEmoji} {item.protocol}
            </span>
            <span className="text-xs text-[var(--color-muted)]">·</span>
            <span className="text-xs text-[var(--color-muted)]">{item.author.displayName}</span>
            <span className="text-xs text-[var(--color-muted)]">·</span>
            <span className="text-xs text-[var(--color-muted)]">{timeAgo(item.createdAt)}</span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)] leading-snug mb-1 line-clamp-2">
            {item.title}
          </h3>
          <p className="text-xs text-[var(--color-muted)] line-clamp-2 mb-2">{item.excerpt}</p>
          <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span>📖 {item.readTime}m read</span>
            <span>❤️ {item.metrics.likes}</span>
            <span>🔄 {item.metrics.reposts}</span>
            {item.niches.length > 0 && (
              <span className="hidden md:inline-flex gap-1">
                {item.niches.slice(0, 3).map((n) => (
                  <span
                    key={n}
                    className="bg-[var(--color-muted-bg)] px-1.5 py-0.5 rounded text-[10px]"
                  >
                    #{n}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

// === Market Summary Card ==================================================

function MarketRow({ item }: { item: LocalDigestItem }) {
  const isUp = item.protocolColor === '#22c55e';
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{item.protocolEmoji}</span>
        <div>
          <span className="text-sm font-semibold text-[var(--color-fg)]">
            {item.author.displayName}
          </span>
          <span className="text-xs text-[var(--color-muted)] ml-2">{item.excerpt}</span>
        </div>
      </div>
      <span className={`text-sm font-mono font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
        {item.title}
      </span>
    </div>
  );
}

// === Trending Tags ========================================================

function TrendingTag({ item }: { item: LocalDigestItem }) {
  return (
    <Link
      href={item.url}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm hover:border-degen-400/40 transition-colors"
    >
      <span className="text-degen-400">🔥</span>
      <span className="text-[var(--color-fg)]">{item.title}</span>
      <span className="text-xs text-[var(--color-muted)]">({item.excerpt.split(' ')[0]})</span>
    </Link>
  );
}

// === Loading State ========================================================

function DigestLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-[var(--color-muted-bg)] rounded" />
        <div className="h-4 w-72 bg-[var(--color-muted-bg)] rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-32 bg-[var(--color-muted-bg)] rounded" />
            <div className="h-24 bg-[var(--color-muted-bg)] rounded-xl" />
            <div className="h-24 bg-[var(--color-muted-bg)] rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

// === Error State ==========================================================

function DigestError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-4">📭</div>
      <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-2">Could not load digest</h2>
      <p className="text-sm text-[var(--color-muted)] mb-6">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 bg-degen-500 text-black rounded-lg font-medium text-sm hover:bg-degen-400 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// === Empty State ==========================================================

function DigestEmpty() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-4">🌅</div>
      <h2 className="text-lg font-semibold text-[var(--color-fg)] mb-2">Not enough posts yet</h2>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        Check back later once more content is available across your networks.
      </p>
      <Link
        href="/feed"
        className="px-4 py-2 bg-degen-500 text-black rounded-lg font-medium text-sm hover:bg-degen-400 transition-colors inline-block"
      >
        Browse Feed
      </Link>
    </div>
  );
}

// === Main Digest Component ==============================================

export default function DigestPage() {
  const [digest, setDigest] = useState<LocalDigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await retryFetch('/api/digest/today', {
        fetchOptions: { credentials: 'include' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as LocalDigestResponse;
      setDigest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load digest');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  if (loading) return <DigestLoading />;
  if (error) return <DigestError message={error} onRetry={fetchDigest} />;
  if (!digest || digest.sections.length === 0) return <DigestEmpty />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">📋 Daily Digest</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/api/digest/yesterday?wallet=preview"
              className="text-xs text-degen-400 hover:text-degen-300 transition-colors"
            >
              Yesterday&apos;s Digest
            </Link>
            <button
              type="button"
              onClick={shareDigest}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-400/40 transition-colors"
            >
              📤 Share
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          {new Date(digest.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}
          {digest.meta.totalPosts} posts analyzed
          {digest.wallet && ' · Personalized for you'}
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1">
            📰 {digest.meta.totalSections} sections
          </span>
          <span>·</span>
          <button
            type="button"
            onClick={fetchDigest}
            className="text-degen-400 hover:text-degen-300 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Sections */}
      {digest.sections.map((section) => {
        if (section.type === 'market') {
          return (
            <div key={section.type} className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">{section.title}</h2>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <MarketRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        }

        if (section.type === 'trending') {
          return (
            <div key={section.type} className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">{section.title}</h2>
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <TrendingTag key={item.id} item={item} />
                ))}
              </div>
              <Link
                href="/trending"
                className="inline-block mt-3 text-sm text-degen-400 hover:text-degen-300 transition-colors"
              >
                View all trending →
              </Link>
            </div>
          );
        }

        return <SectionCard key={section.type} section={section} />;
      })}

      {/* Email newsletter signup */}
      <div className="mt-10 rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/5 to-transparent p-6 text-center">
        <div className="mb-3 text-2xl">📬</div>
        <h3 className="text-base font-bold text-[var(--color-fg)] mb-1">
          Get the DegenFeed Daily Digest
        </h3>
        <p className="text-xs text-[var(--color-muted)] mb-4 max-w-md mx-auto">
          Receive a curated daily email with the top crypto stories, trending topics, and community
          highlights — no spam, unsubscribe anytime.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            const email = formData.get('email') as string;
            if (!email) return;
            try {
              const res = await fetch('/api/digest/subscribe-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              });
              if (res.ok) {
                const btn = form.querySelector('button');
                if (btn) {
                  btn.textContent = 'Subscribed! ✓';
                  btn.disabled = true;
                }
                const input = form.querySelector('input');
                if (input) input.value = '';
              }
            } catch {
              /* ignore */
            }
          }}
          className="mx-auto flex max-w-sm gap-2"
        >
          <input
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            className="input flex-1 h-10 px-3 text-sm"
            aria-label="Email for daily digest"
          />
          <button
            type="submit"
            className="rounded-lg bg-degen-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-degen-400"
          >
            Subscribe
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[var(--color-border)] text-center">
        <p className="text-xs text-[var(--color-muted)] mb-3">
          Generated by DegenFeed · Content from Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS, and
          more
        </p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link href="/feed" className="text-degen-400 hover:text-degen-300">
            Open Feed
          </Link>
          <Link href="/settings" className="text-degen-400 hover:text-degen-300">
            Preferences
          </Link>
          <button
            type="button"
            onClick={() => {
              const emailSection = document.getElementById('digest-email-section');
              if (emailSection) emailSection.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-degen-400 hover:text-degen-300"
          >
            📧 Email Digest
          </button>
        </div>
      </div>
    </div>
  );
}
