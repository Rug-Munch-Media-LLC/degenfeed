'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface AlgorithmWeights {
  recency: number;
  relevance: number;
  popularity: number;
  creatorAffinity: number;
  diversity: number;
  sourceQuality: number;
  interactionHistory: number;
}

interface WeightPreset {
  name: string;
  slug: string;
  icon: string;
  description: string;
  weights: AlgorithmWeights;
}

interface CustomRule {
  id: string;
  type: 'boost-creator' | 'mute-hashtag' | 'min-engagement' | 'content-type';
  creatorId?: string;
  creatorName?: string;
  hashtag?: string;
  minLikes?: number;
  contentType?: string;
  adjustment?: number;
  description: string;
  enabled: boolean;
  createdAt: number;
}

interface SignalSource {
  id: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
}

/* ─── Defaults ──────────────────────────────────────────────── */

const DEFAULT_WEIGHTS: AlgorithmWeights = {
  recency: 50,
  relevance: 50,
  popularity: 50,
  creatorAffinity: 50,
  diversity: 50,
  sourceQuality: 50,
  interactionHistory: 50,
};

const PRESETS: WeightPreset[] = [
  { name: 'Latest First', slug: 'latest-first', icon: '📰', description: 'Newest posts at the top', weights: { recency: 90, relevance: 40, popularity: 40, creatorAffinity: 30, diversity: 30, sourceQuality: 30, interactionHistory: 30 } },
  { name: "What's Hot", slug: 'whats-hot', icon: '🔥', description: 'Trending and viral content', weights: { recency: 50, relevance: 40, popularity: 80, creatorAffinity: 40, diversity: 30, sourceQuality: 40, interactionHistory: 50 } },
  { name: 'For You', slug: 'for-you', icon: '🎯', description: 'Personalized to your interests', weights: { recency: 50, relevance: 70, popularity: 50, creatorAffinity: 60, diversity: 30, sourceQuality: 40, interactionHistory: 70 } },
  { name: 'Discovery Mode', slug: 'discovery', icon: '🌈', description: 'Explore new topics and creators', weights: { recency: 40, relevance: 40, popularity: 40, creatorAffinity: 30, diversity: 80, sourceQuality: 50, interactionHistory: 20 } },
  { name: 'Balanced', slug: 'balanced', icon: '⚖️', description: 'A fair mix of everything', weights: { recency: 50, relevance: 50, popularity: 50, creatorAffinity: 50, diversity: 50, sourceQuality: 50, interactionHistory: 50 } },
];

const WEIGHT_LABELS: Record<keyof AlgorithmWeights, { label: string; icon: string; desc: string }> = {
  recency: { label: 'Recency', icon: '🕐', desc: 'How recent the post is' },
  relevance: { label: 'Relevance', icon: '🎯', desc: 'Match to your interests and topics' },
  popularity: { label: 'Popularity', icon: '🔥', desc: 'Engagement: likes, reposts, replies' },
  creatorAffinity: { label: 'Creator Affinity', icon: '👤', desc: 'Accounts you follow and interact with' },
  diversity: { label: 'Diversity', icon: '🌈', desc: 'Mix of different authors and topics' },
  sourceQuality: { label: 'Source Quality', icon: '📡', desc: 'Trust and quality of the source protocol' },
  interactionHistory: { label: 'Your History', icon: '🔄', desc: 'Your past interactions with similar content' },
};

const RULE_TYPE_LABELS: Record<CustomRule['type'], { label: string; icon: string; fields: string[] }> = {
  'boost-creator': { label: 'Boost Creator', icon: '⭐', fields: ['creatorId', 'creatorName', 'adjustment'] },
  'mute-hashtag': { label: 'Mute Hashtag', icon: '🚫', fields: ['hashtag'] },
  'min-engagement': { label: 'Min Engagement', icon: '📊', fields: ['minLikes'] },
  'content-type': { label: 'Content Type', icon: '📋', fields: ['contentType'] },
};

/* ─── Toggle Switch ─────────────────────────────────────────── */

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="toggle-track"
    >
      <span className="toggle-thumb" />
    </button>
  );
}

/* ─── Weight Slider ─────────────────────────────────────────── */

function WeightSlider({
  weightKey,
  value,
  onChange,
}: {
  weightKey: keyof AlgorithmWeights;
  value: number;
  onChange: (key: keyof AlgorithmWeights, v: number) => void;
}) {
  const meta = WEIGHT_LABELS[weightKey];
  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={`weight-${weightKey}`} className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
          <span className="text-sm">{meta.icon}</span>
          <span>{meta.label}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{meta.desc}</span>
          <span className="w-10 text-right text-xs font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
            {value}%
          </span>
        </div>
      </div>
      <input
        id={`weight-${weightKey}`}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(weightKey, Number(e.target.value))}
        className="tune-slider"
        aria-label={`${meta.label} weight`}
      />
      <div className="mt-1 flex justify-between text-[9px]" style={{ color: 'var(--color-muted)' }}>
        <span>Ignore</span>
        <span>Critical</span>
      </div>
    </div>
  );
}

