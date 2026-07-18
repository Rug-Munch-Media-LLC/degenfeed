import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../_components/doc-badge';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Contributing — DegenFeed',
  description:
    'How to contribute to DegenFeed. Development setup, code style, pull request process, and testing guide for the open-source web3 social aggregator.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/contributing' },
  openGraph: {
    title: 'Contributing to DegenFeed',
    description:
      'Guide for contributors to DegenFeed — the open-source multi-protocol web3 social aggregator.',
  },
};

export default function ContributingPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-2 flex items-center gap-2">
        <Badge color="purple">Contributing</Badge>
        <Badge>Open Source</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        Contributing to DegenFeed
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        DegenFeed is MIT licensed and open to contributions from the community. Whether you&rsquo;re
        fixing a bug, adding a feature, improving documentation, or integrating a new protocol,
        we&rsquo;re glad to have you.
      </p>

      <Callout type="info">
        All contributors are expected to follow our Code of Conduct. Be respectful, constructive,
        and welcoming. We&rsquo;re building an open social web together.
      </Callout>

      {/* Development Setup */}
      <H2 id="development-setup">Development Setup</H2>

      <H3 id="prerequisites">Prerequisites</H3>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[var(--color-muted)]">
        <li>
          <strong className="text-[var(--color-muted)]">Node.js</strong> 20.x or later
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">pnpm</strong> 11.x (
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
            npm install -g pnpm
          </code>
          )
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">Git</strong> 2.x
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">Wrangler CLI</strong> (
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
            npm install -g wrangler
          </code>
          )
        </li>
      </ul>

      <H3 id="clone-and-install">Clone and Install</H3>
      <CodeBlock lang="bash">{`# Clone the repository
git clone https://git.rugmunch.io/RugMunchMedia/degenfeed-web.git
cd degenfeed-web

# Install all dependencies (monorepo)
pnpm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your configuration

# Start development servers
pnpm dev`}</CodeBlock>

      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        The{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">pnpm dev</code>{' '}
        command starts both the Next.js frontend and the API worker in development mode. Open{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          http://localhost:3000
        </code>{' '}
        in your browser.
      </p>

      <H3 id="environment-variables">Environment Variables</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Copy{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          .env.example
        </code>{' '}
        to <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">.env</code>{' '}
        and configure the following:
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Variable</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Required</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              [
                'AUTH_SECRET',
                'Yes',
                'HMAC-SHA256 session signing secret. Generate: openssl rand -hex 32',
              ],
              ['ALLOWED_ORIGINS', 'Yes', 'Comma-separated CORS origins'],
              ['RELAY_URLS', 'No', 'Comma-separated Nostr relay URLs'],
              ['FARCASTER_HUB_URL', 'No', 'Farcaster Hub HTTP endpoint'],
              ['LENS_API_URL', 'No', 'Lens GraphQL API endpoint'],
              ['SOLANA_RPC_URL', 'No', 'Solana RPC for wallet verification'],
              ['GTS_CLIENT_ID', 'No', 'GotoSocial OAuth2 client ID'],
              ['GTS_CLIENT_SECRET', 'No', 'GotoSocial OAuth2 client secret'],
              ['VAPID_PUBLIC_KEY', 'No', 'Web Push VAPID public key'],
              ['VAPID_PRIVATE_KEY', 'No', 'Web Push VAPID private key'],
              ['POSTMARK_SERVER_TOKEN', 'No', 'Postmark API token for emails'],
            ].map(([key, req, desc]) => (
              <tr key={key} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{key}</td>
                <td className="py-2 pr-4">
                  <Badge color={req === 'Yes' ? 'yellow' : 'gray'}>{req}</Badge>
                </td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Development Workflow */}
      <H2 id="development-workflow">Development Workflow</H2>

      <H3 id="branch-naming">Branch Naming</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Use descriptive branch names prefixed by category:
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Prefix</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Example</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              ['feat/', 'feat/cross-protocol-search'],
              ['fix/', 'fix/nostr-reconnect-backoff'],
              ['docs/', 'docs/api-rate-limits'],
              ['chore/', 'chore/update-dependencies'],
              ['refactor/', 'refactor/provider-interface'],
              ['test/', 'test/ranking-algorithm-edge-cases'],
            ].map(([prefix, example]) => (
              <tr key={prefix} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{prefix}</td>
                <td className="py-2 font-mono text-xs">{example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3 id="commit-messages">Commit Messages</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Follow the Conventional Commits specification:
      </p>
      <CodeBlock lang="text">{`feat: add cross-protocol search endpoint
fix: handle Nostr relay disconnection gracefully
docs: update API rate limit documentation
refactor: simplify provider interface
test: add ranking algorithm edge case tests
chore: upgrade dependencies`}</CodeBlock>

      <H3 id="pre-commit-checks">Pre-Commit Checks</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Run these commands before committing to ensure code quality:
      </p>
      <CodeBlock lang="bash">{`# TypeScript type checking
pnpm typecheck

# Linting with Biome
pnpm lint

# Run tests
pnpm test

# All three at once
pnpm typecheck && pnpm lint && pnpm test`}</CodeBlock>

      <Callout type="warning">
        CI will reject commits that fail type checking, linting, or tests. Run all three before
        pushing to save time.
      </Callout>

      {/* Code Style */}
      <H2 id="code-style">Code Style</H2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          {
            title: 'TypeScript',
            desc: 'Strict mode. No implicit any. Prefer types over interfaces for objects.',
          },
          {
            title: 'Formatting',
            desc: 'Biome handles all formatting. No Prettier. No manual formatting debates.',
          },
          {
            title: 'Imports',
            desc: 'Named exports only. No default exports. Use workspace imports for monorepo packages.',
          },
          {
            title: 'Components',
            desc: 'Functional components with hooks. Server components by default in Next.js App Router.',
          },
          {
            title: 'Styling',
            desc: 'Tailwind CSS with CSS variables for theme. No CSS-in-JS. No inline styles.',
          },
          {
            title: 'Patterns',
            desc: 'Follow existing patterns. Each package has a consistent structure. Read the codebase first.',
          },
        ].map((rule) => (
          <div
            key={rule.title}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{rule.title}</div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{rule.desc}</p>
          </div>
        ))}
      </div>

      {/* Testing */}
      <H2 id="testing">Testing Guide</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed uses a multi-layer testing strategy. Run the relevant tests for your change.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Unit Tests',
            tool: 'Vitest',
            cmd: 'pnpm test',
            desc: 'Run during development. Tests individual functions and components in isolation.',
          },
          {
            title: 'E2E Tests',
            tool: 'Playwright',
            cmd: 'pnpm test:e2e',
            desc: 'Full browser tests. Run before creating a PR for UI changes.',
          },
          {
            title: 'Visual Regression',
            tool: 'Playwright',
            cmd: 'pnpm test:visual',
            desc: 'Screenshot comparison tests. Run for UI and component changes.',
          },
        ].map((t) => (
          <div
            key={t.title}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{t.title}</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge color="blue">{t.tool}</Badge>
              <code className="font-mono text-[10px] text-degen-400">{t.cmd}</code>
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">{t.desc}</p>
          </div>
        ))}
      </div>

      <H3 id="writing-tests">Writing Tests</H3>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[var(--color-muted)]">
        <li>
          Place tests next to the file they test:{' '}
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
            component.tsx
          </code>{' '}
          →{' '}
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
            component.test.tsx
          </code>
        </li>
        <li>
          Use descriptive test names:{' '}
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
            should return ranked posts sorted by score
          </code>
        </li>
        <li>Mock external API calls. Don&rsquo;t hit real protocol endpoints in tests.</li>
        <li>Test edge cases: empty responses, rate limits, network errors.</li>
        <li>Aim for 80%+ coverage on new code.</li>
      </ul>

      {/* PR Process */}
      <H2 id="pr-process">Pull Request Process</H2>

      <ol className="mt-4 space-y-4">
        {[
          ['Create a branch', 'Branch from main. Use the naming convention above.'],
          ['Make your changes', 'Write code, tests, and documentation. Run all pre-commit checks.'],
          [
            'Push and open a PR',
            'Push your branch and create a Pull Request on Forgejo (or GitLab mirror).',
          ],
          [
            'Describe your changes',
            'Include a clear description of what your PR does, why, and how to test it.',
          ],
          [
            'Wait for review',
            'A maintainer will review your PR. They may request changes or clarifications.',
          ],
          [
            'Address feedback',
            'Make requested changes. Push additional commits. Keep the conversation constructive.',
          ],
          ['Merge', 'Your PR will be squash-merged into main. Celebrate your contribution!'],
        ].map(([step, desc], i) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
              {i + 1}
            </span>
            <div>
              <strong className="text-[var(--color-muted)]">{step}</strong>
              <p className="mt-0.5 text-[var(--color-muted)]">{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Adding Protocols */}
      <H2 id="adding-protocols">Adding a New Protocol</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed supports 10 protocols and is designed for extensibility. See the{' '}
        <Link href="/docs/protocols#adding-new-protocols" className="text-degen-400 underline">
          Protocol Integration Guide
        </Link>{' '}
        for a detailed walkthrough of adding a new provider.
      </p>

      {/* Code of Conduct */}
      <H2 id="code-of-conduct">Code of Conduct</H2>
      <div className="mt-4 rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
        <ul className="space-y-2 text-sm text-[var(--color-muted)]">
          <li>
            <strong className="text-[var(--color-muted)]">Be respectful.</strong> Disagreement is
            fine, personal attacks are not.
          </li>
          <li>
            <strong className="text-[var(--color-muted)]">Be constructive.</strong> Critique code,
            not people. Suggest improvements.
          </li>
          <li>
            <strong className="text-[var(--color-muted)]">Be welcoming.</strong> We welcome
            contributors of all experience levels.
          </li>
          <li>
            <strong className="text-[var(--color-muted)]">Be patient.</strong> Maintainers review
            PRs in their free time. We&rsquo;ll get to yours.
          </li>
        </ul>
      </div>

      <div className="mt-12 rounded-xl border border-[var(--color-glass-border)] bg-degen-500/[0.02] p-6 text-center">
        <h2 className="mb-2 text-base font-semibold text-[var(--color-fg)]">
          Ready to contribute?
        </h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          Clone the repo and start coding. We&rsquo;re excited to see what you build.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            View on Forgejo
          </a>
          <a
            href="https://gitlab.com/cryptorugmuncher/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            GitLab Mirror
          </a>
        </div>
      </div>
    </div>
  );
}
