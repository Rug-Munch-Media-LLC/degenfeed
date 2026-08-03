'use client';

import Link from 'next/link';
import { ECO_PRESETS } from './constants';
import type { CoinFormState } from './types';

interface StepReviewProps {
  form: CoinFormState;
  update: <K extends keyof CoinFormState>(key: K, value: CoinFormState[K]) => void;
  simulateDeploy: () => Promise<void>;
  onContinue: () => void;
}

function getExplorerUrl(deployTarget: string, hash: string): string {
  switch (deployTarget) {
    case 'base':
      return `https://basescan.org/tx/${hash}`;
    case 'base_sepolia':
      return `https://sepolia.basescan.org/tx/${hash}`;
    case 'solana':
      return `https://solscan.io/tx/${hash}`;
    case 'solana_devnet':
      return `https://solscan.io/tx/${hash}?cluster=devnet`;
    default:
      return `https://basescan.org/tx/${hash}`;
  }
}

function getCoinExplorerUrl(deployTarget: string, address: string): string {
  switch (deployTarget) {
    case 'base':
      return `https://basescan.org/address/${address}`;
    case 'base_sepolia':
      return `https://sepolia.basescan.org/address/${address}`;
    case 'solana':
      return `https://solscan.io/token/${address}`;
    case 'solana_devnet':
      return `https://solscan.io/token/${address}?cluster=devnet`;
    default:
      return `https://basescan.org/address/${address}`;
  }
}

export default function StepReview({form, update}: StepReviewProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Review Your Coin</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">Coin</div>
            <div className="text-sm font-bold text-[var(--color-fg)]">
              ${form.symbol || 'TICKER'}
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">
              {form.name || 'Unnamed Coin'}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">
              Economic Model
            </div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              {ECO_PRESETS[form.ecoPreset].label}
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">
              {ECO_PRESETS[form.ecoPreset].initialUnlock} initial /{' '}
              {ECO_PRESETS[form.ecoPreset].vestingPeriod}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">Protection</div>
            <div className="text-xs font-semibold text-degen-400">
              {[
                form.antiSniper && 'Sniper',
                form.antiWhale && 'Whale',
                form.bundlerDetection && 'Bundler',
                form.mevProtection && 'MEV',
              ]
                .filter(Boolean)
                .join(', ') || 'None'}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1">Allocation</div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              Creator: {form.creatorAllocation}% | Treasury: {form.treasuryAllocation}%
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Deployment</h2>
        <div className="mb-4 space-y-2">
          {[
            {
              value: 'base' as const,
              label: '⧫ Deploy to Base',
              desc: 'Ethereum L2 — low fees, Zora compatible',
            },
            {
              value: 'solana' as const,
              label: '◎ Deploy to Solana',
              desc: 'High throughput, low latency',
            },
            {
              value: 'both' as const,
              label: '🌉 Deploy to Both (Cross-Chain)',
              desc: 'Solana + Base via Wormhole bridge',
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] p-3 cursor-pointer hover:border-degen-500/30"
            >
              <input
                type="radio"
                name="deployTarget"
                checked={form.deployTarget === opt.value}
                onChange={() => update('deployTarget', opt.value)}
                className="accent-degen-400"
              />
              <div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">{opt.label}</div>
                <div className="text-[10px] text-[var(--color-muted)]">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mb-4 rounded-lg bg-[var(--color-overlay)] p-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--color-muted)]">Estimated Gas (Base)</span>
            <span className="font-mono text-[var(--color-fg)]">~0.001 ETH (~$3.50)</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--color-muted)]">Estimated Gas (Solana)</span>
            <span className="font-mono text-[var(--color-fg)]">~0.005 SOL (~$0.75)</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--color-muted)]">Token Generation Fee</span>
            <span className="font-mono text-degen-400">$20.00 USD</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-[var(--color-glass-border)] pt-1 text-[11px]">
            <span className="font-semibold text-[var(--color-fg)]">Total Estimate</span>
            <span className="font-mono font-bold text-degen-400">
              $
              {form.deployTarget === 'both'
                ? '24.25'
                : form.deployTarget === 'solana'
                  ? '20.75'
                  : '23.50'}{' '}
              USD
            </span>
          </div>
        </div>

        {form.deploying && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="text-[var(--color-muted)]">Deploying...</span>
              <span className="text-degen-400">{Math.round(form.deployProgress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500"
                style={{ width: `${form.deployProgress}%` }}
              />
            </div>
          </div>
        )}

        {form.deployed && (
          <div className="mb-4 rounded-lg border border-degen-500/20 bg-degen-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="text-sm font-bold text-degen-400">Deployed Successfully!</span>
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-muted)]">Contract:</span>
                <a
                  href={getCoinExplorerUrl(form.deployTarget, form.deployedAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-degen-400 hover:text-degen-300 underline underline-offset-2"
                >
                  {form.deployedAddress.slice(0, 16)}...{form.deployedAddress.slice(-8)}
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(form.deployedAddress)}
                  className="text-degen-400 hover:text-degen-300"
                >
                  📋
                </button>
              </div>
              {form.txHash && (
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)]">Tx:</span>
                  <a
                    href={getExplorerUrl(form.deployTarget, form.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-degen-400 hover:text-degen-300 underline underline-offset-2"
                  >
                    {form.txHash.slice(0, 20)}...{form.txHash.slice(-8)}
                  </a>
                  <span className="text-[9px] text-[var(--color-muted)]">
                    ↗{' '}
                    {form.deployTarget === 'solana' || form.deployTarget === 'solana_devnet'
                      ? 'Solscan'
                      : 'BaseScan'}
                  </span>
                </div>
              )}
              <div className="mt-2 text-[9px] text-[var(--color-muted)]">
                Chain:{' '}
                {form.deployTarget === 'base'
                  ? 'Base Mainnet'
                  : form.deployTarget === 'base_sepolia'
                    ? 'Base Sepolia'
                    : form.deployTarget === 'solana'
                      ? 'Solana Mainnet'
                      : 'Solana Devnet'}
              </div>
            </div>
          </div>
        )}

        {form.deployed && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/creator/coins/${form.deployedAddress}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-degen-500/15 px-4 py-2 text-[11px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-all"
            >
              🪙 View Coin Page
            </Link>
            <a
              href={getCoinExplorerUrl(form.deployTarget, form.deployedAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
            >
              🔍 View on Explorer
            </a>
            <Link
              href="/creator/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
            >
              📊 Creator Dashboard
            </Link>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(`https://degenfeed.xyz/coins/${form.symbol}`)
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
            >
              🔗 Copy Share Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
