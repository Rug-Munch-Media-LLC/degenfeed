'use client';

import { useState } from 'react';
import { SettingsSection } from './SettingsSection';

interface TreasurySigner {
  address: string;
  avatar: string;
  label: string;
}

const MOCK_SIGNERS: TreasurySigner[] = [
  { address: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b', avatar: '🧠', label: 'Lead Steward' },
  {
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958D2D3a8b8b8b8b',
    avatar: '⚡',
    label: 'Treasury Steward',
  },
  { address: '0x1234567890abcdef1234567890abcdef12345678', avatar: '🐋', label: 'Community Rep' },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', avatar: '🦊', label: 'Community Rep' },
];

export function TreasurySection() {
  const [signers, setSigners] = useState(MOCK_SIGNERS);
  const threshold = 3;

  return (
    <SettingsSection
      title="Treasury Signers"
      description={`Manage who can sign treasury transactions. ${threshold} of ${signers.length} signatures required.`}
    >
      <div className="space-y-2 mb-4">
        {signers.map((signer, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                {signer.avatar}
              </span>
              <div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">{signer.label}</div>
                <div className="text-[9px] font-mono text-[var(--color-muted)]">
                  {signer.address.slice(0, 10)}...{signer.address.slice(-6)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSigners(signers.filter((_, j) => j !== i))}
              className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[9px] text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-dashed border-[var(--color-glass-border)] px-3 py-2 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          + Add Signer
        </button>
        <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
          <span>Current threshold:</span>
          <select
            className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-fg)] outline-none"
            defaultValue={threshold}
          >
            {Array.from({ length: signers.length }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} of {signers.length}
              </option>
            ))}
          </select>
        </div>
      </div>
    </SettingsSection>
  );
}
