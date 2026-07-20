'use client';

/**
 * AddOnCard — Display one-time and yearly add-on fees
 *
 * Shows transparent pass-through costs for protocol registrations,
 * domain names, and optional extras. Each card explains what the
 * fee actually covers (gas, DNS, registration).
 */

// === Types =================================================================

export interface AddOn {
  name: string;
  price: string;
  frequency: 'one-time' | 'yearly';
  description: string;
  covers: string;
}

export const ADD_ONS: AddOn[] = [
  {
    name: 'Custom Lens Handle (9+ chars)',
    price: 'Included',
    frequency: 'one-time',
    description: 'Standard-length handle — always free',
    covers: 'Included in all registration plans',
  },
  {
    name: 'Custom Lens Handle (7-8 chars)',
    price: '+$5–8',
    frequency: 'one-time',
    description: 'Short handle — extra Polygon gas',
    covers: 'Polygon gas fees for shorter handle registration',
  },
  {
    name: 'Custom Lens Handle (5-6 chars)',
    price: '+$15–25',
    frequency: 'one-time',
    description: 'Premium short handle',
    covers: 'Polygon gas fees for premium short handle registration',
  },
  {
    name: 'Custom Lens Handle (3-4 chars)',
    price: '+$50–200',
    frequency: 'one-time',
    description: 'Rare short handle',
    covers: 'Polygon gas fees for rare handle registration',
  },
  {
    name: 'Custom Farcaster Username',
    price: '$5',
    frequency: 'one-time',
    description: 'Claim your preferred Farcaster username on Base',
    covers: 'Base gas fees for Farcaster ID registration',
  },
  {
    name: 'ENS Domain',
    price: '$10',
    frequency: 'one-time',
    description: 'Register yourwallet.eth for your Base wallet',
    covers: 'Ethereum gas + 1 year ENS registration',
  },
  {
    name: 'Additional Creator Coin',
    price: '$2',
    frequency: 'one-time',
    description: 'Deploy an extra creator coin beyond your 2 free ones',
    covers: 'Base or Solana gas for contract deployment',
  },
  {
    name: 'Custom Community Domain',
    price: '$15',
    frequency: 'yearly',
    description: 'Custom domain for your Feddy Community (e.g., mycommunity.degenfeed.xyz)',
    covers: 'DNS management + SSL certificate provisioning',
  },
  {
    name: 'Extra Protocol Account',
    price: '$3',
    frequency: 'one-time',
    description: 'Register an additional account on any supported protocol',
    covers: 'Gas fees for on-chain registration',
  },
];

// === Frequency Badge =======================================================

function FrequencyBadge({ freq }: { freq: 'one-time' | 'yearly' }) {
  const styles = {
    'one-time': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'yearly': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${styles[freq]}`}
    >
      {freq === 'one-time' ? 'One-Time' : 'Yearly'}
    </span>
  );
}

// === Single Add-On Card ===================================================

function AddOnCardItem({ addOn }: { addOn: AddOn }) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--color-fg)]">{addOn.name}</h3>
            <FrequencyBadge freq={addOn.frequency} />
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{addOn.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-degen-400">{addOn.price}</div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--color-muted)]">
            {addOn.frequency}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-[var(--color-overlay)] px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-[10px] text-[var(--color-muted)]" aria-hidden="true">⛽</span>
          <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-fg)]">Covers:</span>{' '}
            {addOn.covers}
          </p>
        </div>
      </div>
    </div>
  );
}

// === Add-Ons Section ======================================================

export function AddOnsSection({ addOns = ADD_ONS }: { addOns?: AddOn[] }) {
  return (
    <div className="space-y-5">
      {/* Transparent costs explainer */}
      <div className="rounded-2xl border border-degen-500/10 bg-gradient-to-r from-degen-500/[0.03] to-transparent p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500/10">
            <span className="text-sm" aria-hidden="true">🪄</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">
              Pass-Through Pricing — We Don&apos;t Profit on Gas
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
              Every one-time fee below is exactly what it costs us to register your identity on the
              blockchain or set up your custom domain. These are <strong>pass-through costs</strong>
              — we charge what the network charges, nothing more. You can also choose to register
              these yourself directly on-chain if you prefer.
            </p>
          </div>
        </div>
      </div>

      {/* Add-on grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {addOns.map((addOn) => (
          <AddOnCardItem key={addOn.name} addOn={addOn} />
        ))}
      </div>

      {/* Callout */}
      <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-sm" aria-hidden="true">💡</span>
          <div>
            <p className="text-xs font-medium text-[var(--color-fg)]">
              Already on Premium or Creator? Protocol registration is covered.
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              Your subscription covers the initial Farcaster ($5) and Lens ($2) registration fees.
              Add-ons are only for <strong>custom handles</strong>,{' '}
              <strong>extra domains</strong>, and <strong>additional coins</strong> beyond what&apos;s
              included.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Cost Breakdown (for signup flow) =====================================

export function CostBreakdown() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
          What It Actually Costs to Register Your Identity
        </h3>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        <CostRow label="GoToSocial (Fediverse)" cost="Free" note="Auto-created" />
        <CostRow label="AT Protocol (Bluesky)" cost="Free" note="Auto-created" />
        <CostRow label="Nostr" cost="Free" note="Keypair generated" />
        <CostRow label="RSS Feed" cost="Free" note="Auto-generated" />
        <CostRow label="Farcaster Registration" cost="$5 gas" note="Covered by Premium" />
        <CostRow label="Lens Protocol Registration" cost="$2 gas" note="Covered by Premium" />
        <CostRow label="Custom Lens Handle 9+ chars (optional)" cost="Included" note="Free in all plans" />
        <CostRow label="Custom Lens Handle 7-8 chars (optional)" cost="+$5–8" note="Extra gas" />
        <CostRow label="Custom Lens Handle 5-6 chars (optional)" cost="+$15–25" note="Extra gas" />
        <CostRow label="Custom Lens Handle 3-4 chars (optional)" cost="+$50–200" note="Extra gas" />
        <CostRow label="Custom Farcaster Username (optional)" cost="$5" note="One-time, optional" />
      </div>
      <div className="border-t border-[var(--color-border)] bg-degen-500/[0.03] px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[var(--color-fg)]">Total one-time costs</span>
          <span className="font-bold text-degen-400">$0 with Premium subscription</span>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
          Premium is <strong>$10/month</strong> — and covers the $5 Farcaster + $2 Lens gas fees
          as part of your subscription. After that, it&apos;s just $10/month with no hidden costs.
        </p>
      </div>
    </div>
  );
}

function CostRow({ label, cost, note }: { label: string; cost: string; note: string }) {
  const isFree = cost === 'Free';
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="text-sm text-[var(--color-fg)]">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span
          className={`text-sm font-semibold ${
            isFree ? 'text-degen-400' : cost.includes('Covered') ? 'text-degen-400' : 'text-[var(--color-fg)]'
          }`}
        >
          {cost}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{note}</span>
      </div>
    </div>
  );
}
