'use client';

/**
 * DegenFeed Connect — Standalone Service Page
 *
 * "Schedule and post to ALL social platforms from one dashboard."
 * Supports: YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn + 12 decentralized protocols.
 *
 * Enterprise tier ($20/mo) or standalone add-on ($15/mo).
 */

import { useCallback, useState } from 'react';
import { ConnectPlatformModal } from '../../components/external-platforms/ConnectPlatformModal';
import { ExternalLiveDashboard } from '../../components/external-platforms/ExternalLiveDashboard';
import { ExternalPostComposer } from '../../components/external-platforms/ExternalPostComposer';
import { usePremium } from '../../hooks/usePremium';

// ─── Feature Card ─────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5 transition-all hover:border-white/20">
      <span className="mb-3 block text-2xl">{icon}</span>
      <h3 className="mb-1 font-semibold text-[var(--color-fg)]">{title}</h3>
      <p className="text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

// ─── Platform Icon Grid ───────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: '#FF0000' },
  { id: 'twitch', name: 'Twitch', icon: '📺', color: '#9146FF' },
  { id: 'kick', name: 'Kick', icon: '🔴', color: '#53FC18' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000' },
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#E4405F' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0A66C2' },
];

const DECENTRALIZED_PROTOCOLS = [
  'Mastodon',
  'Nostr',
  'Farcaster',
  'Lens',
  'Bluesky',
  'Threads',
  'Reddit',
  'Telegram',
  'Discord',
  'Lemmy',
  'PeerTube',
  'Pixelfed',
];

function PlatformBadge({ name, icon, color }: { name: string; icon: string; color?: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] bg-white/[0.03] px-3 py-2 text-sm"
      style={color ? { borderColor: `${color}30` } : undefined}
    >
      <span>{icon}</span>
      <span className="text-[var(--color-fg)]">{name}</span>
    </div>
  );
}

function ProtocolBadge({ name }: { name: string }) {
  return (
    <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-xs text-[var(--color-muted)]">
      {name}
    </span>
  );
}

// ─── Pricing Card ─────────────────────────────────────────────────────────

