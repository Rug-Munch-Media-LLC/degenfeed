'use client';

import { useState } from 'react';
import type { CustomRule } from './types';
import { RULE_TYPE_LABELS } from './types';
import { Toggle } from './WeightSliders';

/* ─── Rule Builder ──────────────────────────────────────────── */

export default function RuleBuilder({
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
      type, adjustment, description: '',
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
    setCreatorId('');
    setCreatorName('');
    setHashtag('');
    setMinLikes(10);
    setContentType('text');
    setAdjustment(30);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}
    >
      <h4 className="mb-3 text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
        Add a Custom Rule
      </h4>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {(Object.entries(RULE_TYPE_LABELS) as Array<[CustomRule['type'], { label: string; icon: string; fields: string[] }]>).map(
          ([key, meta]) => (
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
          ),
        )}
      </div>
      <div className="mb-3 space-y-2">
        {type === 'boost-creator' && (
          <>
            <div>
              <label htmlFor="rule-creator-id" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
                Creator ID (wallet address or protocol ID)
              </label>
              <input id="rule-creator-id" type="text" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}
                placeholder="e.g. 0x... or npub1..." className="tune-input" required />
            </div>
            <div>
              <label htmlFor="rule-creator-name" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
                Display name (optional)
              </label>
              <input id="rule-creator-name" type="text" value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
                placeholder="e.g. @alice" className="tune-input" />
            </div>
            <div>
              <label htmlFor="rule-adjustment" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
                Score boost: +{adjustment}%
              </label>
              <input id="rule-adjustment" type="range" min={5} max={100} step={5} value={adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value))} className="tune-slider" />
            </div>
          </>
        )}
        {type === 'mute-hashtag' && (
          <div>
            <label htmlFor="rule-hashtag" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
              Hashtag to mute
            </label>
            <input id="rule-hashtag" type="text" value={hashtag} onChange={(e) => setHashtag(e.target.value)}
              placeholder="e.g. politics" className="tune-input" required />
          </div>
        )}
        {type === 'min-engagement' && (
          <div>
            <label htmlFor="rule-min-likes" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
              Minimum likes: {minLikes}
            </label>
            <input id="rule-min-likes" type="range" min={0} max={500} step={5} value={minLikes}
              onChange={(e) => setMinLikes(Number(e.target.value))} className="tune-slider" />
          </div>
        )}
        {type === 'content-type' && (
          <div>
            <label htmlFor="rule-content-type" className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-fg)' }}>
              Content type to show
            </label>
            <select id="rule-content-type" value={contentType} onChange={(e) => setContentType(e.target.value)} className="tune-input">
              <option value="text">Text</option>
              <option value="image">Images</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="link">Links</option>
            </select>
          </div>
        )}
      </div>
      <button type="submit" className="w-full rounded-lg bg-degen-500/20 py-2 text-xs font-semibold text-degen-400 hover:bg-degen-500/30 transition-colors">
        Add Rule
      </button>
    </form>
  );
}

/* ─── Rule Item ─────────────────────────────────────────────── */

export function RuleItem({
  rule,
  onToggle,
  onDelete,
}: {
  rule: CustomRule;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{
        borderColor: 'var(--color-glass-border)',
        backgroundColor: 'var(--color-card)',
        opacity: rule.enabled ? 1 : 0.5,
      }}
    >
      <span className="text-lg shrink-0" aria-hidden="true">
        {RULE_TYPE_LABELS[rule.type]?.icon ?? '⚙️'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>
          {rule.description}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          Type: {RULE_TYPE_LABELS[rule.type]?.label ?? rule.type}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Toggle id={`rule-toggle-${rule.id}`} checked={rule.enabled} onChange={onToggle} />
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
          aria-label={`Delete rule ${rule.description}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
