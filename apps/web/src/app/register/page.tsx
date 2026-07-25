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
              Your{' '}
              <span className="bg-gradient-to-r from-degen-400 to-purple-400 bg-clip-text text-transparent">
                One Account
              </span>{' '}
              for the Entire Fediverse
            </h1>
            <p className="mx-auto mb-6 max-w-2xl text-base text-[var(--color-muted)]">
              <strong className="text-degen-400">@you@social.degenfeed.xyz</strong> — One GoToSocial
              account unlocks every ActivityPub service on the planet.
              <br />
              <span className="text-sm opacity-80">
                Mastodon · PeerTube · Lemmy · Pixelfed · WriteFreely · BookWyrm · Mobilizon ·
                Funkwhale · Castopod · Owncast
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
          {/* PRIMARY: GoToSocial / ActivityPub Federation Hub */}
          <div className="mb-8 rounded-2xl border-2 border-degen-500/30 bg-gradient-to-br from-degen-500/10 via-transparent to-purple-500/10 p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-degen-500/20 px-3 py-1 text-xs font-semibold text-degen-400">
                PRIMARY IDENTITY
              </span>
            </div>
            <h3 className="mb-3 text-lg font-bold text-[var(--color-fg)]">
              🐘 @you@social.degenfeed.xyz — One Account, Everywhere
            </h3>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Your GoToSocial (Mastodon-compatible) account is your universal identity across the
              entire fediverse. One sign-up, zero additional registrations.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { icon: '🎬', name: 'PeerTube', desc: 'Comment on videos, subscribe to channels' },
                { icon: '🗳️', name: 'Lemmy', desc: 'Post in communities, comment on threads' },
                { icon: '📸', name: 'Pixelfed', desc: 'Share images, follow photographers' },
                { icon: '✍️', name: 'WriteFreely', desc: 'Publish blogs, write articles' },
                { icon: '📚', name: 'BookWyrm', desc: 'Review books, track your reading' },
                { icon: '📅', name: 'Mobilizon', desc: 'Create and join events' },
                { icon: '🎵', name: 'Funkwhale', desc: 'Listen to music, make playlists' },
                { icon: '🎙️', name: 'Castopod', desc: 'Subscribe to podcasts' },
                { icon: '📺', name: 'Owncast', desc: 'Chat in live streams' },
                { icon: '🐘', name: 'Mastodon', desc: 'Every Mastodon instance on the planet' },
              ].map((s) => (
                <div
                  key={s.name}
                  className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center"
                >
                  <div className="mb-1 text-xl">{s.icon}</div>
                  <div className="text-xs font-bold text-[var(--color-fg)]">{s.name}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
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
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">Nostr Keypair</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Fresh keypair generated for the decentralized Nostr network. Your npub is yours to
                use anywhere. Free forever.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
                <span className="text-base font-bold text-degen-400">🔗</span>
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">Farcaster + Lens</h3>
              <p className="text-xs text-[var(--color-muted)]">
                On-chain Farcaster FID on Base + Lens Profile on Polygon. We pay the gas on paid
                plans.
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
            <div className="rounded-xl border-2 border-degen-500/30 bg-degen-500/5 p-4">
              <div className="mb-2 text-2xl">🐘</div>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">
                GoToSocial — PRIMARY
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                <strong>@you@social.degenfeed.xyz</strong> — Your master identity for every
                ActivityPub service. Mastodon, PeerTube, Lemmy, Pixelfed, and more. Free. Instant.
                No gas.
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

      {/* Fediverse Account Portability section */}
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-center text-xl font-bold text-[var(--color-fg)]">
            Your Account Is Portable. Always.
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                📤 Export Your Data
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Download your follows, blocks, mutes, and bookmarks at any time. Standard
                ActivityPub format — importable into any Mastodon instance.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                🔄 Migrate Anywhere
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Move to another Mastodon/GTS instance with zero follower loss. Your old profile
                redirects followers automatically. Standard ActivityPub migration.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">
                📥 Import from Anywhere
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Coming from another Mastodon instance? Import your data here. Your content and
                followers stay with you.
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
              <h3 className="mb-1.5 text-sm font-bold text-[var(--color-fg)]">1. Pick your plan</h3>
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
