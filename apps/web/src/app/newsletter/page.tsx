'use client';

import { getProtocolColor } from '@degenfeed/ui';
import { useCallback, useMemo, useState } from 'react';
import { QuickTipButton } from '../../components/QuickTipButton';
import { PaywallBadge } from './components';
import {
  ALL_NICHES,
  ALL_PROTOCOLS,
  NEWSLETTER_CATEGORIES,
  NEWSLETTER_TOPICS,
  NEWSLETTERS_BY_TOPIC,
  TOP_NEWSLETTERS_THIS_WEEK,
} from './data';
import { computeNewTodayStats, formatTime, getCategoryStats, protocolEmoji } from './helpers';
import type { DigestItem, DigestMeta } from './types';

export default function NewsletterPage() {
  const [email, setEmail] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [digest, setDigest] = useState<DigestItem[]>([]);
  const [digestMeta, setDigestMeta] = useState<DigestMeta | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [showAllNewsletters, setShowAllNewsletters] = useState(false);

  const newTodayStats = useMemo(() => computeNewTodayStats([], NEWSLETTERS_BY_TOPIC), []);
  const categoryStats = useMemo(
    () => getCategoryStats(NEWSLETTER_CATEGORIES, NEWSLETTERS_BY_TOPIC),
    [],
  );

  const toggleNiche = (id: string) => {
    setSelectedNiches((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  };
  const toggleProtocol = (id: string) => {
    setSelectedProtocols((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSubscribe = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setStatus('error');
        setStatusMsg('Please enter a valid email address.');
        return;
      }
      setStatus('subscribing');
      try {
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            niches: selectedNiches,
            protocols: selectedProtocols.length > 0 ? selectedProtocols : undefined,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Subscription failed');
        setStatus('subscribed');
        setStatusMsg('You are subscribed! Check your inbox for the daily digest.');
      } catch (err) {
        setStatus('error');
        setStatusMsg(err instanceof Error ? err.message : 'Subscription failed');
      }
    },
    [email, selectedNiches, selectedProtocols],
  );

  const loadDigest = useCallback(async () => {
    setDigestLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedNiches.length > 0) params.set('niches', selectedNiches.join(','));
      if (selectedProtocols.length > 0) params.set('protocols', selectedProtocols.join(','));
      const res = await fetch(`/api/newsletter/digest?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as { data?: DigestItem[]; meta?: DigestMeta };
      setDigest(data.data ?? []);
      setDigestMeta(data.meta ?? null);
    } catch {
      setDigest([]);
    } finally {
      setDigestLoading(false);
    }
  }, [selectedNiches, selectedProtocols]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500 to-emerald-600 text-2xl shadow-[0_0_24px_rgba(34,197,94,0.3)]">
          ◆
        </div>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-[var(--color-fg)]">
          DegenFeed Daily
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          The best of web3, AI, and tech — aggregated from Nostr, Farcaster, Lens, Bluesky,
          Mastodon, 353 RSS sources, and 85+ curated newsletters.
        </p>
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          <span className="rounded-full bg-degen-500/10 px-3 py-1 text-[10px] font-medium text-degen-400">
            85+ Newsletters
          </span>
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-medium text-blue-400">
            {newTodayStats.totalDaily} New Daily
          </span>
          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-medium text-purple-400">
            9 Categories
          </span>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-400">
            353 RSS Sources
          </span>
        </div>
      </div>

      {/* Newsletter Discovery */}
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Newsletter Discovery</h2>
        </div>

        <div className="mb-4 rounded-xl border border-degen-500/10 bg-gradient-to-r from-degen-500/5 to-emerald-500/5 p-3">
          <p className="mb-2 text-xs font-semibold text-degen-400">
            📬 New today — {newTodayStats.totalDaily} newsletters published
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(newTodayStats.categoryCounts).map(([catId, count]) => {
              const cat = NEWSLETTER_CATEGORIES.find((c) => c.id === catId);
              if (!cat || count === 0) return null;
              return (
                <span
                  key={catId}
                  className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                >
                  {cat.icon} {cat.label}{' '}
                  <span className="font-medium text-[var(--color-muted)]">{count}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Top Newsletters This Week
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOP_NEWSLETTERS_THIS_WEEK.slice(0, 6).map((nl) => {
              const cat = NEWSLETTER_CATEGORIES.find((c) => c.id === nl.category);
              return (
                <div key={nl.name} className="card flex items-start gap-2.5 p-2.5">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px]"
                    style={{ backgroundColor: cat?.color ? `${cat.color}20` : '#1f2937' }}
                  >
                    {cat?.icon ?? '📰'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--color-fg)]">{nl.name}</p>
                    <p className="truncate text-[10px] text-[var(--color-muted)]">{nl.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Browse by Category
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {categoryStats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTopic(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${activeTopic === cat.id ? 'border-degen-500 bg-degen-500/20 text-degen-400' : 'card-hover text-[var(--color-muted)]'}`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="text-[var(--color-muted)]">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Subscribe */}
        <div className="lg:col-span-3">
          <div className="card border-degen-500/10 bg-gradient-to-br from-gray-900/90 to-gray-950/90 p-6">
            <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Subscribe</h2>
            <p className="mb-5 text-sm text-[var(--color-muted)]">
              Pick your topics and protocols, then enter your email.
            </p>
            <form onSubmit={handleSubscribe}>
              <div className="mb-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Topics
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_NICHES.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNiche(n.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${selectedNiches.includes(n.id) ? 'border-degen-500 bg-degen-500/20 text-degen-400' : 'card-hover text-[var(--color-muted)]'}`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Sources
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_PROTOCOLS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProtocol(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${selectedProtocols.includes(p.id) ? 'border-degen-500 bg-degen-500/20 text-degen-400' : 'card-hover text-[var(--color-muted)]'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                  disabled={status === 'subscribed'}
                />
              </div>
              <button
                type="submit"
                disabled={status === 'subscribing' || status === 'subscribed'}
                className="btn-primary w-full"
              >
                {status === 'subscribing'
                  ? 'Subscribing...'
                  : status === 'subscribed'
                    ? 'Subscribed ✓'
                    : 'Subscribe'}
              </button>
              {status === 'error' && <p className="mt-2 text-xs text-red-400">{statusMsg}</p>}
              {status === 'subscribed' && (
                <p className="mt-2 text-xs text-degen-400">{statusMsg}</p>
              )}
            </form>
          </div>

          {/* Digest Preview */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Preview Digest</h2>
              <button
                type="button"
                onClick={loadDigest}
                disabled={digestLoading}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
              >
                {digestLoading ? 'Loading...' : 'Load Preview'}
              </button>
            </div>
            {digest.length === 0 && !digestLoading && (
              <div className="card py-8 text-center">
                <p className="text-xs text-[var(--color-muted)]">
                  Select topics/sources above and click &ldquo;Load Preview&rdquo; to see what your
                  daily digest will look like.
                </p>
              </div>
            )}
            {digestLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card animate-pulse p-4">
                    <div className="mb-2 h-3 w-32 rounded bg-[var(--color-muted)]" />
                    <div className="mb-2 h-4 w-full rounded bg-[var(--color-muted)]" />
                    <div className="h-3 w-3/4 rounded bg-[var(--color-muted)]" />
                  </div>
                ))}
              </div>
            )}
            {digest.length > 0 && !digestLoading && (
              <div className="space-y-3">
                {digestMeta?.trending && digestMeta.trending.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {digestMeta.trending.slice(0, 6).map((t) => (
                      <span
                        key={t.topic}
                        className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                      >
                        #{t.topic} <span className="text-[var(--color-muted)]">{t.count}</span>
                      </span>
                    ))}
                  </div>
                )}
                {digest.slice(0, 5).map((item) => (
                  <div key={item.id} className="card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: getProtocolColor(item.protocol) }}
                      >
                        {protocolEmoji(item.protocol)} {item.protocol}
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">{item.author}</span>
                      <span className="ml-auto text-[10px] text-[var(--color-muted)]">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-snug text-[var(--color-muted)] line-clamp-2">
                      {item.text}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener"
                        className="mt-1 inline-block text-[11px] text-degen-500 hover:underline"
                      >
                        Read more →
                      </a>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <QuickTipButton
                        recipientProtocol={item.protocol}
                        recipientAuthorId={item.author}
                        recipientDisplayName={item.author}
                        publicationId={item.id}
                        subtle
                      />
                    </div>
                  </div>
                ))}
                {digestMeta && (
                  <p className="text-center text-[10px] text-[var(--color-muted)]">
                    {digestMeta.total} stories · {new Date(digestMeta.fetchedAt).toUTCString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                What you get
              </h3>
              <ul className="space-y-2 text-xs text-[var(--color-muted)]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Top 15 stories from all protocols, ranked by quality</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Sentiment analysis and trending topics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>
                    Multi-protocol aggregation (Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Curated RSS feeds (353 sources across 11 categories)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Curated newsletter content from 85+ top publications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>HTML and plaintext versions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>One-click unsubscribe</span>
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Browse by Topic
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {NEWSLETTER_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTopic(t.id)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${activeTopic === t.id ? 'border-degen-500 bg-degen-500/20 text-degen-400' : 'card-hover text-[var(--color-muted)]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Newsletter Sources
                {activeTopic !== 'all' && (
                  <span className="ml-1 text-degen-400">
                    {' '}
                    — {NEWSLETTERS_BY_TOPIC[activeTopic]?.length ?? 0}
                  </span>
                )}
              </h3>
              <div className="space-y-3 text-xs">
                {(activeTopic === 'all'
                  ? Object.entries(NEWSLETTERS_BY_TOPIC)
                  : ([[activeTopic, NEWSLETTERS_BY_TOPIC[activeTopic] ?? []]] as [
                      string,
                      import('./types').NewsletterEntry[],
                    ][])
                ).map(([topic, newsletters]) => (
                  <div key={topic}>
                    <p className="mb-1 font-medium text-[var(--color-muted)]">
                      {NEWSLETTER_TOPICS.find((t) => t.id === topic)?.label ?? topic}
                    </p>
                    <ul className="space-y-1 text-[var(--color-muted)]">
                      {newsletters
                        .slice(0, activeTopic === 'all' && !showAllNewsletters ? 5 : 99)
                        .map((nl) => (
                          <li key={nl.name}>
                            ✦ {nl.name}
                            <PaywallBadge isPaid={nl.isPaid} premium={nl.premium} />
                            <span className="text-[var(--color-muted)]"> ({nl.schedule})</span>
                          </li>
                        ))}
                      {activeTopic === 'all' && newsletters.length > 5 && !showAllNewsletters && (
                        <li>
                          <button
                            type="button"
                            onClick={() => setShowAllNewsletters(true)}
                            className="text-[var(--color-muted)] italic hover:text-degen-400"
                          >
                            + {newsletters.length - 5} more...
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
                {activeTopic === 'all' && showAllNewsletters && (
                  <button
                    type="button"
                    onClick={() => setShowAllNewsletters(false)}
                    className="text-[10px] text-degen-500 hover:underline"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Trending This Week
              </h3>
              <div className="space-y-2">
                {TOP_NEWSLETTERS_THIS_WEEK.slice(0, 5).map((nl, i) => (
                  <div key={nl.name} className="flex items-center gap-2">
                    <span className="w-4 text-[10px] font-bold text-[var(--color-muted)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-[var(--color-fg)]">
                        {nl.name}
                      </p>
                    </div>
                    <span
                      className="rounded px-1.5 py-0.5 text-[8px] font-medium uppercase"
                      style={{
                        backgroundColor: `${NEWSLETTER_CATEGORIES.find((c) => c.id === nl.category)?.color}15`,
                        color:
                          NEWSLETTER_CATEGORIES.find((c) => c.id === nl.category)?.color ??
                          '#9ca3af',
                      }}
                    >
                      {nl.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Content Access
              </h3>
              <div className="space-y-1.5 text-[10px] text-[var(--color-muted)]">
                <p>
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-400">
                    🔒 Paid
                  </span>{' '}
                  — Full content requires subscription. Preview shown in digest.
                </p>
                <p>
                  <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/10 px-1 py-0.5 text-[9px] font-medium text-purple-400">
                    ◈ Premium
                  </span>{' '}
                  — Some articles behind paywall. Free tier included in digest.
                </p>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                RSS Feeds
              </h3>
              <ul className="space-y-2 text-xs text-[var(--color-muted)]">
                {[
                  { label: 'Full Feed (RSS 2.0)', url: '/api/feed/rss.xml' },
                  { label: 'Full Feed (Atom 1.0)', url: '/api/feed/rss.xml?format=atom' },
                  { label: 'Bitcoin Feed', url: '/api/feed/rss.xml?category=bitcoin' },
                  { label: 'DeFi Feed', url: '/api/feed/rss.xml?category=defi' },
                  { label: 'AI Feed', url: '/api/feed/rss.xml?category=ai' },
                  { label: 'Tech Feed', url: '/api/feed/rss.xml?category=tech' },
                ].map((f) => (
                  <li key={f.label}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener"
                      className="text-degen-500 hover:underline"
                    >
                      {f.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                API
              </h3>
              <ul className="space-y-1.5 text-xs text-[var(--color-muted)]">
                {[
                  'GET /api/newsletter/digest',
                  'GET /api/newsletter/digest?format=html',
                  'GET /api/newsletter/digest?format=text',
                ].map((ep) => (
                  <li key={ep}>
                    <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {ep}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
