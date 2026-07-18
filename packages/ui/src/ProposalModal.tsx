'use client';

import { useCallback, useState } from 'react';

export type ProposalType = 'text' | 'rule_change' | 'mod_action';

export interface ProposalModalProps {
  communityName: string;
  onClose: () => void;
  onCreated: (proposalId: string) => void;
}

const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  text: 'Text Proposal (Temperature Check)',
  rule_change: 'Rule Change',
  mod_action: 'Moderation Action',
};

const VOTING_PERIOD_OPTIONS = [
  { value: '1d', label: '1 Day' },
  { value: '3d', label: '3 Days (default)' },
  { value: '7d', label: '7 Days' },
];

export function ProposalModal({ communityName, onClose, onCreated }: ProposalModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProposalType>('text');
  const [description, setDescription] = useState('');
  const [votingPeriod, setVotingPeriod] = useState('3d');
  const [targetUser, setTargetUser] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !description.trim()) return;

      setCreating(true);
      setError('');

      try {
        const body: Record<string, unknown> = {
          title: title.trim(),
          type,
          description: description.trim(),
          votingPeriod,
        };
        if (type === 'mod_action' && targetUser.trim()) {
          body.targetUser = targetUser.trim();
        }

        const res = await fetch(`/api/community/${encodeURIComponent(communityName)}/proposals`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as {
          success?: boolean;
          proposal?: { id: string };
          error?: string;
        };

        if (!res.ok) {
          setError(data.error ?? 'Failed to create proposal');
          return;
        }

        if (data.proposal) {
          onCreated(data.proposal.id);
        }
      } catch {
        setError('Network error');
      } finally {
        setCreating(false);
      }
    },
    [title, type, description, votingPeriod, targetUser, communityName, onCreated],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card mx-4 w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Create Proposal</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <title>Close</title>
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: adjacent input provides context */}
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
              required
              maxLength={200}
            />
          </div>

          {/* Type selector */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: adjacent input provides context */}
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(PROPOSAL_TYPE_LABELS) as [ProposalType, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      type === key
                        ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                        : 'border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:text-[var(--color-muted)]'
                    }`}
                  >
                    {label.split(' ')[0]}
                    <span className="block text-[10px] opacity-60">
                      {label.includes('(') ? label.split('(')[1]?.replace(')', '') : ''}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Target user (mod_action only) */}
          {type === 'mod_action' && (
            <div>
              {/* biome-ignore lint/a11y/noLabelWithoutControl: adjacent input provides context */}
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Target Wallet Address *
              </label>
              <input
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="0x... or solana address"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
              />
            </div>
          )}

          {/* Description */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: adjacent input provides context */}
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Description *<span className="ml-1 text-gray-600">({description.length}/10,000)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal in detail. What are you proposing and why?"
              rows={5}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
              required
              maxLength={10_000}
            />
          </div>

          {/* Voting period */}
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: adjacent input provides context */}
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Voting Period
            </label>
            <div className="flex gap-2">
              {VOTING_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVotingPeriod(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    votingPeriod === opt.value
                      ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                      : 'border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:text-[var(--color-muted)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim() || !description.trim()}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
