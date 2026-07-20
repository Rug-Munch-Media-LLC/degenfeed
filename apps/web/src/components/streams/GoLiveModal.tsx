'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamType } from './useLiveStreams';

/* === Types ==================================================== */

interface GoLiveForm {
  title: string;
  streamType: StreamType;
  description: string;
  tokenGate: boolean;
  tokenAddress: string;
  minHold: number;
}

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (data: GoLiveForm) => void;
  /** Pre-fill coin address for token-gated streams */
  defaultCoinAddress?: string;
  /** Pre-fill coin symbol for display */
  defaultCoinSymbol?: string;
  /** Pre-fill stream surfaces/platforms */
  defaultSurfaces?: string[];
}

/* === Stream type config ======================================= */

const STREAM_OPTIONS: Array<{
  type: StreamType;
  label: string;
  emoji: string;
  description: string;
  color: string;
}> = [
  {
    type: 'solo',
    label: 'Solo Stream',
    emoji: '🎥',
    description: 'Video stream — just you',
    color: 'indigo',
  },
  {
    type: 'spaces',
    label: 'Audio Space',
    emoji: '🎙️',
    description: 'Live audio conversation',
    color: 'teal',
  },
  {
    type: 'collab',
    label: 'Collab Stream',
    emoji: '👥',
    description: 'Multi-host video stream',
    color: 'amber',
  },
  {
    type: 'launch',
    label: 'Token Launch',
    emoji: '🪙',
    description: 'Launch a coin with streaming',
    color: 'pink',
  },
];

/* === TypeSelector ============================================= */

function TypeSelector({
  selected,
  onChange,
}: {
  selected: StreamType;
  onChange: (type: StreamType) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-[var(--color-fg)]">Stream Type</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STREAM_OPTIONS.map((opt) => {
          const isActive = selected === opt.type;
          const id = `stream-type-${opt.type}`;
          return (
            <label
              key={opt.type}
              htmlFor={id}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                isActive
                  ? 'border-degen-500/50 bg-degen-500/10 shadow-[0_0_12px_var(--color-accent-glow)]'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-muted)]'
              }`}
            >
              <input
                type="radio"
                id={id}
                name="stream-type"
                value={opt.type}
                checked={isActive}
                onChange={() => onChange(opt.type)}
                className="sr-only"
              />
              <span className="text-xl">{opt.emoji}</span>
              <span
                className={`text-xs font-semibold ${
                  isActive ? 'text-degen-400' : 'text-[var(--color-fg)]'
                }`}
              >
                {opt.label}
              </span>
              <span className="text-[9px] text-[var(--color-muted)]">{opt.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* === Token gate configuration ================================= */

function TokenGateConfig({
  enabled,
  onToggle,
  tokenAddress,
  onTokenAddressChange,
  minHold,
  onMinHoldChange,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  tokenAddress: string;
  onTokenAddressChange: (v: string) => void;
  minHold: number;
  onMinHoldChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
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
          <span className="text-xs font-semibold text-[var(--color-fg)]">Token Gate</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            enabled ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
          }`}
          aria-label="Toggle token gate"
        >
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 space-y-2">
          <div>
            <label
              htmlFor="token-address"
              className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              Token Contract Address
            </label>
            <input
              id="token-address"
              type="text"
              value={tokenAddress}
              onChange={(e) => onTokenAddressChange(e.target.value)}
              placeholder="0x... or So1..."
              className="input text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="min-hold"
              className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              Minimum Hold Requirement
            </label>
            <input
              id="min-hold"
              type="number"
              value={minHold}
              onChange={(e) => onMinHoldChange(Number(e.target.value))}
              min={0}
              className="input text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* === Main Modal =============================================== */

export function GoLiveModal({ isOpen, onClose, onStart, defaultCoinAddress, defaultCoinSymbol, defaultSurfaces }: GoLiveModalProps) {
  const [form, setForm] = useState<GoLiveForm>({
    title: '',
    streamType: 'solo',
    description: '',
    tokenGate: !!defaultCoinAddress,
    tokenAddress: defaultCoinAddress || '',
    minHold: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus title input on open
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
        streamType: 'solo',
        description: '',
        tokenGate: false,
        tokenAddress: '',
        minHold: 0,
      });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  // Close on Escape
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
      if (!form.title.trim()) return;
      setIsSubmitting(true);
      // Simulate API call
      await new Promise((r) => setTimeout(r, 800));
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
      aria-label="Go live setup"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] shadow-2xl sm:rounded-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500/20 to-purple-500/10 text-sm">
              📡
            </span>
            <h2 className="text-base font-bold text-[var(--color-fg)]">Go Live</h2>
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
          {/* Stream title */}
          <div>
            <label
              htmlFor="stream-title"
              className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]"
            >
              Stream Title
            </label>
            <input
              ref={titleInputRef}
              id="stream-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What's your stream about?"
              maxLength={100}
              required
              className="input"
            />
            <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
              {form.title.length}/100
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="stream-desc"
              className="mb-1.5 block text-sm font-semibold text-[var(--color-fg)]"
            >
              Description <span className="text-[var(--color-muted)]">(optional)</span>
            </label>
            <textarea
              id="stream-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Tell viewers what to expect..."
              maxLength={500}
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* Stream type */}
          <TypeSelector
            selected={form.streamType}
            onChange={(type) => setForm((f) => ({ ...f, streamType: type }))}
          />

          {/* Token gate */}
          <TokenGateConfig
            enabled={form.tokenGate}
            onToggle={(v) => setForm((f) => ({ ...f, tokenGate: v }))}
            tokenAddress={form.tokenAddress}
            onTokenAddressChange={(v) => setForm((f) => ({ ...f, tokenAddress: v }))}
            minHold={form.minHold}
            onMinHoldChange={(v) => setForm((f) => ({ ...f, minHold: v }))}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || isSubmitting}
              className="btn-primary flex-1 gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Starting...
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
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
