'use client';

import type { FeedRecipe, Protocol } from '@degenfeed/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────

const SOURCES = [
  { id: 'nostr', label: 'Nostr', emoji: '⚡' },
  { id: 'farcaster', label: 'Farcaster', emoji: '🟣' },
  { id: 'lens', label: 'Lens', emoji: '🌿' },
  { id: 'bluesky', label: 'Bluesky', emoji: '🦋' },
  { id: 'mastodon', label: 'Mastodon', emoji: '🐘' },
  { id: 'threads', label: 'Threads', emoji: '🧵' },
  { id: 'reddit', label: 'Reddit', emoji: '🔴' },
  { id: 'rss', label: 'RSS', emoji: '📰' },
  { id: 'lemmy', label: 'Lemmy', emoji: '🌲' },
  { id: 'peertube', label: 'PeerTube', emoji: '📺' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
] as const;

const TOPICS = [
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'nft', label: 'NFT', emoji: '🖼' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'memes', label: 'Memes', emoji: '😂' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'social', label: 'Social', emoji: '💬' },
  { id: 'tech', label: 'Tech', emoji: '💻' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'politics', label: 'Politics', emoji: '🏛' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'news', label: 'News', emoji: '📰' },
  { id: 'crypto', label: 'Crypto', emoji: '₿' },
  { id: 'security', label: 'Security', emoji: '🔒' },
] as const;

const CONTENT_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'link', label: 'Links' },
  { id: 'thread', label: 'Threads' },
] as const;

const LANGUAGES = [
  { code: '', label: 'Any' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'pt', label: 'Portuguese' },
] as const;

const STEPS = ['Name', 'Sources', 'Topics', 'Filters', 'Preview'];

const DEFAULT_CONFIG: FeedRecipe = {
  sources: ['farcaster' as Protocol, 'lens' as Protocol],
  topics: {},
  contentTypes: ['text', 'image', 'video', 'link', 'thread'],
  minEngagement: 0,
  excludeTopics: [],
  excludeWords: [],
};

// ─── Types ────────────────────────────────────────────────────

export interface FeedBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (feed: {
    name: string;
    description: string;
    isPublic: boolean;
    config: FeedRecipe;
  }) => Promise<{ ok: boolean; error?: string }>;
  initial?: {
    name: string;
    description: string;
    isPublic: boolean;
    config: FeedRecipe;
  };
}

// ─── Component ────────────────────────────────────────────────

