import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Developers — DegenFeed',
  description:
    'Build on DegenFeed. Public API, SDKs, webhooks, and integration guides for the open social web. Aggregate 9 protocols into one feed.',
  alternates: { canonical: 'https://app.degenfeed.xyz/developers' },
  openGraph: {
    title: 'Build on DegenFeed',
    description: 'The public API for the open social web.',
  },
};

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-900/30 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-900/30 text-blue-400 border-blue-500/20',
    gray: 'bg-[var(--color-muted)] text-[var(--color-muted)] border-[var(--color-border)]/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium ${colors[color] ?? colors.gray}`}
    >
      {children}
    </span>
  );
}

function Card({
  href,
  title,
  desc,
  badge,
  external = false,
}: {
  href: string;
  title: string;
  desc: string;
  badge?: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener' : undefined}
      className="group rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
    >
      {badge && <Badge color="green">{badge}</Badge>}
      <h3 className="mt-2 font-semibold text-[var(--color-fg)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{desc}</p>
      <span className="mt-3 inline-block text-xs font-medium text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">
        {external ? 'Open →' : 'Learn more →'}
      </span>
    </Link>
  );
}

function Integration({ name, desc, badge }: { name: string; desc: string; badge: string }) {
  return (
    <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-degen-400">{name}</span>
        <Badge color={badge === 'Stable' ? 'green' : badge === 'Beta' ? 'yellow' : 'gray'}>
          {badge}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{desc}</p>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-degen-500/20 bg-gradient-to-br from-degen-500/[0.05] via-black to-degen-500/[0.02] p-10 lg:p-16">
        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2">
            <Badge color="green">v1.0.0</Badge>
            <Badge color="blue">Public API</Badge>
            <Badge color="purple">MIT Licensed</Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)] lg:text-5xl">
            Build on <span className="text-degen-400">DegenFeed</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
            Aggregate 9 decentralized social networks into one ranked feed. The DegenFeed API gives
            you access to Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, Lemmy, and RSS
            — all through a single authenticated endpoint.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/api-docs"
              className="rounded-lg bg-degen-500 px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            >
              Read the API docs →
            </Link>
            <Link
              href="/profile/settings/api"
              className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
            >
              Generate an API key
            </Link>
            <a
              href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
              target="_blank"
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-all hover:border-white/20 hover:text-[var(--color-muted)]"
              rel="noopener"
            >
              Source code
            </a>
          </div>
        </div>
        {/* Decorative grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      </section>

      {/* Quick links */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">Quick Start</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Get up and running in minutes.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            href="/api-docs#authentication"
            title="Get an API key"
            desc="Generate a scoped API key from your profile settings in one click."
            badge="5 min"
          />
          <Card
            href="/api-docs#sdks"
            title="Try the API"
            desc="curl, JavaScript, and Python examples to make your first request."
            badge="curl"
          />
          <Card
            href="/api-docs#endpoints"
            title="Browse endpoints"
            desc="Full reference for all v1 endpoints — feed, search, identity, tips, and more."
            badge="Reference"
          />
        </div>
      </section>

      {/* SDKs & Tools */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">SDKs & Tools</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Client libraries and tools for every platform.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="font-semibold text-[var(--color-fg)]">JavaScript / TypeScript</h3>
            <div className="mt-3 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-[var(--color-muted)]">
              npm install @degenfeed/api-client
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Full-featured client with type safety, auto-pagination, and rate limit handling. Works
              in Node.js 18+, browsers, and Cloudflare Workers.
            </p>
            <Link
              href="/api-docs#javascript"
              className="mt-3 inline-block text-xs font-medium text-degen-400 hover:underline"
            >
              View example →
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="font-semibold text-[var(--color-fg)]">Python</h3>
            <div className="mt-3 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-[var(--color-muted)]">
              pip install degenfeed-client
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Async-first Python client with httpx, Pydantic models, and full type annotations.
              Python 3.10+ required.
            </p>
            <Link
              href="/api-docs#python"
              className="mt-3 inline-block text-xs font-medium text-degen-400 hover:underline"
            >
              View example →
            </Link>
          </div>
        </div>
      </section>

      {/* Example Apps */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">Example Apps</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Open-source projects built on the DegenFeed API.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            external
            title="DegenFeed CLI"
            desc="Command-line feed reader. Browse Nostr, Farcaster, and more from your terminal."
            badge="Go"
          />
          <Card
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            external
            title="Feed Widget"
            desc="Embeddable web component. Add a live DegenFeed widget to any website."
            badge="Web Component"
          />
          <Card
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            external
            title="Discord Bot"
            desc="Post trending DegenFeed content to your Discord server via webhooks."
            badge="Node.js"
          />
        </div>
      </section>

      {/* Webhooks */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">Webhooks</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Receive real-time events when new content is published.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">
            Webhooks let you subscribe to real-time events from the DegenFeed network. When new
            posts match your filters, we send an HTTP POST to your endpoint within seconds.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-400">POST</span>
                <code className="font-mono text-xs text-[var(--color-muted)]">
                  → your-webhook-url.com/events
                </code>
              </div>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-[var(--color-muted)]">{`{
  "event": "post.new",
  "protocol": "nostr",
  "post": { "id": "note1...", "content": "..." },
  "timestamp": 1720000000000
}`}</pre>
            </div>
          </div>
          <div className="mt-4">
            <Badge color="yellow">Coming soon</Badge>
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              Webhook subscriptions will be available in the developer dashboard.
            </span>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">Protocol Integrations</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          All 9 networks available through a single API.
        </p>
        <div className="mt-4 space-y-1">
          <Integration
            name="Nostr"
            desc="Kind 1 text notes, reactions, reposts, long-form articles. Schnorr signatures."
            badge="Stable"
          />
          <Integration
            name="Farcaster"
            desc="Ed25519-signed protobuf messages. Cast Add, Reactions, Replies, Frames."
            badge="Stable"
          />
          <Integration
            name="Lens"
            desc="Polygon-based social graph via GraphQL v2. Profiles, publications, mirrors."
            badge="Stable"
          />
          <Integration
            name="Bluesky"
            desc="AT Protocol XRPC methods. Full CRUD with DID-based identity."
            badge="Stable"
          />
          <Integration
            name="Mastodon / ActivityPub"
            desc="GotoSocial REST API v1. Full Fediverse federation."
            badge="Stable"
          />
          <Integration
            name="Lemmy"
            desc="REST API v3 for communities and posts. Fediverse communities."
            badge="Beta"
          />
          <Integration
            name="Threads"
            desc="Meta ActivityPub integration with HTML parsing. Read-only."
            badge="Read-only"
          />
          <Integration
            name="Reddit"
            desc="RSS + JSON API + community frontends. 91 default subreddits."
            badge="Stable"
          />
          <Integration
            name="RSS / Atom"
            desc="353+ feeds: crypto, tech, AI, science, finance. Custom adapters."
            badge="Stable"
          />
        </div>
      </section>

      {/* Changelog */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">Changelog</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Recent changes to the API and developer platform.
        </p>
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2">
              <Badge color="green">v1.0.0</Badge>
              <span className="text-xs text-[var(--color-muted)]">July 18, 2026</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-muted)] list-disc list-inside">
              <li>
                Stable v1 API with{' '}
                <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">/v1/</code>{' '}
                prefix
              </li>
              <li>API key authentication with scoped permissions</li>
              <li>Tiered rate limiting (1,000 free / 10,000 premium req/hour)</li>
              <li>
                Legacy{' '}
                <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">
                  /api/*
                </code>{' '}
                routes deprecated — sunset November 1, 2026
              </li>
              <li>Developer portal and API documentation</li>
              <li>JavaScript and Python SDK releases</li>
            </ul>
          </div>
          <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2">
              <Badge color="gray">v0.2.0</Badge>
              <span className="text-xs text-[var(--color-muted)]">June 2026</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-muted)] list-disc list-inside">
              <li>Unified tipping across all protocols</li>
              <li>Community creation and management</li>
              <li>Audio Spaces (live audio rooms)</li>
              <li>Cross-protocol reply threading</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-[var(--color-fg)]">Developer Community</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Connect with other builders.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card
            href="/c/developers"
            title="Community Chat"
            desc="Discussion, support, and show-and-tell in the DegenFeed developer community."
          />
          <Card
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            external
            title="GitHub Issues"
            desc="Report bugs, request features, or contribute to the open-source codebase."
          />
          <Card
            href="/newsletter"
            title="Dev Newsletter"
            desc="Monthly updates on API changes, new protocols, and SDK releases."
          />
        </div>
      </section>

      <div className="mt-16 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-gray-600">
          DegenFeed is a product of{' '}
          <strong className="text-[var(--color-muted)]">Rug Munch Media LLC</strong>. MIT Licensed.
          Built on open protocols.{' '}
          <Link href="/api-docs" className="text-degen-400 underline">
            API Documentation
          </Link>{' '}
          ·{' '}
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="text-degen-400 underline"
          >
            Source Code
          </a>
        </p>
      </div>
    </div>
  );
}
