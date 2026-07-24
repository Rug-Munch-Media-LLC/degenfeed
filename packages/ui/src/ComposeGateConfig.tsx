'use client';

import { resolveTokenGateSymbol, type TokenGate, type TokenGateChain } from '@degenfeed/token-gate';
import { useEffect, useRef, useState } from 'react';

export interface ComposeGateConfigProps {
  tokenGate: TokenGate | null;
  onGateChange: (gate: TokenGate | null) => void;
}

const CHAIN_OPTIONS: { value: TokenGateChain; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'solana', label: 'Solana' },
];

export function ComposeGateConfig({ tokenGate, onGateChange }: ComposeGateConfigProps) {
  const [symbol, setSymbol] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const resolveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (resolveTimeout.current) clearTimeout(resolveTimeout.current);
    if (!tokenGate) {
      setSymbol('');
      setError(undefined);
      return;
    }
    setResolving(true);
    setError(undefined);
    resolveTimeout.current = setTimeout(async () => {
      try {
        const sym = await resolveTokenGateSymbol(tokenGate);
        setSymbol(sym);
      } catch {
        setError('Could not resolve token symbol');
      } finally {
        setResolving(false);
      }
    }, 800);
    return () => {
      if (resolveTimeout.current) clearTimeout(resolveTimeout.current);
    };
  }, [tokenGate]);

  return (
    <div className="compose-gate-config space-y-2 rounded-xl border border-[var(--color-border)] p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg)]">
        <input
          type="checkbox"
          checked={!!tokenGate}
          onChange={(e) =>
            onGateChange(
              e.target.checked
                ? { type: 'erc20', chain: 'base', contractAddress: '', minBalance: 0 }
                : null,
            )
          }
          className="checkbox"
        />
        Token-gate this post
      </label>
      {tokenGate && (
        <div className="space-y-2 pl-6">
          <div className="flex gap-2">
            <select
              value={tokenGate.chain}
              onChange={(e) =>
                onGateChange({ ...tokenGate, chain: e.target.value as TokenGateChain })
              }
              className="input text-sm flex-1"
            >
              {CHAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={tokenGate.contractAddress}
              onChange={(e) => onGateChange({ ...tokenGate, contractAddress: e.target.value })}
              placeholder="Contract address (0x...)"
              className="input text-sm flex-[2]"
            />
          </div>
          <input
            type="number"
            value={tokenGate.minBalance ?? ''}
            onChange={(e) =>
              onGateChange({
                ...tokenGate,
                minBalance: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="Minimum balance (e.g. 100)"
            className="input text-sm w-full"
          />
          <select
            value={tokenGate.type}
            onChange={(e) =>
              onGateChange({ ...tokenGate, type: e.target.value as TokenGate['type'] })
            }
            className="input text-sm w-full"
          >
            <option value="erc20">ERC-20 (Token)</option>
            <option value="erc721">ERC-721 (NFT)</option>
            <option value="erc1155">ERC-1155 (Multi Token)</option>
          </select>
          {resolving && (
            <p className="text-xs text-[var(--color-muted)]">Resolving token symbol...</p>
          )}
          {symbol && <p className="text-xs text-green-400">{symbol}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
