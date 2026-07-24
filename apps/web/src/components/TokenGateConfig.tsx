'use client';

import { useState, useCallback, memo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

type TokenGateChain = 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism';
type TokenGateType = 'erc20' | 'erc721' | 'erc1155';
type GateTypeMode = 'single' | 'combined' | 'tiered';
type GateAccessMode = 'strict' | 'view_anyone_comment_holders';
type ContentType = 'post' | 'feed' | 'community' | 'stream' | 'ama' | 'file' | 'download';

interface TokenGate {
  type: TokenGateType;
  chain: TokenGateChain;
  contractAddress: string;
  tokenId?: string;
  minBalance?: number;
  minBalanceDecimals?: number;
}

interface TierConfig {
  name: string;
  minBalance: number;
  decimals: number;
  label: string;
  color: string;
  description: string;
}

interface GateConfig {
  type: GateTypeMode;
  enabled: boolean;
  gate?: TokenGate;
  gates?: TokenGate[];
  operator?: 'AND' | 'OR';
  tiers?: TierConfig[];
  accessMode: GateAccessMode;
  description?: string;
  contentType?: ContentType;
}

// ─── Constants ───────────────────────────────────────────────────────────

const CHAINS: TokenGateChain[] = ['ethereum', 'base', 'polygon', 'solana', 'arbitrum', 'optimism'];
const CHAIN_LABELS: Record<TokenGateChain, string> = {
  ethereum: 'Ethereum', base: 'Base', polygon: 'Polygon',
  solana: 'Solana', arbitrum: 'Arbitrum', optimism: 'Optimism',
};
const TOKEN_TYPES: TokenGateType[] = ['erc20', 'erc721', 'erc1155'];
const TYPE_LABELS: Record<TokenGateType, string> = {
  erc20: 'Token (ERC-20)', erc721: 'NFT (ERC-721)', erc1155: 'Multi Token (ERC-1155)',
};
const CONTENT_TYPES: Array<{ value: ContentType; label: string }> = [
  { value: 'post', label: 'Individual Post' },
  { value: 'feed', label: 'Entire Feed' },
  { value: 'community', label: 'Community' },
  { value: 'stream', label: 'Live Stream' },
  { value: 'ama', label: 'AMA' },
  { value: 'file', label: 'File Download' },
  { value: 'download', label: 'Exclusive Download' },
];

// ─── Default empty gate ──────────────────────────────────────────────────

function emptyGate(): TokenGate {
  return { type: 'erc20', chain: 'base', contractAddress: '', minBalance: 1, minBalanceDecimals: 18 };
}

function defaultConfig(): GateConfig {
  return {
    type: 'single',
    enabled: true,
    gate: emptyGate(),
    accessMode: 'strict',
    contentType: 'post',
  };
}

// ─── Props ────────────────────────────────────────────────────────────────

interface TokenGateConfigProps {
  /** Existing gate config to edit */
  initialConfig?: Partial<GateConfig>;
  /** Content type being gated */
  contentType?: ContentType;
  /** Callback when config changes */
  onChange?: (config: GateConfig) => void;
  /** Callback to save */
  onSave?: (config: GateConfig) => Promise<void>;
  /** Whether to show inline or as modal trigger */
  mode?: 'inline' | 'modal';
}

// ─── Single Gate Editor ──────────────────────────────────────────────────

function SingleGateEditor({
  gate,
  onChange,
}: {
  gate: TokenGate;
  onChange: (g: TokenGate) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
            Chain
          </label>
          <select
            value={gate.chain}
            onChange={(e) => onChange({ ...gate, chain: e.target.value as TokenGateChain })}
            className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>{CHAIN_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
            Token Type
          </label>
          <select
            value={gate.type}
            onChange={(e) => onChange({ ...gate, type: e.target.value as TokenGateType })}
            className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          >
            {TOKEN_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
          Contract Address
        </label>
        <input
          type="text"
          value={gate.contractAddress}
          onChange={(e) => onChange({ ...gate, contractAddress: e.target.value })}
          placeholder="0x... or Solana address"
          className="w-full rounded-lg border px-3 py-2 text-sm font-mono bg-[var(--color-card)]"
          style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
        />
      </div>

      {gate.type === 'erc721' && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
            Token ID (optional — leave empty for any)
          </label>
          <input
            type="text"
            value={gate.tokenId || ''}
            onChange={(e) => onChange({ ...gate, tokenId: e.target.value || undefined })}
            placeholder="Token ID"
            className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          />
        </div>
      )}

      {gate.type === 'erc20' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Min Balance
            </label>
            <input
              type="number"
              value={gate.minBalance ?? 1}
              onChange={(e) => onChange({ ...gate, minBalance: Number(e.target.value) || 1 })}
              min={0}
              step={1}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Decimals
            </label>
            <input
              type="number"
              value={gate.minBalanceDecimals ?? 18}
              onChange={(e) => onChange({ ...gate, minBalanceDecimals: Number(e.target.value) || 0 })}
              min={0}
              max={18}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Combined Gate Editor ────────────────────────────────────────────────

function CombinedGateEditor({
  gates,
  operator,
  onGatesChange,
  onOperatorChange,
}: {
  gates: TokenGate[];
  operator: 'AND' | 'OR';
  onGatesChange: (gates: TokenGate[]) => void;
  onOperatorChange: (op: 'AND' | 'OR') => void;
}) {
  const addGate = useCallback(() => {
    onGatesChange([...gates, emptyGate()]);
  }, [gates, onGatesChange]);

  const removeGate = useCallback((index: number) => {
    onGatesChange(gates.filter((_, i) => i !== index));
  }, [gates, onGatesChange]);

  const updateGate = useCallback((index: number, gate: TokenGate) => {
    const updated = [...gates];
    updated[index] = gate;
    onGatesChange(updated);
  }, [gates, onGatesChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          Logic:
        </label>
        <select
          value={operator}
          onChange={(e) => onOperatorChange(e.target.value as 'AND' | 'OR')}
          className="rounded-lg border px-3 py-1.5 text-sm bg-[var(--color-card)]"
          style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
        >
          <option value="AND">AND (must hold ALL)</option>
          <option value="OR">OR (must hold ANY)</option>
        </select>
      </div>

      {gates.map((gate, i) => (
        <div key={i} className="relative rounded-lg border p-3" style={{ borderColor: 'var(--color-glass-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
              Gate {i + 1}
            </span>
            {gates.length > 1 && (
              <button
                type="button"
                onClick={() => removeGate(i)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          <SingleGateEditor gate={gate} onChange={(g) => updateGate(i, g)} />
        </div>
      ))}

      <button
        type="button"
        onClick={addGate}
        className="w-full rounded-lg border border-dashed px-3 py-2 text-sm transition-colors hover:bg-[var(--color-overlay)]"
        style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-muted)' }}
      >
        + Add Gate
      </button>
    </div>
  );
}

// ─── Tiered Gate Editor ──────────────────────────────────────────────────

function TieredGateEditor({
  tiers,
  onTiersChange,
}: {
  tiers: TierConfig[];
  onTiersChange: (tiers: TierConfig[]) => void;
}) {
  const addTier = useCallback(() => {
    const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    onTiersChange([
      ...tiers,
      {
        name: `Tier ${tiers.length + 1}`,
        minBalance: 100,
        decimals: 18,
        label: `Tier ${tiers.length + 1}`,
        color: colors[tiers.length % colors.length],
        description: `${tiers.length + 1}000+ tokens`,
      },
    ]);
  }, [tiers, onTiersChange]);

  const removeTier = useCallback((index: number) => {
    onTiersChange(tiers.filter((_, i) => i !== index));
  }, [tiers, onTiersChange]);

  const updateTier = useCallback((index: number, tier: TierConfig) => {
    const updated = [...tiers];
    updated[index] = tier;
    onTiersChange(updated);
  }, [tiers, onTiersChange]);

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Different access levels based on token holding amounts.
        Tiers are checked from highest to lowest balance.
      </p>

      {tiers.map((tier, i) => (
        <div
          key={i}
          className="rounded-lg border p-3 space-y-2"
          style={{ borderColor: tier.color || 'var(--color-glass-border)', borderLeft: `3px solid ${tier.color || 'var(--color-glass-border)'}` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
              Tier {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeTier(i)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={tier.name}
              onChange={(e) => updateTier(i, { ...tier, name: e.target.value })}
              placeholder="Tier name"
              className="rounded-lg border px-2 py-1.5 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            />
            <input
              type="number"
              value={tier.minBalance}
              onChange={(e) => updateTier(i, { ...tier, minBalance: Number(e.target.value) || 0 })}
              placeholder="Min balance"
              className="rounded-lg border px-2 py-1.5 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={tier.label}
              onChange={(e) => updateTier(i, { ...tier, label: e.target.value })}
              placeholder="Label (e.g. Bronze)"
              className="rounded-lg border px-2 py-1.5 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            />
            <input
              type="color"
              value={tier.color}
              onChange={(e) => updateTier(i, { ...tier, color: e.target.value })}
              className="h-9 rounded-lg border bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)' }}
            />
          </div>

          <input
            type="text"
            value={tier.description}
            onChange={(e) => updateTier(i, { ...tier, description: e.target.value })}
            placeholder="Description"
            className="w-full rounded-lg border px-2 py-1.5 text-sm bg-[var(--color-card)]"
            style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addTier}
        className="w-full rounded-lg border border-dashed px-3 py-2 text-sm transition-colors hover:bg-[var(--color-overlay)]"
        style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-muted)' }}
      >
        + Add Tier
      </button>
    </div>
  );
}

// ─── Preview Panel ───────────────────────────────────────────────────────

function GatePreview({ config }: { config: GateConfig }) {
  if (!config.enabled) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
        <span className="text-xs text-green-400">Content is public — no gate active</span>
      </div>
    );
  }

  if (config.accessMode === 'view_anyone_comment_holders') {
    return (
      <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--color-glass-border)' }}>
        <div className="mb-1 text-lg">🔓</div>
        <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
          Anyone can view, holders can comment
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
          Non-holders can see this content but cannot interact
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--color-glass-border)' }}>
      <div className="mb-1 text-lg">🔒</div>
      <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
        Token-Gated Content
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
        {config.description || 'Hold specific tokens to access this content'}
      </div>
      {config.type === 'tiered' && config.tiers && (
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {config.tiers.map((tier, i) => (
            <span
              key={i}
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
            >
              {tier.label} ({tier.minBalance}+)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export const TokenGateConfig = memo(function TokenGateConfig({
  initialConfig,
  contentType,
  onChange,
  onSave,
  mode = 'inline',
}: TokenGateConfigProps) {
  const [config, setConfig] = useState<GateConfig>(() => ({
    ...defaultConfig(),
    ...initialConfig,
    ...(contentType ? { contentType } : {}),
  }));
  const [isOpen, setIsOpen] = useState(mode !== 'inline');
  const [saving, setSaving] = useState(false);

  const updateConfig = useCallback((partial: Partial<GateConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...partial };
      onChange?.(updated);
      return updated;
    });
  }, [onChange]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(config);
    } finally {
      setSaving(false);
    }
  }, [config, onSave]);

  const content = (
    <div className="space-y-4">
      {/* Enable / Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
            Token Gate
          </div>
          <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Require token holding to access this content
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all bg-gray-600 peer-checked:bg-degen-500" />
        </label>
      </div>

      {config.enabled && (
        <>
          {/* Content Type */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Content Type
            </label>
            <select
              value={config.contentType || 'post'}
              onChange={(e) => updateConfig({ contentType: e.target.value as ContentType })}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          {/* Access Mode */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Access Mode
            </label>
            <select
              value={config.accessMode}
              onChange={(e) => updateConfig({ accessMode: e.target.value as GateAccessMode })}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            >
              <option value="strict">Strict — Must hold to view</option>
              <option value="view_anyone_comment_holders">Anyone can view, holders can comment</option>
            </select>
          </div>

          {/* Gate Type */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Gate Type
            </label>
            <div className="flex gap-2">
              {(['single', 'combined', 'tiered'] as GateTypeMode[]).map((gt) => (
                <button
                  key={gt}
                  type="button"
                  onClick={() => updateConfig({ type: gt })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    config.type === gt
                      ? 'border-degen-500 bg-degen-500/10 text-degen-400'
                      : 'hover:bg-[var(--color-overlay)]'
                  }`}
                  style={{ borderColor: config.type === gt ? undefined : 'var(--color-glass-border)', color: config.type === gt ? undefined : 'var(--color-muted)' }}
                >
                  {gt === 'single' ? 'Simple' : gt === 'combined' ? 'Combined' : 'Tiered'}
                </button>
              ))}
            </div>
          </div>

          {/* Gate Editor */}
          {config.type === 'single' && config.gate && (
            <SingleGateEditor
              gate={config.gate}
              onChange={(g) => updateConfig({ gate: g })}
            />
          )}

          {config.type === 'combined' && (
            <CombinedGateEditor
              gates={config.gates || [emptyGate()]}
              operator={config.operator || 'AND'}
              onGatesChange={(gates) => updateConfig({ gates })}
              onOperatorChange={(operator) => updateConfig({ operator })}
            />
          )}

          {config.type === 'tiered' && (
            <TieredGateEditor
              tiers={config.tiers || []}
              onTiersChange={(tiers) => updateConfig({ tiers })}
            />
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Gate Description (shown to users)
            </label>
            <input
              type="text"
              value={config.description || ''}
              onChange={(e) => updateConfig({ description: e.target.value })}
              placeholder="Hold 1000 $DEGEN to access this post"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-card)]"
              style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
            />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
              Preview
            </label>
            <GatePreview config={config} />
          </div>
        </>
      )}

      {/* Save Button */}
      {onSave && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-degen-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Gate Configuration'}
        </button>
      )}
    </div>
  );

  if (mode === 'modal') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--color-overlay)]"
          style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          {config.enabled ? 'Edit Gate' : 'Gate This Content'}
        </button>

        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setIsOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-glass-border)' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>Token Gate Configuration</h2>
                <button type="button" onClick={() => setIsOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {content}
            </div>
          </div>
        )}
      </>
    );
  }

  return <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)' }}>{content}</div>;
});
