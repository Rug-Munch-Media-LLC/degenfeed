'use client';

/**
 * @degenfeed/ui — "reply as" protocol switcher for cross-protocol replies.
 */

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '../ProtocolBadge';

export interface ReplySwitcherProps {
  protocols: string[];
  selected: string;
  parentProtocol: string;
  onSelect: (protocol: string) => void;
}

export function ReplySwitcher({
  protocols,
  selected,
  parentProtocol,
  onSelect,
}: ReplySwitcherProps) {
  if (protocols.length <= 1) return null;
  return (
    <fieldset className="border-b border-[var(--color-border)] px-4 py-3">
      <legend className="mb-2 text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
        Reply as
      </legend>
      <div className="flex flex-wrap gap-2">
        {protocols.map((protocol) => {
          const isSelected = protocol === selected;
          return (
            <button
              key={protocol}
              type="button"
              onClick={() => onSelect(protocol)}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? 'border-current opacity-100'
                  : 'border-[var(--color-border)] opacity-60 hover:opacity-100'
              }`}
              style={{
                color: isSelected ? getProtocolColor(protocol) : 'var(--color-muted)',
                backgroundColor: isSelected ? `${getProtocolColor(protocol)}15` : 'transparent',
              }}
            >
              <span className="text-[0.7em]" aria-hidden="true">
                {getProtocolIcon(protocol)}
              </span>
              {getProtocolLabel(protocol)}
              {protocol === parentProtocol && (
                <span className="text-[10px] opacity-70">(same)</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface CrossProtocolNoteProps {
  replyProtocol: string;
  parentProtocol: string;
}

export function CrossProtocolNote({ replyProtocol, parentProtocol }: CrossProtocolNoteProps) {
  return (
    <p className="mx-4 mt-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
      This reply will be posted on{' '}
      <strong className="text-[var(--color-fg)]">{getProtocolLabel(replyProtocol)}</strong> and
      linked to the original{' '}
      <strong className="text-[var(--color-fg)]">{getProtocolLabel(parentProtocol)}</strong> post
      via the DegenFeed cross-protocol bridge.
    </p>
  );
}
