'use client';

/**
 * @app/register — Concierge Registration Landing Page
 *
 * Full-page registration flow. Creates accounts on ALL protocols in one go.
 * Shows transparent pricing, free alternatives, and hands over everything
 * to the user.
 */

import { useAuth } from '../../components/AuthProvider';
import { RegisterFlow } from '../../components/RegisterFlow';

export default function RegisterPage() {
  const { walletAddress } = useAuth();

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      {/* Hero section */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-3 text-3xl font-black tracking-tight text-[var(--color-fg)] sm:text-4xl">
              Create Your{' '}
              <span className="bg-gradient-to-r from-degen-400 to-purple-400 bg-clip-text text-transparent">
                Universal Social Identity
              </span>
            </h1>
            <p className="mx-auto mb-6 max-w-2xl text-base text-[var(--color-muted)]">
              One registration. All protocols. We handle the gas, you get the keys.
              <br />
              <span className="text-sm opacity-80">
                GoToSocial &middot; Bluesky PDS &middot; Nostr &middot; RSS &middot; Farcaster
                &middot; Lens &middot; ENS
              </span>
            </p>

            {!walletAddress && (
              <div className="mx-auto max-w-xs rounded-xl border border-degen-500/20 bg-degen-500/[0.04] px-4 py-3">
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  Connect your wallet to get started
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  You&apos;ll own every account. We just create them for you.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registration flow */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <RegisterFlow />
      </div>

      {/* Features section */}
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-xl font-bold text-[var(--color-fg)]">
            What You Get
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                🐘
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                GoToSocial (Fediverse)
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Your own Fediverse presence at{' '}
                <code className="text-degen-400">@you@social.degenfeed.xyz</code>. Follow anyone on
                Mastodon, Pixelfed, PeerTube, and more. Free forever.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                ☁️
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                AT Protocol (Bluesky)
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Bluesky-compatible account on our PDS. Use any Bluesky app. Your data stays yours.
                Free forever.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                ⚡
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                Nostr Keypair
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Fresh keypair generated for the decentralized Nostr network. Your npub is yours to
                use anywhere. Free forever.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                🔗
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                Farcaster ID
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                On-chain Farcaster identity registered on Base. Your FID is yours. We pay the $5 gas
                fee. Standard plan or Premium.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                ◎
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                Lens Profile
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Decentralized Lens Protocol profile on Polygon. Your handle is your NFT. We pay the
                $2 gas. Standard plan or Premium.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                📡
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                RSS Feed + ENS
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Auto-generated RSS feed for your content. Complete plan adds an ENS domain so your
                identity is a name you own.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Free alternatives section */}
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-center text-xl font-bold text-[var(--color-fg)]">
            Want to Start Free? No Problem.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="mb-2 text-2xl">🐘</div>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Fediverse</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Get @yourname@social.degenfeed.xyz free, instantly. No gas, no fees.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="mb-2 text-2xl">☁️</div>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Bluesky</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Auto-created on our PDS. Use any Bluesky app. Free forever.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="mb-2 text-2xl">⚡</div>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Nostr</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Generated keypair. No gas, no fees, no registration required.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="mb-2 text-2xl">🔗</div>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Farcaster</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Free via{' '}
                <a
                  href="https://warpcast.com/~/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-degen-400 hover:underline"
                >
                  Warpcast
                </a>{' '}
                redirect — sign in with us after.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ / Info section */}
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-center text-xl font-bold text-[var(--color-fg)]">
            How It Works
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                1. Pick your plan
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Free tier creates everything that doesn&apos;t cost gas. Paid tiers cover on-chain
                registration fees. Premium subscription makes it all $0.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                2. Review transparent costs
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                We show exactly what we&apos;ll create and what each cost covers. No hidden fees.
                Gas costs passed through at cost.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                3. Sign once with your wallet
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                One signature authorizes everything. No repeated approvals. No separate transactions
                for each protocol.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                4. Get all accounts + recovery keys
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                We create everything and hand over the keys. You own every account. We can&apos;t
                recover them — only you can.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