/* ─── Preset Card ───────────────────────────────────────────── */

function PresetCard({
  preset,
  active,
  onApply,
  onShare,
}: {
  preset: WeightPreset;
  active: boolean;
  onApply: () => void;
  onShare: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={`relative rounded-xl border p-4 text-left transition-all ${
        active
          ? 'border-degen-500/40 bg-degen-500/[0.06] shadow-[0_0_20px_rgba(0,255,65,0.08)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/20 hover:bg-degen-500/[0.02]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl" aria-hidden="true">{preset.icon}</span>
        {active && (
          <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
            Active
          </span>
        )}
      </div>
      <h3 className="mb-1 text-sm font-bold" style={{ color: 'var(--color-fg)' }}>{preset.name}</h3>
      <p className="mb-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>{preset.description}</p>

      {/* Mini weight bars */}
      <div className="space-y-1">
        {(Object.keys(preset.weights) as Array<keyof AlgorithmWeights>).slice(0, 4).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-16 text-[9px]" style={{ color: 'var(--color-muted)' }}>{WEIGHT_LABELS[k].label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className="h-full rounded-full bg-degen-500/60 transition-all"
                style={{ width: `${preset.weights[k]}%` }}
              />
            </div>
            <span className="w-6 text-right text-[9px] font-mono text-[var(--color-muted)]">{preset.weights[k]}%</span>
          </div>
        ))}
      </div>
    </button>
  );
}

/* ─── Rule Builder ──────────────────────────────────────────── */

function RuleBuilder({
  onAdd,
}: {
  onAdd: (rule: Omit<CustomRule, 'id' | 'createdAt' | 'enabled'>) => void;
}) {
  const [type, setType] = useState<CustomRule['type']>('boost-creator');
  const [creatorId, setCreatorId] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [minLikes, setMinLikes] = useState(10);
  const [contentType, setContentType] = useState('text');
  const [adjustment, setAdjustment] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rule: Omit<CustomRule, 'id' | 'createdAt' | 'enabled'> = {
      type,
      adjustment,
      description: '',
    };

    switch (type) {
      case 'boost-creator':
        if (!creatorId.trim()) return;
        rule.creatorId = creatorId.trim();
        rule.creatorName = creatorName.trim() || creatorId.trim();
        rule.description = `Boost posts from ${rule.creatorName}`;
        break;
      case 'mute-hashtag':
        if (!hashtag.trim()) return;
        rule.hashtag = hashtag.trim().replace(/^#/, '');
        rule.description = `Mute #${rule.hashtag}`;
        break;
      case 'min-engagement':
        rule.minLikes = minLikes;
        rule.description = `Only show posts with at least ${minLikes} likes`;
        break;
      case 'content-type':
        rule.contentType = contentType;
        rule.description = `Only show ${contentType} content`;
        break;
    }

    onAdd(rule);
    // Reset form
    setCreatorId('');
    setCreatorName('');
    setHashtag('');
    setMinLikes(10);
    setContentType('text');
    setAdjustment(30);
  };

  const typeMeta = RULE_TYPE_LABELS[type];

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
      <h4 className="mb-3 text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Add a Custom Rule</h4>

      {/* Rule type selector */}
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {(Object.entries(RULE_TYPE_LABELS) as Array<[CustomRule['type'], typeof typeMeta]>).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => setType(key)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-medium transition-all ${
              type === key
                ? 'bg-degen-500/15 text-degen-400'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </button>
        ))}
      </div>

      {/* Dynamic fields based on rule type */}
      <div className="mb-3 space-y-2">
        {type === 'boost-creator' && (
          <>
            <div>
              <label htmlFor="rule-creator-id" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
                Creator ID (wallet address or protocol ID)
              </label>
              <input
                id="rule-creator-id"
                type="text"
                value={creatorId}
                onChange={(e) => setCreatorId(e.target.value)}
                placeholder="e.g. 0x... or npub1..."
                className="tune-input"
                required
              />
            </div>
            <div>
              <label htmlFor="rule-creator-name" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
                Display name (optional)
              </label>
              <input
                id="rule-creator-name"
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="e.g. @alice"
                className="tune-input"
              />
            </div>
            <div>
              <label htmlFor="rule-adjustment" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
                Score boost: +{adjustment}%
              </label>
              <input
                id="rule-adjustment"
                type="range"
                min={5}
                max={100}
                step={5}
                value={adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value))}
                className="tune-slider"
              />
            </div>
          </>
        )}

        {type === 'mute-hashtag' && (
          <div>
            <label htmlFor="rule-hashtag" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
              Hashtag to mute
            </label>
            <input
              id="rule-hashtag"
              type="text"
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value)}
              placeholder="e.g. politics"
              className="tune-input"
              required
            />
          </div>
        )}

        {type === 'min-engagement' && (
          <div>
            <label htmlFor="rule-min-likes" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
              Minimum likes: {minLikes}
            </label>
            <input
              id="rule-min-likes"
              type="range"
              min={0}
              max={500}
              step={5}
              value={minLikes}
              onChange={(e) => setMinLikes(Number(e.target.value))}
              className="tune-slider"
            />
          </div>
        )}

        {type === 'content-type' && (
          <div>
            <label htmlFor="rule-content-type" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
              Content type to show
            </label>
            <select
              id="rule-content-type"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="tune-input"
            >
              <option value="text">Text</option>
              <option value="image">Images</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="link">Links</option>
            </select>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-degen-500/20 py-2 text-xs font-semibold text-degen-400 hover:bg-degen-500/30 transition-colors"
      >
        Add Rule
      </button>
    </form>
  );
}

