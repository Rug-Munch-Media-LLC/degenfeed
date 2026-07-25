'use client';

/**
 * DegenFeed DAO Creation Wizard — 4-Step Standalone DAO Creator
 *
 * Step 1: DAO Basics (name, mission, avatar, tags, social links)
 * Step 2: Governance Setup (voting token, voting model, threshold, quorum, period, timelock)
 * Step 3: Treasury Configuration (funding, signers, threshold, allocations, streams, grants)
 * Step 4: Review & Deploy (summary card, preview, gas estimate, deploy)
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DAOPreview from '../../../components/dao/DAOPreview';
import DAOTemplates, { type TemplateConfig } from '../../../components/dao/DAOTemplates';

// ─── Types ─────────────────────────────────────────────────────────────────

type VotingModel = 'token' | 'quadratic';
type VotingPeriod = 1 | 3 | 7 | 14;
type TimelockDelay = 0 | 24 | 48 | 168;

interface SignerEntry {
  address: string;
  label: string;
}

interface DAOFormState {
  // Step 1 — Basics
  name: string;
  description: string;
  avatarUrl: string;
  tags: string[];
  twitter: string;
  discord: string;
  telegram: string;
  website: string;
  // Step 2 — Governance
  votingTokenType: 'existing' | 'new';
  existingCoinId: string;
  newTokenName: string;
  newTokenSymbol: string;
  newTokenSupply: string;
  votingModel: VotingModel;
  proposalThreshold: number;
  quorumPercent: number;
  votingPeriodDays: VotingPeriod;
  timelockDelayHours: TimelockDelay;
  // Step 3 — Treasury
  initialFunding: string;
  signers: SignerEntry[];
  threshold: number;
  opsPercent: number;
  grantsPercent: number;
  reservePercent: number;
  streamingEnabled: boolean;
  grantProgramEnabled: boolean;
  // Step 4 — Deploy state
  deploying: boolean;
  deployProgress: number;
  deployed: boolean;
  deployedAddress: string;
  txHash: string;
  snapshotSpaceId: string;
  // Template
  selectedTemplate: string | null;
}

const INITIAL_STATE: DAOFormState = {
  name: '',
  description: '',
  avatarUrl: '',
  tags: [],
  twitter: '',
  discord: '',
  telegram: '',
  website: '',
  votingTokenType: 'existing',
  existingCoinId: '',
  newTokenName: '',
  newTokenSymbol: '',
  newTokenSupply: '1000000',
  votingModel: 'token',
  proposalThreshold: 1,
  quorumPercent: 15,
  votingPeriodDays: 7,
  timelockDelayHours: 24,
  initialFunding: '0.1',
  signers: [{ address: '', label: '' }],
  threshold: 1,
  opsPercent: 50,
  grantsPercent: 30,
  reservePercent: 20,
  streamingEnabled: false,
  grantProgramEnabled: false,
  deploying: false,
  deployProgress: 0,
  deployed: false,
  deployedAddress: '',
  txHash: '',
  snapshotSpaceId: '',
  selectedTemplate: null,
};

const CATEGORY_TAGS = [
  'defi',
  'nft',
  'social',
  'gaming',
  'grant',
  'investment',
  'protocol',
  'creator',
  'music',
  'art',
];

const VOTING_MODEL_DESCRIPTIONS: Record<
  VotingModel,
  { label: string; description: string; bestFor: string }
> = {
  token: {
    label: '1 Token = 1 Vote',
    description: 'Standard weighted voting. More tokens = more voting power.',
    bestFor: 'Treasury management, parameter changes, investment decisions',
  },
  quadratic: {
    label: 'Quadratic Voting',
    description: 'Voting power = sqrt(tokens). Reduces whale dominance, amplifies smaller holders.',
    bestFor: 'Community grants, content decisions, social proposals',
  },
};

const TIMELOCK_OPTIONS: { value: TimelockDelay; label: string }[] = [
  { value: 0, label: 'No timelock' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 168, label: '7 days' },
];

const VOTING_PERIOD_OPTIONS: { value: VotingPeriod; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
];

// Mock user creator coins
const MOCK_USER_COINS: { id: string; name: string; symbol: string; balance: string }[] = [
  { id: '0x1234...abcd', name: 'Alice Coin', symbol: 'ALICE', balance: '1000000' },
  { id: '0x5678...ef01', name: 'Bob Token', symbol: 'BOB', balance: '500000' },
  { id: '0x9012...3456', name: 'Creator Fund', symbol: 'CFND', balance: '2000000' },
];

// ─── Misc Components ───────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="ml-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[8px] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-10 mb-1 w-52 -translate-x-1/2 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 text-[10px] leading-tight text-[var(--color-muted)] shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

function TagChip({
  tag,
  selected,
  onClick,
}: {
  tag: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-all ${
        selected
          ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/20 hover:text-[var(--color-fg)]'
      }`}
    >
      {tag}
    </button>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = ['Basics', 'Governance', 'Treasury', 'Review'];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i <= current
                  ? 'border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'border border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-muted)]'
              }`}
              aria-current={i === current ? 'step' : undefined}
            >
              {i < current ? '✓' : i + 1}
            </div>
            {i < total - 1 && (
              <div
                className={`h-px w-8 sm:w-12 ${
                  i < current ? 'bg-[var(--color-accent)]/30' : 'bg-[var(--color-glass-border)]'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      {/* Step labels */}
      <div className="mt-2 flex justify-between text-[10px] font-medium text-[var(--color-muted)]">
        {steps.map((label, i) => (
          <span key={label} className={i <= current ? 'text-[var(--color-accent)]' : ''}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GasMeter({ gas }: { gas: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-muted)]">Estimated Gas</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-accent)]">{gas}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
        <div
          className="h-full w-3/4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)]"
          style={{ width: '40%' }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[8px] text-[var(--color-muted)]">
        <span>~$12-25 USD</span>
        <span>varies by network</span>
      </div>
    </div>
  );
}

function SignerInputRow({
  index,
  entry,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  entry: SignerEntry;
  onChange: (entry: SignerEntry) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-[10px] font-mono text-[var(--color-muted)]">#{index + 1}</span>
      <div className="flex flex-1 gap-2">
        <input
          type="text"
          placeholder="0x..."
          value={entry.address}
          onChange={(e) => onChange({ ...entry, address: e.target.value })}
          className="input flex-[3] text-[11px] font-mono"
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={entry.label}
          onChange={(e) => onChange({ ...entry, label: e.target.value })}
          className="input flex-[2] text-[11px]"
        />
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-[10px] text-[var(--color-muted)] hover:border-red-500/30 hover:text-red-400"
          aria-label="Remove signer"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function CreateDAOPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DAOFormState>(INITIAL_STATE);

  const update = <K extends keyof DAOFormState>(key: K, value: DAOFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const handleTemplateSelect = (template: TemplateConfig) => {
    update('selectedTemplate', template.id);
    update('name', template.name);
    update('description', template.description);
    update('votingModel', template.governance.votingModel);
    update('proposalThreshold', template.governance.proposalThreshold);
    update('quorumPercent', template.governance.quorumPercent);
    update('votingPeriodDays', template.governance.votingPeriodDays);
    update('timelockDelayHours', template.governance.timelockDelayHours);
    update('threshold', Math.min(template.treasury.threshold, template.treasury.signerCount));
    update('opsPercent', template.treasury.opsPercent);
    update('grantsPercent', template.treasury.grantsPercent);
    update('reservePercent', template.treasury.reservePercent);
    update('streamingEnabled', template.treasury.streamingEnabled);
    update('grantProgramEnabled', template.treasury.grantProgramEnabled);

    // Update signers count
    const newSigners = Array.from(
      { length: Math.max(template.treasury.signerCount, 1) },
      (_, i) => form.signers[i] || { address: '', label: '' },
    );
    update('signers', newSigners);
    update('threshold', template.treasury.threshold);
  };

  const addSigner = () => {
    if (form.signers.length >= 10) return;
    setForm((prev) => ({
      ...prev,
      signers: [...prev.signers, { address: '', label: '' }],
    }));
  };

  const updateSigner = (index: number, entry: SignerEntry) => {
    setForm((prev) => {
      const signers = [...prev.signers];
      signers[index] = entry;
      return { ...prev, signers };
    });
  };

  const removeSigner = (index: number) => {
    setForm((prev) => ({
      ...prev,
      signers: prev.signers.filter((_, i) => i !== index),
      threshold: Math.min(prev.threshold, prev.signers.length - 1),
    }));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return form.name.length >= 2;
      case 1:
        return true;
      case 2:
        return form.signers.some((s) => s.address.length >= 10);
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, form]);

  const simulateDeploy = async () => {
    update('deploying', true);
    update('deployProgress', 0);
    const stages = [
      'Creating Snapshot space...',
      'Deploying governance token...',
      'Setting up treasury multi-sig...',
      'Configuring voting parameters...',
      'Deploying DAO contracts...',
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
    update('snapshotSpaceId', `${form.name.toLowerCase().replace(/\s+/g, '-')}.eth`);
  };

  const totalSteps = 4;

  // ─── Preview State ──────────────────────────────────────────────────────

  const previewState = useMemo(
    () => ({
      name: form.name,
      description: form.description,
      avatarUrl: form.avatarUrl,
      tags: form.tags,
      category: form.tags[0] || 'general',
      votingModel: form.votingModel,
      proposalThreshold: form.proposalThreshold,
      quorumPercent: form.quorumPercent,
      votingPeriodDays: form.votingPeriodDays,
      timelockDelayHours: form.timelockDelayHours,
      signerCount: form.signers.length,
      threshold: Math.min(form.threshold, form.signers.length),
      twitter: form.twitter,
      discord: form.discord,
      telegram: form.telegram,
      website: form.website,
    }),
    [form],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dao"
          className="mb-2 inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          ← Back to DAOs
        </Link>
        <h1
          className="text-2xl font-bold text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Create a DAO
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Launch a decentralized autonomous organization on Base or Solana. Set up governance,
          treasury, and invite your community.
        </p>
      </div>

      {/* Progress */}
      <StepIndicator current={step} total={totalSteps} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ═══ Main Content ═══ */}
        <div>
          {/* ── Step 0: Template Selection ── */}
          {step === 0 && (
            <div className="space-y-5">
              <DAOTemplates
                selectedTemplate={form.selectedTemplate}
                onSelectTemplate={handleTemplateSelect}
                compact={false}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--color-glass-border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[var(--color-bg)] px-2 text-[10px] text-[var(--color-muted)]">
                    OR customize from scratch
                  </span>
                </div>
              </div>

              {/* ── Step 1: DAO Basics ── */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">DAO Identity</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                      DAO Name *
                    </span>
                    <input
                      type="text"
                      placeholder='e.g. "Degen Capital DAO"'
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      className="input text-sm w-full"
                      maxLength={64}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                      Mission Statement / Description
                    </span>
                    <textarea
                      placeholder="What does your DAO do? Who should join?"
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      className="input text-sm w-full min-h-[80px] resize-y"
                      maxLength={2000}
                    />
                    <span className="mt-0.5 block text-right text-[9px] text-[var(--color-muted)]">
                      {form.description.length}/2000
                    </span>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                      DAO Avatar
                    </span>
                    <div className="flex items-center gap-3">
                      {form.avatarUrl ? (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-glass-border)]">
                          <img
                            src={form.avatarUrl}
                            alt="DAO avatar preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[var(--color-glass-border)] text-xl text-[var(--color-muted)]">
                          🏛️
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="Paste image URL..."
                        value={form.avatarUrl}
                        onChange={(e) => update('avatarUrl', e.target.value)}
                        className="input text-sm flex-1"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Tags */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Category Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_TAGS.map((tag) => (
                    <TagChip
                      key={tag}
                      tag={tag}
                      selected={form.tags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    />
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Social Links</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                      𝕏 Twitter
                    </span>
                    <input
                      type="text"
                      placeholder="https://twitter.com/..."
                      value={form.twitter}
                      onChange={(e) => update('twitter', e.target.value)}
                      className="input text-sm w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                      💬 Discord
                    </span>
                    <input
                      type="text"
                      placeholder="https://discord.gg/..."
                      value={form.discord}
                      onChange={(e) => update('discord', e.target.value)}
                      className="input text-sm w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                      ✈️ Telegram
                    </span>
                    <input
                      type="text"
                      placeholder="https://t.me/..."
                      value={form.telegram}
                      onChange={(e) => update('telegram', e.target.value)}
                      className="input text-sm w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                      🌐 Website
                    </span>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={form.website}
                      onChange={(e) => update('website', e.target.value)}
                      className="input text-sm w-full"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Governance Setup ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Voting Token */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Voting Token</h2>
                <div className="space-y-4">
                  {/* Token type selector */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => update('votingTokenType', 'existing')}
                      className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                        form.votingTokenType === 'existing'
                          ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]'
                          : 'border-[var(--color-glass-border)] hover:border-[var(--color-accent)]/20'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        Use my creator coin
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                        Existing token becomes governance token
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => update('votingTokenType', 'new')}
                      className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                        form.votingTokenType === 'new'
                          ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]'
                          : 'border-[var(--color-glass-border)] hover:border-[var(--color-accent)]/20'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        Create new governance token
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                        Deploy a dedicated ERC-20 for voting
                      </div>
                    </button>
                  </div>

                  {/* Existing coin selector */}
                  {form.votingTokenType === 'existing' && (
                    <div className="rounded-lg border border-[var(--color-glass-border)] p-3">
                      <span className="mb-2 block text-[10px] font-medium text-[var(--color-muted)]">
                        Select your creator coin
                      </span>
                      <div className="space-y-1.5">
                        {MOCK_USER_COINS.map((coin) => (
                          <label
                            key={coin.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-all ${
                              form.existingCoinId === coin.id
                                ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]'
                                : 'border-transparent hover:bg-[var(--color-overlay)]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="existingCoin"
                              checked={form.existingCoinId === coin.id}
                              onChange={() => update('existingCoinId', coin.id)}
                              className="accent-[var(--color-accent)]"
                            />
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[10px] font-bold text-[var(--color-accent)]">
                              ₿
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[var(--color-fg)]">
                                {coin.name}
                              </div>
                              <div className="text-[9px] text-[var(--color-muted)]">
                                ${coin.symbol} — {Number(coin.balance).toLocaleString()} supply
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-[9px] text-[var(--color-muted)]">
                        Don&apos;t have a coin?{' '}
                        <Link
                          href="/creator/studio"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          Create one
                        </Link>
                      </p>
                    </div>
                  )}

                  {/* New token config */}
                  {form.votingTokenType === 'new' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                          Token Name
                        </span>
                        <input
                          type="text"
                          placeholder="Governance Token"
                          value={form.newTokenName}
                          onChange={(e) => update('newTokenName', e.target.value)}
                          className="input text-sm w-full"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                          Symbol
                        </span>
                        <input
                          type="text"
                          placeholder="GOV"
                          value={form.newTokenSymbol}
                          onChange={(e) =>
                            update(
                              'newTokenSymbol',
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
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                          Initial Supply
                        </span>
                        <input
                          type="text"
                          value={form.newTokenSupply}
                          onChange={(e) =>
                            update('newTokenSupply', e.target.value.replace(/[^0-9]/g, ''))
                          }
                          className="input text-sm w-full font-mono"
                        />
                        <div className="mt-1 text-[9px] text-[var(--color-muted)]">
                          Distribution: 60% treasury · 20% community · 10% team · 10% reserve
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Voting Model */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Voting Model</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    Object.entries(VOTING_MODEL_DESCRIPTIONS) as [
                      VotingModel,
                      (typeof VOTING_MODEL_DESCRIPTIONS)['token'],
                    ][]
                  ).map(([key, info]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update('votingModel', key)}
                      className={`rounded-lg border p-4 text-left transition-all ${
                        form.votingModel === key
                          ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]'
                          : 'border-[var(--color-glass-border)] hover:border-[var(--color-accent)]/20'
                      }`}
                    >
                      <div className="mb-1 text-sm font-bold text-[var(--color-fg)]">
                        {info.label}
                      </div>
                      <p className="mb-2 text-[10px] leading-snug text-[var(--color-muted)]">
                        {info.description}
                      </p>
                      <span className="text-[9px] text-[var(--color-accent)]">
                        Best for: {info.bestFor}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Preview difference */}
                <div className="mt-4 rounded-lg border border-dashed border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
                  <div className="mb-2 text-[10px] font-medium text-[var(--color-muted)]">
                    How voting power works:
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded bg-[var(--color-bg-tertiary)] p-2">
                      <div className="text-[9px] font-semibold text-[var(--color-fg)]">
                        Whale: 100,000 tokens
                      </div>
                      <div className="text-[8px] text-[var(--color-muted)]">
                        1:1 → 100,000 votes · Quadratic → 316 votes
                      </div>
                    </div>
                    <div className="rounded bg-[var(--color-bg-tertiary)] p-2">
                      <div className="text-[9px] font-semibold text-[var(--color-fg)]">
                        Regular: 1,000 tokens
                      </div>
                      <div className="text-[8px] text-[var(--color-muted)]">
                        1:1 → 1,000 votes · Quadratic → 31 votes
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thresholds */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                  Proposal Parameters
                </h2>
                <div className="space-y-5">
                  {/* Proposal threshold */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>
                        Proposal Threshold
                        <InfoTooltip text="Minimum % of total token supply a proposer must hold to create a proposal." />
                      </span>
                      <span className="text-[var(--color-accent)]">{form.proposalThreshold}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={form.proposalThreshold}
                      onChange={(e) => update('proposalThreshold', Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                    <div className="mt-1 flex justify-between text-[9px] text-[var(--color-muted)]">
                      <span>Any holder can propose</span>
                      <span>5% of supply required</span>
                    </div>
                  </label>

                  {/* Quorum */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>
                        Quorum
                        <InfoTooltip text="Minimum % of total supply that must vote for a proposal to be valid." />
                      </span>
                      <span className="text-[var(--color-accent)]">{form.quorumPercent}%</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={75}
                      step={1}
                      value={form.quorumPercent}
                      onChange={(e) => update('quorumPercent', Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                    <div className="mt-1 flex justify-between text-[9px] text-[var(--color-muted)]">
                      <span>Low: 1%</span>
                      <span>High: 75%</span>
                    </div>
                  </label>

                  {/* Voting period */}
                  <div>
                    <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                      Voting Period
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {VOTING_PERIOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => update('votingPeriodDays', opt.value)}
                          className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${
                            form.votingPeriodDays === opt.value
                              ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                              : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timelock */}
                  <div>
                    <span className="mb-2 flex items-center text-xs font-medium text-[var(--color-fg)]">
                      Timelock Delay
                      <InfoTooltip text="After a vote passes, how long before the proposal can be executed. Longer delays give users time to exit if they disagree." />
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {TIMELOCK_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => update('timelockDelayHours', opt.value)}
                          className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${
                            form.timelockDelayHours === opt.value
                              ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                              : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Treasury Configuration ── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Funding & Signers */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                  Treasury Multi-Sig
                </h2>
                <div className="space-y-4">
                  {/* Initial funding */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                      Initial Treasury Funding (ETH/SOL)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={form.initialFunding}
                        onChange={(e) =>
                          update('initialFunding', e.target.value.replace(/[^0-9.]/g, ''))
                        }
                        className="input text-sm w-32 font-mono"
                      />
                      <span className="text-[10px] text-[var(--color-muted)]">
                        ETH (Base) or SOL (Solana)
                      </span>
                    </div>
                  </label>

                  {/* Signers */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--color-fg)]">
                        Signers
                        <InfoTooltip text="Wallet addresses that can sign treasury transactions. Add at least 1, max 10." />
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {form.signers.length}/10
                      </span>
                    </div>
                    <div className="space-y-2">
                      {form.signers.map((entry, i) => (
                        <SignerInputRow
                          key={i}
                          index={i}
                          entry={entry}
                          onChange={(e) => updateSigner(i, e)}
                          onRemove={() => removeSigner(i)}
                          canRemove={form.signers.length > 1}
                        />
                      ))}
                    </div>
                    {form.signers.length < 10 && (
                      <button
                        type="button"
                        onClick={addSigner}
                        className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        + Add signer
                      </button>
                    )}
                  </div>

                  {/* M of N threshold */}
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                      <span>Threshold Required</span>
                      <span className="text-[var(--color-accent)]">
                        {Math.min(form.threshold, form.signers.length)} of{' '}
                        {form.signers.length || 1}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={Math.max(form.signers.length, 1)}
                      step={1}
                      value={Math.min(form.threshold, form.signers.length)}
                      onChange={(e) => update('threshold', Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </label>
                </div>
              </div>

              {/* Treasury Allocation */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                  Treasury Allocation
                </h2>
                <p className="mb-4 text-[10px] text-[var(--color-muted)]">
                  How treasury funds are distributed across categories.
                </p>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-fg)]">
                      <span>⚙️ Operations</span>
                      <span className="text-[var(--color-accent)]">{form.opsPercent}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={form.opsPercent}
                      onChange={(e) => update('opsPercent', Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-fg)]">
                      <span>🏗️ Grants</span>
                      <span className="text-[var(--color-accent)]">{form.grantsPercent}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={form.grantsPercent}
                      onChange={(e) => update('grantsPercent', Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-fg)]">
                      <span>🏦 Reserve</span>
                      <span className="text-[var(--color-accent)]">{form.reservePercent}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={form.reservePercent}
                      onChange={(e) => update('reservePercent', Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </label>

                  {/* Allocation pie */}
                  <div className="flex items-center justify-center gap-6 rounded-lg bg-[var(--color-overlay)] p-3">
                    <AllocationBar
                      ops={form.opsPercent}
                      grants={form.grantsPercent}
                      reserve={form.reservePercent}
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Advanced Features</h2>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                        💧 Streaming Payments
                        <InfoTooltip text="Enable Superfluid-like continuous payment streams for grants, salaries, and subscriptions." />
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        Real-time payment streaming, pause/resume
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update('streamingEnabled', !form.streamingEnabled)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                        form.streamingEnabled
                          ? 'bg-[var(--color-accent)]'
                          : 'bg-[var(--color-glass-border)]'
                      }`}
                      role="switch"
                      aria-checked={form.streamingEnabled}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          form.streamingEnabled ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                  </label>

                  <label className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                        🏗️ Grant Program
                        <InfoTooltip text="Allow community members to submit grant proposals with milestone-based payouts." />
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        Milestone payouts, community review
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update('grantProgramEnabled', !form.grantProgramEnabled)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                        form.grantProgramEnabled
                          ? 'bg-[var(--color-accent)]'
                          : 'bg-[var(--color-glass-border)]'
                      }`}
                      role="switch"
                      aria-checked={form.grantProgramEnabled}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          form.grantProgramEnabled ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Deploy ── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Review Your DAO</h2>

                {/* Summary Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                    <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">
                      DAO Name
                    </div>
                    <div className="text-sm font-bold text-[var(--color-fg)]">
                      {form.name || 'Unnamed DAO'}
                    </div>
                    {form.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {form.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-[var(--color-glass-border)] px-1.5 py-0.5 text-[8px] text-[var(--color-muted)]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                    <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">
                      Voting Model
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      {form.votingModel === 'quadratic' ? 'Quadratic Voting' : '1 Token = 1 Vote'}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]">
                      {form.quorumPercent}% quorum · {form.votingPeriodDays}d period
                      {form.timelockDelayHours > 0 ? ` · ${form.timelockDelayHours}h timelock` : ''}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                    <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">
                      Treasury
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      {Math.min(form.threshold, form.signers.length)} of {form.signers.length}{' '}
                      multi-sig
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]">
                      {form.streamingEnabled ? 'Streaming ✓ · ' : ''}
                      {form.grantProgramEnabled ? 'Grants ✓' : ''}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-overlay)] p-3">
                    <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">
                      Token
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      {form.votingTokenType === 'existing'
                        ? MOCK_USER_COINS.find((c) => c.id === form.existingCoinId)?.symbol ||
                          'Existing coin'
                        : form.newTokenSymbol || 'New token'}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]">
                      {form.votingTokenType === 'new'
                        ? `${Number(form.newTokenSupply).toLocaleString()} supply`
                        : 'Existing supply'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Gas */}
              <GasMeter gas="~0.002 ETH / ~0.01 SOL" />

              {/* Deploy progress */}
              {form.deploying && (
                <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
                  <div className="mb-2 flex items-center justify-between text-[10px]">
                    <span className="text-[var(--color-muted)]">Deploying DAO...</span>
                    <span className="text-[var(--color-accent)]">
                      {Math.round(form.deployProgress)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)] transition-all duration-500"
                      style={{ width: `${form.deployProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Deployed success state */}
              {form.deployed && (
                <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <span className="text-sm font-bold text-[var(--color-accent)]">
                      DAO Deployed Successfully!
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-muted)]">DAO Address:</span>
                      <span className="text-[var(--color-fg)]">
                        {form.deployedAddress.slice(0, 20)}...
                        {form.deployedAddress.slice(-8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(form.deployedAddress)}
                        className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80"
                        aria-label="Copy DAO address"
                      >
                        📋
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-muted)]">Snapshot Space:</span>
                      <span className="text-[var(--color-fg)]">{form.snapshotSpaceId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-muted)]">Tx:</span>
                      <span className="text-[var(--color-fg)]">
                        {form.txHash.slice(0, 20)}...
                        {form.txHash.slice(-8)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Share links */}
              {form.deployed && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dao/${form.deployedAddress}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-all"
                  >
                    🏛️ View DAO Page
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `https://degenfeed.xyz/dao/${form.name.toLowerCase().replace(/\s+/g, '-')}`;
                      navigator.clipboard.writeText(url);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-[var(--color-accent)]/30 transition-all"
                  >
                    🔗 Copy Share Link
                  </button>
                  {form.votingTokenType === 'new' && (
                    <Link
                      href="/creator/studio"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-[var(--color-accent)]/30 transition-all"
                    >
                      🪙 Add to Creator Coin
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ Sidebar — Live Preview ═══ */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <DAOPreview state={previewState} sidebar />
          </div>
        </div>
      </div>

      {/* ═══ Navigation Buttons ═══ */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-semibold text-[var(--color-fg)] transition-all hover:border-[var(--color-accent)]/30 disabled:opacity-30"
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setStep(Math.min(totalSteps - 1, step + 1))}
              disabled={!canProceed}
              className="rounded-xl bg-[var(--color-accent-soft)] px-5 py-2.5 text-xs font-bold text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent)]/25 disabled:opacity-30"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={simulateDeploy}
              disabled={form.deploying || form.deployed}
              className="rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)] px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-[var(--color-accent)] hover:to-[var(--color-accent-secondary)] disabled:opacity-30 active:scale-[0.98]"
            >
              {form.deploying ? 'Deploying...' : form.deployed ? 'Deployed ✓' : '🚀 Deploy DAO'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Allocation Bar ─────────────────────────────────────────────────────────

function AllocationBar({ ops, grants, reserve }: { ops: number; grants: number; reserve: number }) {
  const total = ops + grants + reserve;
  const opsW = total > 0 ? (ops / total) * 100 : 0;
  const grantsW = total > 0 ? (grants / total) * 100 : 0;
  const reserveW = total > 0 ? (reserve / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="mb-2 flex h-6 overflow-hidden rounded-lg">
        <div
          className="flex items-center justify-center text-[8px] font-bold text-black transition-all"
          style={{ width: `${opsW}%`, backgroundColor: '#06b6d4' }}
          title={`Operations: ${ops}%`}
        >
          {opsW > 15 ? 'Ops' : ''}
        </div>
        <div
          className="flex items-center justify-center text-[8px] font-bold text-black transition-all"
          style={{ width: `${grantsW}%`, backgroundColor: '#10b981' }}
          title={`Grants: ${grants}%`}
        >
          {grantsW > 15 ? 'Grants' : ''}
        </div>
        <div
          className="flex items-center justify-center text-[8px] font-bold text-black transition-all"
          style={{ width: `${reserveW}%`, backgroundColor: '#8b5cf6' }}
          title={`Reserve: ${reserve}%`}
        >
          {reserveW > 15 ? 'Reserve' : ''}
        </div>
      </div>
      <div className="flex justify-center gap-4 text-[9px]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
          <span className="text-[var(--color-muted)]">Ops {ops}%</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
          <span className="text-[var(--color-muted)]">Grants {grants}%</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
          <span className="text-[var(--color-muted)]">Reserve {reserve}%</span>
        </span>
      </div>
    </div>
  );
}
