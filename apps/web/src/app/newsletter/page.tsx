'use client';

import { getProtocolColor } from '@degenfeed/ui';
import { useCallback, useState } from 'react';

const ALL_NICHES = [
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' },
  { id: 'defi', label: 'DeFi' },
  { id: 'ai', label: 'AI' },
  { id: 'security', label: 'Security' },
  { id: 'regulation', label: 'Regulation' },
  { id: 'macro', label: 'Macro' },
  { id: 'nft', label: 'NFTs' },
  { id: 'layer2', label: 'Layer 2' },
  { id: 'memecoin', label: 'Memes' },
  { id: 'stablecoin', label: 'Stablecoins' },
  { id: 'etf', label: 'ETFs' },
  { id: 'onchain', label: 'On-Chain' },
];

const NEWSLETTER_TOPICS = [
  { id: 'all', label: 'All' },
  { id: 'research', label: 'Research' },
  { id: 'defi-alpha', label: 'DeFi Alpha' },
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'trading-markets', label: 'Trading/Markets' },
  { id: 'web3-builders', label: 'Web3/Builders' },
  { id: 'ai-crypto', label: 'AI x Crypto' },
  { id: 'tech-startup', label: 'Tech/Startup' },
];

const NEWSLETTERS_BY_TOPIC: Record<string, { name: string; schedule: string }[]> = {
  research: [
    { name: '0xResearch', schedule: 'daily' },
    { name: 'The Block Research', schedule: 'weekly' },
    { name: 'Reflexivity Research', schedule: 'weekly' },
    { name: 'Cane Island Digital', schedule: 'weekly' },
    { name: 'Ecoinometrics', schedule: 'weekly' },
    { name: 'Messari Unqualified', schedule: 'weekly' },
    { name: 'Delphi Digital', schedule: 'weekly' },
  ],
  'defi-alpha': [
    { name: 'OurNetwork', schedule: 'weekly' },
    { name: 'DeFi Weekly', schedule: 'weekly' },
    { name: 'Blockcrunch', schedule: 'weekly' },
    { name: 'DeFi Dad', schedule: 'weekly' },
    { name: 'Route 2 FI', schedule: 'weekly' },
    { name: 'Ignas DeFi Research', schedule: 'weekly' },
    { name: 'Token Terminal', schedule: 'weekly' },
    { name: 'Dune Digest', schedule: 'weekly' },
  ],
  bitcoin: [
    { name: 'Bitcoin Magazine Pro', schedule: 'weekly' },
    { name: 'Satoshi\'s Journal', schedule: 'weekly' },
    { name: 'The Bitcoin Layer', schedule: 'weekly' },
    { name: 'Nik Bhatia', schedule: 'weekly' },
    { name: 'Pomp Letter', schedule: 'daily' },
    { name: 'Pantera Blockchain', schedule: 'weekly' },
  ],
  'trading-markets': [
    { name: 'MacroScope', schedule: 'daily' },
    { name: 'The Transcript', schedule: 'daily' },
    { name: 'Exec Sum', schedule: 'daily' },
    { name: 'The Market Ear', schedule: 'daily' },
    { name: 'Bankless', schedule: 'daily' },
    { name: 'Milk Road', schedule: 'daily' },
  ],
  'web3-builders': [
    { name: 'Developer DAO', schedule: 'weekly' },
    { name: 'Web3 with a16z', schedule: 'weekly' },
    { name: 'Li Jin (Variant)', schedule: 'weekly' },
    { name: 'Mirror Development', schedule: 'irregular' },
    { name: 'Paragraph Blog', schedule: 'irregular' },
    { name: 'Unchained', schedule: 'weekly' },
  ],
  'ai-crypto': [
    { name: 'Supervised', schedule: 'weekly' },
    { name: 'The AI Report', schedule: 'weekly' },
    { name: 'TLDR AI', schedule: 'weekly' },
    { name: 'Import AI', schedule: 'weekly' },
    { name: 'Last Week in AI', schedule: 'weekly' },
    { name: 'AI Supremacy', schedule: 'weekly' },
  ],
  'tech-startup': [
    { name: 'TLDR Tech', schedule: 'daily' },
    { name: 'Not Boring', schedule: 'weekly' },
    { name: 'Benedict Evans', schedule: 'weekly' },
    { name: 'Exponential View', schedule: 'weekly' },
    { name: 'Stratechery', schedule: 'daily' },
    { name: 'HackerNoon', schedule: 'daily' },
    { name: 'Towards Data Science', schedule: 'daily' },
  ],
};

const ALL_PROTOCOLS = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'rss', label: 'RSS', color: '#ffa500' },
];

