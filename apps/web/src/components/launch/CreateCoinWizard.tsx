'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import FeeConfigPanel from './FeeConfigPanel';
import type { RevenueRecipient } from './RecipientSplitEditor';
import RecipientSplitEditor from './RecipientSplitEditor';
import ShareModal from './ShareModal';
import VestingConfigPanel from './VestingConfigPanel';

/* === Types ============================================ */

interface VestingConfig {
  initialUnlockBps: number;
  cliffDuration: number;
  vestingDuration: number;
}

interface CreatorCoinParams {
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  supply: number;
  creatorAllocation: number;
  feeBps: number;
  revenueSplits: RevenueRecipient[];
  vestingConfig: VestingConfig;
}

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

interface StepConfig {
  id: StepId;
  label: string;
  icon: string;
}

const STEPS: StepConfig[] = [
  { id: 1, label: 'Coin Details', icon: '📝' },
  { id: 2, label: 'Tokenomics', icon: '📊' },
  { id: 3, label: 'Vesting', icon: '🔒' },
  { id: 4, label: 'Revenue Sharing', icon: '🤝' },
  { id: 5, label: 'Review & Deploy', icon: '✅' },
  { id: 6, label: 'Success!', icon: '🚀' },
];

/* === Helpers ========================================== */

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* === Step 1: Coin Details ============================= */

function StepCoinDetails({
  params,
  onChange,
}: {
  params: CreatorCoinParams;
  onChange: (updates: Partial<CreatorCoinParams>) => void;
}) {
  const [imagePreview, setImagePreview] = useState<string | null>(params.image);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        setImageError('Image must be under 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setImageError('File must be an image');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setImagePreview(dataUrl);
        onChange({ image: dataUrl });
        setImageError(null);
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Coin Details</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Define the identity of your creator coin. This is what your community will see.
        </p>
      </div>

      {/* Image upload — larger touch target */}
      <div>
        <label
          className="mb-2 block text-sm font-medium text-[var(--color-fg)]"
          htmlFor="coin-image-input"
        >
          Coin Image
        </label>
        <div
          className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-overlay)] p-8 sm:p-6 transition-colors hover:border-degen-500/30 touch-target"
          onClick={() => document.getElementById('coin-image-input')?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              document.getElementById('coin-image-input')?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload coin image"
          style={{ minHeight: 120 }}
        >
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Coin preview"
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImagePreview(null);
                  onChange({ image: null });
                }}
                className="absolute -right-2 -top-2 flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs touch-target"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto mb-2 text-[var(--color-muted)]"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-xs text-[var(--color-muted)]">Click to upload (PNG, GIF, WEBP)</p>
              <p className="text-[10px] text-[var(--color-muted)]">Max 5MB</p>
            </div>
          )}
          <input
            id="coin-image-input"
            type="file"
            accept="image/png,image/gif,image/webp,image/jpeg"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
        {imageError && <p className="mt-1 text-xs text-red-400">{imageError}</p>}
      </div>

      {/* Name */}
      <div>
        <label
          htmlFor="coin-name"
          className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
        >
          Coin Name
        </label>
        <input
          id="coin-name"
          type="text"
          value={params.name}
          onChange={(e) => onChange({ name: e.target.value.slice(0, 32) })}
          placeholder="e.g. Degen Alice"
          className="input"
          maxLength={32}
          autoComplete="off"
        />
        <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
          {params.name.length}/32
        </p>
      </div>

      {/* Symbol */}
      <div>
        <label
          htmlFor="coin-symbol"
          className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
        >
          Symbol
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)]">
            $
          </span>
          <input
            id="coin-symbol"
            type="text"
            value={params.symbol}
            onChange={(e) => onChange({ symbol: e.target.value.toUpperCase().slice(0, 10) })}
            placeholder="ALICE"
            className="input pl-8 font-mono uppercase"
            maxLength={10}
            autoComplete="off"
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          {params.symbol.length}/10 · Letters, numbers, underscores only
        </p>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="coin-desc"
          className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
        >
          Description
        </label>
        <textarea
          id="coin-desc"
          value={params.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Tell your community why this coin exists..."
          className="input min-h-[100px] resize-y"
          maxLength={500}
        />
        <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
          {params.description.length}/500
        </p>
      </div>
    </div>
  );
}

