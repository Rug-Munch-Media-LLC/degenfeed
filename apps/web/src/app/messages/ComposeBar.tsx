'use client';

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

/* ─── Props ─────────────────────────────────────────────────── */

export interface ComposeBarProps {
  /** Current text in the compose input */
  value: string;
  /** Update text */
  onChange: (text: string) => void;
  /** Send handler */
  onSend: () => void;
  /** Is the message currently being sent */
  sending: boolean;
  /** Error from last send attempt (cleared on next keystroke) */
  sendError: string | null;
  /** Current protocol for this conversation */
  protocol: string;
  /** Available protocols to switch between */
  protocols?: string[];
  /** Callback when protocol is switched */
  onProtocolChange?: (protocol: string) => void;
  /** Typing callback (debounced) */
  onTyping?: () => void;
  /** Max characters per protocol */
  maxChars?: number;
  /** Disable the input */
  disabled?: boolean;
}

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
const MAX_CHARS: Record<string, number> = {
  nostr: 64000,
  farcaster: 320,
  lens: 5000,
  bluesky: 300,
  mastodon: 500,
};

/* ─── Component ─────────────────────────────────────────────── */

export function ComposeBar({
  value,
  onChange,
  onSend,
  sending,
  sendError,
  protocol,
  protocols,
  onProtocolChange,
  onTyping,
  maxChars,
  disabled = false,
}: ComposeBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const charLimit = maxChars ?? MAX_CHARS[protocol] ?? 64000;
  const charCount = value.length;
  const overLimit = charCount > charLimit;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  // Focus textarea when protocol changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !sending && !overLimit) {
          onSend();
        }
      }
      if (e.key === 'Escape') {
        textareaRef.current?.blur();
      }
    },
    [value, sending, overLimit, onSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      onTyping?.();
    },
    [onChange, onTyping],
  );

  const canSend = value.trim().length > 0 && !sending && !overLimit;
  const availableProtocols = protocols ?? PROTOCOLS;

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-compose-bg)]">
      {/* Protocol switcher (compact pill row) */}
      {availableProtocols.length > 1 && (
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <span className="text-[9px] font-medium text-[var(--color-muted)] mr-1">Send via:</span>
          {availableProtocols.map((p) => {
            const isActive = p === protocol;
            const color = getProtocolColor(p);
            const icon = getProtocolIcon(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => onProtocolChange?.(p)}
                disabled={disabled || sending}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                  isActive ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: isActive ? `${color}18` : 'transparent',
                  color: isActive ? color : 'var(--color-muted)',
                  border: isActive ? `1px solid ${color}30` : '1px solid transparent',
                }}
                aria-pressed={isActive}
                title={`Send via ${getProtocolLabel(p)}`}
              >
                <span className="text-[9px]">{icon}</span>
                <span className="hidden sm:inline">{getProtocolLabel(p)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`Message via ${getProtocolLabel(protocol)}\u2026`}
            rows={1}
            disabled={disabled}
            aria-label={`Message via ${getProtocolLabel(protocol)}`}
            aria-describedby={sendError ? 'compose-error' : undefined}
            className={`w-full resize-none rounded-xl border bg-[var(--color-card)] px-3.5 py-2.5 pr-12 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-shadow ${
              focused
                ? 'ring-1 ring-degen-500/40 border-degen-500/30'
                : 'border-[var(--color-border)]'
            } ${overLimit ? 'ring-1 ring-red-500/40 border-red-500/30' : ''}`}
            style={{ maxHeight: '160px' }}
          />

          {/* Character count floating inside */}
          {value.length > 0 && (
            <span
              className={`absolute bottom-2.5 right-3 text-[9px] font-medium ${
                overLimit
                  ? 'text-red-400'
                  : charCount > charLimit * 0.85
                    ? 'text-amber-400'
                    : 'text-[var(--color-muted)]'
              }`}
              role="status"
              aria-live="polite"
            >
              {charCount}/{charLimit}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label={sending ? 'Sending' : 'Send message'}
          className={`flex-shrink-0 flex h-[38px] w-[38px] items-center justify-center rounded-xl font-bold text-black transition-all ${
            canSend
              ? 'bg-degen-500 hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(0,255,65,0.2)] active:scale-95'
              : 'bg-[var(--color-muted)]/20 text-[var(--color-muted)] cursor-not-allowed'
          }`}
        >
          {sending ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Send error */}
      {sendError && (
        <p
          id="compose-error"
          role="alert"
          className="px-3 pb-2 text-[10px] text-red-400 flex items-center gap-1.5"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M5.5 5.5l5 5M10.5 5.5l-5 5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Failed to send.{' '}
          <button
            type="button"
            onClick={onSend}
            className="underline hover:text-red-300 transition-colors"
          >
            Retry?
          </button>
        </p>
      )}
    </div>
  );
}