/* ─── Rule Item ─────────────────────────────────────────────── */

function RuleItem({ rule, onToggle, onDelete }: { rule: CustomRule; onToggle: () => void; onDelete: () => void }) {
  const meta = RULE_TYPE_LABELS[rule.type];
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
      <span className="text-base shrink-0" aria-hidden="true">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{rule.description}</p>
        <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{meta.label}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Toggle id={`rule-${rule.id}`} checked={rule.enabled} onChange={onToggle} />
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
          aria-label="Delete rule"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Signal Source Toggle ──────────────────────────────────── */

function SignalToggle({ signal, onToggle }: { signal: SignalSource; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
      <span className="text-base shrink-0" aria-hidden="true">{signal.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>{signal.label}</p>
        <p className="text-[10px] truncate" style={{ color: 'var(--color-muted)' }}>{signal.description}</p>
      </div>
      <Toggle id={`signal-${signal.id}`} checked={signal.enabled} onChange={onToggle} />
    </div>
  );
}

/* ─── Preview Panel ─────────────────────────────────────────── */

function PreviewPanel({ currentWeights, proposedWeights }: { currentWeights: AlgorithmWeights; proposedWeights: AlgorithmWeights }) {
  // Show the diff between current and proposed weights
  const diffs = useMemo(() => {
    const result: Array<{ key: keyof AlgorithmWeights; label: string; icon: string; current: number; proposed: number; diff: number }> = [];
    for (const key of Object.keys(currentWeights) as Array<keyof AlgorithmWeights>) {
      const diff = proposedWeights[key] - currentWeights[key];
      if (diff !== 0 || proposedWeights[key] !== 50) {
        result.push({
          key,
          label: WEIGHT_LABELS[key].label,
          icon: WEIGHT_LABELS[key].icon,
          current: currentWeights[key],
          proposed: proposedWeights[key],
          diff,
        });
      }
    }
    return result.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [currentWeights, proposedWeights]);

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
        <span>📊</span> Feed Preview
      </h3>
      <p className="mb-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        How your feed would change with these weights:
      </p>
      {diffs.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>No changes yet. Adjust some weights above to see a preview.</p>
      ) : (
        <div className="space-y-2">
          {diffs.slice(0, 6).map((d) => {
            const isPositive = d.diff > 0;
            const isNeutral = d.diff === 0;
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span className="text-sm shrink-0">{d.icon}</span>
                <span className="flex-1 text-xs" style={{ color: 'var(--color-fg)' }}>{d.label}</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.abs(d.proposed)}%`,
                        backgroundColor: isPositive ? 'var(--color-accent)' : isNeutral ? 'var(--color-muted)' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono font-medium ${
                    isPositive ? 'text-degen-400' : isNeutral ? 'text-[var(--color-muted)]' : 'text-red-400'
                  }`}>
                    {isPositive ? '+' : ''}{d.diff}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {diffs.length > 0 && (
        <p className="mt-3 text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {diffs.filter((d) => d.diff > 0).length > 0
            ? '🟢 More weight on: ' + diffs.filter((d) => d.diff > 0).map((d) => d.label).join(', ')
            : ''}
          {diffs.filter((d) => d.diff > 0).length > 0 && diffs.filter((d) => d.diff < 0).length > 0 ? ' | ' : ''}
          {diffs.filter((d) => d.diff < 0).length > 0
            ? '🔴 Less weight on: ' + diffs.filter((d) => d.diff < 0).map((d) => d.label).join(', ')
            : ''}
        </p>
      )}
    </div>
  );
}

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

    // Persist immediately
    try {
      await fetch('/api/algo/weights/preset/' + preset.slug, {
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

  const handleAddRule = useCallback(async (rule: Omit<CustomRule, 'id' | 'createdAt' | 'enabled'>) => {
    const newRule: CustomRule = {
      ...rule,
      id: crypto.randomUUID(),
      enabled: true,
      createdAt: Date.now(),
    };

    // Optimistic update
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
  }, []);

  const handleToggleRule = useCallback(async (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
    // Note: proper toggle would need a PATCH endpoint; for now we re-save all rules
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
  }, [rules]);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    try {
      await fetch(`/api/algo/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Revert
      const res = await fetch('/api/algo/rules', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { rules: CustomRule[] };
        setRules(data.rules);
      }
    }
  }, []);

  const handleToggleSignal = useCallback(async (signalId: string) => {
    const updated = signals.map((s) =>
      s.id === signalId ? { ...s, enabled: !s.enabled } : s,
    );
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
  }, [signals]);

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

  // Share custom weights as a preset link
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Personalization
        </Link>
        <h1 className="text-2xl font-black" style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}>
          Feed Algorithm Tuner
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
          Take total control of your feed. Adjust weights, apply presets, and create custom rules to shape exactly what you see.
        </p>
      </div>

      {/* Save bar */}
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between rounded-xl border p-3 backdrop-blur-xl" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
        <div>
          {saved ? (
            <span className="flex items-center gap-1.5 text-xs text-degen-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved!
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {activePreset ? `Preset: ${PRESETS.find((p) => p.slug === activePreset)?.name ?? activePreset}` : 'Custom weights'}
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
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {/* ═══ 1. Presets ═══ */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🏷️</span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}>
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
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🎛️</span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}>
              Manual Weights
            </h2>
          </div>
          <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
            Fine-tune each factor individually. Higher weight = more influence on your feed.
          </p>
          <div className="rounded-xl border p-5" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
            <div className="space-y-5">
              {(Object.keys(WEIGHT_LABELS) as Array<keyof AlgorithmWeights>).map((key) => (
                <WeightSlider key={key} weightKey={key} value={weights[key]} onChange={handleWeightChange} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 3. Preview + Custom Share ═══ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PreviewPanel currentWeights={initialWeights} proposedWeights={weights} />
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
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
              <span className="text-lg" aria-hidden="true">⚙️</span>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}>
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
            Create IF/THEN rules like &quot;Boost posts from @alice&quot; or &quot;Mute #politics&quot;
          </p>

          {showRuleBuilder && (
            <div className="mb-4">
              <RuleBuilder onAdd={handleAddRule} />
            </div>
          )}

          {rules.length === 0 && !showRuleBuilder ? (
            <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No custom rules yet.</p>
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
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">📡</span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}>
              Signal Sources
            </h2>
          </div>
          <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
            Toggle which data signals the algorithm uses to rank content.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {signals.map((signal) => (
              <SignalToggle key={signal.id} signal={signal} onToggle={() => handleToggleSignal(signal.id)} />
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="mt-10 rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex items-start gap-3">
          <span className="text-lg" aria-hidden="true">💡</span>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>How it works</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Your feed algorithm scores every post using weighted signals. Higher weights give that signal more influence.
              Presets are a quick way to get a specific feed mood. Custom rules let you hard-code preferences.
              Changes apply to new feed loads — refresh your feed to see the effect.
            </p>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        .tune-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          background: var(--color-border);
          outline: none;
          cursor: pointer;
        }
        .tune-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-accent);
          cursor: pointer;
          box-shadow: 0 0 8px var(--color-accent-glow);
          border: 2px solid var(--color-bg);
        }
        .tune-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-accent);
          cursor: pointer;
          box-shadow: 0 0 8px var(--color-accent-glow);
          border: 2px solid var(--color-bg);
        }
        .tune-slider:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        .tune-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--color-glass-border);
          background: var(--color-bg-secondary);
          color: var(--color-fg);
          font-size: 0.75rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .tune-input:focus {
          border-color: var(--color-accent);
        }
        .tune-input::placeholder {
          color: var(--color-muted);
        }
        .toggle-track {
          display: inline-flex;
          width: 36px;
          height: 20px;
          padding: 2px;
          border-radius: 9999px;
          background: var(--color-border);
          cursor: pointer;
          border: none;
          transition: background 0.2s;
        }
        .toggle-track[aria-checked="true"] {
          background: var(--color-accent);
        }
        .toggle-thumb {
          display: block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-bg);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }
        .toggle-track[aria-checked="true"] .toggle-thumb {
          transform: translateX(16px);
        }
        @media (prefers-reduced-motion: reduce) {
          .toggle-track,
          .toggle-thumb,
          .tune-slider {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