/* === Step 2: Tokenomics =============================== */

function StepTokenomics({
  params,
  onChange,
}: {
  params: CreatorCoinParams;
  onChange: (updates: Partial<CreatorCoinParams>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Tokenomics</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Configure your coin&apos;s supply and your allocation.
        </p>
      </div>

      {/* Total Supply */}
      <div>
        <label
          htmlFor="coin-supply"
          className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
        >
          Total Supply
        </label>
        <input
          id="coin-supply"
          type="number"
          value={params.supply}
          onChange={(e) => {
            const val = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(val) && val >= 0) onChange({ supply: val });
          }}
          min={1000}
          max={1_000_000_000}
          step={1000}
          className="input tabular-nums"
        />
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          Recommended: 100,000,000 – 1,000,000,000 (standard for bonding curve coins)
        </p>
      </div>

      {/* Creator Allocation */}
      <div>
        <label
          htmlFor="creator-alloc"
          className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
        >
          Creator Allocation ({params.creatorAllocation}%)
        </label>
        <input
          id="creator-alloc"
          type="range"
          value={params.creatorAllocation}
          onChange={(e) => onChange({ creatorAllocation: Number.parseInt(e.target.value, 10) })}
          min={0}
          max={30}
          step={1}
          className="w-full accent-degen-500"
          aria-label="Creator allocation percentage"
        />
        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>0%</span>
          <span className="font-medium text-degen-400">{params.creatorAllocation}%</span>
          <span>30% max</span>
        </div>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          This allocation is vested and released linearly during the prebonding phase to prevent rug
          pulls. Max 30%.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-degen-500/20 bg-degen-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-degen-400">
            Fair Launch
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            All remaining supply goes to the bonding curve. No pre-sale, no insider allocation.
          </p>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Vested</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            Creator tokens are locked and released proportionally as the curve progresses.
          </p>
        </div>
      </div>
    </div>
  );
}

/* === Step 3: Revenue Sharing ========================== */

