'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DAOPreview from '../../../components/dao/DAOPreview';
import DAOTemplates, { type TemplateConfig } from '../../../components/dao/DAOTemplates';
import type { DAOFormState, SignerEntry } from '../../../components/dao-wizard';
import {
  INITIAL_STATE,
  StepBasics,
  StepGovernance,
  StepReview,
  StepTreasury,
} from '../../../components/dao-wizard';

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
    const newSigners = Array.from(
      { length: Math.max(template.treasury.signerCount, 1) },
      (_, i) => form.signers[i] || { address: '', label: '' },
    );
    update('signers', newSigners);
    update('threshold', template.treasury.threshold);
  };

  const addSigner = () => {
    if (form.signers.length >= 10) return;
    setForm((prev) => ({ ...prev, signers: [...prev.signers, { address: '', label: '' }] }));
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

  // On-chain DAO deployment is not wired to a live factory contract yet.
  // We DO NOT fabricate addresses/tx hashes — the UI states this plainly
  // and preserves the configured proposal for when deployment ships.
  const [deployUnavailable, setDeployUnavailable] = useState(false);

  const totalSteps = 4;

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
          Launch a decentralized autonomous organization on Base or Solana.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
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
              <StepBasics form={form} update={update} toggleTag={toggleTag} />
            </div>
          )}
          {step === 1 && <StepGovernance form={form} update={update} />}
          {step === 2 && (
            <StepTreasury
              form={form}
              update={update}
              updateSigner={updateSigner}
              addSigner={addSigner}
              removeSigner={removeSigner}
            />
          )}
          {step === 3 && (
            <StepReview
              form={form}
              deploying={form.deploying}
              deployProgress={form.deployProgress}
              deployed={form.deployed}
              deployedAddress={form.deployedAddress}
              txHash={form.txHash}
              snapshotSpaceId={form.snapshotSpaceId}
            />
          )}
        </div>

        {deployUnavailable && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-bold text-amber-400">On-chain deployment not yet available</p>
            <p className="mt-1 text-[var(--color-muted)]">
              DAO factory contracts are in final audit. Your configuration is saved locally —
              nothing was deployed and no transaction was sent. Watch the changelog for launch.
            </p>
          </div>
        )}

        <div className="hidden lg:block">
          <div className="sticky top-6">
            <DAOPreview state={previewState} sidebar />
          </div>
        </div>
      </div>

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
              onClick={() => setDeployUnavailable(true)}
              disabled={form.deployed}
              className="rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)] px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-[var(--color-accent)] hover:to-[var(--color-accent-secondary)] disabled:opacity-30 active:scale-[0.98]"
            >
              {form.deployed ? 'Deployed ✓' : '🚀 Deploy DAO'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