export function FeedBuilderModal({
  open,
  onClose,
  onSave,
  initial,
}: FeedBuilderModalProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [config, setConfig] = useState<FeedRecipe>({ ...DEFAULT_CONFIG, topics: {}, contentTypes: [...DEFAULT_CONFIG.contentTypes] });
  const [customTopic, setCustomTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset on open / init
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setDescription(initial.description);
      setIsPublic(initial.isPublic);
      setConfig({ ...initial.config, topics: { ...initial.config.topics }, contentTypes: [...initial.config.contentTypes] });
    } else {
      setName('');
      setDescription('');
      setIsPublic(false);
      setConfig({ ...DEFAULT_CONFIG, topics: {}, contentTypes: [...DEFAULT_CONFIG.contentTypes] });
    }
    setStep(0);
    setError(null);
    setSaving(false);
    setCustomTopic('');
  }, [open, initial]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const el = overlayRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = el.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const f = focusable[0];
      const l = focusable[focusable.length - 1];
      if (!f || !l) return;
      if (e.shiftKey && document.activeElement === f) { l.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === l) { f.focus(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const toggleSource = useCallback((id: string) => {
    setConfig((prev) => {
      const sourceId = id as Protocol;
      const has = prev.sources.includes(sourceId);
      return {
        ...prev,
        sources: has
          ? prev.sources.filter((s) => s !== sourceId)
          : [...prev.sources, sourceId],
      };
    });
  }, []);

  const setTopicWeight = useCallback((topic: string, weight: number) => {
    setConfig((prev) => ({
      ...prev,
      topics: { ...prev.topics, [topic]: weight },
    }));
  }, []);

  const addCustomTopic = useCallback(() => {
    const t = customTopic.trim().toLowerCase();
    if (!t || config.topics[t] !== undefined) return;
    setConfig((prev) => ({ ...prev, topics: { ...prev.topics, [t]: 50 } }));
    setCustomTopic('');
  }, [customTopic, config.topics]);

  const toggleContentType = useCallback((id: string) => {
    setConfig((prev) => {
      const has = prev.contentTypes.includes(id);
      return {
        ...prev,
        contentTypes: has
          ? prev.contentTypes.filter((c) => c !== id)
          : [...prev.contentTypes, id],
      };
    });
  }, []);

  const toggleExcludeTopic = useCallback((topic: string) => {
    setConfig((prev) => {
      const has = prev.excludeTopics.includes(topic);
      return {
        ...prev,
        excludeTopics: has
          ? prev.excludeTopics.filter((t) => t !== topic)
          : [...prev.excludeTopics, topic],
      };
    });
  }, []);

  const canAdvance = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return config.sources.length > 0;
    return true;
  }, [step, name, config.sources]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await onSave({ name: name.trim(), description: description.trim(), isPublic, config });
      if (result.ok) {
        onClose();
      } else {
        setError(result.error || 'Failed to save feed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feed');
    } finally {
      setSaving(false);
    }
  }, [name, description, isPublic, config, onSave, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--color-card)] shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">
            {initial ? 'Edit Feed' : 'Create Custom Feed'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                disabled
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  i === step
                    ? 'bg-degen-500 text-black'
                    : i < step
                      ? 'bg-degen-500/30 text-degen-400'
                      : 'bg-white/10 text-gray-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </button>
              <span className={`text-[10px] hidden sm:block ${i === step ? 'text-degen-400 font-semibold' : 'text-gray-500'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < step ? 'bg-degen-500/50' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Name & Description */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-1.5">
                  Feed Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. "DeFi Deep Dive"'
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-500 focus:border-degen-500/50 focus:outline-none focus:ring-1 focus:ring-degen-500/30 transition-colors"
                  autoFocus
                />
                <p className="mt-1 text-right text-[10px] text-gray-500">{name.length}/100</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g. "Farcaster + Lens, DeFi only, high engagement"'
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-500 focus:border-degen-500/50 focus:outline-none focus:ring-1 focus:ring-degen-500/30 transition-colors resize-none"
                />
                <p className="mt-1 text-right text-[10px] text-gray-500">{description.length}/500</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${isPublic ? 'bg-degen-500' : 'bg-white/20'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">Make public</p>
                  <p className="text-xs text-gray-500">Other users can discover and subscribe</p>
                </div>
              </label>
            </div>
          )}

          {/* Step 2: Source Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Choose protocols to include. At least one required.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SOURCES.map((src) => {
                  const selected = config.sources.includes(src.id);
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => toggleSource(src.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                        selected
                          ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-base">{src.emoji}</span>
                      <span>{src.label}</span>
                      {selected && <span className="ml-auto text-degen-400">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                {config.sources.length} source{config.sources.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {/* Step 3: Topic Tuning */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Boost topics you care about (0 = off, 100 = max boost).
              </p>
              <div className="space-y-3">
                {TOPICS.map((topic) => (
                  <div key={topic.id} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center shrink-0">{topic.emoji}</span>
                    <span className="text-sm text-[var(--color-fg)] w-20 shrink-0">{topic.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={config.topics[topic.id] ?? 0}
                      onChange={(e) => setTopicWeight(topic.id, Number(e.target.value))}
                      className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-degen-500"
                      aria-label={`${topic.label} boost weight`}
                    />
                    <span className="text-xs font-mono text-gray-400 w-8 text-right">
                      {config.topics[topic.id] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
              {/* Custom topic */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Add custom topic"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-500 focus:border-degen-500/50 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTopic(); } }}
                />
                <button
                  type="button"
                  onClick={addCustomTopic}
                  disabled={!customTopic.trim()}
                  className="rounded-lg bg-degen-500/20 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
              {/* Custom topics display */}
              {Object.keys(config.topics).filter((t) => !TOPICS.find((pt) => pt.id === t)).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(config.topics)
                    .filter(([t]) => !TOPICS.find((pt) => pt.id === t))
                    .map(([t, w]) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2.5 py-1 text-xs text-degen-400">
                        {t} {w > 0 && <span className="text-gray-500">({w})</span>}
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => {
                            const next = { ...prev.topics };
                            delete next[t];
                            return { ...prev, topics: next };
                          })}
                          className="ml-0.5 text-gray-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Filters */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
                  Content Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map((ct) => {
                    const selected = config.contentTypes.includes(ct.id);
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => toggleContentType(ct.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-degen-500/15 text-degen-400 border border-degen-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:text-gray-300'
                        }`}
                      >
                        {ct.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
                  Minimum Engagement (likes + reposts)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={config.minEngagement}
                    onChange={(e) => setConfig((prev) => ({ ...prev, minEngagement: Number(e.target.value) }))}
                    className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-degen-500"
                  />
                  <span className="text-xs font-mono text-degen-400 w-8 text-right">{config.minEngagement}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
                  Language
                </label>
                <select
                  value={config.language || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, language: e.target.value || undefined }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[var(--color-fg)] focus:border-degen-500/50 focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[var(--color-card)]">{l.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
                  Exclude Words (comma separated)
                </label>
                <input
                  type="text"
                  value={config.excludeWords.join(', ')}
                  onChange={(e) => setConfig((prev) => ({ ...prev, excludeWords: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) }))}
                  placeholder="politics, crypto crash, scam"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-gray-500 focus:border-degen-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">
                  Exclude Topics
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((topic) => {
                    const excluded = config.excludeTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleExcludeTopic(topic.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          excluded
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:text-gray-300'
                        }`}
                      >
                        {excluded ? '✕ ' : ''}{topic.emoji} {topic.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Preview & Save */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-fg)]">{name}</h3>
                  {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isPublic ? 'bg-degen-500/10 text-degen-400' : 'bg-white/10 text-gray-400'}`}>
                    {isPublic ? '🌍 Public' : '🔒 Private'}
                  </span>
                  <span>{config.sources.length} source{config.sources.length !== 1 ? 's' : ''}</span>
                  <span>{Object.keys(config.topics).filter((t) => (config.topics[t] ?? 0) > 0).length} boosted topic{Object.keys(config.topics).filter((t) => (config.topics[t] ?? 0) > 0).length !== 1 ? 's' : ''}</span>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1.5">Sources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.sources.map((src) => {
                      const meta = SOURCES.find((s) => s.id === src);
                      return (
                        <span key={src} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">
                          {meta?.emoji} {meta?.label || src}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {Object.keys(config.topics).filter((t) => (config.topics[t] ?? 0) > 0).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1.5">Boosted Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(config.topics)
                        .filter(([, w]) => w > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([t, w]) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2 py-0.5 text-xs text-degen-400">
                            {t} <span className="text-gray-500">({w})</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1.5">Filters</p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <span className="block">Content: {config.contentTypes.join(', ') || 'none'}</span>
                    {config.minEngagement > 0 && <span className="block">Min engagement: {config.minEngagement}</span>}
                    {config.language && <span className="block">Language: {config.language}</span>}
                    {config.excludeWords.length > 0 && <span className="block">Excluded words: {config.excludeWords.slice(0, 3).join(', ')}{config.excludeWords.length > 3 ? ` +${config.excludeWords.length - 3} more` : ''}</span>}
                    {config.excludeTopics.length > 0 && <span className="block">Excluded topics: {config.excludeTopics.join(', ')}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save Feed'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