interface DigestItem {
  id: string;
  protocol: string;
  author: string;
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

interface DigestMeta {
  total: number;
  fetchedAt: number;
  niches: string[];
  protocols: string[];
  trending: Array<{ topic: string; count: number; score: number }>;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function protocolEmoji(p: string): string {
  const map: Record<string, string> = {
    nostr: '⚡',
    farcaster: '🟣',
    lens: '🌿',
    bluesky: '🦋',
    mastodon: '🐘',
    threads: '🧵',
    rss: '📡',
  };
  return map[p] ?? '●';
}

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
        headers: { 'cache-control': 'no-store' },
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
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-[var(--color-fg)]">DegenFeed Daily</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-gray-500">
          The best of web3, AI, and tech — aggregated from Nostr, Farcaster, Lens, Bluesky,
          Mastodon, 200+ RSS sources, and 28+ curated newsletters from Substack, Medium,
          Paragraph, and Mirror. Ranked by quality, recency, and diversity. Delivered to
          your inbox every morning.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Subscribe form */}
        <div className="lg:col-span-3">
          <div className="card border-degen-500/10 bg-gradient-to-br from-gray-900/90 to-gray-950/90 p-6">
            <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Subscribe</h2>
            <p className="mb-5 text-sm text-gray-500">
              Pick your topics and protocols, then enter your email.
            </p>

            <form onSubmit={handleSubscribe}>
              {/* Niche selection */}
              <div className="mb-5">
                <label
                  htmlFor="newsletter-topics"
                  className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500"
                >
                  Topics
                </label>
                <div id="newsletter-topics" className="flex flex-wrap gap-1.5">
                  {ALL_NICHES.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNiche(n.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedNiches.includes(n.id)
                          ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                          : 'card-hover text-gray-400'
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Protocol selection */}
              <div className="mb-5">
                <label
                  htmlFor="newsletter-sources"
                  className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500"
                >
                  Sources
                </label>
                <div id="newsletter-sources" className="flex flex-wrap gap-1.5">
                  {ALL_PROTOCOLS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProtocol(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedProtocols.includes(p.id)
                          ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                          : 'card-hover text-gray-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email input */}
              <div className="mb-4">
                <label
                  htmlFor="newsletter-email"
                  className="mb-1.5 block text-xs font-medium text-gray-400"
                >
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

          {/* Digest preview */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Preview Digest</h2>
              <button
                type="button"
                onClick={loadDigest}
                disabled={digestLoading}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-degen-500/30 hover:text-degen-400"
              >
                {digestLoading ? 'Loading...' : 'Load Preview'}
              </button>
            </div>

            {digest.length === 0 && !digestLoading && (
              <div className="card py-8 text-center">
                <p className="text-xs text-gray-500">
                  Select topics/sources above and click "Load Preview" to see what your daily digest
                  will look like.
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
                        className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-400"
                      >
                        #{t.topic} <span className="text-gray-600">{t.count}</span>
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
                      <span className="text-[10px] text-gray-600">{item.author}</span>
                      <span className="ml-auto text-[10px] text-gray-600">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-snug text-gray-300 line-clamp-2">{item.text}</p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[11px] text-degen-500 hover:underline"
                      >
                        Read more →
                      </a>
                    )}
                  </div>
                ))}
                {digestMeta && (
                  <p className="text-center text-[10px] text-gray-600">
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
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                What you get
              </h3>
              <ul className="space-y-2 text-xs text-gray-400">
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
                  <span>Curated RSS feeds (242+ sources across 11 categories)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Premium newsletter content from 50+ top Substacks</span>
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
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Browse by Topic
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {NEWSLETTER_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTopic(t.id)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                      activeTopic === t.id
                        ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                        : 'card-hover text-gray-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Newsletter Sources
                {activeTopic !== 'all' && (
                  <span className="ml-1 text-degen-400">
                    — {NEWSLETTERS_BY_TOPIC[activeTopic]?.length ?? 0}
                  </span>
                )}
              </h3>
              <div className="space-y-3 text-xs">
                {(activeTopic === 'all' ? Object.entries(NEWSLETTERS_BY_TOPIC) : [[activeTopic, NEWSLETTERS_BY_TOPIC[activeTopic] ?? []]] as [string, { name: string; schedule: string }[]][]).map(
                  ([topic, newsletters]) => (
                    <div key={topic}>
                      <p className="mb-1 font-medium text-gray-400">
                        {NEWSLETTER_TOPICS.find((t) => t.id === topic)?.label ?? topic}
                      </p>
                      <ul className="space-y-1 text-gray-500">
                        {newsletters.slice(0, activeTopic === 'all' ? 5 : 99).map((nl) => (
                          <li key={nl.name}>
                            ✦ {nl.name}{' '}
                            <span className="text-gray-600">
                              ({nl.schedule})
                            </span>
                          </li>
                        ))}
                        {activeTopic === 'all' && newsletters.length > 5 && (
                          <li className="text-gray-600 italic">
                            + {newsletters.length - 5} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                RSS Feeds
              </h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <a
                    href="/api/feed/rss.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-degen-500 hover:underline"
                  >
                    Full Feed (RSS 2.0)
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?format=atom"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-degen-500 hover:underline"
                  >
                    Full Feed (Atom 1.0)
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?category=bitcoin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-degen-500 hover:underline"
                  >
                    Bitcoin Feed
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?category=defi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-degen-500 hover:underline"
                  >
                    DeFi Feed
                  </a>
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                API
              </h3>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li>
                  <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-gray-500">
                    GET /api/newsletter/digest
                  </code>
                </li>
                <li>
                  <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-gray-500">
                    GET /api/newsletter/digest?format=html
                  </code>
                </li>
                <li>
                  <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-gray-500">
                    GET /api/newsletter/digest?format=text
                  </code>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
