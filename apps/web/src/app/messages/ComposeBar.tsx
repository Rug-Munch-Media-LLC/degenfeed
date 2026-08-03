'use client';

/**
 * Enhanced Compose Bar — GIF picker, emoji, voice recording, file upload, polls
 */

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface ComposeBarProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  sendError: string | null;
  protocol: string;
  protocols?: string[];
  onProtocolChange?: (protocol: string) => void;
  onTyping?: () => void;
  maxChars?: number;
  disabled?: boolean;
  encrypted?: boolean;
  /** Rich features callbacks */
  onAttachFile?: (files: FileList) => void;
  onVoiceRecord?: () => void;
  onPickEmoji?: (emoji: string) => void;
  onPickGif?: (url: string) => void;
  onOpenPoll?: () => void;
}

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
const MAX_CHARS: Record<string, number> = {
  nostr: 64000,
  farcaster: 320,
  lens: 5000,
  bluesky: 300,
  mastodon: 500,
};

/* ─── Emoji Data (subset) ──────────────────────────────────────────── */

const EMOJI_CATEGORIES: Array<{
  name: string;
  emojis: string[];
}> = [
  {
    name: 'Smileys',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😇',
      '🙂',
      '😉',
      '😌',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😋',
      '😛',
      '😜',
      '🤪',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👍',
      '👎',
      '👊',
      '✊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
      '✌️',
      '🤟',
      '🤘',
      '👌',
      '❤️',
      '💔',
      '💯',
      '🔥',
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      '💀',
      '☠️',
      '👽',
      '🤖',
      '🎃',
      '😈',
      '👾',
      '💩',
      '🫡',
      '🫠',
      '🫣',
      '🫢',
      '🫡',
      '🫤',
      '🫥',
      '🫦',
      '🫧',
      '🫨',
      '🫩',
      '🫪',
    ],
  },
];

const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '🚀', '💯', '🫡', '👀'];

/* ─── GIF Picker ────────────────────────────────────────────────────── */

