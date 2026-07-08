import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DegenFeed — The social feed of web3',
  description:
    'See every network. Zero sign-ups. Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, Threads, Reddit, RSS — all in one window. Open-source web3 social aggregator.',
  alternates: { canonical: 'https://app.degenfeed.xyz' },
};

const protocols = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb', desc: 'Decentralized relays', count: '5M+ events', icon: '☰' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2', desc: 'On-chain social', count: '800K+ users', icon: '◈' },
  { id: 'lens', label: 'Lens', color: '#abfe2c', desc: 'Polygon native', count: '500K+ profiles', icon: '◎' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe', desc: 'AT Protocol', count: '30M+ users', icon: '☁' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff', desc: 'ActivityPub', count: '15M+ accounts', icon: 'M' },
  { id: 'lemmy', label: 'Lemmy', color: '#00b868', desc: 'Federated Reddit', count: '50K+ communities', icon: 'L' },
  { id: 'reddit', label: 'Reddit', color: '#ff4500', desc: 'Crypto subs', count: '8M+ posts', icon: 'R' },
  { id: 'rss', label: 'RSS / News', color: '#ffa500', desc: '400+ feeds', count: '150+ sources', icon: 'A' },
];

const topicChannels = [
  { href: '/home/all?niches=bitcoin&sort=hot', label: 'Bitcoin Only', desc: 'BTC maximalism — news, commentary, on-chain', color: '#f7931a' },
  { href: '/home/all?niches=defi&sort=hot', label: 'DeFi Alpha', desc: 'Yield, lending, DEXs, protocols', color: '#22c55e' },
  { href: '/home/all?niches=ai&type=article&sort=new', label: 'AI & ML', desc: 'Research papers, launches, commentary', color: '#8b5cf6' },
  { href: '/home/all?niches=ethereum,solana,layer2&sort=hot', label: 'L1s & L2s', desc: 'Ethereum, Solana, rollups, bridges', color: '#3b82f6' },
  { href: '/home/all?niches=security&sort=hot', label: 'Security', desc: 'Exploits, audits, CVEs, threat intel', color: '#ef4444' },
  { href: '/home/all?niches=macro&sort=new', label: 'Macro & Policy', desc: 'Fed, SEC, regulation, markets', color: '#f59e0b' },
  { href: '/home/all?type=video&sort=new', label: 'Video Feed', desc: '93 YouTube channels, PeerTube', color: '#ec4899' },
  { href: '/home/all?type=article&protocols=rss&sort=new', label: 'Long Reads', desc: 'Articles, newsletters, deep dives', color: '#06b6d4' },
];

