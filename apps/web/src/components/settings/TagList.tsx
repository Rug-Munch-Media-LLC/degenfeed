'use client';

import { useCallback, useState } from 'react';

export function TagList({
  items,
  onRemove,
  placeholder,
  onAdd,
  addLabel,
}: {
  items: string[];
  onRemove: (item: string) => void;
  placeholder: string;
  onAdd: (item: string) => void;
  addLabel: string;
}) {
  const [input, setInput] = useState('');
  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setInput('');
  }, [input, items, onAdd]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.length === 0 && (
          <span className="text-xs text-[var(--color-muted)] py-1">None added yet</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-2.5 py-1 text-xs text-[var(--color-fg)]"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-0.5 text-[var(--color-muted)] hover:text-red-400 transition-colors"
              aria-label={`Remove ${item}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="btn-secondary text-xs shrink-0"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
