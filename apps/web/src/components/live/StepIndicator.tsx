'use client';

export type Step = 1 | 2 | 3 | 4;

export function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [{ step: 1, label: 'Platform' }, { step: 2, label: 'Configure' }, { step: 3, label: 'Stream Key' }, { step: 4, label: 'Go Live' }];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
            currentStep === s.step ? 'bg-degen-500 text-black shadow-[0_0_12px_var(--color-accent-glow)]' :
            currentStep > s.step ? 'bg-degen-500/30 text-degen-400' : 'bg-white/10 text-white/40'
          }`}>{currentStep > s.step ? '✓' : s.step}</div>
          <span className={`text-xs font-medium ${currentStep === s.step ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`mx-1 h-px w-6 ${currentStep > s.step ? 'bg-degen-500/50' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}
