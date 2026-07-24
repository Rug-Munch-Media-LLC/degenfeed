'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePremium } from '../../hooks/usePremium';
import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';
import { useWeb3 } from '../Web3Provider';
import { PLANS, STEPS } from './constants';
import { Step1_PickPlan } from './Step1_PickPlan';
import { Step2_ChooseUsernames } from './Step2_ChooseUsernames';
import { Step3_ReviewCosts } from './Step3_ReviewCosts';
import { Step4_WalletSignature } from './Step4_WalletSignature';
import { Step5_Processing } from './Step5_Processing';
import { Step6_Success_RecoveryKeys } from './Step6_Success_RecoveryKeys';
import { StepIndicator } from './StepIndicator';
import type {
  AccountResult,
  ChargeBreakdown,
  PlanId,
  PlanInfo,
  RecoveryPackage,
  RegisterFlowProps,
  RegistrationResponse,
} from './types';
import { getHandleTier, getLensHandleGasCost } from './utils';

export function RegisterFlow({ onComplete, compact = false }: RegisterFlowProps) {
  const { walletAddress } = useAuth();
  const { signMessage } = useWeb3();
  const { isPremium, loading: premiumLoading } = usePremium();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [farcasterUsername, setFarcasterUsername] = useState('');
  const [lensHandle, setLensHandle] = useState('');
  const [ensName, setEnsName] = useState('');
  const [signing, setSigning] = useState(false);
  const [_processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Record<string, AccountResult>>({});
  const [_charges, setCharges] = useState<ChargeBreakdown | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryPackage | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [_plans, setPlans] = useState<PlanInfo[]>(PLANS);
  const [confirmedOverage, setConfirmedOverage] = useState(false);
  const [_requiresOverageConfirm, setRequiresOverageConfirm] = useState(false);
  const [_pendingOverageInfo, setPendingOverageInfo] = useState<{
    proposedTotal: string;
    overage: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/register/plans', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { plans?: PlanInfo[] }) => {
        if (data.plans?.length) setPlans(data.plans);
      })
      .catch(() => {});
  }, []);

  const handleGasCost = getLensHandleGasCost(lensHandle);
  const handleLabel = getHandleTier(lensHandle.length).label;

  const computedCharges = useMemo((): ChargeBreakdown | null => {
    if (!selectedPlan) return null;
    if (isPremium) {
      return {
        total: '$0 (covered by Premium subscription)',
        totalCents: 0,
        breakdown: [
          { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: true },
          {
            item: `Lens Profile — ${handleLabel} ($${handleGasCost} gas)`,
            cost: `$${handleGasCost}`,
            covered: true,
          },
          { item: 'GoToSocial account', cost: '$0', covered: true },
          { item: 'AT Protocol PDS', cost: '$0', covered: true },
          { item: 'Nostr keypair', cost: '$0', covered: true },
          { item: 'RSS feed', cost: '$0', covered: true },
        ],
        serviceFeeCents: 0,
        ourProfit: 0,
        requiresConfirmation: false,
        overage: 0,
      };
    }
    switch (selectedPlan) {
      case 'standard': {
        const handleUpcharge = Math.max(0, handleGasCost - 2);
        const totalGas = 5 + handleGasCost;
        const gasBudget = 7;
        const overage = Math.max(0, totalGas - gasBudget);
        const ourProfit = 3;
        const totalUsd = totalGas + ourProfit;
        return {
          total: `$${totalUsd}`,
          totalCents: totalUsd * 100,
          ourProfit,
          requiresConfirmation: overage > 0,
          overage,
          breakdown: [
            { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: false },
            {
              item: `Lens Profile — ${handleLabel} ($${handleGasCost} gas)`,
              cost: `$${handleGasCost}`,
              covered: false,
            },
            { item: 'Service fee (our profit)', cost: `$${ourProfit}`, covered: false },
            ...(handleUpcharge > 0
              ? [{ item: 'Short handle premium', cost: `$${handleUpcharge}`, covered: false }]
              : []),
            ...(overage > 0 ? [{ item: 'Gas overage', cost: `$${overage}`, covered: false }] : []),
            { item: 'GoToSocial + PDS + Nostr + RSS', cost: '$0', covered: true },
          ],
          serviceFeeCents: ourProfit * 100,
        };
      }
      case 'complete': {
        const handleUpcharge = Math.max(0, handleGasCost - 10);
        const totalGas = 5 + handleGasCost + 10 - 7;
        const gasBudget = 17;
        const overage = Math.max(0, totalGas - gasBudget);
        const ourProfit = 3;
        const totalUsd = totalGas + ourProfit;
        return {
          total: `$${totalUsd}`,
          totalCents: totalUsd * 100,
          ourProfit,
          requiresConfirmation: overage > 0,
          overage,
          breakdown: [
            { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: false },
            {
              item: `Lens Profile — ${handleLabel} ($${handleGasCost} gas)`,
              cost: `$${handleGasCost}`,
              covered: false,
            },
            { item: 'ENS domain ($10)', cost: '$10', covered: false },
            ...(handleUpcharge > 0
              ? [{ item: 'Premium handle upcharge', cost: `$${handleUpcharge}`, covered: false }]
              : []),
            { item: 'Service fee (our profit)', cost: `$${ourProfit}`, covered: false },
            { item: 'Bundle discount', cost: '-$7', covered: false },
            ...(overage > 0 ? [{ item: 'Gas overage', cost: `$${overage}`, covered: false }] : []),
            { item: 'GoToSocial + PDS + Nostr + RSS', cost: '$0', covered: true },
          ],
          serviceFeeCents: ourProfit * 100,
        };
      }
      default:
        return {
          total: '$0',
          totalCents: 0,
          breakdown: [
            { item: 'GoToSocial account', cost: '$0', covered: true },
            { item: 'AT Protocol PDS', cost: '$0', covered: true },
            { item: 'Nostr keypair', cost: '$0', covered: true },
            { item: 'RSS feed', cost: '$0', covered: true },
          ],
          serviceFeeCents: 0,
          ourProfit: 0,
          requiresConfirmation: false,
          overage: 0,
        };
    }
  }, [selectedPlan, isPremium, handleGasCost, handleLabel]);

  const executeRegistration = useCallback(
    async (plan: PlanId, skipSign: boolean = false) => {
      if (!walletAddress) {
        showToast('error', 'Connect your wallet first');
        return;
      }
      setProcessing(true);
      setStep(4);
      setError('');

      if (!skipSign) {
        setSigning(true);
        try {
          const sig = await signMessage(
            `Authorize DegenFeed to create all protocol accounts (plan: ${plan}). This is a free signature — no gas fee.`,
          );
          if (!sig) {
            setSigning(false);
            setProcessing(false);
            showToast('error', 'Signature cancelled');
            return;
          }
        } catch {
          setSigning(false);
          setProcessing(false);
          showToast('error', 'Signature failed — try again');
          return;
        }
        setSigning(false);
      }

      try {
        const body: Record<string, string> = { plan };
        if (farcasterUsername) body.farcasterUsername = farcasterUsername;
        if (lensHandle) body.lensHandle = lensHandle;
        if (ensName && plan === 'complete') body.ensName = ensName;
        if (confirmedOverage) body.confirmedOverage = 'true';

        const res = await fetch('/api/register/all', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as RegistrationResponse;

        if (res.status === 402 && data.requiresConfirmation) {
          setPendingOverageInfo({
            proposedTotal: data.proposedTotal || '',
            overage: data.overage || 0,
          });
          setRequiresOverageConfirm(true);
          setProcessing(false);
          setStep(2);
          showToast('warning', data.message || 'Gas costs are higher than usual');
          return;
        }
        if (!res.ok)
          throw new Error((data as unknown as { error?: string }).error || 'Registration failed');

        setResults(data.accounts);
        setCharges(data.charges);
        setRecoveryInfo(data.recoveryInfo);
        setNextSteps(data.nextSteps);
        setStep(5);
        onComplete?.();
        showToast(
          'success',
          `🎉 ${Object.values(data.accounts).filter((a) => a.ok).length} accounts created!`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setError(msg);
        showToast('error', msg);
        if (!compact) setStep(2);
      } finally {
        setProcessing(false);
      }
    },
    [
      walletAddress,
      farcasterUsername,
      lensHandle,
      ensName,
      confirmedOverage,
      signMessage,
      showToast,
      onComplete,
      compact,
    ],
  );

  const handleConfirm = useCallback(
    async (planOverride?: PlanId) => {
      const plan = planOverride || selectedPlan;
      if (!plan) return;
      if (!compact) {
        setStep(3);
        return;
      }
      await executeRegistration(plan, true);
    },
    [selectedPlan, compact, executeRegistration],
  );

  const handlePlanSelect = useCallback(
    (id: PlanId) => {
      setSelectedPlan(id);
      if (compact && id === 'free') {
        handleConfirm(id);
        return;
      }
      setStep(1);
    },
    [compact, handleConfirm],
  );

  const handleConfirmOverage = useCallback(() => setConfirmedOverage(true), []);
  const handleSign = useCallback(async () => {
    if (!selectedPlan) return;
    await executeRegistration(selectedPlan, false);
  }, [selectedPlan, executeRegistration]);

  const handleRestart = useCallback(() => {
    setStep(0);
    setSelectedPlan(null);
    setFarcasterUsername('');
    setLensHandle('');
    setEnsName('');
    setResults({});
    setCharges(null);
    setRecoveryInfo(null);
    setError('');
    setConfirmedOverage(false);
    setRequiresOverageConfirm(false);
    setPendingOverageInfo(null);
  }, []);

  if (!walletAddress) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">
          Create Your Universal Social Identity
        </h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          Connect your wallet to get started. One registration. All protocols. You own everything.
        </p>
        <div className="rounded-lg bg-[var(--color-overlay)] px-4 py-3 text-xs text-[var(--color-muted)]">
          Connect wallet above to continue
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-4">
        {step === 0 && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Quick Registration</h3>
            <div className="grid gap-2">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handlePlanSelect(plan.id)}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-3 py-2.5 text-left hover:bg-[var(--color-overlay)] transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--color-fg)]">{plan.label}</span>
                    <p className="text-[10px] text-[var(--color-muted)]">{plan.description}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${isPremium && plan.id !== 'free' ? 'text-degen-400' : ''}`}
                  >
                    {isPremium && plan.id !== 'free' ? '$0' : plan.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 4 && Object.keys(results).length > 0 && (
          <Step5_Processing results={results} plan={selectedPlan || 'free'} />
        )}
        {step === 5 && recoveryInfo && (
          <Step6_Success_RecoveryKeys
            results={results}
            recoveryInfo={recoveryInfo}
            nextSteps={nextSteps}
            onRestart={handleRestart}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {!premiumLoading && isPremium && (
        <div className="mb-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-sm font-medium text-amber-400">
            ⚡ Premium Active — Registration gas costs covered
          </p>
        </div>
      )}
      {step <= 3 && <StepIndicator steps={STEPS} current={step} />}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {step === 0 && (
          <Step1_PickPlan
            selectedPlan={selectedPlan}
            onSelect={handlePlanSelect}
            premiumActive={isPremium}
          />
        )}
        {step === 1 && selectedPlan && (
          <>
            <Step2_ChooseUsernames
              plan={selectedPlan}
              farcasterUsername={farcasterUsername}
              lensHandle={lensHandle}
              ensName={ensName}
              isPremium={isPremium}
              onFarcasterChange={setFarcasterUsername}
              onLensChange={setLensHandle}
              onEnsChange={setEnsName}
            />
            <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)]"
              >
                Review Costs →
              </button>
            </div>
          </>
        )}
        {step === 2 && selectedPlan && computedCharges && (
          <Step3_ReviewCosts
            plan={selectedPlan}
            isPremium={isPremium}
            charges={computedCharges}
            farcasterUsername={farcasterUsername}
            lensHandle={lensHandle}
            ensName={ensName}
            handleGasCost={handleGasCost}
            confirmedOverage={confirmedOverage}
            onBack={() => setStep(1)}
            onConfirm={() => handleConfirm()}
            onConfirmOverage={handleConfirmOverage}
          />
        )}
        {step === 3 && selectedPlan && (
          <Step4_WalletSignature onBack={() => setStep(2)} onSign={handleSign} signing={signing} />
        )}
        {step === 4 && <Step5_Processing results={results} plan={selectedPlan || 'free'} />}
        {step === 5 && recoveryInfo && (
          <Step6_Success_RecoveryKeys
            results={results}
            recoveryInfo={recoveryInfo}
            nextSteps={nextSteps}
            onRestart={handleRestart}
          />
        )}
      </div>
      {selectedPlan !== 'free' && step < 2 && (
        <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            <span className="font-medium text-amber-400">💡 Free alternatives:</span>
            <br />
            <a
              href="https://warpcast.com/~/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Farcaster (free on Warpcast)
            </a>
            {' · '}
            <a
              href="https://lens.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Lens (free on lens.xyz)
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
