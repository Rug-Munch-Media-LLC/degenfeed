'use client';

/**
 * Creator Coin Studio — 6-Step Setup Wizard (TASKS 1 & 2)
 *
 * Step 1: Coin Basics (name, symbol, description, image, tags)
 * Step 2: Economic Design (vesting preset, bonding curve preview, allocations)
 * Step 3: Anti-Exploit Configuration (sniper, whale, cooldown, bundler, MEV)
 * Step 4: Benefits & Utility (token-gated, revenue share, governance, community)
 * Step 5: Review & Deploy (summary, gas estimate, deploy buttons)
 * Step 6: DAO Setup (optional — create a DAO for this coin)
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DAOPreview from '../../../components/dao/DAOPreview';

// ─── Types ─────────────────────────────────────────────────────────────

type EcoPreset = 'fast' | 'standard' | 'trustless';

interface CoinFormState {
  // Step 1
  name: string;
  symbol: string;
  description: string;
  imagePreview: string;
  tags: string[];
  // Step 2
  ecoPreset: EcoPreset;
  treasuryAllocation: number;
  creatorAllocation: number;
  // Step 3
  antiSniper: boolean;
  antiWhale: boolean;
  cooldownPeriod: 30 | 60 | 120;
  bundlerDetection: boolean;
  mevProtection: boolean;
  // Step 4
  tokenGatedContent: boolean;
  minTokensForAccess: string;
  revenueShare: boolean;
  revenueSharePercent: number;
  governanceEnabled: boolean;
  communityAccess: boolean;
  communityLink: string;
  amaScheduling: boolean;
  // Step 5 - computed
  deployTarget: 'base' | 'solana' | 'both';
  deploying: boolean;
  deployProgress: number;
  deployed: boolean;
  deployedAddress: string;
  txHash: string;
  // Step 6 — DAO Setup (optional)
  daoEnabled: boolean;
  daoVotingModel: 'token' | 'quadratic';
  daoProposalThreshold: number;
  daoQuorumPercent: number;
  daoVotingPeriodDays: number;
  daoTimelockDelayHours: number;
  daoSingerCount: number;
  daoThreshold: number;
  daoStreamingEnabled: boolean;
  daoGrantProgramEnabled: boolean;
  daoDeploying: boolean;
  daoDeployProgress: number;
  daoDeployed: boolean;
  daoAddress: string;
  daoTxHash: string;
  daoSkipped: boolean;
}

const INITIAL_STATE: CoinFormState = {
  name: '',
  symbol: '',
  description: '',
  imagePreview: '',
  tags: [],
  ecoPreset: 'standard',
  treasuryAllocation: 5,
  creatorAllocation: 10,
  antiSniper: true,
  antiWhale: true,
  cooldownPeriod: 30,
  bundlerDetection: true,
  mevProtection: true,
  tokenGatedContent: false,
  minTokensForAccess: '1000',
  revenueShare: false,
  revenueSharePercent: 5,
  governanceEnabled: false,
  communityAccess: false,
  communityLink: '',
  amaScheduling: false,
  deployTarget: 'base',
  deploying: false,
  deployProgress: 0,
  deployed: false,
  deployedAddress: '',
  txHash: '',
  daoEnabled: false,
  daoVotingModel: 'token',
  daoProposalThreshold: 0.5,
  daoQuorumPercent: 15,
  daoVotingPeriodDays: 7,
  daoTimelockDelayHours: 24,
  daoSingerCount: 3,
  daoThreshold: 2,
  daoStreamingEnabled: false,
  daoGrantProgramEnabled: false,
  daoDeploying: false,
  daoDeployProgress: 0,
  daoDeployed: false,
  daoAddress: '',
  daoTxHash: '',
  daoSkipped: false,
};

const ECO_PRESETS: Record<
  EcoPreset,
  { label: string; description: string; initialUnlock: string; vestingPeriod: string; risk: string }
> = {
  fast: {
    label: 'FAST',
    description: '20% initial unlock, 7-day vesting — get your tokens fast',
    initialUnlock: '20%',
    vestingPeriod: '7 days',
    risk: 'Higher sell pressure risk',
  },
  standard: {
    label: 'STANDARD',
    description: '10% initial unlock, 90-day linear vesting — balanced approach',
    initialUnlock: '10%',
    vestingPeriod: '90 days',
    risk: 'Standard market risk',
  },
  trustless: {
    label: 'TRUSTLESS',
    description: '0% initial unlock, 730-day vesting — maximum trust signal',
    initialUnlock: '0%',
    vestingPeriod: '730 days (2 years)',
    risk: 'Maximizes holder confidence',
  },
};

const CATEGORY_TAGS = [
  'meme',
  'defi',
  'nft',
  'gaming',
  'social',
  'creator',
  'music',
  'art',
  'sports',
];

const BONDING_PHASES_DISPLAY = [
  { name: 'Steal Deal', range: '0-20%', color: '#00ff41', desc: 'Lowest price entry' },
  { name: 'Early Bird', range: '20-40%', color: '#22dd88', desc: 'Still early' },
  { name: 'Cruise Control', range: '40-60%', color: '#ffcc00', desc: 'Steady growth' },
  { name: 'Final Call', range: '60-80%', color: '#ff8800', desc: 'Last chance' },
  { name: 'Moonshot', range: '80-100%', color: '#ff4444', desc: 'Graduation imminent' },
];

// ─── SVG Bonding Curve Preview ─────────────────────────────────────────

function BondingCurvePreview({ className }: { className?: string }) {
  const w = 320;
  const h = 120;
  const pad = { t: 10, b: 20, l: 30, r: 10 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  // Generate sigmoid-ish curve points
  const points = Array.from({ length: 100 }, (_, i) => {
    const t = i / 99;
    const supply = t * 80; // 0-80% of graduation
    // Sigmoid-like price curve with 5 phases
    let price: number;
    if (supply < 20) {
      price = (supply / 20) ** 2.2 * 0.3;
    } else if (supply < 40) {
      price = 0.3 + ((supply - 20) / 20) ** 1.6 * 0.25;
    } else if (supply < 60) {
      price = 0.55 + ((supply - 40) / 20) * 0.15;
    } else if (supply < 80) {
      price = 0.7 + ((supply - 60) / 20) ** 1.5 * 0.15;
    } else {
      price = 0.85 + ((supply - 80) / 20) ** 2.0 * 0.15;
    }
    const x = pad.l + (supply / 80) * plotW;
    const y = h - pad.b - price * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-label="Bonding curve preview">
      {/* Background grid */}
      <line
        x1={pad.l}
        y1={h - pad.b}
        x2={w - pad.r}
        y2={h - pad.b}
        stroke="var(--color-glass-border)"
        strokeWidth="0.5"
      />
      <line
        x1={pad.l}
        y1={pad.t}
        x2={pad.l}
        y2={h - pad.b}
        stroke="var(--color-glass-border)"
        strokeWidth="0.5"
      />
      {/* Phase background bands */}
      {BONDING_PHASES_DISPLAY.map((phase, i) => {
        const x1 = pad.l + ((i * 20) / 80) * plotW;
        const x2 = pad.l + (((i + 1) * 20) / 80) * plotW;
        return (
          <rect
            key={phase.name}
            x={x1}
            y={pad.t}
            width={x2 - x1}
            height={plotH}
            fill={phase.color}
            opacity={i === 2 ? 0.12 : 0.06}
          />
        );
      })}
      {/* Curve */}
      <polyline
        fill="none"
        stroke="#00ff41"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Phase labels */}
      {BONDING_PHASES_DISPLAY.map((phase, i) => {
        const cx = pad.l + ((i * 20 + 10) / 80) * plotW;
        return (
          <text
            key={phase.name}
            x={cx}
            y={h - 4}
            textAnchor="middle"
            fill={phase.color}
            fontSize="6"
            fontFamily="monospace"
            className="opacity-60"
          >
            {phase.range}
          </text>
        );
      })}
      {/* Start/end markers */}
      <text x={pad.l} y={h - 4} textAnchor="start" fill="#888" fontSize="6" fontFamily="monospace">
        0%
      </text>
      <text
        x={w - pad.r}
        y={h - 4}
        textAnchor="end"
        fill="#888"
        fontSize="6"
        fontFamily="monospace"
      >
        100%
      </text>
      <text x={pad.l + 2} y={pad.t + 8} fill="#888" fontSize="6" fontFamily="monospace">
        Price ↗
      </text>
    </svg>
  );
}

