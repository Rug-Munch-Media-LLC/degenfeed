'use client';

/**
 * @degenfeed/web — Go Live Flow Wizard
 *
 * A multi-step wizard for streamers to start a live stream:
 *   Step 1 — Choose Platform (Owncast, PeerTube, or Both)
 *   Step 2 — Stream Configuration (title, description, category, tags, privacy)
 *   Step 3 — Get Stream Key (RTMP URL + stream key with copy buttons)
 *   Step 4 — Go Live! (activate + share on Twitter, Nostr, Farcaster)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

type LivePlatform = 'owncast' | 'peertube' | 'both';

interface StreamConfig {
  title: string;
  description: string;
  category: string;
  tags: string[];
  privacy: 'public' | 'unlisted' | 'private';
  chatEnabled: boolean;
  recordingEnabled: boolean;
  thumbnail: File | null;
  thumbnailPreview: string;
}

interface StreamConnection {
  streamKey: string;
  rtmpUrl: string;
  playbackUrl: string;
  embedUrl: string;
  streamId: string;
  platformMessages: Record<string, { ok: boolean; id?: string; url?: string; error?: string }>;
}

type Step = 1 | 2 | 3 | 4;

// ─── Categories ───────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '🪙' },
  { id: 'art', label: 'Art & Creative', icon: '🎨' },
  { id: 'irl', label: 'IRL & Lifestyle', icon: '🌍' },
  { id: 'talk', label: 'Talk Shows & Podcasts', icon: '🎙️' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'tech', label: 'Tech & Coding', icon: '💻' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'trading', label: 'Trading', icon: '📈' },
];

const TAGS_PRESETS = [
  'live',
  'stream',
  'crypto',
  'web3',
  'defi',
  'nft',
  'gaming',
  'music',
  'tech',
  'education',
];

// ─── Step Indicator ───────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { step: 1, label: 'Platform' },
    { step: 2, label: 'Configure' },
    { step: 3, label: 'Stream Key' },
    { step: 4, label: 'Go Live' },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              currentStep === s.step
                ? 'bg-degen-500 text-black shadow-[0_0_12px_var(--color-accent-glow)]'
                : currentStep > s.step
                  ? 'bg-degen-500/30 text-degen-400'
                  : 'bg-white/10 text-white/40'
            }`}
          >
            {currentStep > s.step ? '✓' : s.step}
          </div>
          <span
            className={`text-xs font-medium ${
              currentStep === s.step ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-1 h-px w-6 ${
                currentStep > s.step ? 'bg-degen-500/50' : 'bg-white/10'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Platform Selection ───────────────────────────────────────

function PlatformSelection({
  selected,
  onChange,
}: {
  selected: LivePlatform;
  onChange: (p: LivePlatform) => void;
}) {
  const PLATFORMS: Array<{
    id: LivePlatform;
    label: string;
    icon: string;
    description: string;
    features: string[];
    color: string;
  }> = [
    {
      id: 'owncast',
      label: 'Owncast',
      icon: '📡',
      description: 'Self-hosted on our Owncast instance',
      features: ['No censorship', 'Own your content', 'Embed anywhere', 'IRC chat'],
      color: '#00ff41',
    },
    {
      id: 'peertube',
      label: 'PeerTube',
      icon: '🎥',
      description: 'Federated via our PeerTube instance',
      features: ['ActivityPub fedi', 'VOD recording', 'Live chat', 'Cross-instance reach'],
      color: '#F1684B',
    },
    {
      id: 'both',
      label: 'Both (Simulcast)',
      icon: '🔀',
      description: 'Stream to Owncast + PeerTube simultaneously',
      features: ['Maximum reach', 'Unified chat', 'Cross-platform VOD', 'Federation + ownership'],
      color: '#FFD600',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Choose Your Platform</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Where do you want to stream?</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLATFORMS.map((p) => {
          const isActive = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`group relative cursor-pointer rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-degen-500/50 bg-degen-500/10 shadow-[0_0_16px_var(--color-accent-glow)]'
                  : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div
                    className={`text-base font-bold ${
                      isActive ? 'text-degen-400' : 'text-[var(--color-fg)]'
                    }`}
                  >
                    {p.label}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">{p.description}</div>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {p.features.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]"
                  >
                    <span
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {f}
                  </div>
                ))}
              </div>

              {isActive && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-degen-500">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="black"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Stream Configuration ─────────────────────────────────────

function StreamConfiguration({
  config,
  onChange,
}: {
  config: StreamConfig;
  onChange: (c: StreamConfig) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (partial: Partial<StreamConfig>) => onChange({ ...config, ...partial }),
    [config, onChange],
  );

  const handleThumbnail = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        update({ thumbnail: file, thumbnailPreview: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    },
    [update],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const exists = config.tags.includes(tag);
      update({
        tags: exists ? config.tags.filter((t) => t !== tag) : [...config.tags, tag],
      });
    },
    [config, update],
  );

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Stream Configuration</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Set up your stream details</p>
      </div>

      {/* Title */}
      <div>
        <label
          htmlFor="live-title"
          className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]"
        >
          Stream Title
        </label>
        <input
          id="live-title"
          type="text"
          value={config.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="What's your stream about?"
          maxLength={120}
          required
          className="input w-full"
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="live-desc"
          className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]"
        >
          Description <span className="text-[var(--color-muted)]">(optional)</span>
        </label>
        <textarea
          id="live-desc"
          value={config.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Tell viewers what to expect..."
          maxLength={1000}
          rows={3}
          className="input w-full resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">
          Category
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => update({ category: cat.id })}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-all ${
                config.category === cat.id
                  ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              <span className="text-center leading-tight">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">
          Tags <span className="text-[var(--color-muted)]">(click to toggle)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TAGS_PRESETS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                config.tags.includes(tag)
                  ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500/30'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Thumbnail */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">
          Thumbnail <span className="text-[var(--color-muted)]">(optional)</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-16 w-28 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-glass-border)] text-[10px] text-[var(--color-muted)] transition-colors hover:border-degen-500/30"
          >
            {config.thumbnailPreview ? (
              <img
                src={config.thumbnailPreview}
                alt="Thumbnail preview"
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              <div className="text-center">
                <div className="mb-1 text-lg">🖼️</div>
                Upload
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnail}
            className="hidden"
          />
          <div className="text-[10px] text-[var(--color-muted)]">
            Recommended: 1280×720px
            <br />
            Max 5MB
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]">Privacy</label>
        <div className="flex gap-2">
          {(['public', 'unlisted', 'private'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => update({ privacy: p })}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                config.privacy === p
                  ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'
              }`}
            >
              {p === 'public' && '🌐'} {p === 'unlisted' && '🔗'} {p === 'private' && '🔒'} {p}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={config.chatEnabled}
            onChange={(e) => update({ chatEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-degen-500"
          />
          <span className="text-xs text-[var(--color-fg)]">Enable Chat</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={config.recordingEnabled}
            onChange={(e) => update({ recordingEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-degen-500"
          />
          <span className="text-xs text-[var(--color-fg)]">Save VOD</span>
        </label>
      </div>
    </div>
  );
}

// ─── Step 3: Stream Key Display ───────────────────────────────────────

function StreamKeyDisplay({ connection }: { connection: StreamConnection }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Stream Connection Details</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Copy these into OBS, Streamlabs, or any RTMP-compatible software
        </p>
      </div>

      {/* RTMP URL */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]">
          RTMP URL
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-xs text-degen-400 font-mono whitespace-nowrap">
            {connection.rtmpUrl}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(connection.rtmpUrl, setCopiedUrl)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-xs transition-colors hover:bg-white/5"
            title="Copy RTMP URL"
          >
            {copiedUrl ? (
              '✓'
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Stream Key */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-amber-400">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Stream Key — Keep this private!
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg bg-black/50 px-3 py-2 text-sm text-amber-300 font-mono tracking-wider">
            {connection.streamKey}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(connection.streamKey, setCopiedKey)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 text-amber-400 transition-colors hover:bg-amber-500/10"
            title="Copy Stream Key"
          >
            {copiedKey ? (
              '✓'
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* OBS Instructions */}
      <details className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--color-fg)]">
          📖 OBS / Streamlabs Setup Instructions
        </summary>
        <div className="border-t border-[var(--color-glass-border)] px-4 py-3 text-[11px] text-[var(--color-muted)] space-y-2">
          <p>
            <strong>1.</strong> Open OBS Studio or Streamlabs
          </p>
          <p>
            <strong>2.</strong> Go to <em>Settings → Stream</em>
          </p>
          <p>
            <strong>3.</strong> Set <em>Service</em> to <strong>Custom...</strong>
          </p>
          <p>
            <strong>4.</strong> Paste the <strong>RTMP URL</strong> above
          </p>
          <p>
            <strong>5.</strong> Paste the <strong>Stream Key</strong> above
          </p>
          <p>
            <strong>6.</strong> Click <em>Apply</em> and <em>OK</em>
          </p>
          <p>
            <strong>7.</strong> Set up your scenes and click <strong>Start Streaming</strong>
          </p>
          <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-amber-400">
            ⚠️ Never share your stream key. Anyone with it can stream to your channel.
          </p>
        </div>
      </details>

      {/* Playback URL */}
      {connection.playbackUrl && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]">
            Playback URL
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-xs text-degen-400 font-mono">
              {connection.playbackUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(connection.playbackUrl, () => {})}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-xs transition-colors hover:bg-white/5"
              title="Copy playback URL"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Go Live + Share ──────────────────────────────────────────

function GoLiveActions({
  connection,
  config,
  platform,
  onGoLive,
}: {
  connection: StreamConnection;
  config: StreamConfig;
  platform: LivePlatform;
  onGoLive: () => void;
}) {
  const shareText = `🔴 I'm live now! Watch "${config.title}" on DegenFeed ${connection.playbackUrl} #DegenFeed #Live`;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Ready to Go Live!</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Your stream is configured. Share with the world.
        </p>
      </div>

      {/* Go Live Button */}
      <button
        type="button"
        onClick={onGoLive}
        className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 text-lg font-bold text-white shadow-lg transition-all hover:from-red-500 hover:to-red-400 hover:shadow-red-500/25 active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
          I'm Live!
        </span>
      </button>

      {/* Live Preview */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
        <div className="aspect-video bg-black flex items-center justify-center">
          {connection.embedUrl ? (
            <iframe
              src={connection.embedUrl}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title="Stream preview"
            />
          ) : (
            <div className="text-center text-[var(--color-muted)]">
              <div className="text-3xl mb-2">📡</div>
              <div className="text-xs">Stream preview will appear here</div>
              <div className="text-[10px] mt-1">Start your RTMP stream in OBS</div>
            </div>
          )}
        </div>
      </div>

      {/* Share Links */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-[var(--color-muted)]">
          Share Your Stream
        </label>
        <div className="flex flex-wrap gap-2">
          <ShareButton
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            label="Twitter / X"
            color="#1DA1F2"
          />
          <ShareButton
            href={`https://nostr.com/intent?text=${encodeURIComponent(shareText)}`}
            label="Nostr"
            color="#8B5CF6"
          />
          <ShareButton
            href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`}
            label="Farcaster"
            color="#7C65C1"
          />
          <ShareButton
            href={`https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`}
            label="Bluesky"
            color="#0085FF"
          />
        </div>
      </div>
    </div>
  );
}

function ShareButton({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:text-white hover:border-white/20"
      style={{ borderColor: `${color}30`, '--tw-ring-color': color } as React.CSSProperties}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </a>
  );
}

// ─── Main GoLiveFlow Component ────────────────────────────────────────

interface GoLiveFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onLiveStarted?: (streamId: string) => void;
}

export function GoLiveFlow({ isOpen, onClose, onLiveStarted }: GoLiveFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [platform, setPlatform] = useState<LivePlatform>('owncast');
  const [config, setConfig] = useState<StreamConfig>({
    title: '',
    description: '',
    category: 'gaming',
    tags: ['live', 'stream'],
    privacy: 'public',
    chatEnabled: true,
    recordingEnabled: true,
    thumbnail: null,
    thumbnailPreview: '',
  });
  const [connection, setConnection] = useState<StreamConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setPlatform('owncast');
      setConfig({
        title: '',
        description: '',
        category: 'gaming',
        tags: ['live', 'stream'],
        privacy: 'public',
        chatEnabled: true,
        recordingEnabled: true,
        thumbnail: null,
        thumbnailPreview: '',
      });
      setConnection(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 1) onClose();
        else setStep((step - 1) as Step);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, step, onClose]);

  // Generate stream connection (Step 2 → Step 3 transition)
  const handleConfigured = useCallback(async () => {
    if (!config.title.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/live/go-live', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: config.title,
          description: config.description,
          category: config.category,
          tags: config.tags,
          privacy: config.privacy,
          recordingEnabled: config.recordingEnabled,
          chatEnabled: config.chatEnabled,
          platform,
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || 'Failed to start stream');
      }

      const data = (await response.json()) as StreamConnection;
      setConnection(data);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure stream');
    } finally {
      setIsLoading(false);
    }
  }, [config, platform]);

  // Go live! (Step 4)
  const handleGoLive = useCallback(() => {
    if (connection) {
      onLiveStarted?.(connection.streamId);
    }
  }, [connection, onLiveStarted]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current && step === 1) onClose();
    },
    [step, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-label="Go Live Wizard"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] shadow-2xl sm:rounded-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500/20 to-purple-500/10 text-sm">
              {step === 4 ? '🔴' : '📡'}
            </span>
            <h2 className="text-base font-bold text-[var(--color-fg)]">
              {step === 1 && 'Go Live'}
              {step === 2 && 'Stream Settings'}
              {step === 3 && 'Stream Key'}
              {step === 4 && 'You're Live!'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (step === 1) onClose();
              else setStep((step - 1) as Step);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label={step === 1 ? 'Close' : 'Back'}
          >
            {step === 1 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-5 pt-4">
          <StepIndicator currentStep={step} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {step === 1 && <PlatformSelection selected={platform} onChange={setPlatform} />}
          {step === 2 && <StreamConfiguration config={config} onChange={setConfig} />}
          {step === 3 && connection && <StreamKeyDisplay connection={connection} />}
          {step === 4 && connection && (
            <GoLiveActions connection={connection} config={config} platform={platform} onGoLive={handleGoLive} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              if (step === 1) onClose();
              else setStep((step - 1) as Step);
            }}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 && (
            <button
              type="button"
              onClick={() => {
                if (step === 1) setStep(2);
                if (step === 2) handleConfigured();
              }}
              disabled={(step === 2 && !config.title.trim()) || isLoading}
              className="btn-primary gap-2"
            >
              {isLoading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Setting up...
                </>
              ) : step === 1 ? (
                'Continue'
              ) : (
                'Get Stream Key'
              )}
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="btn-primary gap-2"
            >
              Continue → Go Live
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              className="btn-secondary text-xs"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
