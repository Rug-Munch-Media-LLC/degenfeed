'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  StepNavigation, StepBasics, StepEconomics, StepAntiExploit,
  StepBenefits, StepReview, StepDAO,
  INITIAL_STATE, ECO_PRESETS,
} from '../../../components/creator-studio';
import type { CoinFormState } from '../../../components/creator-studio';

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
      case 0: return form.name.length >= 2 && form.symbol.length >= 2 && form.symbol.length <= 5;
      case 1: case 2: case 3: case 4: case 5: return true;
      default: return false;
    }
  }, [step, form]);

  const simulateDeploy = async () => {
    update('deploying', true);
    update('deployProgress', 0);
    const stages = ['Creating token contract...', 'Configuring bonding curve...', 'Setting up anti-exploit...', 'Deploying to chain...', 'Verifying deployment...'];
    for (let i = 0; i < stages.length; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      update('deployProgress', ((i + 1) / stages.length) * 100);
    }
    update('deploying', false);
    update('deployed', true);
    update('deployedAddress', `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`);
    update('txHash', `0x${crypto.randomUUID().replace(/-/g, '')}`);
  };

  const daoDeploy = async () => {
    if (form.daoDeploying) return;
    update('daoDeploying', true);
    update('daoDeployProgress', 0);
    const stages = ['Creating Snapshot space...', 'Deploying governance token...', 'Setting up treasury multi-sig...', 'Configuring DAO parameters...', 'Verifying deployment...'];
    for (let i = 0; i < stages.length; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      update('daoDeployProgress', ((i + 1) / stages.length) * 100);
    }
    update('daoDeploying', false);
    update('daoDeployed', true);
    update('daoAddress', `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`);
    update('daoTxHash', `0x${crypto.randomUUID().replace(/-/g, '')}`);
  };

  const totalSteps = 6;
  const stepLabels = ['Basics', 'Economics', 'Protection', 'Utility', 'Review', 'DAO'];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-page-enter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]" style={{ fontFamily: 'var(--font-heading)' }}>
          Creator Coin Studio
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Launch your own creator coin — better than pump.fun, better than Zora. Full creator control, anti-exploit, bonding curve 2.0.
        </p>
      </div>

      <StepNavigation current={step} total={totalSteps} steps={stepLabels} />

      {step === 0 && <StepBasics form={form} update={update} toggleTag={toggleTag} />}
      {step === 1 && <StepEconomics form={form} update={update} />}
      {step === 2 && <StepAntiExploit form={form} update={update} />}
      {step === 3 && <StepBenefits form={form} update={update} />}
      {step === 4 && <StepReview form={form} update={update} simulateDeploy={simulateDeploy} onContinue={() => setStep(5)} />}
      {step === 5 && <StepDAO form={form} update={update} daoDeploy={daoDeploy} />}

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-semibold text-[var(--color-fg)] transition-all hover:border-degen-500/30 disabled:opacity-30"
        >Back</button>

        <div className="flex items-center gap-2">
          {step === 4 && !form.deployed && (
            <button type="button" onClick={simulateDeploy} disabled={form.deploying}
              className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-30 active:scale-[0.98]"
            >
              {form.deploying ? 'Deploying...' : form.deployTarget === 'both' ? '🚀 Deploy to Both' : `🚀 Deploy to ${form.deployTarget === 'base' ? 'Base' : 'Solana'}`}
            </button>
          )}
          {step === 4 && form.deployed && (
            <button type="button" onClick={() => setStep(5)}
              className="rounded-xl bg-degen-500/15 px-5 py-2.5 text-xs font-bold text-degen-400 transition-all hover:bg-degen-500/25"
            >Continue → DAO Setup</button>
          )}
          {step === 5 && (
            <Link href={`/dao/${form.daoAddress || form.deployedAddress}`}
              className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-[0.98]"
            >{form.daoDeployed ? '🏛️ View DAO' : 'Skip → Dashboard'}</Link>
          )}
          {step < 4 && (
            <button type="button" onClick={() => setStep(Math.min(4, step + 1))} disabled={!canProceed}
              className="rounded-xl bg-degen-500/15 px-5 py-2.5 text-xs font-bold text-degen-400 transition-all hover:bg-degen-500/25 disabled:opacity-30"
            >Continue</button>
          )}
        </div>
      </div>
    </div>
  );
}
