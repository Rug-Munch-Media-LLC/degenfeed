'use client';

import type { CreatorChain } from '@degenfeed/creator-coin/types';
import { useState } from 'react';

interface DeployCoinDialogProps {
  open: boolean;
  onClose: () => void;
  onDeploy: (config: {
    name: string;
    symbol: string;
    uri: string;
    chain: CreatorChain;
    creatorAllocationBps: number;
    creatorFeeBps: number;
    crossChain: boolean;
  }) => Promise<void>;
}

/**
 * DeployCoinDialog — modal for creating a new creator coin.
 * Shows fee breakdown, chain selection, and deployment options.
 */
export function DeployCoinDialog({ open, onClose, onDeploy }: DeployCoinDialogProps) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [uri, _setUri] = useState('');
  const [chain, setChain] = useState<CreatorChain>('solana');
  const [creatorAlloc, setCreatorAlloc] = useState(500);
  const [creatorFee, setCreatorFee] = useState(100);
  const [crossChain, setCrossChain] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleDeploy = async () => {
    setError('');
    if (!name || !symbol) {
      setError('Name and symbol are required');
      return;
    }
    if (symbol.length > 10) {
      setError('Symbol max 10 characters');
      return;
    }
    setDeploying(true);
    try {
      await onDeploy({
        name,
        symbol: symbol.toUpperCase(),
        uri: uri || `https://degenfeed.io/api/coins/${symbol.toLowerCase()}/metadata`,
        chain,
        creatorAllocationBps: creatorAlloc,
        creatorFeeBps: creatorFee,
        crossChain,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const estimatedCost =
    chain === 'solana' ? '$21 (~$20 fee + ~0.002 SOL gas)' : '$23 (~$20 fee + ~0.001 ETH gas)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Create Creator Coin</h2>
        <p className="text-sm text-gray-400 mb-6">
          Deploy your own coin with bonding curve economics
        </p>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              className="block text-sm font-medium text-gray-300 mb-1"
              htmlFor="field-746d4ac7"
            >
              Name
            </label>
            <input
              id="field-746d4ac7"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice Coin"
              className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-degen-500 focus:outline-none"
            />
          </div>

          {/* Symbol */}
          <div>
            <label
              className="block text-sm font-medium text-gray-300 mb-1"
              htmlFor="field-b7c2755b"
            >
              Symbol
            </label>
            <input
              id="field-b7c2755b"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="ALICE"
              maxLength={10}
              className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-degen-500 focus:outline-none uppercase"
            />
          </div>

          {/* Chain Selection */}
          <div>
            <span className="block text-sm font-medium text-gray-300 mb-2">Deploy On</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChain('solana')}
                className={`rounded-lg border p-3 text-left transition-all ${
                  chain === 'solana'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-white/10 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="text-sm font-bold">◎ Solana</div>
                <div className="text-xs opacity-70">$0.002 gas</div>
              </button>
              <button
                type="button"
                onClick={() => setChain('base')}
                className={`rounded-lg border p-3 text-left transition-all ${
                  chain === 'base'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-white/10 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="text-sm font-bold">⧫ Base</div>
                <div className="text-xs opacity-70">~$3 gas</div>
              </button>
            </div>
          </div>

          {/* Cross-Chain Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-gray-800 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-white">Auto-wrap to other chain</div>
              <div className="text-xs text-gray-400">
                {chain === 'solana'
                  ? 'Creates a wrapped ERC-20 on Base (Zora-visible)'
                  : 'Creates a wrapped SPL token on Solana'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCrossChain(!crossChain)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                crossChain ? 'bg-degen-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  crossChain ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Fee Sliders */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-medium text-gray-400 mb-1"
                htmlFor="field-4bfbf332"
              >
                Creator Allocation: {creatorAlloc / 100}%
              </label>
              <input
                id="field-4bfbf332"
                type="range"
                min={0}
                max={1500}
                step={100}
                value={creatorAlloc}
                onChange={(e) => setCreatorAlloc(Number(e.target.value))}
                className="w-full accent-degen-500"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium text-gray-400 mb-1"
                htmlFor="field-35e0abaa"
              >
                Creator Fee: {creatorFee / 100}%
              </label>
              <input
                id="field-35e0abaa"
                type="range"
                min={0}
                max={200}
                step={25}
                value={creatorFee}
                onChange={(e) => setCreatorFee(Number(e.target.value))}
                className="w-full accent-degen-500"
              />
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="rounded-lg bg-gray-800/50 p-3 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Estimated cost</span>
              <span className="text-white font-medium">{estimatedCost}</span>
            </div>
            <div className="mt-1 flex justify-between text-gray-500 text-xs">
              <span>Platform fee</span>
              <span>0.5% on trades</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleDeploy}
            disabled={deploying}
            className="w-full rounded-lg bg-gradient-to-r from-degen-500 to-purple-600 py-3 font-bold text-white transition-all hover:from-degen-400 hover:to-purple-500 disabled:opacity-50"
          >
            {deploying
              ? 'Deploying...'
              : `Create ${symbol || 'Coin'} on ${chain === 'solana' ? 'Solana' : 'Base'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
