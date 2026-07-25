'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface TopicWeight {
  id: string;
  label: string;
  weight: number; // 0-100
}

interface ContentTypePref {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

type FeedMode = 'for-you' | 'following' | 'latest';
type DigestFreq = 'realtime' | 'hourly' | 'daily' | 'weekly';
type ProfileVis = 'public' | 'followers' | 'private';
type PostLength = 'short' | 'medium' | 'long';

interface DraggableProtocol {
  id: string;
  name: string;
  color: string;
  icon: string;
}

/* ─── Toggle Switch ──────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
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

/* ─── Slider ─────────────────────────────────────────────────── */

function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  label,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  id: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-input"
        aria-label={label}
      />
      <span
        className="w-8 text-right text-xs font-mono font-medium"
        style={{ color: 'var(--color-fg)' }}
      >
        {value}%
      </span>
    </div>
  );
}

/* ─── Section Heading ────────────────────────────────────────── */

function SectionHeading({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-lg" aria-hidden="true">
          {icon}
        </span>
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h2>
      </div>
      {desc && (
        <p className="ml-8 text-xs" style={{ color: 'var(--color-muted)' }}>
          {desc}
        </p>
      )}
    </div>
  );
}

/* ─── Option Button Group ────────────────────────────────────── */

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div
        className="flex gap-1.5 rounded-xl p-1"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 ${
              value === opt.value
                ? 'bg-degen-500 text-black shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════ */

export default function PersonalizationPage() {
  /* === Content Preferences === */
  const [topicWeights, setTopicWeights] = useState<TopicWeight[]>([
    { id: 'defi', label: 'DeFi', weight: 70 },
    { id: 'nft', label: 'NFTs & Art', weight: 50 },
    { id: 'memecoins', label: 'Meme Coins', weight: 60 },
    { id: 'infra', label: 'Infrastructure', weight: 40 },
    { id: 'gaming', label: 'Gaming', weight: 30 },
    { id: 'social', label: 'Social', weight: 55 },
    { id: 'privacy', label: 'Privacy', weight: 35 },
    { id: 'ai-crypto', label: 'AI × Crypto', weight: 45 },
  ]);
  const [postLength, setPostLength] = useState<PostLength>('medium');
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [contentWarnings, setContentWarnings] = useState(true);
  const [languagePrefs, setLanguagePrefs] = useState<string[]>(['en']);

  const [contentTypes, setContentTypes] = useState<ContentTypePref[]>([
    { id: 'text', label: 'Text', icon: '📝', enabled: true },
    { id: 'images', label: 'Images', icon: '🖼️', enabled: true },
    { id: 'video', label: 'Video', icon: '🎬', enabled: true },
    { id: 'audio', label: 'Audio', icon: '🎵', enabled: false },
    { id: 'links', label: 'Links', icon: '🔗', enabled: true },
  ]);

  /* === Feed Preferences === */
  const [defaultFeed, setDefaultFeed] = useState<FeedMode>('for-you');
  const [protocolOrder, setProtocolOrder] = useState<DraggableProtocol[]>([
    { id: 'farcaster', name: 'Farcaster', color: '#8a63d2', icon: 'F' },
    { id: 'nostr', name: 'Nostr', color: '#8b5cf6', icon: 'N' },
    { id: 'lens', name: 'Lens', color: '#abfe2c', icon: 'L' },
    { id: 'bluesky', name: 'Bluesky', color: '#1185fe', icon: 'B' },
    { id: 'mastodon', name: 'Mastodon', color: '#6364ff', icon: 'M' },
  ]);
  const [weights, setWeights] = useState({
    recency: 40,
    relevance: 70,
    diversity: 30,
    affinity: 50,
  });
  const [boredomBreaker, setBoredomBreaker] = useState(true);

  /* === Notification Preferences === */
  const [notifPerProtocol, setNotifPerProtocol] = useState<Record<string, boolean>>({
    nostr: true,
    farcaster: true,
    lens: true,
    bluesky: true,
    mastodon: false,
  });
  const [digestFreq, setDigestFreq] = useState<DigestFreq>('realtime');
  const [quietHours, setQuietHours] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');
  const [tipNotifs, setTipNotifs] = useState(true);

  /* === Privacy === */
  const [profileVis, setProfileVis] = useState<ProfileVis>('public');
  const [activityVis, setActivityVis] = useState(true);
  const [dataSharing, setDataSharing] = useState(true);

  const updateTopicWeight = useCallback((id: string, weight: number) => {
    setTopicWeights((prev) => prev.map((t) => (t.id === id ? { ...t, weight } : t)));
  }, []);

  const toggleContentType = useCallback((id: string) => {
    setContentTypes((prev) =>
      prev.map((ct) => (ct.id === id ? { ...ct, enabled: !ct.enabled } : ct)),
    );
  }, []);

  const moveProtocolUp = useCallback((id: string) => {
    setProtocolOrder((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveProtocolDown = useCallback((id: string) => {
    setProtocolOrder((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/settings"
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
          Back to Settings
        </Link>
        <h1
          className="text-2xl font-black"
          style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
        >
          Personalization
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
          Fine-tune your DegenFeed experience. Changes apply in real-time.
        </p>
      </div>

      <div className="space-y-10">
        {/* ═══ 1. Content Preferences ═══ */}
        <section>
          <SectionHeading
            icon="🎯"
            title="Content Preferences"
            desc="Control what shows up in your feed"
          />

          {/* Topic sliders */}
          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              Topic Interest Weights
            </h3>
            <p className="mb-4 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Drag to tell us how much you want to see of each topic
            </p>
            <div className="space-y-3">
              {topicWeights.map((topic) => (
                <div key={topic.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <label
                      htmlFor={`topic-${topic.id}`}
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-fg)' }}
                    >
                      {topic.label}
                    </label>
                  </div>
                  <Slider
                    id={`topic-${topic.id}`}
                    value={topic.weight}
                    onChange={(v) => updateTopicWeight(topic.id, v)}
                    label={`${topic.label} interest weight`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content type toggles */}
          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              Content Types
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {contentTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => toggleContentType(ct.id)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                    ct.enabled
                      ? 'border-degen-500/30 bg-degen-500/[0.04]'
                      : 'border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)] opacity-60 hover:opacity-100'
                  }`}
                  aria-pressed={ct.enabled}
                >
                  <span className="text-lg">{ct.icon}</span>
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                      {ct.label}
                    </span>
                    {ct.enabled && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="mt-0.5"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Post length + NSFW */}
          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <div className="space-y-4">
              <div>
                <span
                  className="mb-2 block text-xs font-medium"
                  style={{ color: 'var(--color-fg)' }}
                >
                  Post Length Preference
                </span>
                <OptionGroup
                  label="Post length"
                  options={[
                    { value: 'short', label: 'Short' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'long', label: 'Long' },
                  ]}
                  value={postLength}
                  onChange={(v) => setPostLength(v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    NSFW / Content Warnings
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Show sensitive content labeled with warnings
                  </p>
                </div>
                <Toggle id="nsfw-toggle" checked={nsfwEnabled} onChange={setNsfwEnabled} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    Content Warnings
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Blur media that has content warnings until clicked
                  </p>
                </div>
                <Toggle id="cw-toggle" checked={contentWarnings} onChange={setContentWarnings} />
              </div>

              <div>
                <span
                  className="mb-2 block text-xs font-medium"
                  style={{ color: 'var(--color-fg)' }}
                >
                  Language Preferences
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['en', 'es', 'ja', 'ko', 'zh', 'pt', 'de', 'fr'].map((lang) => {
                    const selected = languagePrefs.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() =>
                          setLanguagePrefs((prev) =>
                            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                          selected
                            ? 'bg-degen-500/15 text-degen-400'
                            : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                        }`}
                        aria-pressed={selected}
                      >
                        {lang}
                      </button>
                    );
                  })}
                  {languagePrefs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLanguagePrefs([])}
                      className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] px-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 2. Feed Preferences ═══ */}
        <section>
          <SectionHeading
            icon="📰"
            title="Feed Preferences"
            desc="Customize how your feed looks and behaves"
          />

          {/* Default feed mode */}
          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
              Default Feed
            </span>
            <OptionGroup
              label="Default feed mode"
              options={[
                { value: 'for-you', label: 'For You' },
                { value: 'following', label: 'Following' },
                { value: 'latest', label: 'Latest' },
              ]}
              value={defaultFeed}
              onChange={(v) => setDefaultFeed(v)}
            />
          </div>

          {/* Protocol drag-to-reorder */}
          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              Protocol Priority Order
            </h3>
            <p className="mb-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Reorder which protocols appear first in your feed
            </p>
            <div className="space-y-1.5">
              {protocolOrder.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5"
                  style={{
                    borderColor: 'var(--color-glass-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                  }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                    style={{ backgroundColor: `${p.color}20`, color: p.color }}
                  >
                    {p.icon}
                  </span>
                  <span className="flex-1 text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    {p.name}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">#{idx + 1}</span>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveProtocolUp(p.id)}
                      disabled={idx === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] disabled:opacity-30"
                      aria-label={`Move ${p.name} up`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProtocolDown(p.id)}
                      disabled={idx === protocolOrder.length - 1}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] disabled:opacity-30"
                      aria-label={`Move ${p.name} down`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Algorithm tuner */}
          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                Algorithm Tuner
              </h3>
              <Link
                href="/feed/tune"
                className="rounded-lg bg-degen-500/15 px-2.5 py-1 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-colors"
              >
                Full Tuner →
              </Link>
            </div>
            <p className="mb-4 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Adjust how the feed algorithm scores content
            </p>
            <div className="space-y-3">
              {[
                { id: 'recency', label: 'Recency', desc: 'How recent the post is' },
                { id: 'relevance', label: 'Relevance', desc: 'Match to your interests' },
                { id: 'diversity', label: 'Diversity', desc: 'Mix of different topics' },
                { id: 'affinity', label: 'Creator Affinity', desc: 'Accounts you interact with' },
              ].map((w) => (
                <div key={w.id}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <label
                      htmlFor={`weight-${w.id}`}
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-fg)' }}
                    >
                      {w.label}
                    </label>
                    <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                      {w.desc}
                    </span>
                  </div>
                  <Slider
                    id={`weight-${w.id}`}
                    value={weights[w.id as keyof typeof weights]}
                    onChange={(v) => setWeights((prev) => ({ ...prev, [w.id]: v }))}
                    label={`${w.label} weight`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Boredom breaker */}
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">
                  🎲
                </span>
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    Boredom Breaker
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Inject discovery content periodically to keep things fresh
                  </p>
                </div>
              </div>
              <Toggle id="boredom-breaker" checked={boredomBreaker} onChange={setBoredomBreaker} />
            </div>
          </div>
        </section>

        {/* ═══ 3. Notification Preferences ═══ */}
        <section>
          <SectionHeading
            icon="🔔"
            title="Notification Preferences"
            desc="Control how and when you get notified"
          />

          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              Per-Protocol Notifications
            </h3>
            <div className="space-y-3">
              {Object.entries(notifPerProtocol).map(([protocol, enabled]) => (
                <div key={protocol} className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium capitalize"
                    style={{ color: 'var(--color-fg)' }}
                  >
                    {protocol}
                  </span>
                  <Toggle
                    id={`notif-${protocol}`}
                    checked={enabled}
                    onChange={(v) => setNotifPerProtocol((prev) => ({ ...prev, [protocol]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
              Digest Frequency
            </span>
            <OptionGroup
              label="Digest frequency"
              options={[
                { value: 'realtime', label: 'Real-time' },
                { value: 'hourly', label: 'Hourly' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
              ]}
              value={digestFreq}
              onChange={(v) => setDigestFreq(v)}
            />
          </div>

          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    Quiet Hours
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Mute notifications during specific times
                  </p>
                </div>
                <Toggle id="quiet-hours" checked={quietHours} onChange={setQuietHours} />
              </div>
              {quietHours && (
                <div className="flex items-center gap-3">
                  <div>
                    <label
                      htmlFor="quiet-start"
                      className="block text-[10px] text-[var(--color-muted)] mb-1"
                    >
                      From
                    </label>
                    <input
                      id="quiet-start"
                      type="time"
                      value={quietStart}
                      onChange={(e) => setQuietStart(e.target.value)}
                      className="input !w-auto !py-1.5 text-xs"
                    />
                  </div>
                  <span className="text-xs text-[var(--color-muted)] mt-5">→</span>
                  <div>
                    <label
                      htmlFor="quiet-end"
                      className="block text-[10px] text-[var(--color-muted)] mb-1"
                    >
                      To
                    </label>
                    <input
                      id="quiet-end"
                      type="time"
                      value={quietEnd}
                      onChange={(e) => setQuietEnd(e.target.value)}
                      className="input !w-auto !py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-glass-border)]">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    Tip Notifications
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Get notified when someone tips you
                  </p>
                </div>
                <Toggle id="tip-notifs" checked={tipNotifs} onChange={setTipNotifs} />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 4. Privacy ═══ */}
        <section>
          <SectionHeading icon="🛡️" title="Privacy" desc="Control your visibility and data" />

          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <span className="mb-2 block text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
              Profile Visibility
            </span>
            <OptionGroup
              label="Profile visibility"
              options={[
                { value: 'public', label: 'Public' },
                { value: 'followers', label: 'Followers' },
                { value: 'private', label: 'Private' },
              ]}
              value={profileVis}
              onChange={(v) => setProfileVis(v)}
            />
          </div>

          <div
            className="mb-6 rounded-xl border p-5"
            style={{
              borderColor: 'var(--color-glass-border)',
              backgroundColor: 'var(--color-card)',
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    Activity Visibility
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Show your likes, follows, and tips to others
                  </p>
                </div>
                <Toggle id="activity-vis" checked={activityVis} onChange={setActivityVis} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-glass-border)]">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                    Data Sharing
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Help improve DegenFeed with anonymous usage data
                  </p>
                </div>
                <Toggle id="data-sharing" checked={dataSharing} onChange={setDataSharing} />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Custom slider styles */}
      <style>{`
        .slider-input {
          -webkit-appearance: none;
          appearance: none;
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--color-border);
          outline: none;
          cursor: pointer;
        }
        .slider-input::-webkit-slider-thumb {
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
        .slider-input::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-accent);
          cursor: pointer;
          box-shadow: 0 0 8px var(--color-accent-glow);
          border: 2px solid var(--color-bg);
        }
        .slider-input:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .toggle-track,
          .toggle-thumb {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