const sections = [
  { href: '/home/all?sort=hot', label: 'Hot', desc: 'Trending right now across all protocols' },
  { href: '/home/all?sort=new', label: 'New', desc: 'Latest posts in real time' },
  { href: '/news', label: 'News', desc: 'Curated crypto, AI, and tech news from 550+ RSS feeds' },
  { href: '/discover', label: 'Discover', desc: 'Trending topics, communities, and people' },
  { href: '/home/funding', label: 'Funding', desc: 'Track crypto venture rounds in real time' },
  { href: '/newsletter', label: 'Newsletter', desc: 'Daily digest delivered to your inbox' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5 px-4 py-16 sm:py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-degen-500/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-3 font-mono text-xs tracking-widest text-degen-400 uppercase">Open-source web3 social aggregator</p>
          <h1 className="mb-4 font-bold text-4xl text-white tracking-tight sm:text-5xl lg:text-6xl">Every network.<br /><span className="text-degen-400">One window.</span></h1>
          <p className="mx-auto mb-8 max-w-2xl text-base text-gray-400 sm:text-lg">Browse Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, Threads, Reddit, and RSS — all in one unified feed. No account needed. Open source. Free forever.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/home/all?sort=hot" className="inline-flex items-center gap-2 rounded-lg bg-degen-600 px-6 py-3 font-medium text-sm text-white transition-all hover:bg-degen-500 hover:shadow-lg hover:shadow-degen-500/20">Browse the feed<span aria-hidden="true">→</span></Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 font-medium text-sm text-gray-300 transition-all hover:border-white/20 hover:bg-white/10">Read the docs</Link>
            <Link href="https://social.degenfeed.xyz" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 font-medium text-sm text-gray-300 transition-all hover:border-white/20 hover:bg-white/10">Get @degenfeed.xyz</Link>
          </div>
        </div>
      </section>

      {/* Protocol cards */}
      <section className="border-b border-white/5 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 text-center font-mono text-xs tracking-widest text-degen-400 uppercase">Browse by protocol</p>
          <h2 className="mb-10 text-center font-bold text-2xl text-white sm:text-3xl">Click any network to see its feed live</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {protocols.map((p) => (
              <Link key={p.id} href={`/home/${p.id}?sort=hot`} className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/10 hover:bg-white/[0.04] hover:shadow-lg">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-lg" style={{ backgroundColor: `${p.color}18`, color: p.color }}>{p.icon}</div>
                <h3 className="mb-1 font-semibold text-white">{p.label}</h3>
                <p className="mb-2 text-xs text-gray-500">{p.desc}</p>
                <span className="font-mono text-[11px] tracking-wide text-gray-600">{p.count}</span>
                <span className="mt-3 block font-medium text-xs text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">View feed →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Topic channels */}
      <section className="border-b border-white/5 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 text-center font-mono text-xs tracking-widest text-degen-400 uppercase">Topic channels</p>
          <h2 className="mb-10 text-center font-bold text-2xl text-white sm:text-3xl">Dive into what you care about</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topicChannels.map((c) => (
              <Link key={c.href} href={c.href} className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/10 hover:bg-white/[0.04]">
                <div className="mb-3 h-1 w-12 rounded-full" style={{ backgroundColor: c.color }} />
                <h3 className="mb-1 font-semibold text-white">{c.label}</h3>
                <p className="text-xs text-gray-500">{c.desc}</p>
                <span className="mt-3 block font-medium text-xs text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">Browse →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Daily digest preview */}
      <section className="border-b border-white/5 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-degen-500/10 bg-degen-500/[0.03] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Daily digest</p>
              <h3 className="mt-1 text-lg font-bold text-white">The best of web3, AI, and tech in your inbox</h3>
              <p className="mt-1 text-sm text-gray-500">Curated from 10 protocols and 550+ sources. Every morning. Free.</p>
            </div>
            <div className="mt-4 flex flex-shrink-0 gap-3 sm:mt-0">
              <Link href="/newsletter" className="rounded-lg bg-degen-600 px-5 py-2.5 font-medium text-sm text-white transition-all hover:bg-degen-500">Subscribe</Link>
              <Link href="/newsletter/digest" className="rounded-lg border border-white/10 px-5 py-2.5 font-medium text-sm text-gray-300 transition-all hover:border-white/20">Preview</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="border-b border-white/5 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-center font-mono text-xs tracking-widest text-degen-400 uppercase">Jump right in</p>
          <h2 className="mb-10 text-center font-bold text-2xl text-white sm:text-3xl">See how it works for yourself</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => (
              <Link key={s.href} href={s.href} className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]">
                <h3 className="mb-1 font-semibold text-white">{s.label}</h3>
                <p className="text-xs text-gray-500">{s.desc}</p>
                <span className="mt-3 block font-medium text-xs text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b border-white/5 px-4 py-12">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 sm:gap-12">
          {[{ value: '10', label: 'Protocols' },{ value: '550+', label: 'RSS Sources' },{ value: '50M+', label: 'Reachable Users' },{ value: '\u221E', label: 'Free Reads' }].map((s) => (
            <div key={s.label} className="text-center"><div className="font-bold text-2xl text-white sm:text-3xl">{s.value}</div><div className="mt-1 font-mono text-[11px] tracking-widest text-gray-500 uppercase">{s.label}</div></div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <section className="px-4 py-16 text-center">
        <p className="mb-2 font-mono text-xs tracking-widest text-degen-400 uppercase">Open source</p>
        <h2 className="mb-4 font-bold text-2xl text-white sm:text-3xl">Built on open protocols. MIT licensed.</h2>
        <p className="mb-6 text-gray-500">Fork us, self-host, contribute. No walled gardens.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/docs" className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 font-medium text-sm text-white transition-all hover:border-white/20">Documentation</Link>
          <Link href="/faq" className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 font-medium text-sm text-white transition-all hover:border-white/20">FAQ</Link>
          <Link href="/status" className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 font-medium text-sm text-white transition-all hover:border-white/20">Status</Link>
          <a href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web" target="_blank" rel="noopener" className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 font-medium text-sm text-white transition-all hover:border-white/20">Source Code</a>
        </div>
      </section>
    </div>
  );
}