function StepRevenueSharing({
  params,
  onChange,
}: {
  params: CreatorCoinParams;
  onChange: (updates: Partial<CreatorCoinParams>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Revenue Sharing</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Configure your creator fee and distribute it among recipients.
        </p>
      </div>

      <FeeConfigPanel feeBps={params.feeBps} onFeeChange={(bps) => onChange({ feeBps: bps })} />

      <RecipientSplitEditor
        recipients={params.revenueSplits}
        onChange={(recipients) => onChange({ revenueSplits: recipients })}
      />

      {/* Total fee summary */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
        <h4 className="text-xs font-semibold text-[var(--color-fg)]">Fee Summary</h4>
        <div className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
          <div className="flex justify-between">
            <span>Creator Fee</span>
            <span className="font-medium text-[var(--color-fg)]">
              {(params.feeBps / 100).toFixed(2)}%
            </span>
          </div>
          {params.revenueSplits.length > 0 && (
            <div className="flex justify-between">
              <span>Recipients</span>
              <span className="font-medium text-[var(--color-fg)]">
                {params.revenueSplits.length}
              </span>
            </div>
          )}
          {params.revenueSplits.length === 0 && (
            <div className="flex justify-between">
              <span>Your Share</span>
              <span className="font-medium text-degen-400">
                {(params.feeBps / 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* === Step 4: Review & Deploy ========================== */

function StepReviewDeploy({
  params,
  deploying,
  deployError,
  onDeploy,
}: {
  params: CreatorCoinParams;
  deploying: boolean;
  deployError: string | null;
  onDeploy: () => void;
}) {
  const totalSplitPct = params.revenueSplits.reduce((s, r) => s + r.percentage, 0);
  const isShareValid = totalSplitPct <= 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Review & Deploy</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Verify everything looks correct before deploying your creator coin.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-5 space-y-4">
        {/* Coin identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-gradient-to-br from-degen-500/20 to-purple-500/20">
            {params.image ? (
              <img src={params.image} alt={params.symbol} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-degen-400">{params.symbol.charAt(0)}</span>
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--color-fg)]">{params.name}</h3>
            <span className="font-mono text-xs text-[var(--color-muted)]">${params.symbol}</span>
          </div>
        </div>

        {params.description && (
          <p className="text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] pt-3">
            {params.description}
          </p>
        )}

        {/* Tokenomics */}
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Total Supply
            </span>
            <p className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
              {formatCompact(params.supply)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Creator Allocation
            </span>
            <p className="text-sm font-bold tabular-nums text-degen-400">
              {params.creatorAllocation}% (
              {formatCompact(Math.round((params.supply * params.creatorAllocation) / 100))})
            </p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Curve Supply
            </span>
            <p className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
              {formatCompact(Math.round((params.supply * (100 - params.creatorAllocation)) / 100))}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Vesting Schedule
            </span>
            <p className="text-sm font-bold text-degen-400">
              {params.vestingConfig.initialUnlockBps / 100}% initial
              {params.vestingConfig.cliffDuration > 0
                ? ` · ${Math.round(params.vestingConfig.cliffDuration / 86400)}d cliff`
                : ' · no cliff'}
              {' · '}
              {Math.round(params.vestingConfig.vestingDuration / 86400)}d linear vest
            </p>
          </div>
        </div>

        {/* Fee & Splits */}
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-muted)]">Creator Fee</span>
            <span className="font-medium text-[var(--color-fg)]">
              {(params.feeBps / 100).toFixed(2)}%
            </span>
          </div>
          {params.revenueSplits.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Revenue Splits
              </span>
              {params.revenueSplits.map((r) => (
                <div key={r.id} className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted)]">
                    {r.name || shortenAddress(r.address)}
                  </span>
                  <span className="font-medium text-[var(--color-fg)]">{r.percentage}%</span>
                </div>
              ))}
              {totalSplitPct < 100 && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Your Share (remaining)</span>
                  <span className="font-medium text-degen-400">
                    {((params.feeBps * (100 - totalSplitPct)) / 100).toFixed(2)}% of fee
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
        <p className="text-[11px] text-yellow-400">
          ⚠️ Deploying a coin requires a gas fee. Make sure you have enough ETH/SOL in your wallet.
          Creator coins are immutable after deployment.
        </p>
      </div>

      {/* Error */}
      {deployError && (
        <div className="rounded-lg bg-red-500/10 p-3 text-center text-xs font-medium text-red-400">
          {deployError}
        </div>
      )}

      {/* Deploy button */}
      <button
        type="button"
        onClick={onDeploy}
        disabled={deploying || !isShareValid}
        className="w-full rounded-xl bg-gradient-to-r from-degen-500 to-degen-400 px-6 py-3.5 text-sm font-bold text-black transition-all hover:from-degen-400 hover:to-degen-300 hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
      >
        {deploying ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
            Deploying...
          </span>
        ) : (
          `🚀 Deploy $${params.symbol}`
        )}
      </button>

      {/* Validation */}
      {!isShareValid && (
        <p className="text-center text-xs text-red-400">
          Revenue split total ({totalSplitPct}%) exceeds 100%. Please adjust.
        </p>
      )}
    </div>
  );
}

/* === Step 5: Success ================================== */

function StepSuccess({ symbol, coinAddress }: { symbol: string; coinAddress: string }) {
  const [showShare, setShowShare] = useState(false);
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/launch/${symbol.toLowerCase()}`
      : `/launch/${symbol.toLowerCase()}`;

  return (
    <div className="space-y-6 text-center">
      {/* Celebration */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 via-green-500/20 to-purple-500/20">
        <span className="text-4xl">🚀</span>
      </div>

      <div>
        <h2 className="text-xl font-bold text-[var(--color-fg)]">${symbol} is Live!</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Your creator coin has been deployed and the prebonding curve is now active.
        </p>
      </div>

      {/* Coin address */}
      <div className="mx-auto max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Coin Address
        </p>
        <p className="mt-1 font-mono text-xs text-[var(--color-fg)] break-all">{coinAddress}</p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(coinAddress).catch(() => {});
          }}
          className="mt-2 text-[10px] text-degen-400 hover:underline"
        >
          📋 Copy address
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/launch/${symbol.toLowerCase()}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-degen-500 px-6 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_30px_rgba(0,255,65,0.4)]"
        >
          🪙 View Coin Page
        </Link>
        <button
          type="button"
          onClick={() => setShowShare(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-6 py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:text-degen-400"
        >
          📣 Share Your Coin
        </button>
      </div>

      {/* Next steps */}
      <div className="mx-auto max-w-sm space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left">
        <h3 className="text-xs font-semibold text-[var(--color-fg)]">Next Steps</h3>
        <ol className="space-y-1.5 text-xs text-[var(--color-muted)]">
          <li className="flex items-start gap-2">
            <span className="text-degen-400">1.</span>
            <span>Share your coin on social platforms</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-degen-400">2.</span>
            <span>Pin the coin page to your profile</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-degen-400">3.</span>
            <span>Engage your community to buy in</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-degen-400">4.</span>
            <span>Watch the bonding curve progress toward graduation!</span>
          </li>
        </ol>
      </div>

      {/* Share modal */}
      <ShareModal
        symbol={symbol}
        name={symbol}
        url={url}
        creatorAddress={coinAddress}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </div>
  );
}

/* === Main Wizard ====================================== */

interface CreateCoinWizardProps {
  className?: string;
}

export default function CreateCoinWizard({ className = '' }: CreateCoinWizardProps) {
  const [step, setStep] = useState<StepId>(1);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const [params, setParams] = useState<CreatorCoinParams>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    supply: 100_000_000,
    creatorAllocation: 10,
    feeBps: 100,
    revenueSplits: [],
    vestingConfig: { initialUnlockBps: 0, cliffDuration: 2_592_000, vestingDuration: 7_776_000 },
  });

  const updateParams = useCallback((updates: Partial<CreatorCoinParams>) => {
    setParams((prev) => ({ ...prev, ...updates }));
  }, []);

  // Validation per step
  const stepErrors = useMemo((): Partial<Record<StepId, string | null>> => {
    const errors: Partial<Record<StepId, string | null>> = {};
    const nameSanitized = params.name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    if (!nameSanitized) errors[1] = 'Coin name is required';
    else if (nameSanitized.length < 2) errors[1] = 'Name must be at least 2 characters';
    else if (nameSanitized.length > 32) errors[1] = 'Name must be 32 characters or less';
    const symbolSanitized = params.symbol.replace(/[^A-Z0-9_]/g, '').trim();
    if (!symbolSanitized) errors[1] = 'Symbol is required';
    else if (symbolSanitized.length < 1) errors[1] = 'Symbol is required';
    else if (symbolSanitized.length > 10) errors[1] = 'Symbol must be 10 characters or less';
    if (params.supply < 1000) errors[2] = 'Minimum supply is 1,000';
    if (params.creatorAllocation < 0) errors[2] = 'Allocation must be 0 or more';
    const vc = params.vestingConfig;
    if (vc.initialUnlockBps < 0 || vc.initialUnlockBps > 3000)
      errors[3] = 'Initial unlock must be 0-30%';
    if (vc.cliffDuration < 0 || vc.cliffDuration > 7_776_000) errors[3] = 'Cliff must be 0-90 days';
    if (vc.vestingDuration < 604_800 || vc.vestingDuration > 63_072_000)
      errors[3] = 'Vesting must be 7 days-2 years';
    const totalSplit = params.revenueSplits.reduce((s, r) => s + r.percentage, 0);
    if (totalSplit > 100) errors[4] = 'Revenue splits exceed 100%';
    return errors;
  }, [params]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return (
          Boolean(params.name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim()) &&
          Boolean(params.symbol.replace(/[^A-Z0-9_]/g, '').trim()) &&
          params.name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().length <= 32 &&
          params.symbol.replace(/[^A-Z0-9_]/g, '').trim().length <= 10
        );
      case 2:
        return (
          params.supply >= 1000 && params.creatorAllocation >= 0 && params.creatorAllocation <= 30
        );
      case 3: {
        const vc = params.vestingConfig;
        return (
          vc.initialUnlockBps >= 0 &&
          vc.initialUnlockBps <= 3000 &&
          vc.cliffDuration >= 0 &&
          vc.cliffDuration <= 7_776_000 &&
          vc.vestingDuration >= 604_800 &&
          vc.vestingDuration <= 63_072_000
        );
      }
      case 4:
        return params.revenueSplits.reduce((s, r) => s + r.percentage, 0) <= 100;
      case 5:
        return true;
      case 6:
        return true;
    }
  }, [step, params]);

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployError(null);

    try {
      // Build deploy payload with vesting config
      const deployPayload = {
        ...params,
        vestingConfig: params.vestingConfig,
      };

      const res = await fetch('/api/creator/coin/deploy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(deployPayload),
      });

      const data = (await res.json()) as { address?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error || `Deploy failed: ${res.status}`);
      }

      if (!data.address) {
        throw new Error('Deploy succeeded but no address returned');
      }

      setDeployedAddress(data.address);
      setStep(5);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  }, [params]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((step - 1) as StepId);
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < 5 && canProceed) {
      setStep((step + 1) as StepId);
    }
  }, [step, canProceed]);

  // Step 6 is terminal — no wizard navigation
  if (step === 6) {
    return (
      <div className={`mx-auto max-w-lg ${className}`}>
        <StepSuccess symbol={params.symbol} coinAddress={deployedAddress || '0x...'} />
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className={`mx-auto max-w-2xl ${className}`}>
      {/* Step indicators — horizontal scrollable on mobile */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between sm:justify-center">
          {STEPS.slice(0, 5).map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex h-8 w-8 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold transition-all touch-target ${
                  step === s.id
                    ? 'bg-degen-500 text-black shadow-[0_0_12px_rgba(0,255,65,0.4)]'
                    : step > s.id
                      ? 'bg-degen-500/20 text-degen-400'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                }`}
              >
                {step > s.id ? '✓' : s.id}
              </div>
              {i < 4 && (
                <div
                  className={`mx-1 sm:mx-2 h-0.5 w-6 sm:w-20 transition-colors ${
                    step > s.id ? 'bg-degen-500/40' : 'bg-[var(--color-border)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[8px] sm:text-[10px] font-medium text-[var(--color-muted)]">
          {STEPS.slice(0, 5).map((s) => (
            <span key={s.id} className={`truncate px-0.5 ${step === s.id ? 'text-degen-400' : ''}`}>
              {isMobile ? s.label.split(' ')[0] || s.label : s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 1 && <StepCoinDetails params={params} onChange={updateParams} />}
        {step === 2 && <StepTokenomics params={params} onChange={updateParams} />}
        {step === 3 && (
          <VestingConfigPanel
            config={params.vestingConfig}
            onChange={(vc) => updateParams({ vestingConfig: vc })}
            creatorAllocation={params.creatorAllocation}
            supply={params.supply}
          />
        )}
        {step === 4 && <StepRevenueSharing params={params} onChange={updateParams} />}
        {step === 5 && (
          <StepReviewDeploy
            params={params}
            deploying={deploying}
            deployError={deployError}
            onDeploy={handleDeploy}
          />
        )}
      </div>

      {/* Step errors */}
      {stepErrors[step] && (
        <div className="mt-4 rounded-lg bg-red-500/10 p-2.5 text-center text-xs text-red-400">
          {stepErrors[step]}
        </div>
      )}

      {/* Navigation buttons — full-width on mobile */}
      {step < 5 && (
        <div className="mt-6 sm:mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="btn-secondary text-sm touch-target disabled:opacity-30 flex-1 sm:flex-none"
            style={{ minHeight: 48 }}
          >
            ← Back
          </button>
          <span className="text-[10px] tabular-nums text-[var(--color-muted)] hidden sm:block">
            Step {step} of 5
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="btn-primary text-sm touch-target disabled:opacity-40 flex-1 sm:flex-none"
            style={{ minHeight: 48 }}
          >
            {step === 4 ? 'Review →' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  );
}
