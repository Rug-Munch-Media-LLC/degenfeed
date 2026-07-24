/**
 * @degenfeed/web — Feed Tuner UI Component
 *
 * Types, config, and helpers moved to ./feed/feed-tuner-types.ts.
 * Re-exported here for backward compatibility.
 *
 * IMPORTANT: The prop interface must match the feed/page.tsx usage exactly.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// Re-export all types and helpers for backward compatibility
export type {
  ContentTypeWeights,
  FeedMixConfig,
  FeedPreset,
  ProtocolWeight,
  SavedMix,
  TopicDef,
} from './feed/feed-tuner-types';
export {
  CONTENT_TYPE_LABELS,
  countTunedTopics,
  DEFAULT_WEIGHT,
  encodeTopicWeights,
  FEED_PRESETS,
  getDefaultFeedMixConfig,
  getDefaultProtocols,
  getDefaultWeights,
  loadFeedMixConfig,
  loadSavedMixes,
  PREBUILT_MIXES,
  PROTOCOLS,
  saveFeedMixConfig,
  saveSavedMixes,
  TOPICS,
} from './feed/feed-tuner-types';

import type {
  ContentTypeWeights,
  FeedMixConfig,
  FeedPreset,
  ProtocolWeight,
  SavedMix,
} from './feed/feed-tuner-types';
import {
  CONTENT_TYPE_LABELS,
  countTunedTopics,
  DEFAULT_WEIGHT,
  PROTOCOLS,
  TOPICS,
} from './feed/feed-tuner-types';

// ─── Preview Post Generator ──────────────────────────────────

interface PreviewPost {
  id: string;
  protocol: string;
  content: string;
  author: { name: string; avatar: string };
  engagement: number;
}

function generatePreviewPosts(config: FeedMixConfig): PreviewPost[] {
  const posts: PreviewPost[] = [];
  const protocols = Object.entries(config.protocols)
    .filter(([, p]) => p.weight > 0)
    .sort(([, a], [, b]) => b.weight - a.weight);

  const sampleTexts: Record<string, string[]> = {
    nostr: ['gm degen frens ☕', 'just bought the dip again', 'nostr is the way'],
    farcaster: ['gm from farcaster 🌞', 'hot take: layer 2s are…', 'farcaster native content'],
    lens: ['gm on lens 🌿', 'just published on lens', 'lenster content here'],
    bluesky: ['gm from bluesky 🦋', 'bluesky thread time', 'bsky native vibes'],
    mastodon: ['gm from mastodon 🐘', 'mastodon post #fediverse', 'hello from mastodon'],
    reddit: ['r/crypto thread', 'check out this discussion', 'reddit hot take'],
    rss: ['Latest crypto news', 'Market update: BTC at…', 'New DeFi protocol launch'],
  };

  for (const [proto, p] of protocols) {
    const count = Math.max(1, Math.round((p.weight / 100) * 3));
    for (let i = 0; i < count; i++) {
      const texts = sampleTexts[proto] ?? ['sample content'];
      posts.push({
        id: `preview-${proto}-${i}`,
        protocol: proto,
        content: texts[i % texts.length] ?? 'sample content',
        author: { name: `${proto} user`, avatar: '' },
        engagement: Math.round(p.weight * (1 + Math.random())),
      });
    }
  }
  return posts.sort(() => Math.random() - 0.5);
}

// ─── UI Helpers ──────────────────────────────────────────────

function sliderGradient(weight: number): string {
  const pct = (weight / 100) * 100;
  return `linear-gradient(to right, var(--degen-400) ${pct}%, var(--color-glass-border) ${pct}%)`;
}

function weightLabel(weight: number): string {
  if (weight >= 90) return 'Maximum';
  if (weight >= 70) return 'High';
  if (weight >= 40) return 'Medium';
  if (weight >= 10) return 'Low';
  return 'Off';
}

// ─── FeedTuner Props (matches feed/page.tsx) ─────────────────

interface FeedTunerProps {
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
  onApply: (weights: Record<string, number>) => void;
  onReset: () => void;
  onClose: () => void;
  feedMixConfig: FeedMixConfig;
  onFeedMixChange: (config: FeedMixConfig) => void;
  onFeedMixApply: (config: FeedMixConfig) => void;
  onFeedMixReset: () => void;
  savedMixes: SavedMix[];
  onSaveMix: (mix: SavedMix) => void;
  onLoadMix: (mix: SavedMix) => void;
  onDeleteMix: (id: string) => void;
  algorithmTransparent: boolean;
  onAlgorithmTransparencyChange: (v: boolean) => void;
  freshnessPreference: number;
  onFreshnessChange: (v: number) => void;
  creatorDiversity: number;
  onCreatorDiversityChange: (v: number) => void;
  exploreRatio: number;
  onExploreRatioChange: (v: number) => void;
  activePreset: string | null;
  onApplyPreset: (presetId: string) => void;
  feedPresets: FeedPreset[];
}

export function FeedTuner(props: FeedTunerProps) {
  const {
    weights,
    onWeightsChange,
    onApply,
    onReset,
    onClose,
    feedMixConfig,
    onFeedMixChange,
    onFeedMixApply,
    onFeedMixReset,
    savedMixes,
    onSaveMix,
    onLoadMix,
    onDeleteMix,
    algorithmTransparent,
    onAlgorithmTransparencyChange,
    freshnessPreference,
    onFreshnessChange,
    creatorDiversity,
    onCreatorDiversityChange,
    exploreRatio,
    onExploreRatioChange,
    activePreset,
    onApplyPreset,
    feedPresets,
  } = props;

  const [activeTab, setActiveTab] = useState<'mix' | 'topics' | 'presets'>('mix');
  const [localWeights, setLocalWeights] = useState(weights);
  const [localConfig, setLocalConfig] = useState<FeedMixConfig>(feedMixConfig);

  useEffect(() => {
    setLocalWeights(weights);
  }, [weights]);
  useEffect(() => {
    setLocalConfig(feedMixConfig);
  }, [feedMixConfig]);

  const previewPosts = useMemo(() => generatePreviewPosts(localConfig), [localConfig]);

  // ── Mix Tab ──
  const handleProtocolWeight = useCallback((proto: string, weight: number) => {
    setLocalConfig((prev) => {
      const existing = prev.protocols[proto];
      const safe: ProtocolWeight = existing ?? {
        weight: 50,
        minEngagement: 0,
        verifiedOnly: false,
        minContentLength: 0,
      };
      return { ...prev, protocols: { ...prev.protocols, [proto]: { ...safe, weight } } };
    });
  }, []);

  const handleContentTypeWeight = useCallback((type: keyof ContentTypeWeights, weight: number) => {
    setLocalConfig((prev) => ({ ...prev, contentTypes: { ...prev.contentTypes, [type]: weight } }));
  }, []);

  // ── Topics Tab ──
  const handleTopicWeight = useCallback((topicId: string, weight: number) => {
    setLocalWeights((prev) => ({ ...prev, [topicId]: weight }));
  }, []);

  const handleTopicsApply = useCallback(() => {
    onApply(localWeights);
    onClose();
  }, [localWeights, onApply, onClose]);
  const handleMixApply = useCallback(() => {
    onFeedMixApply(localConfig);
    onClose();
  }, [localConfig, onFeedMixApply, onClose]);

  // ── Presets Tab ──
  const handleSaveCurrent = useCallback(() => {
    onSaveMix(localConfig as unknown as SavedMix);
  }, [localConfig, onSaveMix]);

  // ── Render ──
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto pt-12 pb-8">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-bg)] shadow-2xl"
        role="dialog"
        aria-label="Feed tuner"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-fg)]">Feed Tuner</h2>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Fine-tune your feed mix and topics
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-glass-border)] px-5">
          {(['mix', 'topics', 'presets'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-degen-400 text-[var(--color-fg)]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {tab === 'mix' ? 'Mix' : tab === 'topics' ? 'Topics' : 'Presets'}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-6">
          {/* MIX TAB */}
          {activeTab === 'mix' && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  Protocol Weights
                </h3>
                <div className="space-y-3">
                  {PROTOCOLS.map((proto) => {
                    const w = localConfig.protocols[proto.id]?.weight ?? 50;
                    return (
                      <div key={proto.id} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-[var(--color-muted)] shrink-0">
                          {proto.label}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={w}
                          onChange={(e) => handleProtocolWeight(proto.id, Number(e.target.value))}
                          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ background: sliderGradient(w) }}
                        />
                        <span className="w-14 text-right text-xs font-medium text-[var(--color-fg)] tabular-nums">
                          {w}%
                        </span>
                        <span className="w-14 text-[10px] text-[var(--color-muted)]">
                          {weightLabel(w)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  Content Types
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    Object.entries(CONTENT_TYPE_LABELS) as [
                      keyof ContentTypeWeights,
                      (typeof CONTENT_TYPE_LABELS)[keyof ContentTypeWeights],
                    ][]
                  ).map(([key, meta]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm">{meta.icon}</span>
                      <span className="text-xs text-[var(--color-muted)] flex-1">{meta.label}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={localConfig.contentTypes[key]}
                        onChange={(e) => handleContentTypeWeight(key, Number(e.target.value))}
                        className="w-20 h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ background: sliderGradient(localConfig.contentTypes[key]) }}
                      />
                      <span className="w-8 text-right text-[10px] text-[var(--color-muted)] tabular-nums">
                        {localConfig.contentTypes[key]}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  Preview
                </h3>
                <div className="space-y-1.5">
                  {previewPosts.slice(0, 5).map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2"
                    >
                      <span className="text-lg">
                        {PROTOCOLS.find((p) => p.id === post.protocol)?.icon ?? '📄'}
                      </span>
                      <span className="flex-1 text-xs text-[var(--color-muted)] truncate">
                        {post.content}
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {post.engagement} pts
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* TOPICS TAB */}
          {activeTab === 'topics' && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                Topic Weights ({countTunedTopics(localWeights)} tuned)
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {TOPICS.map((topic) => {
                  const w = localWeights[topic.id] ?? DEFAULT_WEIGHT;
                  const isTuned = w !== DEFAULT_WEIGHT;
                  return (
                    <div key={topic.id} className="flex items-center gap-2">
                      <span className="w-5 text-center text-sm">{topic.icon}</span>
                      <span className="flex-1 text-xs text-[var(--color-muted)]">
                        {topic.label}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={w}
                        onChange={(e) => handleTopicWeight(topic.id, Number(e.target.value))}
                        className="w-16 h-1 rounded-full appearance-none cursor-pointer"
                        style={{ background: sliderGradient(w) }}
                      />
                      <span
                        className={`w-8 text-right text-[10px] tabular-nums ${isTuned ? 'text-degen-400 font-medium' : 'text-[var(--color-muted)]'}`}
                      >
                        {w}
                      </span>
                    </div>
                  );
                })}
              </div>
              {countTunedTopics(localWeights) > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="mt-4 text-xs text-degen-400 hover:text-degen-300 transition-colors"
                >
                  Reset all topics to default
                </button>
              )}
            </section>
          )}

          {/* PRESETS TAB */}
          {activeTab === 'presets' && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                Saved Mixes
              </h3>
              {savedMixes.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No saved mixes yet.</p>
              ) : (
                <div className="space-y-2">
                  {savedMixes.map((mix) => (
                    <div
                      key={mix.id}
                      className="flex items-center justify-between rounded-lg bg-[var(--color-overlay)] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--color-fg)]">{mix.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{mix.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onLoadMix(mix)}
                          className="text-xs text-degen-400 hover:text-degen-300"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMix(mix.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="mt-3 w-full rounded-lg border border-dashed border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)] transition-colors"
              >
                + Save current mix
              </button>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-glass-border)] px-5 py-3">
          <button
            type="button"
            onClick={activeTab === 'topics' ? onReset : onFeedMixReset}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            {activeTab === 'topics' ? 'Reset topics' : 'Reset mix'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={activeTab === 'topics' ? handleTopicsApply : handleMixApply}
              className="btn-primary text-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
