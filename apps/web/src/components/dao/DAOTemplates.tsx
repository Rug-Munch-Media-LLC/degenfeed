'use client';

/**
 * DegenFeed DAO Templates — Quick-start presets for common DAO use cases.
 *
 * Each template pre-fills the DAO creation wizard with sensible defaults
 * for governance, treasury, and feature configuration.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TemplateConfig {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  gradient: string;
  accentColor: string;
  /** Recommended governance params */
  governance: {
    votingModel: 'token' | 'quadratic';
    proposalThreshold: number; // 0-100 slider
    quorumPercent: number;
    votingPeriodDays: 1 | 3 | 7 | 14;
    timelockDelayHours: 0 | 24 | 48 | 168;
  };
  /** Recommended treasury params */
  treasury: {
    signerCount: number;
    threshold: number; // M of N
    opsPercent: number;
    grantsPercent: number;
    reservePercent: number;
    streamingEnabled: boolean;
    grantProgramEnabled: boolean;
  };
  /** Pre-selected features */
  features: string[];
}

export const DAO_TEMPLATES: TemplateConfig[] = [
  {
    id: 'creator',
    name: 'Creator DAO',
    tagline: 'Community-powered content & revenue',
    description:
      'Built for content creators, artists, and streamers. Simple governance with a community treasury for tip distribution, collab funding, and fan-driven content decisions.',
    icon: '🎨',
    gradient: 'from-violet-600/20 to-fuchsia-600/10',
    accentColor: '#8b5cf6',
    governance: {
      votingModel: 'token',
      proposalThreshold: 0.5,
      quorumPercent: 15,
      votingPeriodDays: 3,
      timelockDelayHours: 0,
    },
    treasury: {
      signerCount: 3,
      threshold: 2,
      opsPercent: 60,
      grantsPercent: 20,
      reservePercent: 20,
      streamingEnabled: true,
      grantProgramEnabled: false,
    },
    features: ['Revenue sharing', 'Content proposals', 'Tip distribution', 'Community polls'],
  },
  {
    id: 'investment',
    name: 'Investment DAO',
    tagline: 'Pool capital, vote on deals',
    description:
      'For communities that want to collectively invest in early-stage projects, NFTs, and DeFi strategies. Multi-sig treasury with investment proposal workflows.',
    icon: '📈',
    gradient: 'from-amber-600/20 to-orange-600/10',
    accentColor: '#f59e0b',
    governance: {
      votingModel: 'token',
      proposalThreshold: 1,
      quorumPercent: 20,
      votingPeriodDays: 7,
      timelockDelayHours: 48,
    },
    treasury: {
      signerCount: 5,
      threshold: 3,
      opsPercent: 30,
      grantsPercent: 10,
      reservePercent: 60,
      streamingEnabled: false,
      grantProgramEnabled: false,
    },
    features: [
      'Investment proposals',
      'LP management',
      'Multi-sig treasury',
      'Due diligence workflow',
    ],
  },
  {
    id: 'grant',
    name: 'Grant DAO',
    tagline: 'Fund builders & creators',
    description:
      'Purpose-built for funding ecosystems. Community members submit grant proposals, reviewers score submissions, and payouts happen on milestone completion.',
    icon: '🏗️',
    gradient: 'from-emerald-600/20 to-teal-600/10',
    accentColor: '#10b981',
    governance: {
      votingModel: 'quadratic',
      proposalThreshold: 0.1,
      quorumPercent: 25,
      votingPeriodDays: 7,
      timelockDelayHours: 24,
    },
    treasury: {
      signerCount: 7,
      threshold: 4,
      opsPercent: 20,
      grantsPercent: 70,
      reservePercent: 10,
      streamingEnabled: true,
      grantProgramEnabled: true,
    },
    features: ['Grant proposals', 'Milestone payouts', 'Community review', 'Streaming payments'],
  },
  {
    id: 'protocol',
    name: 'Protocol DAO',
    tagline: 'Govern parameters & upgrades',
    description:
      'For protocols and dApps that need formal on-chain governance. Timelock-secured upgrades, parameter votes, and emergency multisig for rapid response.',
    icon: '⚙️',
    gradient: 'from-cyan-600/20 to-blue-600/10',
    accentColor: '#06b6d4',
    governance: {
      votingModel: 'token',
      proposalThreshold: 1,
      quorumPercent: 30,
      votingPeriodDays: 14,
      timelockDelayHours: 168,
    },
    treasury: {
      signerCount: 7,
      threshold: 5,
      opsPercent: 40,
      grantsPercent: 30,
      reservePercent: 30,
      streamingEnabled: false,
      grantProgramEnabled: false,
    },
    features: [
      'Upgrade proposals',
      'Fee parameter votes',
      'Emergency multisig',
      'Timelock security',
    ],
  },
  {
    id: 'social',
    name: 'Social DAO',
    tagline: 'Lightweight community governance',
    description:
      'Perfect for fan clubs, social tokens, and online communities. Low barriers to participate, quick votes on events, membership, and community fund allocation.',
    icon: '🌐',
    gradient: 'from-pink-600/20 to-rose-600/10',
    accentColor: '#ec4899',
    governance: {
      votingModel: 'quadratic',
      proposalThreshold: 0.1,
      quorumPercent: 10,
      votingPeriodDays: 3,
      timelockDelayHours: 0,
    },
    treasury: {
      signerCount: 3,
      threshold: 2,
      opsPercent: 50,
      grantsPercent: 30,
      reservePercent: 20,
      streamingEnabled: false,
      grantProgramEnabled: true,
    },
    features: ['Membership voting', 'Event planning', 'Community fund', 'Grant allocations'],
  },
];