// ─── Pie Chart Component ───────────────────────────────────────────────

function AllocationPieChart({
  treasuryPct,
  creatorPct,
}: {
  treasuryPct: number;
  creatorPct: number;
}) {
  const w = 140;
  const h = 140;
  const cx = w / 2;
  const cy = h / 2;
  const r = 55;

  const liquidityPct = 60;
  const communityPct = 100 - treasuryPct - creatorPct - liquidityPct;

  const segments = [
    { pct: liquidityPct, color: '#00ff41', label: 'Liquidity' },
    { pct: communityPct, color: '#8b5cf6', label: 'Community' },
    { pct: treasuryPct, color: '#f59e0b', label: 'Treasury' },
    { pct: creatorPct, color: '#3b82f6', label: 'Creator' },
  ].filter((s) => s.pct > 0);

  const polarToCartesian = (angle: number) => ({
    x: cx + r * Math.cos((angle - 90) * (Math.PI / 180)),
    y: cy + r * Math.sin((angle - 90) * (Math.PI / 180)),
  });

  let currentAngle = 0;
  const paths = segments.map((seg) => {
    const angle = (seg.pct / 100) * 360;
    const start = polarToCartesian(currentAngle);
    const end = polarToCartesian(currentAngle + angle);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    currentAngle += angle;
    return { ...seg, d };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {paths.map((p) => (
          <path key={p.label} d={p.d} fill={p.color} opacity="0.7" stroke="#111" strokeWidth="1" />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.35} fill="var(--color-card)" />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fill="var(--color-fg)"
          fontSize="10"
          fontWeight="bold"
          fontFamily="monospace"
        >
          100%
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="var(--color-muted)"
          fontSize="6"
          fontFamily="monospace"
        >
          Total
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[var(--color-muted)]">
              {s.label} ({s.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tooltip Component ─────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="ml-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[8px] text-[var(--color-muted)] hover:border-degen-400 hover:text-degen-400"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-10 mb-1 w-48 -translate-x-1/2 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 text-[10px] leading-tight text-[var(--color-muted)] shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Step Indicator ────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i <= current
                ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
                : 'bg-[var(--color-card)] text-[var(--color-muted)] border border-[var(--color-glass-border)]'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-px w-6 ${i < current ? 'bg-degen-500/30' : 'bg-[var(--color-glass-border)]'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Wizard Page ──────────────────────────────────────────────────

export default function CreatorStudioPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CoinFormState>(INITIAL_STATE);

  const update = <K extends keyof CoinFormState>(key: K, value: CoinFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return form.name.length >= 2 && form.symbol.length >= 2 && form.symbol.length <= 5;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, form]);

  const simulateDeploy = async () => {
    update('deploying', true);
    update('deployProgress', 0);
    const stages = [
      'Creating token contract...',
      'Configuring bonding curve...',
      'Setting up anti-exploit...',
      'Deploying to chain...',
      'Verifying deployment...',
    ];
    for (let i = 0; i < stages.length; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      update('deployProgress', ((i + 1) / stages.length) * 100);
    }
    update('deploying', false);
    update('deployed', true);
    update('deployedAddress', `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`);
    update('txHash', `0x${crypto.randomUUID().replace(/-/g, '')}`);
  };

  const totalSteps = 6;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Creator Coin Studio
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Launch your own creator coin — better than pump.fun, better than Zora. Full creator
          control, anti-exploit, bonding curve 2.0.
        </p>
      </div>

      {/* Progress */}
      <StepIndicator current={step} total={totalSteps} />

      {/* Step labels */}
      <div className="mb-6 flex justify-between text-[10px] font-medium text-[var(--color-muted)]">
        <span className={step >= 0 ? 'text-degen-400' : ''}>Basics</span>
        <span className={step >= 1 ? 'text-degen-400' : ''}>Economics</span>
        <span className={step >= 2 ? 'text-degen-400' : ''}>Protection</span>
        <span className={step >= 3 ? 'text-degen-400' : ''}>Utility</span>
        <span className={step >= 4 ? 'text-degen-400' : ''}>Review</span>
        <span className={step >= 5 ? 'text-degen-400' : ''}>DAO</span>
      </div>

      {/* ═══ Step 1: Coin Basics ═══ */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Coin Identity</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                  Coin Name *
                </span>
                <input
                  type="text"
                  placeholder='e.g. "Alice Coin"'
                  value={form.name}
                  onChange={(e) => {
                    update('name', e.target.value);
                    if (!form.symbol && e.target.value) {
                      const auto = e.target.value
                        .replace(/[^a-zA-Z0-9]/g, '')
                        .toUpperCase()
                        .slice(0, 5);
                      if (auto.length >= 2) update('symbol', auto);
                    }
                  }}
                  className="input text-sm w-full"
                  maxLength={64}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                  Symbol ($TICKER) *
                </span>
                <input
                  type="text"
                  placeholder="$TICKER"
                  value={form.symbol}
                  onChange={(e) =>
                    update(
                      'symbol',
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 5),
                    )
                  }
                  className="input text-sm w-full font-mono"
                  maxLength={5}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Description & Media</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                Bio / Description
              </span>
              <textarea
                placeholder="Tell the world about your coin..."
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className="input text-sm w-full min-h-[80px] resize-y"
                maxLength={1000}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                Profile Image
              </span>
              <div className="flex items-center gap-3">
                {form.imagePreview ? (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--color-glass-border)]">
                    <img
                      src={form.imagePreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-glass-border)] text-xl text-[var(--color-muted)]">
                    🪙
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Paste image URL or upload..."
                  value={form.imagePreview}
                  onChange={(e) => update('imagePreview', e.target.value)}
                  className="input text-sm flex-1"
                />
              </div>
            </label>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Category Tags</h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-all ${
                    form.tags.includes(tag)
                      ? 'border-degen-500/30 bg-degen-500/15 text-degen-400'
                      : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Economic Design ═══ */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Vesting Preset</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.entries(ECO_PRESETS) as [EcoPreset, (typeof ECO_PRESETS)['fast']][]).map(
                ([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update('ecoPreset', key)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      form.ecoPreset === key
                        ? 'border-degen-500/30 bg-degen-500/10'
                        : 'border-[var(--color-glass-border)] hover:border-degen-500/20'
                    }`}
                  >
                    <div className="mb-1 text-sm font-bold text-[var(--color-fg)]">
                      {preset.label}
                    </div>
                    <div className="mb-2 text-[10px] leading-snug text-[var(--color-muted)]">
                      {preset.description}
                    </div>
                    <div className="space-y-0.5 text-[9px]">
                      <span className="text-degen-400">Unlock: {preset.initialUnlock}</span>
                      <br />
                      <span className="text-[var(--color-muted)]">
                        Vesting: {preset.vestingPeriod}
                      </span>
                      <br />
                      <span className="text-amber-400">{preset.risk}</span>
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Bonding Curve Preview</h2>
              <span className="text-[10px] text-[var(--color-muted)]">
                5 phases → DEX graduation
              </span>
            </div>
            <BondingCurvePreview className="w-full max-w-sm mx-auto" />
            <div className="mt-3 grid grid-cols-5 gap-1">
              {BONDING_PHASES_DISPLAY.map((phase) => (
                <div key={phase.name} className="text-center">
                  <div
                    className="h-1 w-full rounded-full"
                    style={{ backgroundColor: phase.color }}
                  />
                  <div className="mt-1 text-[8px] font-medium text-[var(--color-muted)]">
                    {phase.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Allocation</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                    <span>Treasury Allocation</span>
                    <span className="text-degen-400">{form.treasuryAllocation}%</span>
                  </span>
                  <input
                    type="range"
                    min={5}
                    max={15}
                    step={1}
                    value={form.treasuryAllocation}
                    onChange={(e) => update('treasuryAllocation', Number(e.target.value))}
                    className="w-full accent-degen-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                    <span>Creator Allocation</span>
                    <span className="text-degen-400">{form.creatorAllocation}%</span>
                  </span>
                  <input
                    type="range"
                    min={5}
                    max={20}
                    step={1}
                    value={form.creatorAllocation}
                    onChange={(e) => update('creatorAllocation', Number(e.target.value))}
                    className="w-full accent-degen-400"
                  />
                </label>
                <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                  <div className="text-[10px] font-medium text-[var(--color-muted)]">
                    Price Estimate by Phase
                  </div>
                  <div className="mt-1 space-y-1">
                    {BONDING_PHASES_DISPLAY.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between text-[9px]">
                        <span className="text-[var(--color-muted)]">{p.name}</span>
                        <span className="font-mono text-degen-400">
                          ~${(0.001 * 2 ** i).toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <AllocationPieChart
                treasuryPct={form.treasuryAllocation}
                creatorPct={form.creatorAllocation}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Anti-Exploit Configuration ═══ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Protection Mechanisms</h2>
            <div className="space-y-4">
              {/* Anti-Sniper */}
              <label className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    Anti-Sniper Protection
                    <InfoTooltip text="Limits how many tokens can be bought in the first N blocks after launch. Prevents MEV bots from frontrunning real buyers." />
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Progressive phase limits — tighter at launch
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('antiSniper', !form.antiSniper)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    form.antiSniper ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.antiSniper}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.antiSniper ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>

              {/* Anti-Whale */}
              <label className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    Anti-Whale
                    <InfoTooltip text="Limits maximum buy size to a percentage of total supply. Prevents single whales from owning too much too fast." />
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Max buy: 1% of supply per transaction
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('antiWhale', !form.antiWhale)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    form.antiWhale ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.antiWhale}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.antiWhale ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>

              {/* Cooldown */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    Cooldown Period
                    <InfoTooltip text="Minimum time between buys from the same wallet. Prevents rapid-fire purchases that manipulate the bonding curve." />
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Wait time between buys
                  </div>
                </div>
                <div className="flex gap-1">
                  {([30, 60, 120] as const).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => update('cooldownPeriod', sec)}
                      className={`rounded-lg border px-3 py-1 text-[10px] font-medium transition-all ${
                        form.cooldownPeriod === sec
                          ? 'border-degen-500/30 bg-degen-500/15 text-degen-400'
                          : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Bundler Detection */}
              <label className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    Bundler Detection
                    <InfoTooltip text="Detects and blocks multiple buys from the same entity in the same block. Prevents bundlers from sybil-attacking the launch." />
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Max 3 buys per block per wallet group
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('bundlerDetection', !form.bundlerDetection)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    form.bundlerDetection ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.bundlerDetection}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.bundlerDetection ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>

              {/* MEV Protection */}
              <label className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    MEV Protection (Flashbots)
                    <InfoTooltip text="Routes transactions through Flashbots private mempool. Prevents sandwich attacks and frontrunning by validators/MEV bots." />
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Private mempool, sandwich-resistant
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('mevProtection', !form.mevProtection)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    form.mevProtection ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.mevProtection}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.mevProtection ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <p className="text-xs font-medium text-amber-400">
                  Security Score:{' '}
                  {form.antiSniper && form.antiWhale && form.bundlerDetection && form.mevProtection
                    ? 'MAXIMUM'
                    : 'ENHANCED'}
                </p>
                <p className="mt-0.5 text-[10px] text-amber-400/60">
                  All protections are enforced at the smart contract level. No central authority can
                  disable them after deployment.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 4: Benefits & Utility ═══ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Token Holder Benefits</h2>
            <div className="space-y-4">
              {/* Token-gated content */}
              <label className="flex items-center justify-between">
                <div>
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    <span className="mr-1.5">🔐</span> Token-Gated Content
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Holders of X $TICKER can access exclusive posts
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('tokenGatedContent', !form.tokenGatedContent)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    form.tokenGatedContent ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.tokenGatedContent}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.tokenGatedContent ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
              {form.tokenGatedContent && (
                <div className="ml-5">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-muted)]">
                      Min tokens for access:
                    </span>
                    <input
                      type="text"
                      value={form.minTokensForAccess}
                      onChange={(e) => update('minTokensForAccess', e.target.value)}
                      className="input w-24 text-[10px] font-mono"
                    />
                    <span className="text-[10px] text-[var(--color-muted)]">
                      ${form.symbol || 'TICKER'}
                    </span>
                  </label>
                </div>
              )}

              {/* Revenue share */}
              <label className="flex items-center justify-between">
                <div>
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    <span className="mr-1.5">💰</span> Revenue Share
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    X% of tips go to token holders proportionally
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('revenueShare', !form.revenueShare)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    form.revenueShare ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.revenueShare}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.revenueShare ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
              {form.revenueShare && (
                <div className="ml-5">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-muted)]">Share %:</span>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={form.revenueSharePercent}
                      onChange={(e) => update('revenueSharePercent', Number(e.target.value))}
                      className="w-24 accent-degen-400"
                    />
                    <span className="text-[10px] text-degen-400 font-mono">
                      {form.revenueSharePercent}%
                    </span>
                  </label>
                </div>
              )}

              {/* Governance */}
              <label className="flex items-center justify-between">
                <div>
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    <span className="mr-1.5">🗳️</span> Governance
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Holders vote on coin parameters (fees, allocations, etc.)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('governanceEnabled', !form.governanceEnabled)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    form.governanceEnabled ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.governanceEnabled}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.governanceEnabled ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>

              {/* Community access */}
              <label className="flex items-center justify-between">
                <div>
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    <span className="mr-1.5">💬</span> Community Access
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Holders join a private Telegram/Discord
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('communityAccess', !form.communityAccess)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    form.communityAccess ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.communityAccess}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.communityAccess ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
              {form.communityAccess && (
                <div className="ml-5">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-muted)]">Invite link:</span>
                    <input
                      type="text"
                      placeholder="https://t.me/..."
                      value={form.communityLink}
                      onChange={(e) => update('communityLink', e.target.value)}
                      className="input flex-1 text-[10px]"
                    />
                  </label>
                </div>
              )}

              {/* AMA scheduling */}
              <label className="flex items-center justify-between">
                <div>
                  <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                    <span className="mr-1.5">🎙️</span> Live AMA Scheduling
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Schedule live audio/video events for holders
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('amaScheduling', !form.amaScheduling)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    form.amaScheduling ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                  }`}
                  role="switch"
                  aria-checked={form.amaScheduling}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.amaScheduling ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 5: Review & Deploy ═══ */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Review Your Coin</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">Coin</div>
                <div className="text-sm font-bold text-[var(--color-fg)]">
                  ${form.symbol || 'TICKER'}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">
                  {form.name || 'Unnamed Coin'}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">
                  Economic Model
                </div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">
                  {ECO_PRESETS[form.ecoPreset].label}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">
                  {ECO_PRESETS[form.ecoPreset].initialUnlock} initial /{' '}
                  {ECO_PRESETS[form.ecoPreset].vestingPeriod}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">
                  Protection
                </div>
                <div className="text-xs font-semibold text-degen-400">
                  {[
                    form.antiSniper && 'Sniper',
                    form.antiWhale && 'Whale',
                    form.bundlerDetection && 'Bundler',
                    form.mevProtection && 'MEV',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'None'}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">
                  Allocation
                </div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">
                  Creator: {form.creatorAllocation}% | Treasury: {form.treasuryAllocation}%
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Deployment</h2>
            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] p-3 cursor-pointer hover:border-degen-500/30">
                <input
                  type="radio"
                  name="deployTarget"
                  checked={form.deployTarget === 'base'}
                  onChange={() => update('deployTarget', 'base')}
                  className="accent-degen-400"
                />
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    ⧫ Deploy to Base
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Ethereum L2 — low fees, Zora compatible
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] p-3 cursor-pointer hover:border-degen-500/30">
                <input
                  type="radio"
                  name="deployTarget"
                  checked={form.deployTarget === 'solana'}
                  onChange={() => update('deployTarget', 'solana')}
                  className="accent-degen-400"
                />
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    ◎ Deploy to Solana
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    High throughput, low latency
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] p-3 cursor-pointer hover:border-degen-500/30">
                <input
                  type="radio"
                  name="deployTarget"
                  checked={form.deployTarget === 'both'}
                  onChange={() => update('deployTarget', 'both')}
                  className="accent-degen-400"
                />
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    🌉 Deploy to Both (Cross-Chain)
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Solana + Base via Wormhole bridge
                  </div>
                </div>
              </label>
            </div>

            {/* Gas estimate */}
            <div className="mb-4 rounded-lg bg-[var(--color-overlay)] p-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Estimated Gas (Base)</span>
                <span className="font-mono text-[var(--color-fg)]">~0.001 ETH (~$3.50)</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Estimated Gas (Solana)</span>
                <span className="font-mono text-[var(--color-fg)]">~0.005 SOL (~$0.75)</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Token Generation Fee</span>
                <span className="font-mono text-degen-400">$20.00 USD</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-[var(--color-glass-border)] pt-1 text-[11px]">
                <span className="font-semibold text-[var(--color-fg)]">Total Estimate</span>
                <span className="font-mono font-bold text-degen-400">
                  $
                  {form.deployTarget === 'both'
                    ? '24.25'
                    : form.deployTarget === 'solana'
                      ? '20.75'
                      : '23.50'}{' '}
                  USD
                </span>
              </div>
            </div>

            {/* Deploy progress */}
            {form.deploying && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="text-[var(--color-muted)]">Deploying...</span>
                  <span className="text-degen-400">{Math.round(form.deployProgress)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500"
                    style={{ width: `${form.deployProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Deployed state */}
            {form.deployed && (
              <div className="mb-4 rounded-lg border border-degen-500/20 bg-degen-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <span className="text-sm font-bold text-degen-400">Deployed Successfully!</span>
                </div>
                <div className="space-y-1 text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-muted)]">Contract:</span>
                    <span className="text-[var(--color-fg)]">
                      {form.deployedAddress.slice(0, 20)}...{form.deployedAddress.slice(-8)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(form.deployedAddress)}
                      className="text-degen-400 hover:text-degen-300"
                    >
                      📋
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-muted)]">Tx:</span>
                    <span className="text-[var(--color-fg)]">
                      {form.txHash.slice(0, 20)}...{form.txHash.slice(-8)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Share links */}
            {form.deployed && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/creator/coins/${form.deployedAddress}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-degen-500/15 px-4 py-2 text-[11px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-all"
                >
                  🪙 View Coin Page
                </Link>
                <Link
                  href="/creator/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
                >
                  📊 Creator Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const url = `https://degenfeed.xyz/coins/${form.symbol}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
                >
                  🔗 Copy Share Link
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Step 6: DAO Setup (optional) ═══ */}
      {step === 5 && (
        <div className="space-y-5">
          {/* DAO toggle */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="mb-1 text-sm font-bold text-[var(--color-fg)]">
                  🏛️ DAO for ${form.symbol || 'TICKER'}
                </h2>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Give your coin holders the power to govern. Create a DAO with your coin as the
                  governance token.
                </p>
              </div>
              <button
                type="button"
                onClick={() => update('daoEnabled', !form.daoEnabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  form.daoEnabled ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'
                }`}
                role="switch"
                aria-checked={form.daoEnabled}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-md ${
                    form.daoEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Condensed DAO setup (only shown when enabled) */}
          {form.daoEnabled && (
            <>
              {/* Governance parameters */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                  Governance Parameters
                </h2>
                <div className="space-y-4">
                  {/* Voting model */}
                  <div>
                    <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                      Voting Model
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => update('daoVotingModel', 'token')}
                        className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                          form.daoVotingModel === 'token'
                            ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                            : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[var(--color-fg)]">
                          1 Token = 1 Vote
                        </div>
                        <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">
                          Standard weighted voting
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => update('daoVotingModel', 'quadratic')}
                        className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                          form.daoVotingModel === 'quadratic'
                            ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                            : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[var(--color-fg)]">
                          Quadratic Voting
                        </div>
                        <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">
                          Reduces whale dominance
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Threshold slider */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>Proposal Threshold</span>
                      <span className="text-degen-400">{form.daoProposalThreshold}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={form.daoProposalThreshold}
                      onChange={(e) => update('daoProposalThreshold', Number(e.target.value))}
                      className="w-full accent-degen-400"
                    />
                  </label>

                  {/* Quorum */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>Quorum</span>
                      <span className="text-degen-400">{form.daoQuorumPercent}%</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={75}
                      step={1}
                      value={form.daoQuorumPercent}
                      onChange={(e) => update('daoQuorumPercent', Number(e.target.value))}
                      className="w-full accent-degen-400"
                    />
                  </label>

                  {/* Voting period */}
                  <div>
                    <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                      Voting Period
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {([1, 3, 7, 14] as const).map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => update('daoVotingPeriodDays', days)}
                          className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${
                            form.daoVotingPeriodDays === days
                              ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                              : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
                          }`}
                        >
                          {days} day{days > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timelock */}
                  <div>
                    <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                      Timelock Delay
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 0, label: 'None' },
                        { value: 24, label: '24h' },
                        { value: 48, label: '48h' },
                        { value: 168, label: '7 days' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            update('daoTimelockDelayHours', opt.value as 0 | 24 | 48 | 168)
                          }
                          className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${
                            form.daoTimelockDelayHours === opt.value
                              ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                              : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Treasury */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                  Treasury Multi-Sig
                </h2>
                <div className="space-y-4">
                  {/* Signer count */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>Signers</span>
                      <span className="text-degen-400">{form.daoSingerCount}</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={form.daoSingerCount}
                      onChange={(e) => {
                        const count = Number(e.target.value);
                        update('daoSingerCount', count);
                        if (form.daoThreshold > count) {
                          update('daoThreshold', count);
                        }
                      }}
                      className="w-full accent-degen-400"
                    />
                  </label>

                  {/* Threshold */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>Threshold Required</span>
                      <span className="text-degen-400">
                        {form.daoThreshold} of {form.daoSingerCount}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={form.daoSingerCount}
                      step={1}
                      value={Math.min(form.daoThreshold, form.daoSingerCount)}
                      onChange={(e) => update('daoThreshold', Number(e.target.value))}
                      className="w-full accent-degen-400"
                    />
                  </label>

                  {/* Advanced features */}
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                          💧 Streaming Payments
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          Continuous payment streams
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('daoStreamingEnabled', !form.daoStreamingEnabled)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          form.daoStreamingEnabled
                            ? 'bg-degen-500'
                            : 'bg-[var(--color-glass-border)]'
                        }`}
                        role="switch"
                        aria-checked={form.daoStreamingEnabled}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            form.daoStreamingEnabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                          🏗️ Grant Program
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          Community grant proposals
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          update('daoGrantProgramEnabled', !form.daoGrantProgramEnabled)
                        }
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          form.daoGrantProgramEnabled
                            ? 'bg-degen-500'
                            : 'bg-[var(--color-glass-border)]'
                        }`}
                        role="switch"
                        aria-checked={form.daoGrantProgramEnabled}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            form.daoGrantProgramEnabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>
              </div>

              {/* DAO Preview */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">
                  Coin + DAO Preview
                </h2>
                <DAOPreview
                  state={{
                    name: `${form.name} DAO`,
                    description: `Governance DAO for ${form.name} ($${form.symbol}) token holders.`,
                    avatarUrl: form.imagePreview,
                    tags: form.tags,
                    category: form.tags[0] || 'general',
                    votingModel: form.daoVotingModel,
                    proposalThreshold: form.daoProposalThreshold,
                    quorumPercent: form.daoQuorumPercent,
                    votingPeriodDays: form.daoVotingPeriodDays,
                    timelockDelayHours: form.daoTimelockDelayHours,
                    signerCount: form.daoSingerCount,
                    threshold: Math.min(form.daoThreshold, form.daoSingerCount),
                    twitter: '',
                    discord: '',
                    telegram: '',
                    website: '',
                  }}
                  coinSymbol={form.symbol}
                  sidebar
                />
              </div>

              {/* DAO deploy progress */}
              {form.daoDeploying && (
                <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                  <div className="mb-2 flex items-center justify-between text-[10px]">
                    <span className="text-[var(--color-muted)]">Creating DAO...</span>
                    <span className="text-degen-400">{Math.round(form.daoDeployProgress)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500"
                      style={{ width: `${form.daoDeployProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* DAO deployed */}
              {form.daoDeployed && (
                <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <span className="text-sm font-bold text-degen-400">
                      DAO Created Successfully!
                    </span>
                  </div>
                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-muted)]">DAO:</span>
                      <span className="text-[var(--color-fg)]">
                        {form.daoAddress.slice(0, 20)}...{form.daoAddress.slice(-8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-muted)]">Tx:</span>
                      <span className="text-[var(--color-fg)]">
                        {form.daoTxHash.slice(0, 20)}...{form.daoTxHash.slice(-8)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* If skipped */}
          {!form.daoEnabled && (
            <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-6 text-center">
              <span className="text-3xl">🏛️</span>
              <p className="mt-2 text-sm font-medium text-[var(--color-fg)]">
                You can create a DAO later from your creator dashboard
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Your coin holders will still be able to participate in governance through other
                features.
              </p>
              <Link
                href="/dao/create"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[10px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
              >
                Go to DAO Creator →
              </Link>
            </div>
          )}

          {/* Navigation for step 6 — DAO deploy or skip */}
          {form.daoEnabled && !form.daoDeployed && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (form.daoDeploying) return;
                  update('daoDeploying', true);
                  update('daoDeployProgress', 0);
                  const stages = [
                    'Creating Snapshot space...',
                    'Deploying governance token...',
                    'Setting up treasury multi-sig...',
                    'Configuring DAO parameters...',
                    'Verifying deployment...',
                  ];
                  for (let i = 0; i < stages.length; i++) {
                    await new Promise((r) => setTimeout(r, 1000));
                    update('daoDeployProgress', ((i + 1) / stages.length) * 100);
                  }
                  update('daoDeploying', false);
                  update('daoDeployed', true);
                  update('daoAddress', `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`);
                  update('daoTxHash', `0x${crypto.randomUUID().replace(/-/g, '')}`);
                }}
                disabled={form.daoDeploying}
                className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-30 active:scale-[0.98]"
              >
                {form.daoDeploying ? 'Creating DAO...' : '🚀 Create DAO with Coin'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ Navigation Buttons ═══ */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-semibold text-[var(--color-fg)] transition-all hover:border-degen-500/30 disabled:opacity-30"
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          {/* Step 4 (Review) — Deploy coin */}
          {step === 4 && !form.deployed && (
            <button
              type="button"
              onClick={simulateDeploy}
              disabled={form.deploying}
              className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-30 active:scale-[0.98]"
            >
              {form.deploying
                ? 'Deploying...'
                : form.deployTarget === 'both'
                  ? '🚀 Deploy to Both'
                  : `🚀 Deploy to ${form.deployTarget === 'base' ? 'Base' : 'Solana'}`}
            </button>
          )}

          {/* Step 4 (Review) — After deploy, continue to DAO */}
          {step === 4 && form.deployed && (
            <button
              type="button"
              onClick={() => setStep(5)}
              className="rounded-xl bg-degen-500/15 px-5 py-2.5 text-xs font-bold text-degen-400 transition-all hover:bg-degen-500/25"
            >
              Continue → DAO Setup
            </button>
          )}

          {/* Step 5 (DAO) — Already has internal deploy, just show Done */}
          {step === 5 && (
            <Link
              href={`/dao/${form.daoAddress || form.deployedAddress}`}
              className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-[0.98]"
            >
              {form.daoDeployed ? '🏛️ View DAO' : 'Skip → Dashboard'}
            </Link>
          )}

          {/* Steps 0-3 — Continue button */}
          {step < 4 && (
            <button
              type="button"
              onClick={() => setStep(Math.min(4, step + 1))}
              disabled={!canProceed}
              className="rounded-xl bg-degen-500/15 px-5 py-2.5 text-xs font-bold text-degen-400 transition-all hover:bg-degen-500/25 disabled:opacity-30"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
