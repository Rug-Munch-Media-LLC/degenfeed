'use client';

/**
 * Tip system shared hook.
 * Re-exports from the canonical useTip hook and adds local state management
 * shared between TipButton and TipMenu.
 */

import { useCallback, useState } from 'react';
export type { TipMethod, TipIntent, TipState, TipPostContext } from '../../hooks/useTip';
export { useTip } from '../../hooks/useTip';

/** Steps for the TipButton's modal flow */
export type TipStep = 'select-amount' | 'add-message' | 'confirm' | 'sending' | 'sent';

export interface SmartChainOption {
  chain: string;
  rank: number;
  reason: string;
  route: {
    chain: string;
    currency: string;
    tokens: string[];
    avgFeeUsd: number;
    speed: string;
  };
}

export const FIAT_PRESETS = [
  { label: '$1', cryptoLabel: '0.0005 ETH', value: '1', usdEquivalent: 1 },
  { label: '$5', cryptoLabel: '0.0025 ETH', value: '5', usdEquivalent: 5 },
  { label: '$10', cryptoLabel: '0.005 ETH', value: '10', usdEquivalent: 10 },
  { label: '$25', cryptoLabel: '0.013 ETH', value: '25', usdEquivalent: 25 },
  { label: '$50', cryptoLabel: '0.026 ETH', value: '50', usdEquivalent: 50 },
];

export const SATS_PRESETS = [
  { label: '1K sats', cryptoLabel: '1,000 sats', value: '1000', usdEquivalent: 0.6 },
  { label: '5K sats', cryptoLabel: '5,000 sats', value: '5000', usdEquivalent: 3 },
  { label: '10K sats', cryptoLabel: '10,000 sats', value: '10000', usdEquivalent: 6 },
  { label: '50K sats', cryptoLabel: '50,000 sats', value: '50000', usdEquivalent: 30 },
  { label: '100K sats', cryptoLabel: '100,000 sats', value: '100000', usdEquivalent: 60 },
];

export const PROTOCOL_EMOJIS: Record<string, string> = {
  nostr: '⚡', farcaster: '◈', lens: '◎', bluesky: '☁️',
  mastodon: '🐘', peertube: '🎬', owncast: '📡', youtube: '▶',
  zora: '⧫', degenfeed: '◆',
};

export const CHAIN_ICONS: Record<string, string> = {
  lightning: '⚡', ethereum: '⟠', solana: '◎', base: '◈',
  polygon: '⬡', optimism: '⬠', arbitrum: '◆',
};

export const PROTOCOL_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  nostr: { bg: 'bg-purple-900/20', text: 'text-purple-400', border: 'border-purple-900/50' },
  farcaster: { bg: 'bg-indigo-900/20', text: 'text-indigo-400', border: 'border-indigo-900/50' },
  lens: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-900/50' },
};