// ─── Template Card ──────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: TemplateConfig;
  selected: boolean;
  onSelect: (id: string) => void;
}

function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 ${
        selected
          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] shadow-[var(--shadow-glow)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-[var(--color-accent)]/20 hover:bg-[var(--color-card-hover)]'
      }`}
    >
      {/* Gradient background */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${template.gradient} opacity-50 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`}
      />

      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: `${template.accentColor}15` }}
          >
            {template.icon}
          </span>
          <div>
            <div className="text-sm font-bold text-[var(--color-fg)]">{template.name}</div>
            <div className="text-[10px] text-[var(--color-muted)]">{template.tagline}</div>
          </div>
          {selected && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-black">
              ✓
            </span>
          )}
        </div>

        <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-muted)]">
          {template.description}
        </p>

        {/* Feature chips */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {template.features.map((f) => (
            <span
              key={f}
              className="rounded-full border border-[var(--color-glass-border)] px-2 py-0.5 text-[9px] text-[var(--color-muted)]"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 text-[9px] text-[var(--color-muted)]">
          <span>
            Quorum:{' '}
            <span className="font-semibold text-[var(--color-fg)]">
              {template.governance.quorumPercent}%
            </span>
          </span>
          <span>
            Period:{' '}
            <span className="font-semibold text-[var(--color-fg)]">
              {template.governance.votingPeriodDays}d
            </span>
          </span>
          <span>
            Threshold:{' '}
            <span className="font-semibold text-[var(--color-fg)]">
              {template.treasury.threshold}/{template.treasury.signerCount}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface DAOTemplatesProps {
  /** Currently selected template ID (or null) */
  selectedTemplate: string | null;
  /** Called when user selects a template */
  onSelectTemplate: (template: TemplateConfig) => void;
  /** Optional compact mode for embedding in the coin wizard */
  compact?: boolean;
}

export default function DAOTemplates({
  selectedTemplate,
  onSelectTemplate,
  compact = false,
}: DAOTemplatesProps) {
  const handleSelect = (id: string) => {
    const template = DAO_TEMPLATES.find((t) => t.id === id);
    if (template) onSelectTemplate(template);
  };

  if (compact) {
    // Compact grid for embedded use
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DAO_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={selectedTemplate === t.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2
          className="text-lg font-bold text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Choose a DAO Template
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Not sure where to start? Pick a pre-built template. You can customize everything in the
          next steps.
        </p>
      </div>

      {/* Template Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DAO_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={selectedTemplate === t.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