function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  popular,
  onSelect,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  popular?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={`relative rounded-xl border p-6 ${
        popular
          ? 'border-white/30 bg-white/[0.04]'
          : 'border-[var(--color-glass-border)] bg-white/[0.02]'
      }`}
    >
      {popular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium text-[var(--color-fg)]">
          BEST VALUE
        </span>
      )}
      <h3 className="mb-1 text-lg font-bold text-[var(--color-fg)]">{name}</h3>
      <div className="mb-4">
        <span className="text-3xl font-bold text-[var(--color-fg)]">{price}</span>
        <span className="text-sm text-[var(--color-muted)]">/{period}</span>
      </div>
      <ul className="mb-6 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
            <span className="mt-0.5 text-green-400">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          popular
            ? 'bg-white/20 text-[var(--color-fg)] hover:bg-white/30'
            : 'border border-[var(--color-glass-border)] text-[var(--color-fg)] hover:bg-white/10'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const {tier} = usePremium();  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const handleUpgrade = useCallback(() => {
    window.location.href = '/premium';
  }, []);

  const hasEnterpriseAccess = tier === 'enterprise';

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      {/* ════════════════════════════════════════════════════
          HERO
         ════════════════════════════════════════════════════ */}
      <section className="mb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-white/[0.03] px-4 py-1.5 text-sm text-[var(--color-muted)]">
          <span>🚀</span>
          <span>New: DegenFeed Connect</span>
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-[var(--color-fg)] sm:text-5xl lg:text-6xl">
          Post{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Everywhere
          </span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-[var(--color-muted)]">
          Schedule and post to ALL social platforms from one dashboard. YouTube, Twitch, Kick,
          TikTok, Instagram, LinkedIn + 12 decentralized protocols. No more jumping between apps.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          {hasEnterpriseAccess ? (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="rounded-xl bg-white/10 px-8 py-3 font-medium text-[var(--color-fg)] transition-colors hover:bg-white/20"
            >
              Connect Platforms →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUpgrade}
              className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              Get Enterprise — $20/mo
            </button>
          )}
          <a
            href="#pricing"
            className="rounded-xl border border-[var(--color-glass-border)] px-8 py-3 font-medium text-[var(--color-fg)] transition-colors hover:bg-white/10"
          >
            See Plans
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          PLATFORM GRID
         ════════════════════════════════════════════════════ */}
      <section className="mb-16">
        <h2 className="mb-6 text-center text-2xl font-bold text-[var(--color-fg)]">
          Supported Platforms
        </h2>

        <div className="mb-8">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-muted)]">
            CENTRALIZED PLATFORMS
          </h3>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <PlatformBadge key={p.id} name={p.name} icon={p.icon} color={p.color} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-[var(--color-muted)]">
            DECENTRALIZED PROTOCOLS
          </h3>
          <div className="flex flex-wrap gap-2">
            {DECENTRALIZED_PROTOCOLS.map((p) => (
              <ProtocolBadge key={p} name={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          FEATURES
         ════════════════════════════════════════════════════ */}
      <section className="mb-16">
        <h2 className="mb-6 text-center text-2xl font-bold text-[var(--color-fg)]">
          Everything You Need
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="📝"
            title="Unified Composer"
            description="Write once, publish everywhere. One composer handles text, images, video, and links for all platforms."
          />
          <FeatureCard
            icon="📅"
            title="Schedule Posts"
            description="Schedule content for optimal times. Batch-create and auto-publish across all connected platforms."
          />
          <FeatureCard
            icon="🎥"
            title="Go Live Anywhere"
            description="Stream to YouTube, Twitch, Kick, and TikTok simultaneously. One click goes live everywhere."
          />
          <FeatureCard
            icon="📊"
            title="Cross-Platform Analytics"
            description="Track engagement, views, and followers across all platforms in one unified dashboard."
          />
          <FeatureCard
            icon="🔗"
            title="OAuth via Postiz"
            description="Postiz handles OAuth for all platforms. Connect once, post forever. Enterprise-grade security."
          />
          <FeatureCard
            icon="🔄"
            title="Cross-Protocol + Cross-Platform"
            description="Combine decentralized protocols (Nostr, Farcaster, Lens) with centralized platforms (YouTube, Twitch)."
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          LIVE DEMO / COMPOSER
         ════════════════════════════════════════════════════ */}
      {hasEnterpriseAccess && (
        <section className="mb-16">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--color-fg)]">
              Post to External Platforms
            </h2>
            <button
              type="button"
              onClick={() => setShowComposer(!showComposer)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[var(--color-fg)] hover:bg-white/20"
            >
              {showComposer ? 'Hide Composer' : 'Open Composer'}
            </button>
          </div>

          {showComposer && (
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6">
              <ExternalPostComposer />
            </div>
          )}

          <div className="mt-6">
            <ExternalLiveDashboard />
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════
          PRICING
         ════════════════════════════════════════════════════ */}
      <section id="pricing" className="mb-16">
        <h2 className="mb-2 text-center text-2xl font-bold text-[var(--color-fg)]">
          Simple Pricing
        </h2>
        <p className="mb-8 text-center text-[var(--color-muted)]">
          Included in Enterprise or grab it standalone.
        </p>
        <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
          <PricingCard
            name="Enterprise"
            price="$20"
            period="mo"
            features={[
              'All external platforms',
              'All 12 decentralized protocols',
              'Unlimited scheduling',
              'Full analytics suite',
              'API access',
              'Team accounts (up to 5)',
              'Priority support',
            ]}
            cta="Get Enterprise"
            popular
            onSelect={handleUpgrade}
          />
          <PricingCard
            name="Connect Standalone"
            price="$15"
            period="mo"
            features={[
              'All external platforms',
              'Post & schedule to YouTube, Twitch, etc.',
              'Go live on connected platforms',
              'Basic analytics',
              'No decentralized protocols',
              'Individual use',
            ]}
            cta="Add to Your Plan"
            onSelect={() => {
              window.location.href = '/connect/subscribe';
            }}
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          FAQ
         ════════════════════════════════════════════════════ */}
      <section className="mb-16">
        <h2 className="mb-6 text-center text-2xl font-bold text-[var(--color-fg)]">FAQ</h2>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
            <h3 className="mb-1 font-medium text-[var(--color-fg)]">
              How does the OAuth connection work?
            </h3>
            <p className="text-sm text-[var(--color-muted)]">
              When you click Connect, you&apos;re redirected to the platform&apos;s authorization
              page. After authorizing, Postiz securely stores the tokens. DegenFeed never sees your
              platform credentials.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
            <h3 className="mb-1 font-medium text-[var(--color-fg)]">
              Can I post to both decentralized protocols AND external platforms at once?
            </h3>
            <p className="text-sm text-[var(--color-muted)]">
              Yes! With Enterprise tier, you can cross-post to all 12 decentralized protocols and
              all 6 external platforms simultaneously from one composer.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
            <h3 className="mb-1 font-medium text-[var(--color-fg)]">
              What&apos;s the difference between Connect Standalone and Enterprise?
            </h3>
            <p className="text-sm text-[var(--color-muted)]">
              Connect Standalone ($15/mo) gives you external platform posting only. Enterprise
              ($20/mo) includes everything — external platforms, all decentralized protocols, full
              analytics, API access, and team accounts.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
            <h3 className="mb-1 font-medium text-[var(--color-fg)]">Can I cancel anytime?</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Yes. Cancel anytime and your access stays active until the end of the billing period.
              No lock-in, no hidden fees.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          Connect Modal
         ════════════════════════════════════════════════════ */}
      <ConnectPlatformModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
    </div>
  );
}
