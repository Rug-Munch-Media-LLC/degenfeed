'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

type ProposalType = 'standard' | 'treasury' | 'constitutional' | 'signaling';

interface Milestone {
  id: string;
  description: string;
  amount: string;
  token: string;
}

interface ConstitutionalParam {
  key: string;
  label: string;
  currentValue: string;
  description: string;
  unit: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

const PROPOSAL_TYPES: { value: ProposalType; label: string; description: string; icon: string }[] =
  [
    {
      value: 'standard',
      label: 'Standard',
      description: 'Simple majority vote for general decisions',
      icon: '📋',
    },
    {
      value: 'treasury',
      label: 'Treasury',
      description: 'Spending proposal with amount and recipient',
      icon: '💰',
    },
    {
      value: 'constitutional',
      label: 'Constitutional',
      description: 'Parameter changes to DAO governance',
      icon: '⚖️',
    },
    {
      value: 'signaling',
      label: 'Signaling',
      description: 'Non-binding temperature check',
      icon: '📡',
    },
  ];

const CONSTITUTIONAL_PARAMS: ConstitutionalParam[] = [
  {
    key: 'quorum',
    label: 'Quorum Threshold',
    currentValue: '10%',
    description: 'Minimum voting power required for a valid vote',
    unit: '%',
  },
  {
    key: 'threshold',
    label: 'Approval Threshold',
    currentValue: '60%',
    description: 'Percentage of FOR votes required to pass',
    unit: '%',
  },
  {
    key: 'votingPeriod',
    label: 'Voting Period',
    currentValue: '7 days',
    description: 'Duration of the voting window',
    unit: 'days',
  },
  {
    key: 'timelock',
    label: 'Timelock Duration',
    currentValue: '48 hours',
    description: 'Delay before execution after passing',
    unit: 'hours',
  },
  {
    key: 'delegation',
    label: 'Delegation Enabled',
    currentValue: 'Yes',
    description: 'Allow voting power delegation',
    unit: '',
  },
];

const MOCK_TOKENS = ['ETH', 'USDC', 'DEGEN', 'SOL', 'ARB', 'OP'];

// ─── Milestone Editor ──────────────────────────────────────────────────

function MilestoneEditor({
  milestones,
  onChange,
}: {
  milestones: Milestone[];
  onChange: (ms: Milestone[]) => void;
}) {
  const addMilestone = () => {
    const newMs: Milestone = {
      id: crypto.randomUUID?.() || String(Date.now()),
      description: '',
      amount: '',
      token: 'USDC',
    };
    onChange([...milestones, newMs]);
  };

  const removeMilestone = (id: string) => {
    onChange(milestones.filter((m) => m.id !== id));
  };

  const updateMilestone = (id: string, field: keyof Milestone, value: string) => {
    onChange(milestones.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-fg)]">Milestones</span>
        <button
          type="button"
          onClick={addMilestone}
          className="rounded-lg bg-degen-500/15 px-2.5 py-1 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-colors"
        >
          + Add Milestone
        </button>
      </div>

      {milestones.length === 0 && (
        <p className="text-[10px] text-[var(--color-muted)]">
          No milestones added. Add at least one milestone to proceed.
        </p>
      )}

      {milestones.map((ms, i) => (
        <div
          key={ms.id}
          className="relative rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
              Milestone {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeMilestone(ms.id)}
              className="text-[9px] text-red-400 hover:text-red-300 transition-colors"
            >
              Remove
            </button>
          </div>

          <div className="mb-2">
            <label className="mb-1 block text-[9px] text-[var(--color-muted)]">Description</label>
            <input
              type="text"
              value={ms.description}
              onChange={(e) => updateMilestone(ms.id, 'description', e.target.value)}
              placeholder="What gets delivered at this milestone?"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[9px] text-[var(--color-muted)]">Amount</label>
              <input
                type="text"
                value={ms.amount}
                onChange={(e) => updateMilestone(ms.id, 'amount', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors font-mono"
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-[9px] text-[var(--color-muted)]">Token</label>
              <select
                value={ms.token}
                onChange={(e) => updateMilestone(ms.id, 'token', e.target.value)}
                className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
              >
                {MOCK_TOKENS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE — Proposal Creation
// ══════════════════════════════════════════════════════════════════════

export default function CreateProposalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [step, setStep] = useState<'type' | 'content' | 'preview'>('type');

  // Form state
  const [proposalType, setProposalType] = useState<ProposalType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discussionLink, setDiscussionLink] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  // Treasury-specific
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [paymentType, setPaymentType] = useState<'one-time' | 'streaming' | 'milestone'>(
    'one-time',
  );
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Constitutional-specific
  const [selectedParam, setSelectedParam] = useState<ConstitutionalParam | null>(null);
  const [newValue, setNewValue] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proposalId, setProposalId] = useState('');

  // ─── Select type ──────────────────────────────────────────────────

  if (step === 'type') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 animate-page-enter">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
            DAO
          </Link>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className="text-[var(--color-fg)]">Create Proposal</span>
        </div>

        <h1
          className="mb-2 text-[28px] font-black text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          New Proposal
        </h1>
        <p className="mb-8 text-sm text-[var(--color-muted)]">
          Choose the type of proposal you want to create.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {PROPOSAL_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => {
                setProposalType(pt.value);
                setStep('content');
              }}
              className="group relative overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 text-left transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.04)]"
            >
              <div className="mb-3 text-3xl">{pt.icon}</div>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
                {pt.label}
              </h3>
              <p className="text-[11px] text-[var(--color-muted)]">{pt.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Content builder ──────────────────────────────────────────────

  if (step === 'content') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 animate-page-enter">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
            DAO
          </Link>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <Link
            href={`/dao/${params.id}/proposals/create`}
            className="hover:text-degen-400 transition-colors"
          >
            Create
          </Link>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className="text-[var(--color-fg)]">Content</span>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-black text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {PROPOSAL_TYPES.find((t) => t.value === proposalType)?.icon}{' '}
              {PROPOSAL_TYPES.find((t) => t.value === proposalType)?.label} Proposal
            </h1>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Fill in the details of your proposal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep('type')}
            className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ← Change Type
          </button>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label
              htmlFor="prop-title"
              className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
            >
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="prop-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DIP-13: Fund Community Development Program"
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="prop-desc"
              className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
            >
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="prop-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal in detail. Markdown is supported."
              rows={8}
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors resize-y"
            />
            <p className="mt-1 text-[9px] text-[var(--color-muted)]">
              Supports Markdown formatting: **bold**, *italic*, `code`, [links](url), lists, and
              headings.
            </p>
          </div>

          {/* Discussion Link */}
          <div>
            <label
              htmlFor="prop-discuss"
              className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
            >
              Discussion Link
            </label>
            <input
              id="prop-discuss"
              type="url"
              value={discussionLink}
              onChange={(e) => setDiscussionLink(e.target.value)}
              placeholder="https://forum.degenfeed.xyz/t/proposal-discussion"
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors font-mono"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">
              Attachments
            </label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1.5"
                >
                  <span className="text-[10px] text-[var(--color-fg)]">{att}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                    className="text-[9px] text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const name = prompt('Enter file name (e.g., proposal-v2.pdf):');
                  if (name) setAttachments([...attachments, name]);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--color-glass-border)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Add File
              </button>
            </div>
          </div>

          {/* ─── Treasury-specific fields ─── */}
          {proposalType === 'treasury' && (
            <div className="rounded-xl border border-degen-500/10 bg-degen-500/5 p-5 space-y-4">
              <h3 className="text-xs font-bold text-degen-400">💰 Treasury Proposal Details</h3>

              <div>
                <label
                  htmlFor="recipient"
                  className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
                >
                  Recipient Address <span className="text-red-400">*</span>
                </label>
                <input
                  id="recipient"
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x... or ens.eth"
                  className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-mono text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="amount"
                    className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
                  >
                    Amount <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="amount"
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-mono text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors"
                  />
                </div>
                <div className="w-28">
                  <label
                    htmlFor="token"
                    className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
                  >
                    Token
                  </label>
                  <select
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                  >
                    {MOCK_TOKENS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">
                  Payment Type
                </label>
                <div className="flex gap-2">
                  {(['one-time', 'streaming', 'milestone'] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPaymentType(pt)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[10px] font-medium transition-all ${
                        paymentType === pt
                          ? 'border-degen-500/30 bg-degen-500/15 text-degen-400'
                          : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                      }`}
                    >
                      {pt === 'one-time'
                        ? 'One-Time'
                        : pt === 'streaming'
                          ? 'Streaming'
                          : 'Milestone'}
                    </button>
                  ))}
                </div>
              </div>

              {paymentType === 'milestone' && (
                <MilestoneEditor milestones={milestones} onChange={setMilestones} />
              )}
            </div>
          )}

          {/* ─── Constitutional-specific fields ─── */}
          {proposalType === 'constitutional' && (
            <div className="rounded-xl border border-purple-500/10 bg-purple-500/5 p-5 space-y-4">
              <h3 className="text-xs font-bold text-purple-400">
                ⚖️ Constitutional Proposal Details
              </h3>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">
                  Parameter to Change <span className="text-red-400">*</span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONSTITUTIONAL_PARAMS.map((param) => (
                    <button
                      key={param.key}
                      type="button"
                      onClick={() => {
                        setSelectedParam(param);
                        setNewValue('');
                      }}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        selectedParam?.key === param.key
                          ? 'border-purple-500/30 bg-purple-500/15'
                          : 'border-[var(--color-glass-border)] hover:border-purple-500/20'
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-[var(--color-fg)]">
                        {param.label}
                      </div>
                      <div className="text-[9px] text-[var(--color-muted)]">
                        Current: {param.currentValue}
                      </div>
                      <p className="mt-0.5 text-[8px] text-[var(--color-muted)]/70">
                        {param.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedParam && (
                <>
                  <div>
                    <label
                      htmlFor="new-value"
                      className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]"
                    >
                      New Value <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="new-value"
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={`Enter new value (current: ${selectedParam.currentValue})`}
                        className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-purple-500 transition-colors"
                      />
                      {selectedParam.unit && (
                        <span className="text-xs text-[var(--color-muted)]">
                          {selectedParam.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Impact preview */}
                  <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                    <div className="mb-1 text-[10px] font-semibold text-amber-400">
                      ⚠️ Impact Preview
                    </div>
                    <p className="text-[9px] text-[var(--color-muted)]">
                      Changing{' '}
                      <strong className="text-[var(--color-fg)]">{selectedParam.label}</strong> from{' '}
                      <strong className="text-red-400">{selectedParam.currentValue}</strong> to{' '}
                      <strong className="text-degen-400">
                        {newValue || '??'}
                        {selectedParam.unit}
                      </strong>{' '}
                      will affect how proposals are governed. This change requires a constitutional
                      vote.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep('type')}
              className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep('preview')}
              disabled={!title || !description}
              className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              Preview →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Preview & Submit ──────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-4 py-6 animate-page-enter">
        <div className="text-center">
          <div className="mb-4 text-6xl">🎉</div>
          <h1
            className="mb-2 text-2xl font-black text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Proposal Submitted!
          </h1>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            Your proposal is now live for DAO members to review and vote.
          </p>

          <div className="mb-6 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
                {PROPOSAL_TYPES.find((t) => t.value === proposalType)?.label}
              </span>
              <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[9px] font-semibold text-blue-400">
                Active
              </span>
            </div>
            <h2 className="mb-1 text-sm font-bold text-[var(--color-fg)]">{title}</h2>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/dao/${params.id}/proposals/${proposalId}`,
                );
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-glass-border)] px-5 py-2.5 text-xs font-semibold text-[var(--color-fg)] hover:bg-[var(--color-overlay-hover)] transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              Copy Share Link
            </button>
            <Link
              href={`/dao/${params.id}/proposals/${proposalId}`}
              className="text-xs text-degen-400 hover:underline"
            >
              View Proposal →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Preview step
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
          DAO
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <Link
          href={`/dao/${params.id}/proposals/create`}
          className="hover:text-degen-400 transition-colors"
        >
          Create
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--color-fg)]">Preview</span>
      </div>

      <h1
        className="mb-6 text-2xl font-black text-[var(--color-fg)]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Preview Proposal
      </h1>

      {/* Proposal Preview Card */}
      <div className="mb-8 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
            {PROPOSAL_TYPES.find((t) => t.value === proposalType)?.label}
          </span>
          <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[9px] font-semibold text-blue-400">
            Preview
          </span>
        </div>

        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">
          {title || 'Untitled Proposal'}
        </h2>

        <div className="mb-4 text-sm leading-relaxed text-[var(--color-muted)] whitespace-pre-wrap">
          {description || 'No description provided.'}
        </div>

        {discussionLink && (
          <div className="mb-3 text-xs">
            <span className="text-[var(--color-muted)]">Discussion: </span>
            <a
              href={discussionLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              {discussionLink}
            </a>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <span
                key={i}
                className="rounded-lg bg-[var(--color-glass-border)] px-2 py-1 text-[9px] text-[var(--color-muted)]"
              >
                📎 {att}
              </span>
            ))}
          </div>
        )}

        {/* Treasury preview */}
        {proposalType === 'treasury' && (
          <div className="mt-4 rounded-lg border border-degen-500/10 bg-degen-500/5 p-3">
            <div className="grid gap-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Recipient</span>
                <span className="font-mono text-[var(--color-fg)]">
                  {recipientAddress || 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Amount</span>
                <span className="font-mono text-degen-400">
                  {amount || '0'} {token}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Payment Type</span>
                <span className="capitalize text-[var(--color-fg)]">{paymentType}</span>
              </div>
              {paymentType === 'milestone' && milestones.length > 0 && (
                <div className="border-t border-degen-500/10 pt-2 mt-1">
                  <span className="text-[var(--color-muted)]">
                    Milestones ({milestones.length})
                  </span>
                  {milestones.map((ms, i) => (
                    <div key={ms.id} className="mt-1 flex justify-between text-[9px]">
                      <span className="text-[var(--color-fg)]">
                        {i + 1}. {ms.description}
                      </span>
                      <span className="font-mono text-[var(--color-muted)]">
                        {ms.amount || '?'} {ms.token}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Constitutional preview */}
        {proposalType === 'constitutional' && selectedParam && (
          <div className="mt-4 rounded-lg border border-purple-500/10 bg-purple-500/5 p-3">
            <div className="grid gap-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Parameter</span>
                <span className="text-[var(--color-fg)]">{selectedParam.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Current Value</span>
                <span className="text-red-400">{selectedParam.currentValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">New Value</span>
                <span className="text-degen-400">
                  {newValue || '??'}
                  {selectedParam.unit}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Voting period preview */}
        <div className="mt-4 flex items-center gap-4 rounded-lg bg-[var(--color-glass-border)] p-3 text-[10px]">
          <span className="text-[var(--color-muted)]">
            ⏱️ Voting Period: <strong className="text-[var(--color-fg)]">7 days</strong>
          </span>
          <span className="text-[var(--color-muted)]">
            Quorum: <strong className="text-[var(--color-fg)]">10%</strong>
          </span>
          <span className="text-[var(--color-muted)]">
            Threshold: <strong className="text-[var(--color-fg)]">60%</strong>
          </span>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm submission"
        >
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl">
            <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">Confirm Submission</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              This will create an on-chain proposal. A gas fee ({'~'}0.003 ETH ≈ $8) will be
              required to submit.
            </p>

            <div className="mb-4 rounded-lg bg-[var(--color-glass-border)] p-3 text-[10px]">
              <div className="flex justify-between mb-1">
                <span className="text-[var(--color-muted)]">Estimated Gas</span>
                <span className="font-mono text-[var(--color-fg)]">~0.003 ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Estimated USD</span>
                <span className="font-mono text-[var(--color-fg)]">~$8.00</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setSubmitting(true);
                  // Simulate submission
                  setTimeout(() => {
                    setSubmitting(false);
                    setShowConfirm(false);
                    setProposalId(String(Math.floor(Math.random() * 1000) + 10));
                    setSubmitted(true);
                  }, 2000);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-4 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-40 active:scale-95"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-30"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep('content')}
          className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          ← Edit
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!title || !description}
          className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-8 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          Submit Proposal
        </button>
      </div>
    </div>
  );
}
