'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState} from 'react';
import RuleBuilder, { RuleItem } from './CustomRules';
import { SignalSourcesSection } from './SignalSources';
import type { AlgorithmWeights, CustomRule, SignalSource, WeightPreset } from './types';
import { DEFAULT_WEIGHTS, PRESETS } from './types';
import { PresetCard, PreviewPanel, WeightSlidersSection } from './WeightSliders';

/* ═════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════ */

export default function FeedTunePage() {
  const [weights, setWeights] = useState<AlgorithmWeights>(DEFAULT_WEIGHTS);
  const [initialWeights, setInitialWeights] = useState<AlgorithmWeights>(DEFAULT_WEIGHTS);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [signals, setSignals] = useState<SignalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    async function load() {
      try {
        const [weightsRes, rulesRes, signalsRes] = await Promise.all([
          fetch('/api/algo/weights', { credentials: 'include' }),
          fetch('/api/algo/rules', { credentials: 'include' }),
          fetch('/api/algo/signals', { credentials: 'include' }),
        ]);
        if (weightsRes.ok) {
          const w = (await weightsRes.json()) as { weights: AlgorithmWeights };
          setWeights(w.weights);
          setInitialWeights(w.weights);
        }
        if (rulesRes.ok) {
          const r = (await rulesRes.json()) as { rules: CustomRule[] };
          setRules(r.rules);
        }
        if (signalsRes.ok) {
          const s = (await signalsRes.json()) as { signals: SignalSource[] };
          setSignals(s.signals);
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleWeightChange = useCallback((key: keyof AlgorithmWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
    setSaved(false);
  }, []);

  const handleApplyPreset = useCallback(async (preset: WeightPreset) => {
    setWeights({ ...preset.weights });
    setActivePreset(preset.slug);
    setSaved(false);
    try {
      await fetch(`/api/algo/weights/preset/${preset.slug}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* ignore */
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/algo/weights', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(weights),
      });
      if (res.ok) {
        setSaved(true);
        setInitialWeights({ ...weights });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, [weights]);

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch('/api/algo/weights/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { weights: AlgorithmWeights };
        setWeights(data.weights);
        setActivePreset(null);
      }
    } catch {
      setWeights(DEFAULT_WEIGHTS);
    }
  }, []);

  const handleAddRule = useCallback(
    async (rule: Omit<CustomRule, 'id' | 'createdAt' | 'enabled'>) => {
      const newRule: CustomRule = {
        ...rule,
        id: crypto.randomUUID(),
        enabled: true,
        createdAt: Date.now(),
      };
      setRules((prev) => [...prev, newRule]);
      setShowRuleBuilder(false);
      try {
        await fetch('/api/algo/rules', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(newRule),
        });
      } catch {
        setRules((prev) => prev.filter((r) => r.id !== newRule.id));
      }
    },
    [],
  );

  const handleToggleRule = useCallback(
    async (ruleId: string) => {
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
      const updated = rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
      try {
        await fetch('/api/algo/rules', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updated.find((r) => r.id === ruleId)),
        });
      } catch {
        /* ignore */
      }
    },
    [rules],
  );

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    try {
      await fetch(`/api/algo/rules/${ruleId}`, { method: 'DELETE', credentials: 'include' });
    } catch {
      const res = await fetch('/api/algo/rules', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { rules: CustomRule[] };
        setRules(data.rules);
      }
    }
  }, []);

  const handleToggleSignal = useCallback(
    async (signalId: string) => {
      const updated = signals.map((s) => (s.id === signalId ? { ...s, enabled: !s.enabled } : s));
      setSignals(updated);
      try {
        await fetch('/api/algo/signals', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ signals: updated.map((s) => ({ id: s.id, enabled: s.enabled })) }),
        });
      } catch {
        setSignals(signals);
      }
    },
    [signals],
  );

  const handleShare = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/algo/presets/share/${slug}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { shareUrl: string };
        setShareUrl(data.shareUrl);
        await navigator.clipboard.writeText(data.shareUrl).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleShareCustom = useCallback(async () => {
    const w = weights;
    const params = `custom=${w.recency},${w.relevance},${w.popularity},${w.creatorAffinity},${w.diversity},${w.sourceQuality},${w.interactionHistory}`;
    const url = `${window.location.origin}/feed/tune?${params}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => {});
  }, [weights]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-4 w-96 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-64 rounded-xl bg-[var(--color-bg-tertiary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/settings/personalization"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
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
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Personalization
        </Link>
        <h1
          className="text-2xl font-black"
          style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
        >
          Feed Algorithm Tuner
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
          Take total control of your feed. Adjust weights, apply presets, and create custom rules to
          shape exactly what you see.
        </p>
      </div>

      {/* Save bar */}
      <div
        className="sticky top-0 z-10 mb-6 flex items-center justify-between rounded-xl border p-3 backdrop-blur-xl"
        style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}
      >
        <div>
          {saved ? (
            <span className="flex items-center gap-1.5 text-xs text-degen-400">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved!
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {activePreset
                ? `Preset: ${PRESETS.find((p) => p.slug === activePreset)?.name ?? activePreset}`
                : 'Custom weights'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-muted)' }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-degen-500/20 px-4 py-1.5 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/30 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving\u2026' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {/* ═══ 1. Presets ═══ */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              🏷️
            </span>
            <h2
              className="text-lg font-bold"
              style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
            >
              Presets
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((preset) => (
              <PresetCard
                key={preset.slug}
                preset={preset}
                active={activePreset === preset.slug}
                onApply={() => handleApplyPreset(preset)}
                onShare={() => handleShare(preset.slug)}
              />
            ))}
          </div>
        </section>

        {/* ═══ 2. Weight Sliders ═══ */}
        <WeightSlidersSection weights={weights} onWeightChange={handleWeightChange} />

        {/* ═══ 3. Preview + Custom Share ═══ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PreviewPanel currentWeights={initialWeights} proposedWeights={weights} />
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <h3
              className="mb-3 flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--color-fg)' }}
            >
              <span>🔗</span> Share Your Algorithm
            </h3>
            <p className="mb-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Generate a shareable link with your current configuration.
            </p>
            <button
              type="button"
              onClick={handleShareCustom}
              className="w-full rounded-lg border py-2 text-xs font-medium transition-colors"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            >
              Copy Share Link
            </button>
            {shareUrl && (
              <p className="mt-2 text-[10px] text-degen-400 break-all">
                Link copied! Share it with friends.
              </p>
            )}
          </div>
        </div>

        {/* ═══ 4. Custom Rules ═══ */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                ⚙️
              </span>
              <h2
                className="text-lg font-bold"
                style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
              >
                Custom Rules
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowRuleBuilder(!showRuleBuilder)}
              className="rounded-lg bg-degen-500/15 px-3 py-1.5 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-colors"
            >
              {showRuleBuilder ? 'Cancel' : '+ Add Rule'}
            </button>
          </div>
          <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
            Create IF/THEN rules like &quot;Boost posts from @alice&quot; or &quot;Mute
            #politics&quot;
          </p>

          {showRuleBuilder && (
            <div className="mb-4">
              <RuleBuilder onAdd={handleAddRule} />
            </div>
          )}

          {rules.length === 0 && !showRuleBuilder ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{
                borderColor: 'var(--color-glass-border)',
                backgroundColor: 'var(--color-card)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                No custom rules yet.
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                Create rules to boost specific creators, mute topics, or filter by engagement.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  onToggle={() => handleToggleRule(rule.id)}
                  onDelete={() => handleDeleteRule(rule.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ═══ 5. Signal Sources ═══ */}
        <SignalSourcesSection signals={signals} onToggleSignal={handleToggleSignal} />
      </div>

      {/* Footer */}
      <div
        className="mt-10 rounded-xl border p-4"
        style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg" aria-hidden="true">
            💡
          </span>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
              How it works
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Your feed algorithm scores every post using weighted signals. Higher weights give that
              signal more influence. Presets are a quick way to get a specific feed mood. Custom
              rules let you hard-code preferences. Changes apply to new feed loads — refresh your
              feed to see the effect.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .tune-slider {
          -webkit-appearance: none; appearance: none; width: 100%; height: 4px;
          border-radius: 2px; background: var(--color-border); outline: none; cursor: pointer;
        }
        .tune-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%;
          background: var(--color-accent); cursor: pointer; box-shadow: 0 0 8px var(--color-accent-glow);
          border: 2px solid var(--color-bg);
        }
        .tune-slider::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--color-accent); cursor: pointer; box-shadow: 0 0 8px var(--color-accent-glow);
          border: 2px solid var(--color-bg);
        }
        .tune-slider:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
        .tune-input {
          width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
          border: 1px solid var(--color-glass-border); background: var(--color-bg-secondary);
          color: var(--color-fg); font-size: 0.75rem; outline: none; transition: border-color 0.15s;
        }
        .tune-input:focus { border-color: var(--color-accent); }
        .tune-input::placeholder { color: var(--color-muted); }
        .toggle-track {
          display: inline-flex; width: 36px; height: 20px; padding: 2px;
          border-radius: 9999px; background: var(--color-border); cursor: pointer;
          border: none; transition: background 0.2s;
        }
        .toggle-track[aria-checked="true"] { background: var(--color-accent); }
        .toggle-thumb {
          display: block; width: 16px; height: 16px; border-radius: 50%;
          background: var(--color-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }
        .toggle-track[aria-checked="true"] .toggle-thumb { transform: translateX(16px); }
        @media (prefers-reduced-motion: reduce) {
          .toggle-track, .toggle-thumb, .tune-slider { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
