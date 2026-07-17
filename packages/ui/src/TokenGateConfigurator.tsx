/**
 * @degenfeed/ui — TokenGateConfigurator
 *
 * A UI panel for configuring a token/NFT gate on a post or community.
 * Used inside ComposeModal and the community creation flow.
 *
 * Features:
 *   - Select chain (Ethereum, Base, Polygon, Solana, Arbitrum, Optimism)
 *   - Select token type (ERC-20, ERC-721, ERC-1155)
 *   - Enter contract address
 *   - Optional token ID (for NFTs)
 *   - Optional min balance (for ERC-20)
 *   - Live preview of the gate: "Only holders of SYMBOL on Chain can view"
 */

import { type TokenGate, type TokenGateChain, type TokenGateType, CHAIN_LABELS, TYPE_LABELS } from '@degenfeed/token-gate';
import { useCallback, useEffect, useState } from 'react';

const CHAINS: TokenGateChain[] = ['ethereum', 'base', 'polygon', 'solana', 'arbitrum', 'optimism'];
const TYPES: TokenGateType[] = ['erc20', 'erc721', 'erc1155'];

export interface TokenGateConfiguratorProps {
  /** Current gate config (null = no gate) */
  gate: TokenGate | null;
  /** Called when the gate config changes */
  onChange: (gate: TokenGate | null) => void;
  /** Resolved info to display (fetched externally) */
  displaySymbol?: string;
  displayName?: string;
  /** Whether the gate info is being resolved */
  resolving?: boolean;
  /** Error message from resolution */
  error?: string;
}

export function TokenGateConfigurator({
  gate,
  onChange,
  displaySymbol,
  displayName,
  resolving,
  error,
}: TokenGateConfiguratorProps) {
  const [chain, setChain] = useState<TokenGateChain>(gate?.chain ?? 'ethereum');
  const [type, setType] = useState<TokenGateType>(gate?.type ?? 'erc20');
  const [contractAddress, setContractAddress] = useState(gate?.contractAddress ?? '');
  const [tokenId, setTokenId] = useState(gate?.tokenId ?? '');
  const [minBalance, setMinBalance] = useState(String(gate?.minBalance ?? 1));
  const [minBalanceDecimals, setMinBalanceDecimals] = useState(String(gate?.minBalanceDecimals ?? 18));

  const [expanded, setExpanded] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Emit gate config changes
  const emitGate = useCallback(() => {
    const clean = contractAddress.trim();
    if (!clean) {
      onChange(null);
      return;
    }

    // Basic address validation
    if (chain === 'solana') {
      if (clean.length < 32 || clean.length > 44) {
        setAddressError('Invalid Solana address');
        onChange(null);
        return;
      }
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) {
        setAddressError('Invalid address (must be 0x... 40 hex chars)');
        onChange(null);
        return;
      }
    }
    setAddressError(null);

    const config: TokenGate = {
      type,
      chain,
      contractAddress: clean,
    };

    if (type === 'erc721' || type === 'erc1155') {
      if (tokenId.trim()) {
        config.tokenId = tokenId.trim();
      }
    }

    if (type === 'erc20') {
      const bal = Number(minBalance);
      config.minBalance = bal > 0 ? bal : 1;
      const dec = Number(minBalanceDecimals);
      config.minBalanceDecimals = dec >= 0 ? dec : 18;
    }

    onChange(config);
  }, [chain, type, contractAddress, tokenId, minBalance, minBalanceDecimals, onChange]);

  // Emit on changes to gate fields
  useEffect(() => {
    emitGate();
  }, [emitGate]);

  const handleClear = useCallback(() => {
    setContractAddress('');
    setTokenId('');
    setMinBalance('1');
    setMinBalanceDecimals('18');
    setAddressError(null);
    onChange(null);
    setExpanded(false);
  }, [onChange]);

  // Build the preview description
  const previewParts: string[] = [];
  if (displaySymbol) {
    if (type === 'erc721' && tokenId) {
      previewParts.push(`${displaySymbol} #${tokenId}`);
    } else if (type === 'erc721') {
      previewParts.push(`any ${displaySymbol}`);
    } else if (type === 'erc1155' && tokenId) {
      previewParts.push(`${displayName || displaySymbol} #${tokenId}`);
    } else {
      const bal = gate?.minBalance ?? 1;
      previewParts.push(`${bal} ${displaySymbol}`);
    }
    previewParts.push(`on ${CHAIN_LABELS[chain]}`);
  }

  return (
    <div className="rounded-xl border border-yellow-900/40 bg-yellow-950/20 p-3">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 text-sm text-yellow-300 hover:text-yellow-200 transition-colors"
        >
          <span className="text-base">🔒</span>
          {gate && displaySymbol ? (
            <span>
              Gated: {previewParts.length > 0 ? previewParts.join(' ') : 'Token-gated'}
            </span>
          ) : (
            <span>Token Gate — restrict access to token/NFT holders</span>
          )}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="ml-auto" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-yellow-300">
              <span>🔒</span>
              Token Gate Configuration
            </h3>
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              aria-label="Remove token gate"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Chain selector */}
          <div>
            <label className="mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Chain
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CHAINS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChain(c)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    chain === c
                      ? 'bg-yellow-700/40 text-yellow-200 border border-yellow-600/50'
                      : 'bg-[var(--color-muted)] text-gray-400 border border-transparent hover:text-gray-200'
                  }`}
                >
                  {CHAIN_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Token type selector */}
          <div>
            <label className="mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Token Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    type === t
                      ? 'bg-yellow-700/40 text-yellow-200 border border-yellow-600/50'
                      : 'bg-[var(--color-muted)] text-gray-400 border border-transparent hover:text-gray-200'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Contract address */}
          <div>
            <label className="mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Contract Address
            </label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder={chain === 'solana' ? 'Token mint address...' : '0x...'}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-yellow-600 font-mono"
            />
            {addressError && (
              <p className="mt-1 text-[11px] text-red-400">{addressError}</p>
            )}
            {contractAddress.trim() && !addressError && resolving && (
              <p className="mt-1 text-[11px] text-yellow-500 animate-pulse">Resolving token info...</p>
            )}
            {error && (
              <p className="mt-1 text-[11px] text-red-400">{error}</p>
            )}
          </div>

          {/* Token ID (for NFTs) */}
          {(type === 'erc721' || type === 'erc1155') && (
            <div>
              <label className="mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Token ID {type === 'erc721' ? '(optional — leave empty to gate on any)' : '(required)'}
              </label>
              <input
                type="text"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-yellow-600"
              />
            </div>
          )}

          {/* Min balance (for ERC-20) */}
          {type === 'erc20' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Min Balance
                </label>
                <input
                  type="number"
                  value={minBalance}
                  onChange={(e) => setMinBalance(e.target.value)}
                  min={1}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-yellow-600"
                />
              </div>
              <div>
                <label className="mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Decimals
                </label>
                <input
                  type="number"
                  value={minBalanceDecimals}
                  onChange={(e) => setMinBalanceDecimals(e.target.value)}
                  min={0}
                  max={18}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-yellow-600"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {previewParts.length > 0 && (
            <div className="rounded-lg border border-yellow-900/30 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-200">
              <span className="font-medium">Preview:</span>{' '}
              Only holders of {previewParts.join(' ')} can view this content
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="self-end rounded-lg bg-yellow-700/30 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-700/50 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