function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ url: string; preview: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/gifs/search?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { results: Array<{ url: string; preview: string }> };
        setResults(data.results?.slice(0, 20) ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl p-3 z-50 max-h-80 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          ESC
        </button>
      </div>
      {loading && (
        <p className="text-[10px] text-[var(--color-muted)] text-center py-4">Searching...</p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {results.map((gif, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              onSelect(gif.url);
              onClose();
            }}
            className="rounded-lg overflow-hidden border border-[var(--color-border)] hover:ring-2 hover:ring-degen-500 transition-all"
          >
            <img src={gif.preview} alt="GIF" className="w-full h-20 object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Emoji Picker ──────────────────────────────────────────────────── */

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(0);

  return (
    <div className="absolute bottom-full left-0 mb-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl p-3 z-50 w-72">
      {/* Quick picks */}
      <div className="flex flex-wrap gap-0.5 mb-2 pb-2 border-b border-[var(--color-border)]">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="rounded-lg p-1 text-lg hover:bg-[var(--color-overlay)] hover:scale-125 transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
      {/* Categories */}
      <div className="flex gap-1 mb-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setCategory(i)}
            className={`rounded-lg px-2 py-0.5 text-[10px] ${i === category ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'} transition-colors`}
          >
            {cat.name}
          </button>
        ))}
      </div>
      {/* Emojis */}
      <div className="flex flex-wrap gap-0.5 max-h-40 overflow-y-auto">
        {EMOJI_CATEGORIES[category]?.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="rounded-lg p-1 text-lg hover:bg-[var(--color-overlay)] hover:scale-125 transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Poll Creator ──────────────────────────────────────────────────── */

function PollCreator({
  onSubmit,
  onClose,
}: {
  onSubmit: (question: string, options: string[], multiple: boolean) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);

  const addOption = () => setOptions((prev) => [...prev, '']);
  const updateOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? val : o)));
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, j) => j !== i));

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl p-3 z-50">
      <h4 className="text-xs font-semibold text-[var(--color-fg)] mb-2">Create Poll</h4>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question..."
        maxLength={200}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 mb-2"
      />
      {options.map((opt, i) => (
        <div key={i} className="flex gap-1 mb-1">
          <input
            type="text"
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            maxLength={100}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30"
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="text-[var(--color-muted)] hover:text-red-400 px-1"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= 10}
          className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] disabled:opacity-30"
        >
          + Option
        </button>
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(e) => setMultiple(e.target.checked)}
            className="rounded"
          />
          Multiple answers
        </label>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (question.trim() && options.filter(Boolean).length >= 2) {
                onSubmit(question.trim(), options.filter(Boolean), multiple);
                onClose();
              }
            }}
            className="rounded-lg bg-degen-500 px-2 py-1 text-[10px] font-bold text-black disabled:opacity-30"
            disabled={!question.trim() || options.filter(Boolean).length < 2}
          >
            Send Poll
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

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
  encrypted = false,
  onAttachFile,
  onVoiceRecord,
  onPickGif,
  onOpenPoll,
}: ComposeBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sub-pickers
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [_showExtra, _setShowExtra] = useState(false);

  const charLimit = maxChars ?? MAX_CHARS[protocol] ?? 64000;
  const charCount = value.length;
  const overLimit = charCount > charLimit;

  // Auto-resize
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !sending && !overLimit) onSend();
      }
      if (e.key === 'Escape') textareaRef.current?.blur();
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onAttachFile?.(e.target.files);
      }
      e.target.value = '';
    },
    [onAttachFile],
  );

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-compose-bg)] relative">
      {/* Encryption indicator */}
      {encrypted && (
        <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5">
          <div className="flex items-center gap-1.5">
            <svg
              width="8"
              height="8"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="text-degen-400"
            >
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M5 7V4a3 3 0 016 0v3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[8px] text-degen-400/60">End-to-end encrypted</span>
          </div>
          <span className="text-[8px] text-[var(--color-muted)]">Signal Protocol</span>
        </div>
      )}

      {/* Protocol switcher */}
      {availableProtocols.length > 1 && (
        <div className="flex items-center gap-1 px-3 pt-1 pb-1">
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

      {/* GIF picker overlay */}
      {showGif && (
        <GifPicker
          onSelect={(url) => {
            onPickGif?.(url);
            setShowGif(false);
          }}
          onClose={() => setShowGif(false)}
        />
      )}

      {/* Emoji picker overlay */}
      {showEmoji && (
        <EmojiPicker
          onSelect={(emoji) => {
            onChange(value + emoji);
            setShowEmoji(false);
          }}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {/* Poll creator overlay */}
      {showPoll && (
        <PollCreator
          onSubmit={(_q, _opts, _multiple) => {
            onOpenPoll?.(); /* parent handles sending */
            setShowPoll(false);
          }}
          onClose={() => setShowPoll(false)}
        />
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5 px-2.5 py-2">
        {/* Attach / Extra buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Emoji */}
          <button
            type="button"
            onClick={() => {
              setShowEmoji(!showEmoji);
              setShowGif(false);
              setShowPoll(false);
            }}
            className={`rounded-lg p-1.5 transition-colors ${showEmoji ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
            aria-label="Add emoji"
            title="Emoji"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>

          {/* GIF */}
          <button
            type="button"
            onClick={() => {
              setShowGif(!showGif);
              setShowEmoji(false);
              setShowPoll(false);
            }}
            className={`rounded-lg p-1.5 transition-colors ${showGif ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
            aria-label="Search GIFs"
            title="GIF"
          >
            <span className="text-xs font-bold">GIF</span>
          </button>

          {/* Voice record */}
          {onVoiceRecord && (
            <button
              type="button"
              onClick={onVoiceRecord}
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
              aria-label="Record voice message"
              title="Voice message"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}

          {/* Attachment (file) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
            aria-label="Attach file"
            title="Attach file"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.zip"
          />

          {/* Poll */}
          {onOpenPoll && (
            <button
              type="button"
              onClick={() => {
                setShowPoll(!showPoll);
                setShowEmoji(false);
                setShowGif(false);
              }}
              className={`rounded-lg p-1.5 transition-colors ${showPoll ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label="Create poll"
              title="Poll"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>
          )}
        </div>

        {/* Textarea */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`Message via ${getProtocolLabel(protocol)}…`}
            rows={1}
            disabled={disabled}
            aria-label={`Message via ${getProtocolLabel(protocol)}`}
            aria-describedby={sendError ? 'compose-error' : undefined}
            className={`w-full resize-none rounded-xl border bg-[var(--color-card)] px-3 py-2.5 pr-10 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-shadow ${
              focused
                ? 'ring-1 ring-degen-500/40 border-degen-500/30'
                : 'border-[var(--color-border)]'
            } ${overLimit ? 'ring-1 ring-red-500/40 border-red-500/30' : ''}`}
            style={{ maxHeight: '120px' }}
          />

          {/* Char count */}
          {value.length > 0 && (
            <span
              className={`absolute bottom-2.5 right-2.5 text-[9px] font-medium ${
                overLimit
                  ? 'text-red-400'
                  : charCount > charLimit * 0.85
                    ? 'text-amber-400'
                    : 'text-[var(--color-muted)]'
              }`}
              role="status"
              aria-live="polite"
            >
              {charCount}
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

      {/* Error */}
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
