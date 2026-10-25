'use client';

/**
 * @degenfeed/ui — per-protocol target chips with live character counters.
 *
 * State is exposed with aria-pressed and the over-limit case gets a text
 * indicator, so the signal is never colour-only.
 */

import { getProtocolColor, getProtocolIcon } from '../ProtocolBadge';
import type { ComposeTarget } from './types';

export interface ProtocolPickerProps {
  targets: ComposeTarget[];
  textLength: number;
  onToggle: (id: string) => void;
  locked?: boolean;
}

export function ProtocolPicker({ targets, textLength, onToggle, locked }: ProtocolPickerProps) {
  return (
    <fieldset className="mb-3 flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Post to networks</legend>
      {targets.map((target) => {
        const overLimit = target.enabled && textLength > target.charLimit;
        const stateLabel =
          target.status === 'sending'
            ? 'Sending'
            : target.status === 'sent'
              ? 'Sent'
              : target.status === 'failed'
                ? 'Failed'
                : undefined;
        return (
          <button
            key={target.id}
            type="button"
            onClick={() => onToggle(target.id)}
            aria-pressed={target.enabled}
            aria-disabled={locked || undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              target.enabled
                ? 'border-current opacity-100'
                : 'border-[var(--color-border)] opacity-60 hover:opacity-100'
            }`}
            style={{
              color: !target.connected
                ? 'var(--color-muted)'
                : overLimit
                  ? 'var(--color-danger)'
                  : getProtocolColor(target.id),
              backgroundColor: target.enabled ? `${getProtocolColor(target.id)}15` : 'transparent',
            }}
            title={
              !target.connected
                ? `Not connected — sign in with ${target.label}`
                : `${target.label} (${textLength}/${target.charLimit})`
            }
          >
            {!target.connected ? (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 1C5.5 1 3.5 3 3.5 5.5v2C3 8 2 8.5 2 10v3h12v-3c0-1.5-1-2-1.5-2.5v-2C12.5 3 10.5 1 8 1zM8 13.5c-1 0-1.8-.8-1.8-1.8h3.6c0 1-.8 1.8-1.8 1.8z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <span className="text-[0.7em]" aria-hidden="true">
                {getProtocolIcon(target.id)}
              </span>
            )}
            {target.label}
            <span className="text-[0.65rem] opacity-70">
              {textLength}/{target.charLimit}
            </span>
            {overLimit && <span className="text-[0.65rem] font-semibold">too long</span>}
            {stateLabel && <span className="sr-only">{stateLabel}</span>}
          </button>
        );
      })}
    </fieldset>
  );
}
