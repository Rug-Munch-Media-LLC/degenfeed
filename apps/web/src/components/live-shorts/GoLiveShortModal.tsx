'use client';

/**
 * GoLiveShortModal — Modal dialog for starting a new live short session.
 *
 * Fields:
 *   - Title (required)
 *   - Description (optional)
 *   - Duration preset (30s / 60s / 90s / 120s)
 *   - Protocol selection (HLS, WebRTC, SRT, RTMP)
 *   - Token gate (optional)
 *
 * On submit, calls `onStart` with the form data. Shows loading state
 * while the stream key and ingest URL are being provisioned.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveShortProtocol } from './useLiveShorts';

// === Types =============================================================

interface GoLiveShortForm {
  title: string;
  description: string;
  maxDuration: number;
  protocols: LiveShortProtocol[];
  tokenAddress: string;
  tokenSymbol: string;
}

interface GoLiveShortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (data: GoLiveShortForm) => void;
}

// === Duration presets ==================================================

const DURATION_PRESETS = [
  { value: 30, label: '30s' },
  { value: 60, label: '60s', default: true },
  { value: 90, label: '90s' },
  { value: 120, label: '2 min' },
] as const;

// === Protocol options ==================================================

const PROTOCOL_OPTIONS: Array<{
  value: LiveShortProtocol;
  label: string;
  description: string;
  color: string;
}> = [
  {
    value: 'hls',
    label: 'HLS',
    description: 'HTTP Live Streaming — broadest compatibility',
    color: '#00ff41',
  },
  {
    value: 'webrtc',
    label: 'WebRTC',
    description: 'Lowest latency, peer-to-peer',
    color: '#8b5cf6',
  },
  { value: 'srt', label: 'SRT', description: 'Secure Reliable Transport', color: '#f59e0b' },
  { value: 'rtmp', label: 'RTMP', description: 'Legacy, widest tool support', color: '#ec4899' },
];

// === Duration selector =================================================

function DurationSelector({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (d: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-[var(--color-fg)]">Max Duration</legend>
      <div className="flex gap-2">
        {DURATION_PRESETS.map((preset) => {
          const isActive = selected === preset.value;
          const id = `duration-${preset.value}`;
          return (
            <label
              key={preset.value}
              htmlFor={id}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
              }`}
            >
              <input
                type="radio"
                id={id}
                name="duration"
                value={preset.value}
                checked={isActive}
                onChange={() => onChange(preset.value)}
                className="sr-only"
              />
              {preset.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// === Protocol selector =================================================

function ProtocolSelector({
  selected,
  onChange,
}: {
  selected: LiveShortProtocol[];
  onChange: (protocols: LiveShortProtocol[]) => void;
}) {
  const toggle = (value: LiveShortProtocol) => {
    if (selected.includes(value)) {
      // Must keep at least one
      if (selected.length <= 1) return;
      onChange(selected.filter((p) => p !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-[var(--color-fg)]">
        Streaming Protocols
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {PROTOCOL_OPTIONS.map((opt) => {
          const isActive = selected.includes(opt.value);
          const id = `protocol-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-all ${
                isActive
                  ? 'border-degen-500/50 bg-degen-500/10'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-muted)]'
              }`}
            >
              <input
                type="checkbox"
                id={id}
                checked={isActive}
                onChange={() => toggle(opt.value)}
                className="sr-only"
              />
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-colors"
                style={{
                  borderColor: isActive ? opt.color : 'var(--color-border)',
                  backgroundColor: isActive ? `${opt.color}30` : 'transparent',
                  color: isActive ? opt.color : 'var(--color-muted)',
                }}
              >
                {isActive ? '✓' : ''}
              </span>
              <div className="min-w-0">
                <div
                  className="text-xs font-semibold"
                  style={{ color: isActive ? opt.color : 'var(--color-fg)' }}
                >
                  {opt.label}
                </div>
                <div className="text-[9px] text-[var(--color-muted)]">{opt.description}</div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// === Token gate section ================================================

function TokenGateSection({
  address,
  onAddressChange,
  symbol,
  onSymbolChange,
}: {
  address: string;
  onAddressChange: (v: string) => void;
  symbol: string;
  onSymbolChange: (v: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-[var(--color-muted)]"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-xs font-semibold text-[var(--color-fg)]">
            Token Gate (optional)
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative h-4 w-8 rounded-full transition-colors ${
            enabled ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
          }`}
          aria-label="Toggle token gate"
        >
          <span
            className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="tg-address"
              className="mb-1 block text-[9px] font-medium text-[var(--color-muted)]"
            >
              Token Address
            </label>
            <input
              id="tg-address"
              type="text"
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="0x... or So1..."
              className="input text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="tg-symbol"
              className="mb-1 block text-[9px] font-medium text-[var(--color-muted)]"
            >
              Symbol
            </label>
            <input
              id="tg-symbol"
              type="text"
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              placeholder="DEGEN"
              className="input text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// === Main Modal ========================================================

export function GoLiveShortModal({ isOpen, onClose, onStart }: GoLiveShortModalProps) {
  const [form, setForm] = useState<GoLiveShortForm>({
    title: '',
    description: '',
    maxDuration: 60,
    protocols: ['hls'],
    tokenAddress: '',
    tokenSymbol: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus title on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setForm({
        title: '',
        description: '',
        maxDuration: 60,
        protocols: ['hls'],
        tokenAddress: '',
        tokenSymbol: '',
      });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.title.trim() || form.protocols.length === 0) return;
      setIsSubmitting(true);
      // Simulate provisioning
      await new Promise((r) => setTimeout(r, 1200));
      onStart(form);
      setIsSubmitting(false);
      onClose();
    },
    [form, onStart, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-label="Go live with a short"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] shadow-2xl sm:rounded-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/20 to-rose-500/10 text-sm">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
            </span>
            <h2 className="text-base font-bold text-[var(--color-fg)]">Go Live Short</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Title */}
          <div>
            <label
              htmlFor="ls-title"
              className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]"
            >
              Title <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="ls-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What's happening? Keep it short!"
              maxLength={80}
              required
              className="input"
            />
            <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
              {form.title.length}/80
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="ls-desc"
              className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]"
            >
              Description <span className="text-[var(--color-muted)]">(optional)</span>
            </label>
            <textarea
              id="ls-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Tell viewers what you're about to share..."
              maxLength={300}
              rows={2}
              className="input resize-none"
            />
          </div>

          {/* Duration */}
          <DurationSelector
            selected={form.maxDuration}
            onChange={(d) => setForm((f) => ({ ...f, maxDuration: d }))}
          />

          {/* Protocols */}
          <ProtocolSelector
            selected={form.protocols}
            onChange={(p) => setForm((f) => ({ ...f, protocols: p }))}
          />

          {/* Token gate */}
          <TokenGateSection
            address={form.tokenAddress}
            onAddressChange={(v) => setForm((f) => ({ ...f, tokenAddress: v }))}
            symbol={form.tokenSymbol}
            onSymbolChange={(v) => setForm((f) => ({ ...f, tokenSymbol: v }))}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || form.protocols.length === 0 || isSubmitting}
              className="btn-primary flex-1 gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Provisioning...
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
                  </span>
                  Go Live
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
